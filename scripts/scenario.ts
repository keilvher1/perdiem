/**
 * scripts/scenario.ts — runs the 8 scripted demo requests (contracts/api.ts DEMO_SCRIPT 0–7) in
 * order against a RUNNING PerDiem server and saves everything as evidence.
 *
 *   npm run scenario                                        # ids from evidence/seed-latest.json
 *   npm run scenario -- --mandates man_A_x,man_B_x,man_C_x  # explicit A,B,C ids
 *   BASE_URL=http://localhost:3200 npm run scenario         # default http://localhost:3000
 *
 * Flags: --mandates A,B,C | --base-url <url> | --poll-ms <ms, default 6000> | --polls <n, default 20>
 *        --out-dir <dir, default evidence> | --no-confirm (do not wait for settlement)
 *
 * What it does (PRD §7):
 *   0–3 POST /api/chat on A, A, A, B; PATCH A → paused before #4; #4 on A; #5 on C;
 *   PATCH A → active before #6; #6 on A; #7 status question on A (0 tokens, entry null).
 *   Every APPROVE is confirmed by polling GET /api/ledger/<id>/confirm every 6 s, up to 20 times.
 * Output: evidence/scenario-<YYYYMMDD-HHmm>.json (every request and full response) and a console
 * table n | mandate | decision | codes | txHash | tokens. Exit 1 when any run differs from `expect`.
 * If the Pause (before #4) or Resume (before #6) PATCH fails, the run stops right there — #4 would
 * otherwise be a real payment on a still-active mandate — and the report records `aborted`.
 *
 * COST: runs 0 and 6 are real Sepolia payments made by the server (~$17 of test ETH at the demo
 * rate). Run it once per fresh seed; a rerun within 5 minutes trips DUPLICATE by design.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  DEMO_SCRIPT,
  ENDPOINTS,
  type ApiError,
  type ChatRequest,
  type ChatResponse,
  type ConfirmResponse,
  type MandateStatus,
  type SettlementStatus,
  type UpdateMandateStatusRequest,
  type UpdateMandateStatusResponse,
} from "../contracts/api";

type Key = "A" | "B" | "C";
type Expected = { kind: "APPROVE" } | { kind: "STOP"; codes: string[] } | { kind: "FASTPATH" };

interface HttpResult<T> {
  method: string;
  path: string;
  body?: unknown;
  status: number;
  ms: number;
  response: T | ApiError | null;
  error?: string;
}

interface StepRecord {
  n: number;
  mandateKey: Key;
  mandateId: string;
  text: string;
  expect: string;
  statusChange: HttpResult<UpdateMandateStatusResponse> | null;
  chat: HttpResult<ChatResponse>;
  confirms: Array<{ attempt: number; status: number; state: SettlementStatus["state"] | "error"; at: string }>;
  finalConfirm: HttpResult<ConfirmResponse> | null;
  actual: { decision: "APPROVE" | "STOP" | "NONE" | "ERROR"; codes: string[]; txHash: string | null; settlement: string | null; tokens: number; flows: string[] };
  match: boolean;
  why: string;
}

// ---------- args ----------

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const BASE_URL = (arg("base-url") ?? process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const POLL_MS = Number(arg("poll-ms") ?? 6000);
const POLLS = Number(arg("polls") ?? 20);
const OUT_DIR = arg("out-dir") ?? "evidence";
const NO_CONFIRM = flag("no-confirm");

const color = process.stdout.isTTY;
const red = (s: string) => (color ? `\x1b[31m${s}\x1b[0m` : s);
const green = (s: string) => (color ? `\x1b[32m${s}\x1b[0m` : s);
const dim = (s: string) => (color ? `\x1b[2m${s}\x1b[0m` : s);

function idOf(v: unknown): string | null {
  if (typeof v === "string" && v) return v;
  if (v && typeof v === "object" && typeof (v as { id?: unknown }).id === "string") return (v as { id: string }).id;
  return null;
}

function loadMandates(): { ids: Record<Key, string>; source: string } {
  const explicit = arg("mandates");
  if (explicit) {
    const [A, B, C] = explicit.split(",").map((s) => s.trim());
    if (!A || !B || !C) throw new Error("--mandates needs three comma-separated ids: A,B,C");
    return { ids: { A, B, C }, source: "--mandates" };
  }
  const path = join(OUT_DIR, "seed-latest.json");
  if (!existsSync(path)) throw new Error(`${path} not found — run \`npm run seed\` first or pass --mandates A,B,C`);
  const seed = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const A = idOf(seed.A);
  const B = idOf(seed.B);
  const C = idOf(seed.C);
  if (!A || !B || !C) throw new Error(`${path} must contain A, B and C mandate ids`);
  return { ids: { A, B, C }, source: path };
}

// ---------- http ----------

async function http<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<HttpResult<T>> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
    const text = await res.text();
    let json: T | ApiError | null = null;
    try {
      json = text ? (JSON.parse(text) as T | ApiError) : null;
    } catch {
      json = { error: { code: `HTTP_${res.status}`, message: text.slice(0, 300) } };
    }
    return { method, path, body, status: res.status, ms: Date.now() - t0, response: json };
  } catch (e) {
    return { method, path, body, status: 0, ms: Date.now() - t0, response: null, error: (e as Error).message };
  }
}

const isOk = (r: HttpResult<unknown>) => r.status >= 200 && r.status < 300 && r.response !== null && !("error" in (r.response as object));

function failure(r: HttpResult<unknown>): string {
  const api = r.response && typeof r.response === "object" && "error" in r.response ? (r.response as ApiError).error : null;
  const detail = r.error ?? (api ? `${api.code}: ${api.message}` : "");
  return `HTTP ${r.status}${detail ? " " + detail : ""}`;
}

async function setStatus(id: string, status: MandateStatus): Promise<HttpResult<UpdateMandateStatusResponse>> {
  const body: UpdateMandateStatusRequest = { status };
  const r = await http<UpdateMandateStatusResponse>("PATCH", ENDPOINTS.mandate(id), body);
  console.log(dim(`   PATCH ${ENDPOINTS.mandate(id)} {status:"${status}"} → ${r.status}${r.error ? " " + r.error : ""}`));
  return r;
}

// ---------- expectations ----------

function parseExpect(expect: string): Expected {
  const clean = expect.replace(/\s*\(.*\)\s*$/, "").trim();
  if (clean.startsWith("status_fastpath")) return { kind: "FASTPATH" };
  if (clean.startsWith("STOP:")) return { kind: "STOP", codes: clean.slice(5).split(",").map((s) => s.trim()).filter(Boolean) };
  if (clean === "APPROVE") return { kind: "APPROVE" };
  throw new Error(`cannot parse expect "${expect}"`);
}

function sameSet(a: string[], b: string[]): boolean {
  const x = [...new Set(a)].sort();
  const y = [...new Set(b)].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

function check(exp: Expected, step: StepRecord): { match: boolean; why: string } {
  const a = step.actual;
  if (a.decision === "ERROR") return { match: false, why: `chat failed: HTTP ${step.chat.status} ${step.chat.error ?? JSON.stringify(step.chat.response).slice(0, 160)}` };
  if (exp.kind === "FASTPATH") {
    const r = step.chat.response as ChatResponse;
    const ok = r.entry === null && a.flows.includes("status_fastpath") && a.tokens === 0;
    return { match: ok, why: ok ? "entry null, status_fastpath, 0 tokens" : `expected entry null + status_fastpath + 0 tokens, got decision ${a.decision}, flows [${a.flows}], ${a.tokens} tokens` };
  }
  if (exp.kind === "STOP") {
    const ok = a.decision === "STOP" && sameSet(exp.codes, a.codes);
    return { match: ok, why: ok ? `STOP ${a.codes.join(",")}` : `expected STOP [${exp.codes}], got ${a.decision} [${a.codes}]` };
  }
  if (a.decision !== "APPROVE") return { match: false, why: `expected APPROVE, got ${a.decision} [${a.codes}]` };
  if (!a.txHash) return { match: false, why: "APPROVE without txHash (broadcast failed?)" };
  if (NO_CONFIRM) return { match: true, why: "APPROVE (settlement not awaited: --no-confirm)" };
  return a.settlement === "settled" ? { match: true, why: "APPROVE, settled" } : { match: false, why: `APPROVE but settlement is ${a.settlement ?? "unknown"} after ${POLLS} polls` };
}

// ---------- main ----------

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function pad(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n);
}

async function main() {
  const { ids, source } = loadMandates();
  const startedAt = new Date();
  console.log(`PerDiem scenario → ${BASE_URL}  (mandates from ${source})`);
  console.log(`  A=${ids.A}  B=${ids.B}  C=${ids.C}\n`);

  const steps: StepRecord[] = [];
  let pausedA = false;
  let aborted: { beforeStep: number; reason: string; statusChange: HttpResult<UpdateMandateStatusResponse> } | null = null;
  try {
    for (const s of DEMO_SCRIPT) {
      const key = s.mandateId.slice(-1) as Key;
      const mandateId = ids[key];
      let statusChange: StepRecord["statusChange"] = null;
      if (s.n === 4) {
        // Mark first: if the PATCH failed after the server paused A (e.g. a timeout), `finally` still resumes it.
        pausedA = true;
        statusChange = await setStatus(ids.A, "paused");
        if (!isOk(statusChange)) {
          // Never send #4 to a mandate that may still be active: it would be APPROVEd and paid for real,
          // and #6 would then stop as DUPLICATE.
          aborted = { beforeStep: 4, reason: `PATCH pause failed (${failure(statusChange)}); aborted before sending #4`, statusChange };
          break;
        }
      }
      if (s.n === 6) {
        statusChange = await setStatus(ids.A, "active");
        if (!isOk(statusChange)) {
          aborted = { beforeStep: 6, reason: `PATCH resume failed (${failure(statusChange)}); aborted before sending #6`, statusChange };
          break;
        }
        pausedA = false;
      }

      const req: ChatRequest = { mandateId, text: s.text };
      console.log(`#${s.n} [${key}] "${s.text}"`);
      const chat = await http<ChatResponse>("POST", ENDPOINTS.chat, req);
      const step: StepRecord = {
        n: s.n,
        mandateKey: key,
        mandateId,
        text: s.text,
        expect: s.expect,
        statusChange,
        chat,
        confirms: [],
        finalConfirm: null,
        actual: { decision: "ERROR", codes: [], txHash: null, settlement: null, tokens: 0, flows: [] },
        match: false,
        why: "",
      };

      if (isOk(chat)) {
        const r = chat.response as ChatResponse;
        const e = r.entry;
        step.actual = {
          decision: e ? e.decision : "NONE",
          codes: e ? e.reasons.map((x) => x.code) : [],
          txHash: e?.txHash ?? null,
          settlement: e ? e.status : null,
          tokens: r.usage.reduce((t, u) => t + u.totalTokens, 0),
          flows: r.usage.map((u) => u.flow),
        };
        // Wait for settlement of approved payments (two-step settlement, CLAUDE.md #7).
        if (e && e.decision === "APPROVE" && e.txHash && !NO_CONFIRM) {
          for (let i = 1; i <= POLLS; i++) {
            await new Promise((res) => setTimeout(res, POLL_MS));
            const c = await http<ConfirmResponse>("GET", ENDPOINTS.confirm(e.id));
            const state = isOk(c) ? (c.response as ConfirmResponse).settlement.state : "error";
            step.confirms.push({ attempt: i, status: c.status, state, at: new Date().toISOString() });
            step.finalConfirm = c;
            console.log(dim(`   confirm ${i}/${POLLS}: ${state}`));
            if (state === "settled" || state === "failed") {
              step.actual.settlement = state;
              break;
            }
          }
        }
      }

      const verdict = check(parseExpect(s.expect), step);
      step.match = verdict.match;
      step.why = verdict.why;
      console.log(`   ${step.match ? green("✓") : red("✗")} ${step.why}`);
      steps.push(step);
    }
  } finally {
    // Never leave mandate A paused if a run crashed or aborted between #4 and #6.
    if (pausedA) {
      const resumed = await setStatus(ids.A, "active");
      if (!isOk(resumed)) console.error(red(`! could not resume ${ids.A} (${failure(resumed)}) — resume it on /principal`));
    }
  }

  const finishedAt = new Date();
  const matched = steps.filter((x) => x.match).length;
  const report = {
    kind: "perdiem-scenario",
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    baseUrl: BASE_URL,
    mandates: ids,
    mandatesSource: source,
    confirm: NO_CONFIRM ? "skipped" : { pollMs: POLL_MS, maxPolls: POLLS },
    summary: { total: steps.length, matched, mismatched: steps.length - matched },
    aborted,
    steps,
  };
  mkdirSync(OUT_DIR, { recursive: true });
  // Never overwrite earlier evidence: two runs in the same minute get -2, -3, … suffixes.
  let out = join(OUT_DIR, `scenario-${stamp(startedAt)}.json`);
  for (let i = 2; existsSync(out); i++) out = join(OUT_DIR, `scenario-${stamp(startedAt)}-${i}.json`);
  writeFileSync(out, JSON.stringify(report, null, 2) + "\n");

  console.log(`\n${pad("n", 3)}${pad("mandate", 22)}${pad("decision", 10)}${pad("codes", 58)}${pad("txHash", 16)}${pad("tokens", 7)}ok`);
  for (const x of steps) {
    const tx = x.actual.txHash ? `${x.actual.txHash.slice(0, 8)}…${x.actual.txHash.slice(-4)}` : "—";
    const line = `${pad(String(x.n), 3)}${pad(x.mandateId, 22)}${pad(x.actual.decision, 10)}${pad(x.actual.codes.join(",") || "—", 58)}${pad(tx, 16)}${pad(String(x.actual.tokens), 7)}${x.match ? "✓" : "✗"}`;
    console.log(x.match ? line : red(line));
  }
  console.log(`\n${matched}/${steps.length} runs match the expected outcome. Saved ${out}`);
  if (aborted) {
    console.error(red(`ABORTED before #${aborted.beforeStep}: ${aborted.reason}`));
    process.exit(1);
  }
  if (matched !== steps.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
