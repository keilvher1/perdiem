/**
 * scripts/db-clean.ts — LEAD helper: back up the whole database, then remove dev/QA demo sets
 * before the evidence run. Never touches the chain; merchants are backed up, never deleted.
 *
 *   npx tsx --env-file=.env.local scripts/db-clean.ts --backup ~/perdiem-backups/ --suffix devbe1,qalv0928 --usage
 *       → backup + DRY RUN: prints what would be deleted, deletes nothing
 *   npx tsx --env-file=.env.local scripts/db-clean.ts --backup ~/perdiem-backups/ --suffix devbe1,qalv0928 --usage --apply
 *       → backup, then deletes
 *
 * (no npm script: package.json is frozen; the file imports no server-only module, so no --conditions flag)
 *
 *  --backup <path>   REQUIRED, always written first (dry run too): every row of mandates, merchants,
 *                    ledger_entries and usage_records as one JSON file. Refused when the path is
 *                    inside this repo or any of its git worktrees (symlinks resolved), and when the
 *                    file already exists. A directory (existing, or given with a trailing /) gets
 *                    perdiem-db-backup-<UTC timestamp>.json. Written 0600, re-read and counted.
 *  --suffix a,b      mandates whose id ends with exactly "_a" or "_b" (man_A_devbe1 matches devbe1;
 *                    man_A_devbe10 does not) plus every ledger entry of those mandates.
 *  --usage           all usage_records rows (the /metrics token table starts from zero).
 *  --apply           actually delete. Without it nothing is deleted.
 *
 * Only rows present in the backup are deleted (by id, in chunks): ledger_entries first, then
 * mandates (FK), then usage_records. A ledger entry written after the backup for a matched mandate
 * makes the mandate delete fail on the FK — nothing unbacked-up is lost; re-run.
 * Restore: insert the backup's tables in the order merchants, mandates, ledger_entries, usage_records.
 * Prints ids and counts only — never an env value or the Supabase URL.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ROOT = resolve(__dirname, "..");
const TABLES = ["mandates", "merchants", "ledger_entries", "usage_records"] as const;
type Table = (typeof TABLES)[number];
const PK: Record<Table, string> = { mandates: "id", merchants: "id", ledger_entries: "id", usage_records: "id" };
const PAGE = 1000; // PostgREST default max rows per request
const CHUNK = 100; // ids per delete request (keeps the URL short)

type Row = Record<string, unknown>;
interface Args {
  backup: string;
  suffixes: string[];
  usage: boolean;
  apply: boolean;
}

class UsageError extends Error {}

function parseArgs(argv: string[]): Args {
  let backup: string | undefined;
  let suffixes: string[] = [];
  let usage = false;
  let apply = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const [flag, inline] = a.includes("=") ? [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)] : [a, undefined];
    const value = () => {
      const v = inline ?? argv[++i];
      if (v === undefined || v.startsWith("--")) throw new UsageError(`${flag} needs a value`);
      return v;
    };
    if (flag === "--backup") backup = value();
    else if (flag === "--suffix") suffixes = value().split(",").map((s) => s.trim()).filter(Boolean);
    else if (flag === "--usage") usage = true;
    else if (flag === "--apply") apply = true;
    else throw new UsageError(`unknown argument ${a}`);
  }
  if (!backup) throw new UsageError("--backup <path outside the repo> is required");
  for (const s of suffixes) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(s)) throw new UsageError(`bad suffix "${s}" (letters, digits, _ and - only)`);
  }
  return { backup, suffixes: [...new Set(suffixes)], usage, apply };
}

// ---------------------------------------------------------------------------
// Backup path: outside every worktree of this repo
// ---------------------------------------------------------------------------

function expandHome(p: string): string {
  return p === "~" ? homedir() : p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;
}

/** realpath of the deepest existing ancestor + the rest, so /tmp → /private/tmp and symlinked dirs resolve. */
function realish(p: string): string {
  const rest: string[] = [];
  let cur = p;
  while (!existsSync(cur)) {
    const parent = dirname(cur);
    if (parent === cur) break;
    rest.unshift(basename(cur));
    cur = parent;
  }
  return join(realpathSync(cur), ...rest);
}

