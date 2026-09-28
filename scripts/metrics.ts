/**
 * scripts/metrics.ts — turns the running app's usage numbers and the server log into evidence.
 *
 *   npm run dev 2>&1 | tee logs/dev-server.log     # (lead, evidence run) keep the server log
 *   npm run metrics                                 # BASE_URL default http://localhost:3000
 *
 * Inputs
 *   GET <BASE_URL>/api/usage                         tokens by flow, zero-token calls, energy, comparison
 *   logs/dev-server.log                              one JSON line per Kiln call (`"kind":"kiln"`, printed by
 *                                                    lib/kiln.ts chatWithUsage) and per decision (`"kind":"decision"`)
 *   docs/reasoning-comparison.kiln.jsonl             Kiln lines of the "compare" flow (scripts/compare-reasoning.ts
 *                                                    runs outside the server, so its calls are not in the server log)
 * Outputs (evidence/)
 *   metrics.md              by-flow table incl. 0-token rows, thinking on/off table, energy card text
 *   kiln-calls-by-flow.md   README proof: per flow — calls, response ids, tool calls, prompt/completion/cached/
 *                           reasoning tokens, cost; plus every call as a row
 *   06-kiln-calls.txt       every raw `"kind":"kiln"` line
 *   logs-stop.txt           every raw `"kind":"decision"` line (STOP and APPROVE), with a count header
 *   logs-status.txt         status timeline: every raw `"kind":"mandate_status"` line (printed by PATCH
 *                           /api/mandates/[id] on pause/resume/revoke) merged with every `"kind":"decision"`
 *                           line by their `at` field, with a header that counts both kinds. SERVER LOG LINES,
 *                           NOT HASHED RECORDS: no hash, anchor or verify.ts check covers them.
 *
 * Flags: --base-url <url> | --log <file> (repeatable; replaces the default server log) | --no-compare-log
 *        --logs-only (skip /api/usage) | --out-dir <dir, default evidence>
 * Exit 1 when /api/usage could not be read (the log-based files are still written).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ENDPOINTS, type FlowName, type ReasoningComparison, type UsageByFlowRow, type UsageResponse } from "../contracts/api";

// ---------- args ----------

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function args(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((a, i) => {
    if (a === `--${name}` && process.argv[i + 1]) out.push(process.argv[i + 1]!);
  });
  return out;
}
const BASE_URL = (arg("base-url") ?? process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const OUT_DIR = arg("out-dir") ?? "evidence";
const LOGS_ONLY = process.argv.includes("--logs-only");
const SERVER_LOGS = args("log").length ? args("log") : ["logs/dev-server.log"];
const COMPARE_LOG = process.argv.includes("--no-compare-log") ? null : "docs/reasoning-comparison.kiln.jsonl";

// ---------- log parsing ----------

interface KilnCall {
  source: string;
  line: number;
  raw: string;
  flow: string;
  id: string | null;
  model: string | null;
  toolCalls: Array<{ name: string; args?: string }>;
  finish: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number | null;
  reasoningTokens: number | null;
  costUsd: number | null;
}

interface RawKiln {
  kind: "kiln";
  flow?: string;
  id?: string | null;
  model?: string | null;
  tool_calls?: Array<{ name?: string; args?: string; type?: string }> | null;
  finish_reason?: string | null;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
    prompt_tokens_details?: { cached_tokens?: number } | null;
    completion_tokens_details?: { reasoning_tokens?: number } | null;
  } | null;
}

const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;

/** Pull the JSON object that starts at `{"kind":"<kind>"` out of a (possibly prefixed / colored) log line. */
function extractJson(line: string, kind: string): string | null {
  const clean = line.replace(ANSI, "");
  const at = clean.indexOf(`{"kind":"${kind}"`);
  if (at < 0) return null;
  const tail = clean.slice(at).trimEnd();
  // the object may be followed by other text on the same line: cut at the matching brace
  let depth = 0;
  let inStr = false;
  for (let i = 0; i < tail.length; i++) {
    const c = tail[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return tail.slice(0, i + 1);
  }
  return null;
}

function parseKilnLines(text: string, source: string): { calls: KilnCall[]; bad: number } {
  const calls: KilnCall[] = [];
  let bad = 0;
  text.split(/\r?\n/).forEach((line, idx) => {
    const json = extractJson(line, "kiln");
    if (!json) {
      if (line.includes('"kind":"kiln"')) bad++; // truncated / interleaved line
      return;
    }
    try {
      const o = JSON.parse(json) as RawKiln;
      const u = o.usage ?? {};
      calls.push({
        source,
        line: idx + 1,
        raw: json,
        flow: o.flow ?? "other",
        id: o.id ?? null,
        model: o.model ?? null,
        toolCalls: (o.tool_calls ?? []).map((t) => ({ name: t.name ?? t.type ?? "?", args: t.args })),
        finish: o.finish_reason ?? null,
        promptTokens: u.prompt_tokens ?? 0,
        completionTokens: u.completion_tokens ?? 0,
        totalTokens: u.total_tokens ?? 0,
        cachedTokens: u.prompt_tokens_details?.cached_tokens ?? null,
        reasoningTokens: u.completion_tokens_details?.reasoning_tokens ?? null,
        costUsd: typeof u.cost === "number" ? u.cost : null,
      });
    } catch {
      bad++;
    }
  });
  return { calls, bad };
}

function parseDecisionLines(text: string): { lines: string[]; stop: number; approve: number; bad: number } {
  const lines: string[] = [];
  let stop = 0;
  let approve = 0;
  let bad = 0;
  for (const line of text.split(/\r?\n/)) {
    const json = extractJson(line, "decision");
    if (!json) {
      if (line.includes('"kind":"decision"')) bad++;
      continue;
    }
    try {
      const o = JSON.parse(json) as { decision?: string; entry?: { decision?: string } };
      const d = o.decision ?? o.entry?.decision;
      if (d === "STOP") stop++;
      if (d === "APPROVE") approve++;
      lines.push(json);
    } catch {
      bad++;
    }
  }
  return { lines, stop, approve, bad };
}

interface TimelineLine {
  kind: "mandate_status" | "decision";
  raw: string;
  /** epoch ms of the `at` field, NaN when missing or unparseable */
  t: number;
  /** position across all server logs, for a stable order on equal / missing `at` */
  seq: number;
  noop: boolean;
  decision: string | null;
  codes: string[];
}

/** Every `mandate_status` and `decision` line of one log, in log order (verbatim JSON). */
function parseTimelineLines(text: string, seqStart: number): { lines: TimelineLine[]; bad: number } {
  const lines: TimelineLine[] = [];
  let bad = 0;
  let seq = seqStart;
  for (const line of text.split(/\r?\n/)) {
    for (const kind of ["mandate_status", "decision"] as const) {
      const json = extractJson(line, kind);
      if (!json) {
        if (line.includes(`"kind":"${kind}"`)) bad++;
        continue;
      }
      try {
        const o = JSON.parse(json) as { at?: unknown; from?: unknown; to?: unknown; decision?: unknown; codes?: unknown };
        lines.push({
          kind,
          raw: json,
          t: typeof o.at === "string" ? Date.parse(o.at) : NaN,
          seq: seq++,
          noop: kind === "mandate_status" && o.from === o.to,
          decision: typeof o.decision === "string" ? o.decision : null,
          codes: Array.isArray(o.codes) ? o.codes.filter((c): c is string => typeof c === "string") : [],
        });
      } catch {
        bad++;
      }
    }
  }
  return { lines, bad };
}

/** Sorted by `at` (ties and lines without a valid `at` keep their log order; the latter go last). */
function renderStatusTimeline(all: TimelineLine[], bad: number, generatedAt: string, logs: string[]): string {
  const sorted = [...all].sort((a, b) => {
    const an = Number.isNaN(a.t);
    const bn = Number.isNaN(b.t);
    if (an !== bn) return an ? 1 : -1;
    if (!an && a.t !== b.t) return a.t - b.t;
    return a.seq - b.seq;
  });
  const status = all.filter((l) => l.kind === "mandate_status");
  const decisions = all.filter((l) => l.kind === "decision");
  const stop = decisions.filter((l) => l.decision === "STOP").length;
  const approve = decisions.filter((l) => l.decision === "APPROVE").length;
  const notActive = decisions.filter((l) => l.codes.includes("MANDATE_NOT_ACTIVE")).length;
  const noAt = all.filter((l) => Number.isNaN(l.t)).length;
  const noop = status.filter((l) => l.noop).length;
  return (
    [
      `# PerDiem status timeline — ${all.length} server log line(s): ${status.length} mandate_status + ${decisions.length} decision`,
      `#   mandate_status: ${status.length} line(s) printed by PATCH /api/mandates/[id] (pause / resume / revoke)${noop ? `, of which ${noop} no-op (from == to, kept verbatim)` : ""}`,
      `#   decision:       ${decisions.length} line(s) printed by POST /api/chat — ${stop} STOP (${notActive} with MANDATE_NOT_ACTIVE), ${approve} APPROVE`,
      "# THESE ARE SERVER LOG LINES, NOT HASHED RECORDS. They are console output of the running app, copied verbatim;",
      "# no mandate hash, receipt hash, on-chain anchor or scripts/verify.ts check covers them. The hashed records show a",
      "# pause only indirectly, as MANDATE_NOT_ACTIVE STOP entries in the ledger.",
      `# extracted ${generatedAt} from ${logs.join(", ")} (lines containing "kind":"mandate_status" or "kind":"decision"),`,
      `# sorted by their "at" field; equal times keep log order${noAt ? `; ${noAt} line(s) without a valid "at" are listed last, in log order` : ""}${bad ? `; ${bad} unparseable line(s) skipped` : ""}`,
      ...sorted.map((l) => l.raw),
    ].join("\n") + "\n"
  );
}

// ---------- markdown ----------

const n0 = (x: number) => x.toLocaleString("en-US");
const usd = (x: number | null) => (x === null ? "—" : `$${x.toFixed(6)}`);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const esc = (s: string) => s.replace(/\|/g, "\\|");

function renderKilnByFlow(calls: KilnCall[], usage: UsageResponse | null, generatedAt: string, sources: string[]): string {
  const flows = [...new Set(calls.map((c) => c.flow))];
  const out: string[] = [];
  out.push("# Kiln API calls by flow");
  out.push("");
  out.push(`Generated ${generatedAt} by \`scripts/metrics.ts\` from ${sources.map((s) => `\`${s}\``).join(", ")}.`);
  out.push("Scope: only the calls in these log files (one server session plus the compare run). `/metrics` and `evidence/metrics.md` count every row in `usage_records`, i.e. every call ever recorded in the database, so their call counts are larger by design.");
  out.push("Every line comes from `lib/kiln.ts::chatWithUsage()`, which prints one JSON line per real call to Kiln (`https://api.bricksum.com/v1`, model `qwen3-32b`): the Kiln response id, the tool calls the model made, and the `usage` block Kiln returned. Raw lines: `evidence/06-kiln-calls.txt`.");
  out.push("");
  out.push("## Summary");
  out.push("");
  out.push("| Flow | Kiln calls | Tool calls | Prompt | Cached prompt | Completion | Reasoning | Total | Cost (USD) |");
  out.push("|---|---:|---|---:|---:|---:|---:|---:|---:|");
  for (const f of flows) {
    const cs = calls.filter((c) => c.flow === f);
    const names = new Map<string, number>();
    for (const c of cs) {
      if (c.toolCalls.length === 0) names.set("(none)", (names.get("(none)") ?? 0) + 1);
      for (const t of c.toolCalls) names.set(t.name, (names.get(t.name) ?? 0) + 1);
    }
    const tools = [...names].map(([k, v]) => `${k} ×${v}`).join(", ");
    const cached = cs.some((c) => c.cachedTokens !== null) ? n0(sum(cs.map((c) => c.cachedTokens ?? 0))) : "—";
    const reasoning = cs.some((c) => c.reasoningTokens !== null) ? n0(sum(cs.map((c) => c.reasoningTokens ?? 0))) : "—";
    const cost = cs.some((c) => c.costUsd !== null) ? usd(sum(cs.map((c) => c.costUsd ?? 0))) : "—";
    out.push(`| \`${f}\` | ${cs.length} | ${tools} | ${n0(sum(cs.map((c) => c.promptTokens)))} | ${cached} | ${n0(sum(cs.map((c) => c.completionTokens)))} | ${reasoning} | ${n0(sum(cs.map((c) => c.totalTokens)))} | ${cost} |`);
  }
  out.push(`| **all** | **${calls.length}** | | **${n0(sum(calls.map((c) => c.promptTokens)))}** | | **${n0(sum(calls.map((c) => c.completionTokens)))}** | | **${n0(sum(calls.map((c) => c.totalTokens)))}** | **${usd(sum(calls.map((c) => c.costUsd ?? 0)))}** |`);
  out.push("");
  if (usage) {
    const zero = usage.byFlow.filter((r) => r.totalTokens === 0 && r.calls > 0);
    const z = usage.zeroTokenCalls;
    out.push("Flows answered **without** calling the model (recorded as 0-token rows by `zeroUsage()`, so they appear in `/metrics` but never in the Kiln log; counts from `/api/usage`, i.e. all rows in `usage_records`, not only this log):");
    out.push("");
    out.push(`- \`status_fastpath\`: ${z.statusFastpath} request(s) answered from the ledger, 0 tokens`);
    out.push(`- \`stop_template\`: ${z.stopTemplate} refusal(s) explained from a template, 0 tokens`);
    for (const r of zero) if (r.flow !== "status_fastpath" && r.flow !== "stop_template") out.push(`- \`${r.flow}\`: ${r.calls} call(s), 0 tokens`);
    out.push("");
  }
  for (const f of flows) {
    const cs = calls.filter((c) => c.flow === f);
    out.push(`## Flow \`${f}\` — ${cs.length} call(s)`);
    out.push("");
    out.push("| # | Kiln response id | Tool call (arguments) | Finish | Prompt | Cached | Completion | Reasoning | Cost (USD) |");
    out.push("|---:|---|---|---|---:|---:|---:|---:|---:|");
    cs.forEach((c, i) => {
      const tool = c.toolCalls.length ? c.toolCalls.map((t) => `\`${t.name}\`${t.args ? ` \`${esc(t.args.replace(/\s+/g, " "))}\`` : ""}`).join("<br>") : "(no tool call)";
      out.push(`| ${i + 1} | \`${c.id ?? "—"}\` | ${tool} | ${c.finish ?? "—"} | ${c.promptTokens} | ${c.cachedTokens ?? "—"} | ${c.completionTokens} | ${c.reasoningTokens ?? "—"} | ${usd(c.costUsd)} |`);
    });
    out.push("");
  }
  if (calls.length === 0) out.push("_No `\"kind\":\"kiln\"` lines found. Start the server with `npm run dev 2>&1 | tee logs/dev-server.log` and run `npm run scenario` first._\n");
  return out.join("\n");
}

