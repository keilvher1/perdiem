/**
 * scripts/compare-reasoning.ts — measures what Qwen3's thinking costs on the propose step.
 *
 *   npm run compare              # 10 Kiln calls (5 prompts × thinking on/off) → docs/reasoning-comparison.json
 *   npm run compare -- --save    # also stores each call in usage_records (flow "compare"; needs lib/db.ts)
 *
 * Same request the app sends (lib/agent.ts): systemPrompt(mandate A from docs/seed.json),
 * tools=[proposePaymentTool], tool_choice auto, reasoning_effort low, max_tokens 300, temperature 0.2.
 *   thinking ON  = the traveler's text as is
 *   thinking OFF = the text + " /no_think"   (Qwen3 soft switch; what production uses, KILN_NO_THINK=1)
 * Prompts: the purchase requests of contracts/api.ts DEMO_SCRIPT #0, #1, #2, #3, #6.
 * On/off order alternates per prompt so prompt caching does not favour one side.
 *
 * Writes:
 *   docs/reasoning-comparison.json        contracts/api.ts ReasoningComparison (read by GET /api/usage)
 *   docs/reasoning-comparison.kiln.jsonl  the raw `"kind":"kiln"` line of every call (response ids =
 *                                         proof of real calls; scripts/metrics.ts folds it into the
 *                                         per-flow Kiln log)
 * Flags: --save | --max-tokens <n, default 300> | --out <path> | --log-out <path>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { DEMO_SCRIPT, type ReasoningComparison, type ReasoningComparisonRow } from "../contracts/api";
import { chatWithUsage, extractToolCall, proposePaymentTool, KILN_MODEL, type UsageRecord } from "../lib/kiln";
import { systemPrompt } from "../lib/agent";
import type { Mandate } from "../lib/policy";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const SAVE = process.argv.includes("--save");
const MAX_TOKENS = Number(arg("max-tokens") ?? 300);
const OUT = arg("out") ?? "docs/reasoning-comparison.json";
const LOG_OUT = arg("log-out") ?? "docs/reasoning-comparison.kiln.jsonl";
const PROMPT_NS = [0, 1, 2, 3, 6];

type Side = ReasoningComparisonRow["thinkingOn"];
interface KilnLine {
  kind: "kiln";
  id?: string;
  finish_reason?: string;
  usage?: { completion_tokens_details?: { reasoning_tokens?: number } | null; prompt_tokens_details?: { cached_tokens?: number } | null };
}

// chatWithUsage prints one `{"kind":"kiln",…}` JSON line per call. Capture those lines instead of
// echoing them, so they can be saved as the call log of the "compare" flow.
const kilnLines: string[] = [];
const origLog = console.log;
console.log = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].startsWith('{"kind":"kiln"')) {
    kilnLines.push(args[0]);
    return;
  }
  origLog(...args);
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const r1 = (x: number) => Math.round(x * 10) / 10;

async function main() {
  const seed = JSON.parse(readFileSync("docs/seed.json", "utf8")) as { mandates: Mandate[] };
  const mandate = seed.mandates.find((m) => m.id === "man_A");
  if (!mandate) throw new Error("docs/seed.json has no man_A");
  const system = systemPrompt(mandate);
  const saveUsage = SAVE ? (await import("../lib/db")).saveUsage : null;

  const prompts = PROMPT_NS.map((n) => {
    const s = DEMO_SCRIPT.find((x) => x.n === n);
    if (!s) throw new Error(`DEMO_SCRIPT has no #${n}`);
    return s.text;
  });

  const usages: UsageRecord[] = [];
  const extra: Array<{ prompt: string; side: "on" | "off"; reasoningTokens: number | null; cachedTokens: number | null; finish: string | null; responseId: string | null }> = [];

  async function measure(prompt: string, thinking: boolean): Promise<Side> {
    const before = kilnLines.length;
    const r = await chatWithUsage({
      flow: "compare",
      messages: [
        { role: "system", content: system },
        { role: "user", content: thinking ? prompt : `${prompt} /no_think` },
      ],
      tools: [proposePaymentTool],
      maxTokens: MAX_TOKENS,
    });
    usages.push(r.usage);
    if (saveUsage) await saveUsage(r.usage);
    const line = kilnLines.length > before ? (JSON.parse(kilnLines[kilnLines.length - 1]!) as KilnLine) : null;
    extra.push({
      prompt,
      side: thinking ? "on" : "off",
      reasoningTokens: line?.usage?.completion_tokens_details?.reasoning_tokens ?? null,
      cachedTokens: line?.usage?.prompt_tokens_details?.cached_tokens ?? null,
      finish: line?.finish_reason ?? null,
      responseId: r.responseId,
    });
    return {
      toolCall: extractToolCall(r.message, "propose_payment") !== null,
      completionTokens: r.usage.completionTokens,
      promptTokens: r.usage.promptTokens,
      latencyMs: r.usage.latencyMs,
      costUsd: r.usage.costUsd,
    };
  }

  const rows: ReasoningComparisonRow[] = [];
  for (const [i, prompt] of prompts.entries()) {
    let on: Side;
    let off: Side;
    if (i % 2 === 0) {
      on = await measure(prompt, true);
      off = await measure(prompt, false);
    } else {
      off = await measure(prompt, false);
      on = await measure(prompt, true);
    }
    rows.push({ prompt, thinkingOn: on, thinkingOff: off });
    console.log(`${prompt}\n  on : tool=${on.toolCall} completion=${on.completionTokens} prompt=${on.promptTokens} ${on.latencyMs} ms cost=${on.costUsd}\n  off: tool=${off.toolCall} completion=${off.completionTokens} prompt=${off.promptTokens} ${off.latencyMs} ms cost=${off.costUsd}`);
  }

  const onC = avg(rows.map((r) => r.thinkingOn.completionTokens));
  const offC = avg(rows.map((r) => r.thinkingOff.completionTokens));
  const result: ReasoningComparison = {
    measuredAt: new Date().toISOString(),
    model: usages[0]?.model ?? KILN_MODEL,
    rows,
    summary: {
      toolCallsOn: rows.filter((r) => r.thinkingOn.toolCall).length,
      toolCallsOff: rows.filter((r) => r.thinkingOff.toolCall).length,
      avgCompletionOn: r1(onC),
      avgCompletionOff: r1(offC),
      completionSavedPct: onC > 0 ? r1(((onC - offC) / onC) * 100) : 0,
      avgLatencyOnMs: Math.round(avg(rows.map((r) => r.thinkingOn.latencyMs))),
      avgLatencyOffMs: Math.round(avg(rows.map((r) => r.thinkingOff.latencyMs))),
    },
  };
  writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
  writeFileSync(LOG_OUT, kilnLines.join("\n") + (kilnLines.length ? "\n" : ""));

  const s = result.summary;
  const costOn = rows.reduce((t, r) => t + (r.thinkingOn.costUsd ?? 0), 0);
  const costOff = rows.reduce((t, r) => t + (r.thinkingOff.costUsd ?? 0), 0);
  const reasonOn = avg(extra.filter((e) => e.side === "on" && e.reasoningTokens !== null).map((e) => e.reasoningTokens as number));
  const reasonOff = avg(extra.filter((e) => e.side === "off" && e.reasoningTokens !== null).map((e) => e.reasoningTokens as number));
  const truncated = extra.filter((e) => e.finish === "length").length;
  console.log(`\n=== thinking on vs off — ${result.model}, ${rows.length} purchase prompts, max_tokens ${MAX_TOKENS} ===`);
  console.log(`tool calls        on ${s.toolCallsOn}/${rows.length}   off ${s.toolCallsOff}/${rows.length}`);
  console.log(`avg completion    on ${s.avgCompletionOn}   off ${s.avgCompletionOff}   saved ${s.completionSavedPct}%`);
  console.log(`avg reasoning     on ${r1(reasonOn)}   off ${r1(reasonOff)}   (usage.completion_tokens_details.reasoning_tokens)`);
  console.log(`avg latency       on ${s.avgLatencyOnMs} ms   off ${s.avgLatencyOffMs} ms`);
  console.log(`total cost        on $${costOn.toFixed(8)}   off $${costOff.toFixed(8)}   saved ${costOn > 0 ? r1(((costOn - costOff) / costOn) * 100) : 0}%`);
  if (truncated) console.log(`note: ${truncated} call(s) hit max_tokens (finish_reason "length")`);
  console.log(`wrote ${OUT} and ${LOG_OUT} (${kilnLines.length} Kiln calls${SAVE ? ", saved to usage_records" : "; not saved to usage_records (use --save)"})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