function repoRoots(): string[] {
  const roots = new Set<string>([realpathSync(ROOT)]);
  try {
    const out = execFileSync("git", ["-C", ROOT, "worktree", "list", "--porcelain"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    for (const line of out.split("\n")) {
      if (line.startsWith("worktree ")) {
        const p = line.slice("worktree ".length).trim();
        if (existsSync(p)) roots.add(realpathSync(p));
      }
    }
  } catch {
    // no git: the repo root alone
  }
  return [...roots];
}

function inside(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

/** Resolves --backup to a new file outside the repo, or throws. */
function backupTarget(raw: string, now: Date): string {
  let p = resolve(expandHome(raw));
  if (raw.endsWith("/") || (existsSync(p) && statSync(p).isDirectory())) p = join(p, `perdiem-db-backup-${stamp(now)}.json`);
  const real = realish(p);
  for (const root of repoRoots()) {
    if (inside(real, root)) throw new UsageError(`refusing --backup inside the repo (${root}): ${real}. Use a path outside it, e.g. ~/perdiem-backups/`);
  }
  if (existsSync(p)) throw new UsageError(`refusing to overwrite ${p}; pick a new file name or pass a directory`);
  return p;
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

function db(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new UsageError("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set: run with npx tsx --env-file=.env.local");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

/** Every row, paged by the exact count (works even if the project's max-rows is below PAGE). */
async function readAll(sb: SupabaseClient, table: Table): Promise<Row[]> {
  const rows: Row[] = [];
  let total = Infinity;
  while (rows.length < total) {
    const { data, error, count } = await sb
      .from(table)
      .select("*", { count: "exact" })
      .order(PK[table], { ascending: true })
      .range(rows.length, rows.length + PAGE - 1);
    if (error) throw new Error(`read ${table}: ${error.message}${error.code ? ` [${error.code}]` : ""}`);
    if (count === null) throw new Error(`read ${table}: no row count returned`);
    total = count;
    if (!data || data.length === 0) break;
    rows.push(...(data as Row[]));
  }
  if (rows.length !== total) throw new Error(`read ${table}: got ${rows.length} rows, the table reports ${total} (changed while reading? re-run)`);
  return rows;
}

async function deleteIds(sb: SupabaseClient, table: Table, ids: Array<string | number>): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { data, error } = await sb.from(table).delete().in(PK[table], chunk).select(PK[table]);
    if (error) throw new Error(`delete ${table}: ${error.message}${error.code ? ` [${error.code}]` : ""} (${deleted} of ${ids.length} deleted before this error)`);
    deleted += data?.length ?? 0;
  }
  return deleted;
}

// ---------------------------------------------------------------------------

function mandateSummary(m: Row, ledgerCount: number): string {
  const created = typeof m.created_at === "string" ? m.created_at.slice(0, 19) + "Z" : "?";
  return `  ${String(m.id).padEnd(24)} status ${String(m.status).padEnd(8)} anchor ${m.anchor_tx ? "yes" : "no "}  created ${created}  ledger entries ${ledgerCount}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const now = new Date();
  const target = backupTarget(args.backup, now); // before any DB access
  const sb = db();

  // (a) backup — always, dry run included
  const tables = {} as Record<Table, Row[]>;
  for (const t of TABLES) tables[t] = await readAll(sb, t);
  const counts = Object.fromEntries(TABLES.map((t) => [t, tables[t].length])) as Record<Table, number>;
  mkdirSync(dirname(target), { recursive: true });
  const payload = {
    kind: "perdiem-db-backup",
    createdAt: now.toISOString(),
    restoreOrder: ["merchants", "mandates", "ledger_entries", "usage_records"],
    counts,
    tables,
  };
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  const reread = JSON.parse(readFileSync(target, "utf8")) as typeof payload;
  for (const t of TABLES) {
    if (reread.tables[t]?.length !== counts[t]) throw new Error(`backup check failed for ${t}: wrote ${counts[t]}, read back ${reread.tables[t]?.length}`);
  }
  console.log(`backup: ${target}`);
  console.log(`  ${TABLES.map((t) => `${t} ${counts[t]}`).join(", ")} (re-read OK)`);

  // (b) plan
  const matched = tables.mandates.filter((m) => args.suffixes.some((s) => String(m.id).endsWith(`_${s}`)));
  const matchedIds = new Set(matched.map((m) => String(m.id)));
  const ledger = tables.ledger_entries.filter((e) => matchedIds.has(String(e.mandate_id)));
  const perMandate = (id: string) => ledger.filter((e) => e.mandate_id === id).length;
  const usage = args.usage ? tables.usage_records : [];
  const linkedUsage = tables.usage_records.filter((u) => matchedIds.has(String(u.mandate_id))).length;

  console.log(`\n${args.apply ? "DELETING" : "WOULD DELETE (dry run)"}:`);
  if (args.suffixes.length === 0) console.log("  mandates: none (no --suffix)");
  else {
    console.log(`  mandates matching ${args.suffixes.map((s) => `"_${s}"`).join(", ")}: ${matched.length}`);
    for (const m of matched) console.log(mandateSummary(m, perMandate(String(m.id))));
    for (const s of args.suffixes) if (!matched.some((m) => String(m.id).endsWith(`_${s}`))) console.log(`  (no mandate ends with "_${s}")`);
  }
  console.log(`  ledger_entries of those mandates: ${ledger.length}`);
  console.log(`  usage_records: ${args.usage ? `${usage.length} (all)` : `0 (no --usage; ${linkedUsage} of ${counts.usage_records} are linked to the matched mandates)`}`);
  const kept = tables.mandates.filter((m) => !matchedIds.has(String(m.id)));
  console.log(`KEPT: ${kept.length} mandate(s)${kept.length ? ": " + kept.map((m) => String(m.id)).join(", ") : ""}; merchants ${counts.merchants} (never deleted)`);

  if (matched.length === 0 && usage.length === 0) {
    console.log("\nNothing to delete.");
    return;
  }
  if (!args.apply) {
    console.log("\nDRY RUN: nothing was deleted. Re-run with --apply to delete (a fresh backup is written first).");
    return;
  }

  const delLedger = await deleteIds(sb, "ledger_entries", ledger.map((e) => String(e.id)));
  const delMandates = await deleteIds(sb, "mandates", matched.map((m) => String(m.id)));
  const delUsage = await deleteIds(sb, "usage_records", usage.map((u) => u.id as number));
  console.log(`\ndeleted: ledger_entries ${delLedger}, mandates ${delMandates}, usage_records ${delUsage}`);

  const left = await readAll(sb, "mandates");
  const still = left.filter((m) => matchedIds.has(String(m.id)));
  if (still.length > 0) throw new Error(`still present after delete: ${still.map((m) => String(m.id)).join(", ")}`);
  console.log(`now: ${left.length} mandate(s) left${left.length ? ": " + left.map((m) => String(m.id)).join(", ") : ""}`);
}

main().catch((e) => {
  console.error(e instanceof UsageError ? `db-clean: ${e.message}` : e instanceof Error ? `db-clean failed: ${e.message}` : e);
  process.exit(e instanceof UsageError ? 2 : 1);
});