function withZeroRows(rows: UsageByFlowRow[], usage: UsageResponse): UsageByFlowRow[] {
  const out = [...rows];
  const ensure = (flow: FlowName, calls: number) => {
    if (!out.some((r) => r.flow === flow)) out.push({ flow, calls, promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0, avgLatencyMs: 0 });
  };
  ensure("status_fastpath", usage.zeroTokenCalls.statusFastpath);
  ensure("stop_template", usage.zeroTokenCalls.stopTemplate);
  const order: FlowName[] = ["propose", "status_fastpath", "stop_template", "compare", "explain", "audit", "other"];
  return out.sort((a, b) => order.indexOf(a.flow) - order.indexOf(b.flow));
}

const FLOW_NOTE: Partial<Record<FlowName, string>> = {
  propose: "one model call per purchase request",
  status_fastpath: "no model — answered from the ledger",
  stop_template: "no model — refusal templated from reasons",
  compare: "thinking on vs off script",
};

function renderComparison(c: ReasoningComparison | null): string {
  if (!c) return "_No comparison yet — run `npm run compare`._\n";
  const s = c.summary;
  const out: string[] = [];
  out.push(`Measured ${c.measuredAt} on \`${c.model}\`, same system prompt and tool as production; thinking off = user text + \` /no_think\`.`);
  out.push("");
  out.push("| Prompt | Tool call on / off | Completion on | Completion off | Latency on (ms) | Latency off (ms) | Cost on | Cost off |");
  out.push("|---|---|---:|---:|---:|---:|---:|---:|");
  for (const r of c.rows) {
    out.push(`| ${esc(r.prompt)} | ${r.thinkingOn.toolCall ? "✓" : "✗"} / ${r.thinkingOff.toolCall ? "✓" : "✗"} | ${r.thinkingOn.completionTokens} | ${r.thinkingOff.completionTokens} | ${r.thinkingOn.latencyMs} | ${r.thinkingOff.latencyMs} | ${usd(r.thinkingOn.costUsd)} | ${usd(r.thinkingOff.costUsd)} |`);
  }
  const costOn = sum(c.rows.map((r) => r.thinkingOn.costUsd ?? 0));
  const costOff = sum(c.rows.map((r) => r.thinkingOff.costUsd ?? 0));
  out.push(`| **Summary** | **${s.toolCallsOn}/${c.rows.length} / ${s.toolCallsOff}/${c.rows.length}** | **${s.avgCompletionOn}** | **${s.avgCompletionOff}** | **${s.avgLatencyOnMs}** | **${s.avgLatencyOffMs}** | **${usd(costOn)}** | **${usd(costOff)}** |`);
  out.push("");
  const costPct = costOn > 0 ? Math.round(((costOn - costOff) / costOn) * 1000) / 10 : 0;
  out.push(`Thinking off: completion tokens per proposal ${s.avgCompletionOn} → ${s.avgCompletionOff} (−${s.completionSavedPct}%), latency ${(s.avgLatencyOnMs / 1000).toFixed(1)} s → ${(s.avgLatencyOffMs / 1000).toFixed(1)} s, cost −${costPct}%, tool calls ${s.toolCallsOn}/${c.rows.length} → ${s.toolCallsOff}/${c.rows.length}.`);
  return out.join("\n") + "\n";
}

