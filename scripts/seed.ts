/**
 * scripts/seed.ts — create a fresh demo set (mandates A, B, C) from docs/seed.json.
 *
 *   npm run seed                              # suffix = Date.now().toString(36), anchors ON
 *   npm run seed -- --suffix take2            # ids man_A_take2, man_B_take2, man_C_take2
 *   npm run seed -- --no-anchor               # no Sepolia tx (development only; audit will show no anchor)
 *   npm run seed -- --window now              # A/B valid from now-1h to now+48h
 *   npm run seed -- --window event            # A/B keep the fixed seed.json window
 *
 * Window (A and B): default = "event" while now is inside the seed.json window, otherwise "now".
 * C always keeps its past window so it stays EXPIRED.
 *
 * Steps: dbProbe → upsert merchants → per mandate: mandateHash → anchorMandate (broadcast only,
 * never waits) → createMandate → evidence/seed-latest.json { A, B, C, anchors, at }.
 * Each anchor is a 0-value self-transfer: it costs gas (test ETH). Re-use a set instead of
 * re-seeding when debugging, or pass --no-anchor.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Hex } from "viem";
import { mandateHash, type Mandate, type Merchant } from "../lib/policy";
import { agentAccount, anchorMandate, explorerTxUrl } from "../lib/chain";
import { createMandate, dbProbe, getMandate, upsertMerchants } from "../lib/db";

type Key = "A" | "B" | "C";
type WindowMode = "event" | "now";

interface SeedFile {
  agentAddress: Hex;
  merchants: Merchant[];
  mandates: Mandate[];
}

interface Args {
  suffix: string;
  anchor: boolean;
  window: WindowMode | "auto";
}

const ROOT = resolve(__dirname, "..");
const HOUR = 60 * 60 * 1000;

function parseArgs(argv: string[]): Args {
  const args: Args = { suffix: Date.now().toString(36), anchor: true, window: "auto" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const [flag, inline] = a.includes("=") ? [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)] : [a, undefined];
    const value = () => {
      const v = inline ?? argv[++i];
      if (v === undefined || v.startsWith("--")) throw new Error(`${flag} needs a value`);
      return v;
    };
    if (flag === "--suffix") args.suffix = value();
    else if (flag === "--no-anchor") args.anchor = false;
    else if (flag === "--window") {
      const w = value();
      if (w !== "event" && w !== "now") throw new Error(`--window must be "event" or "now" (got "${w}")`);
      args.window = w;
    } else throw new Error(`unknown argument ${a} (use --suffix <s>, --no-anchor, --window event|now)`);
  }
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(args.suffix)) throw new Error(`--suffix must match [A-Za-z0-9_-]{1,32} (got "${args.suffix}")`);
  return args;
}

function keyOf(seedId: string): Key {
  const k = seedId.replace(/^man_/, "");
  if (k !== "A" && k !== "B" && k !== "C") throw new Error(`unexpected mandate id in seed.json: ${seedId}`);
  return k;
}

function minute(d: Date): string {
  return new Date(Math.floor(d.getTime() / 60_000) * 60_000).toISOString();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const seed = JSON.parse(readFileSync(resolve(ROOT, "docs/seed.json"), "utf8")) as SeedFile;
  const now = new Date();

  // 0. Database reachable? (fast, no retries)
  const probe = await dbProbe();
  console.log(`db ok (${probe.latencyMs} ms, ${probe.mandates} mandates so far)`);
  if (!probe.responseIdColumn) {
    console.warn("warning: usage_records.response_id is missing — apply migration usage_response_id from docs/schema.sql");
  }

  // 1. Agent wallet: the env wallet is the one that signs; the mandate must name it.
  let envWallet: Hex | null = null;
  try {
    envWallet = agentAccount().address;
  } catch (err) {
    if (args.anchor) throw err;
    console.warn(`warning: ${(err as Error).message}; keeping seed.json agentAddress (--no-anchor)`);
  }

  // 2. Window for A/B.
  const seedA = seed.mandates.find((m) => keyOf(m.id) === "A");
  if (!seedA) throw new Error("seed.json has no man_A");
  const eventStart = new Date(seedA.startsAt);
  const eventEnd = new Date(seedA.expiresAt);
  const insideEvent = now >= eventStart && now < eventEnd;
  const mode: WindowMode = args.window === "auto" ? (insideEvent ? "event" : "now") : args.window;
  const nowWindow = { startsAt: minute(new Date(now.getTime() - HOUR)), expiresAt: minute(new Date(now.getTime() + 48 * HOUR)) };
  if (mode === "event") {
    console.log(
      `window: event — A/B keep seed.json ${seedA.startsAt} → ${seedA.expiresAt}` +
        (args.window === "auto" ? " (now is inside it)" : " (forced)") +
        (insideEvent ? "" : " — WARNING: now is outside this window, A/B will STOP with BEFORE_START/EXPIRED"),
    );
  } else {
    console.log(
      `window: now — A/B ${nowWindow.startsAt} → ${nowWindow.expiresAt}` +
        (args.window === "auto" ? " (now is outside the seed.json window)" : " (forced)"),
    );
  }
  console.log("window: C keeps its past window (stays EXPIRED)");

  // 3. Merchants.
  await upsertMerchants(seed.merchants);
  console.log(`merchants upserted: ${seed.merchants.map((m) => m.id).join(", ")}`);

  // 4. Build the three mandates and refuse to overwrite (checked BEFORE spending gas).
  const built = seed.mandates.map((s) => {
    const key = keyOf(s.id);
    let agentWallet = s.agentWallet;
    if (envWallet && agentWallet.toLowerCase() !== envWallet.toLowerCase()) {
      console.warn(`warning: ${s.id}.agentWallet ${agentWallet} != env wallet ${envWallet}; using the env wallet`);
      agentWallet = envWallet;
    }
    const window = key === "C" || mode === "event" ? { startsAt: s.startsAt, expiresAt: s.expiresAt } : nowWindow;
    const mandate: Mandate = {
      id: `${s.id}_${args.suffix}`,
      principal: s.principal,
      traveler: s.traveler,
      agentWallet,
      budgetUsd: s.budgetUsd,
      perTxCapUsd: s.perTxCapUsd,
      allowedMerchantIds: [...s.allowedMerchantIds],
      allowedCategories: [...s.allowedCategories],
      blockedKeywords: [...s.blockedKeywords],
      startsAt: window.startsAt,
      expiresAt: window.expiresAt,
      catalog: s.catalog.map((c) => ({ id: c.id, name: c.name, category: c.category, wallet: c.wallet })),
      status: "active",
    };
    return { key, mandate, hash: mandateHash(mandate) };
  });
  for (const b of built) {
    if (await getMandate(b.mandate.id)) throw new Error(`${b.mandate.id} already exists — pick another --suffix`);
  }

  // 5. Anchor (broadcast only) + save, one mandate at a time (the nonce manager serializes sends).
  const ids = {} as Record<Key, string>;
  const hashes = {} as Record<Key, Hex>;
  const anchors = {} as Record<Key, { txHash: Hex; explorerUrl: string } | null>;
  for (const b of built) {
    let anchor: { txHash: Hex; explorerUrl: string } | null = null;
    if (args.anchor) {
      anchor = await anchorMandate(b.hash);
      console.log(`${b.key} anchor broadcast ${anchor.txHash}`);
    }
    try {
      await createMandate(b.mandate, b.hash, anchor?.txHash ?? null);
    } catch (err) {
      if (anchor) console.error(`${b.key}: anchor ${anchor.txHash} was broadcast but the mandate was not saved`);
      throw err;
    }
    ids[b.key] = b.mandate.id;
    hashes[b.key] = b.hash;
    anchors[b.key] = anchor;
  }

  // 6. Evidence for scripts/scenario.ts and the README.
  const out = {
    A: ids.A,
    B: ids.B,
    C: ids.C,
    anchors,
    hashes,
    window: mode,
    suffix: args.suffix,
    agentWallet: envWallet ?? seed.agentAddress,
    at: new Date().toISOString(),
  };
  mkdirSync(resolve(ROOT, "evidence"), { recursive: true });
  writeFileSync(resolve(ROOT, "evidence/seed-latest.json"), `${JSON.stringify(out, null, 2)}\n`);

  console.log("");
  for (const b of built) {
    const a = anchors[b.key];
    console.log(
      `${b.key}  ${b.mandate.id.padEnd(22)} $${String(b.mandate.budgetUsd).padStart(3)}  ${b.mandate.startsAt} → ${b.mandate.expiresAt}  hash ${b.hash}`,
    );
    console.log(`   anchor ${a ? explorerTxUrl(a.txHash) : "(none: --no-anchor)"}`);
  }
  console.log(`\nwrote evidence/seed-latest.json (A=${ids.A}, B=${ids.B}, C=${ids.C})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
