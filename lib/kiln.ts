/**
 * lib/kiln.ts — Kiln (Bricksum NPU) client wrapper.
 *
 * Why a wrapper: the challenge asks for token usage "broken down by flow".
 * Every model call goes through `chatWithUsage()` with a `flow` label so the
 * UI can show tokens/cost per flow. Zero-token flows (rule fast-path,
 * templated STOP) are recorded too via `zeroUsage()` so the metrics table
 * proves inference was avoided, not just unmeasured.
 *
 * Facts verified from Kiln docs (2026-09-26):
 *  - OpenAI-compatible. base_url https://api.bricksum.com/v1, key "sk-bk-..."
 *  - model id for this track: "qwen3-32b" (32k context, tool calling AUTO only,
 *    no parallel tool calls). Always confirm with GET /models on the day.
 *  - tool_choice "required" / named function is accepted (200) but NOT applied.
 *    => never rely on forcing a tool call; treat "no tool call" as "no proposal".
 *  - reasoning_effort: "low" | "medium" | "high" (more = more tokens/latency)
 *  - usage: { prompt_tokens, completion_tokens, total_tokens, cost } — cost in USD
 *    is added by the gateway. No reasoning_tokens breakdown is documented.
 *  - 60 requests/min, 8 concurrent per org; 402 when credits are depleted.
 */
import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionMessage,
} from "openai/resources/chat/completions";

export const KILN_BASE_URL = process.env.KILN_BASE_URL ?? "https://api.bricksum.com/v1";
export const KILN_MODEL = process.env.KILN_MODEL ?? "qwen3-32b";

export const kiln = new OpenAI({
  baseURL: KILN_BASE_URL,
  apiKey: process.env.KILN_API_KEY ?? "missing-key",
  timeout: 30_000, // never hang a request handler on a slow inference
  maxRetries: 1,
});

export type FlowName =
  | "propose" // one model call per purchase request
  | "explain" // optional: traveler asks "why?" about an approved item
  | "audit" // optional: natural-language summary of a replay (off by default)
  | "status_fastpath" // answered from the ledger, 0 tokens
  | "stop_template" // refusal text templated from reasons, 0 tokens
  | "compare" // reasoning-effort comparison script
  | "other";

export interface UsageRecord {
  flow: FlowName;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number | null; // gateway-provided; null if absent
  latencyMs: number;
  responseId: string | null; // Kiln response id — evidence of a real call
  at: string; // ISO
}

/** A record for work done WITHOUT the model (fast-path, templated STOP). */
export function zeroUsage(flow: FlowName): UsageRecord {
  return {
    flow,
    model: "none",
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    latencyMs: 0,
    responseId: null,
    at: new Date().toISOString(),
  };
}

export interface ChatArgs {
  flow: FlowName;
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  /** Keep "low" for simple flows — this track scores token efficiency. */
  reasoningEffort?: "low" | "medium" | "high";
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResult {
  message: ChatCompletionMessage;
  /** assistant text with any <think>…</think> blocks removed */
  text: string;
  usage: UsageRecord;
  responseId: string | null;
}

/** Qwen3 may emit reasoning inside <think> tags when the server does not split it out. */
export function stripThink(s: string | null | undefined): string {
  return (s ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

export async function chatWithUsage(args: ChatArgs): Promise<ChatResult> {
  const t0 = Date.now();
  const res = await kiln.chat.completions.create({
    model: KILN_MODEL,
    messages: args.messages,
    tools: args.tools,
    // "auto" is the only value Kiln applies for qwen3-32b.
    tool_choice: args.tools && args.tools.length > 0 ? "auto" : undefined,
    max_tokens: args.maxTokens ?? 512,
    temperature: args.temperature ?? 0.2,
    reasoning_effort: args.reasoningEffort ?? "low",
  });

  const choice = res.choices[0];
  if (!choice) throw new Error("Kiln returned no choices");

  const u = res.usage;
  // `cost` is a Kiln gateway extension, not part of the OpenAI type.
  const cost = (u as unknown as { cost?: number } | undefined)?.cost;

  const usage: UsageRecord = {
    flow: args.flow,
    model: res.model ?? KILN_MODEL,
    promptTokens: u?.prompt_tokens ?? 0,
    completionTokens: u?.completion_tokens ?? 0,
    totalTokens: u?.total_tokens ?? 0,
    costUsd: typeof cost === "number" ? cost : null,
    latencyMs: Date.now() - t0,
    responseId: res.id ?? null,
    at: new Date().toISOString(),
  };

  // One JSON line per call → `evidence/06-kiln-calls.txt` (grep '"kind":"kiln"').
  console.log(
    JSON.stringify({
      kind: "kiln",
      flow: args.flow,
      id: res.id,
      model: res.model,
      tool_calls: choice.message.tool_calls?.map((c) => (c.type === "function" ? { name: c.function.name, args: c.function.arguments } : { type: c.type })),
      finish_reason: choice.finish_reason,
      usage: u,
    }),
  );

  return { message: choice.message, text: stripThink(choice.message.content), usage, responseId: res.id ?? null };
}

/**
 * Return parsed arguments of the FIRST call to `toolName` (plus the raw JSON),
 * or null when the model did not call it. Callers must treat null as "nothing
 * to do" — the model can only *propose*; the policy engine (code) decides.
 *
 * Fallback: if the server failed to parse a Hermes-style call and left
 * `<tool_call>{...}</tool_call>` in the content, recover it from there.
 */
export function extractToolCall<T>(message: ChatCompletionMessage, toolName: string): { args: T; raw: string } | null {
  const call = message.tool_calls?.find(
    (c) => c.type === "function" && c.function.name === toolName,
  );
  if (call && call.type === "function") {
    const raw = call.function.arguments || "{}";
    try {
      return { args: JSON.parse(raw) as T, raw };
    } catch {
      return null;
    }
  }
  const content = message.content ?? "";
  const m = content.match(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/);
  if (m && m[1]) {
    try {
      const obj = JSON.parse(m[1]) as { name?: string; arguments?: T };
      if (obj.name === toolName && obj.arguments) return { args: obj.arguments, raw: JSON.stringify(obj.arguments) };
    } catch {
      /* fall through */
    }
  }
  return null;
}

/** Tool schema the agent uses to propose a payment (code enforces the mandate). */
export const proposePaymentTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "propose_payment",
    description:
      "Propose ONE payment for the traveler. You never pay directly; the policy engine will approve or stop it. Call this whenever the user asks to buy, pay, order, or book something — even if you think it might not be allowed.",
    parameters: {
      type: "object",
      properties: {
        merchant_id: { type: "string", description: "id from the merchant catalog" },
        amount_usd: { type: "number", description: "amount in USD, before network fees" },
        memo: { type: "string", description: "what this is for, in the user's words" },
      },
      required: ["merchant_id", "amount_usd", "memo"],
    },
  },
};

/** Sanity check to run on day 0: is the model actually served right now? */
export async function assertModelAvailable(): Promise<string[]> {
  const list = await kiln.models.list();
  const ids = list.data.map((m) => m.id);
  if (!ids.includes(KILN_MODEL)) {
    throw new Error(`Model ${KILN_MODEL} not in GET /models: ${ids.join(", ")}`);
  }
  return ids;
}