function energyText(u: UsageResponse): string {
  const e = u.energy;
  if (e.assumedJPerToken === null || e.totalWh === null) {
    return `Energy estimate: assumption not set — see README. Formula: energy_Wh = total_tokens × J_per_token ÷ 3600 (total_tokens so far: ${n0(e.totalTokens)}).`;
  }
  return `Energy estimate: ≈ ${e.totalWh.toPrecision(3)} Wh for ${n0(e.totalTokens)} tokens. Assumption: ${e.assumedJPerToken} J/token (source: ${e.source ?? "not stated"}). Formula: total_tokens × J_per_token ÷ 3600. Kiln does not report per-request energy; this is an estimate, not a measurement.`;
}

function renderMetrics(u: UsageResponse, comparison: ReasoningComparison | null, generatedAt: string, from: string): string {
  const rows = withZeroRows(u.byFlow, u);
  const out: string[] = [];
  out.push("# PerDiem — metrics");
  out.push("");
  out.push(`Generated ${generatedAt} by \`scripts/metrics.ts\` from \`${from}\` (all rows in \`usage_records\`).`);
  out.push("");
  out.push("Scope: every call ever recorded in this database (development, integration, evidence run, video takes), not one server session, so the call counts differ from `kiln-calls-by-flow.md` (built from the server log) by design. The `compare` flow appears here only if `npm run compare -- --save` was run.");
  out.push("");
  out.push("## Tokens by flow");
  out.push("");
  out.push("| Flow | What it is | Calls | Prompt | Completion | Total | Cost (USD) | Avg latency (ms) |");
  out.push("|---|---|---:|---:|---:|---:|---:|---:|");
  for (const r of rows) {
    out.push(`| \`${r.flow}\` | ${FLOW_NOTE[r.flow] ?? ""} | ${r.calls} | ${n0(r.promptTokens)} | ${n0(r.completionTokens)} | ${n0(r.totalTokens)} | ${usd(r.costUsd)} | ${r.totalTokens === 0 ? "—" : Math.round(r.avgLatencyMs)} |`);
  }
  const t = u.totals;
  out.push(`| **Total** | | **${t.calls}** | **${n0(t.promptTokens)}** | **${n0(t.completionTokens)}** | **${n0(t.totalTokens)}** | **${usd(t.costUsd)}** | |`);
  out.push("");
  out.push(`Inference avoided: ${u.zeroTokenCalls.statusFastpath} status question(s) and ${u.zeroTokenCalls.stopTemplate} refusal explanation(s) were handled with 0 tokens.`);
  out.push("");
  out.push("## Thinking on vs off (propose step)");
  out.push("");
  out.push(renderComparison(comparison));
  out.push("## Energy");
  out.push("");
  out.push(energyText(u));
  out.push("");
  return out.join("\n");
}

// ---------- main ----------

async function fetchUsage(): Promise<UsageResponse> {
  const res = await fetch(`${BASE_URL}${ENDPOINTS.usage}`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`GET ${ENDPOINTS.usage} → HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as UsageResponse;
}

async function main() {
  const generatedAt = new Date().toISOString();
  mkdirSync(OUT_DIR, { recursive: true });

  let usage: UsageResponse | null = null;
  let usageError: string | null = null;
  if (!LOGS_ONLY) {
    try {
      usage = await fetchUsage();
    } catch (e) {
      usageError = (e as Error).message;
      console.error(`! could not read ${BASE_URL}${ENDPOINTS.usage}: ${usageError}`);
    }
  }

  // Kiln + decision lines
  const sources = [...SERVER_LOGS, ...(COMPARE_LOG ? [COMPARE_LOG] : [])].filter((p) => {
    if (existsSync(p)) return true;
    console.error(`! log not found, skipped: ${p}`);
    return false;
  });
  const seen = new Set<string>();
  const calls: KilnCall[] = [];
  let bad = 0;
  const decisions = { lines: [] as string[], stop: 0, approve: 0, bad: 0 };
  const timeline: TimelineLine[] = [];
  let timelineBad = 0;
  const serverLogsRead: string[] = [];
  for (const p of sources) {
    const text = readFileSync(p, "utf8");
    const k = parseKilnLines(text, p);
    bad += k.bad;
    for (const c of k.calls) {
      const key = c.id ?? `${p}:${c.line}`;
      if (seen.has(key)) continue; // same call in two logs
      seen.add(key);
      calls.push(c);
    }
    if (p !== COMPARE_LOG) {
      const d = parseDecisionLines(text);
      decisions.lines.push(...d.lines);
      decisions.stop += d.stop;
      decisions.approve += d.approve;
      decisions.bad += d.bad;
      const tl = parseTimelineLines(text, timeline.length);
      timeline.push(...tl.lines);
      timelineBad += tl.bad;
      serverLogsRead.push(p);
    }
  }

  writeFileSync(join(OUT_DIR, "06-kiln-calls.txt"), calls.map((c) => c.raw).join("\n") + (calls.length ? "\n" : ""));
  writeFileSync(join(OUT_DIR, "kiln-calls-by-flow.md"), renderKilnByFlow(calls, usage, generatedAt, sources));
  writeFileSync(
    join(OUT_DIR, "logs-stop.txt"),
    [
      `# PerDiem decision log — ${decisions.lines.length} decision(s): ${decisions.stop} STOP, ${decisions.approve} APPROVE`,
      `# extracted ${generatedAt} from ${SERVER_LOGS.join(", ")} (lines containing "kind":"decision")`,
      ...decisions.lines,
    ].join("\n") + "\n",
  );

  writeFileSync(join(OUT_DIR, "logs-status.txt"), renderStatusTimeline(timeline, timelineBad, generatedAt, serverLogsRead.length ? serverLogsRead : SERVER_LOGS));

  let comparison: ReasoningComparison | null = usage?.comparison ?? null;
  if (!comparison && existsSync("docs/reasoning-comparison.json")) {
    comparison = JSON.parse(readFileSync("docs/reasoning-comparison.json", "utf8")) as ReasoningComparison;
  }
  if (usage) writeFileSync(join(OUT_DIR, "metrics.md"), renderMetrics(usage, comparison, generatedAt, `${BASE_URL}${ENDPOINTS.usage}`));

  const flows = [...new Set(calls.map((c) => c.flow))].map((f) => `${f}=${calls.filter((c) => c.flow === f).length}`).join(" ");
  console.log(`Kiln calls: ${calls.length} (${flows || "none"})${bad ? `, ${bad} unparseable line(s)` : ""}`);
  console.log(`Decisions: ${decisions.lines.length} (${decisions.stop} STOP, ${decisions.approve} APPROVE)${decisions.bad ? `, ${decisions.bad} unparseable` : ""}`);
  const statusLines = timeline.filter((l) => l.kind === "mandate_status").length;
  console.log(`Status timeline: ${statusLines} mandate_status + ${timeline.length - statusLines} decision line(s)${timelineBad ? `, ${timelineBad} unparseable` : ""}`);
  console.log(`Wrote ${OUT_DIR}/06-kiln-calls.txt, ${OUT_DIR}/kiln-calls-by-flow.md, ${OUT_DIR}/logs-stop.txt, ${OUT_DIR}/logs-status.txt${usage ? `, ${OUT_DIR}/metrics.md` : " (metrics.md skipped)"}`);
  if (usage) console.log(energyText(usage));
  if (usageError) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
