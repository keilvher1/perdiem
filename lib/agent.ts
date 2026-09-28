/**
 * lib/agent.ts — the spine of the app: one traveler request → one decision.
 *
 *   user text ─▶ (rule fast-path?) ─▶ Kiln qwen3-32b proposes via tool ─▶
 *   policy.evaluate() in code ─▶ APPROVE: broadcast on Sepolia, record pending
 *                             └▶ STOP: record reasons, NO chain call, NO extra LLM call
 *
 * Token-efficiency design (report this in the README):
 *  - One LLM call per request in the happy path; zero LLM calls when the
 *    request is a plain "status"/"balance" question (rule fast-path).
 *  - STOP explanations are templated from StopReason[] — no model call.
 *  - reasoning_effort "low"; short system prompt; catalog as a compact
 *    `id | name | category` list (7 lines), never the full DB in the prompt.
 *  - Zero-token flows are recorded with zeroUsage() so /metrics can prove it.
 *  - Thinking OFF for the propose step (Qwen3 "/no_think" soft switch, env
 *    KILN_NO_THINK=1 by default). Measured on Kiln qwen3-32b, 2026-09-27, same
 *    5 purchase prompts: tool calls 5/5 both ways; completion tokens per
 *    proposal 160 → 47 (−71%); latency 2.9 s → 1.1 s; cost −52%.
 */
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { chatWithUsage, extractToolCall, proposePaymentTool, zeroUsage, type UsageRecord } from "./kiln";
import {
  evaluate,
  findMerchant,
  fmtUsd,
  mandateHash,
  receiptHash,
  SPEND_STATUSES,
  type LedgerEntry,
  type Mandate,
  type Proposal,
} from "./policy";
import { estimateFeeUsd, paymentCalldata, sendPaymentNoWait } from "./chain";

export interface AgentDeps {
  mandate: Mandate; // status merged from the DB column (Pause/Resume) — see lib/db.ts
  ledger: LedgerEntry[]; // existing entries for this mandate (oldest first)
  saveEntry: (e: LedgerEntry) => Promise<void>;
  saveUsage: (u: UsageRecord) => Promise<void>;
  now?: () => Date;
}

export interface AgentReply {
  text: string; // what the traveler sees
  entry?: LedgerEntry; // present when a payment was proposed
  usage: UsageRecord[]; // every flow touched for this request
}

const STATUS_RE = /\b(balance|remaining|how much|left|status|spent)\b/i;
/** Qwen3 soft switch: skip the hidden reasoning for the simple "pick a merchant + amount" step. */
const NO_THINK = process.env.KILN_NO_THINK !== "0";
const LOOKS_LIKE_PURCHASE = /[$\d]/; // any amount or digit → not a plain status question

function spentUsd(ledger: LedgerEntry[]): number {
  return ledger.filter((e) => SPEND_STATUSES.has(e.status)).reduce((s, e) => s + e.totalUsd, 0);
}

/** Exported so scripts/compare-reasoning.ts measures the exact production prompt. */
export function systemPrompt(m: Mandate): string {
  const catalog = m.catalog.map((x) => `${x.id} | ${x.name} | ${x.category}`).join("\n");
  return [
    `You are PerDiem, a travel-spend agent for ${m.traveler}. You cannot pay; you can only PROPOSE a payment with the propose_payment tool, and a policy engine decides.`,
    `Whenever the user wants to buy, pay, order, or book, call propose_payment exactly once with the best-matching merchant from the catalog. ALWAYS propose — never refuse or judge the request yourself, even if it seems disallowed; the policy engine is the only judge. Do not invent merchants. Do not discuss budget limits.`,
    `If the request is not a purchase, answer in one short sentence.`,
    `Merchant catalog (id | name | category):\n${catalog}`,
  ].join("\n\n");
}

export async function handleTravelerMessage(userText: string, deps: AgentDeps): Promise<AgentReply> {
  const now = deps.now?.() ?? new Date();
  const m = deps.mandate;
  const usage: UsageRecord[] = [];

  // 0. Rule fast-path: no model call for simple status questions.
  if (STATUS_RE.test(userText) && !LOOKS_LIKE_PURCHASE.test(userText) && userText.length < 80) {
    const u = zeroUsage("status_fastpath");
    usage.push(u);
    await deps.saveUsage(u);
    const spent = spentUsd(deps.ledger);
    return {
      text: `Spent $${spent.toFixed(2)} of $${m.budgetUsd.toFixed(2)}. Remaining $${(m.budgetUsd - spent).toFixed(2)}. Mandate ${m.status}, expires ${m.expiresAt}.`,
      usage,
    };
  }

  // 1. Ask the model to propose (it may also just answer in text).
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt(m) },
    { role: "user", content: NO_THINK ? `${userText} /no_think` : userText },
  ];
  const r = await chatWithUsage({ flow: "propose", messages, tools: [proposePaymentTool], maxTokens: 300 });
  usage.push(r.usage);
  await deps.saveUsage(r.usage);

  const call = extractToolCall<{ merchant_id: string; amount_usd: number | string; memo: string }>(
    r.message,
    "propose_payment",
  );
  if (!call) {
    // No proposal => nothing can be spent. Safe by construction.
    return { text: r.text || "I did not understand a purchase in that request.", usage };
  }

  // Normalize model output defensively ("12 dollars" → 12, "M1" → m1).
  const amount = typeof call.args.amount_usd === "number" ? call.args.amount_usd : Number(String(call.args.amount_usd).replace(/[^0-9.]/g, ""));
  const proposal: Proposal = {
    merchantId: String(call.args.merchant_id ?? "").trim().toLowerCase(),
    amountUsd: Number.isFinite(amount) ? Math.round(amount * 100) / 100 : NaN,
    memo: String(call.args.memo ?? userText),
    sourceText: userText,
    requestedAt: now.toISOString(),
  };
  const merchant = findMerchant(m, proposal.merchantId);
  const mh = mandateHash(m);

  // 2. Real fee estimate. null = unavailable → policy fails closed (FEE_UNAVAILABLE).
  let feeUsd: number | null = null;
  let feeSource: LedgerEntry["feeSource"] = "none";
  if (merchant && Number.isFinite(proposal.amountUsd) && proposal.amountUsd > 0) {
    try {
      const placeholderReceipt = paymentCalldata(mh, mh); // same byte length as the real calldata
      const est = await estimateFeeUsd(merchant.wallet, proposal.amountUsd, placeholderReceipt);
      feeUsd = est.feeUsd;
      feeSource = est.source;
    } catch {
      feeUsd = null;
    }
  } else if (merchant === undefined) {
    feeUsd = 0; // unknown merchant is already a STOP; don't add a misleading fee reason
    feeSource = "none";
  }

  // 3. The boundary, in code.
  const decision = evaluate(proposal, {
    mandate: m,
    merchant,
    spentUsd: spentUsd(deps.ledger),
    estimatedFeeUsd: feeUsd,
    now,
    recent: deps.ledger.slice(-20),
  });

  const base = {
    id: `led_${now.getTime()}_${Math.random().toString(36).slice(2, 6)}`,
    mandateId: m.id,
    mandateHash: mh,
    proposal,
    merchantName: merchant?.name,
    decision: decision.decision,
    reasons: decision.decision === "STOP" ? decision.reasons : [],
    feeUsd: decision.feeUsd,
    feeSource,
    totalUsd: decision.totalUsd,
    kilnResponseId: r.responseId ?? undefined,
    toolArgsRaw: call.raw,
    at: now.toISOString(),
  };

  if (decision.decision === "STOP") {
    const entry: LedgerEntry = { ...base, status: "stopped", receiptHash: receiptHash(base) };
    await deps.saveEntry(entry);
    // Templated explanation: zero extra tokens — and recorded as such.
    const u = zeroUsage("stop_template");
    usage.push(u);
    await deps.saveUsage(u);
    const why = decision.reasons.map((x) => `• [${x.code}] ${x.message}`).join("\n");
    return {
      text: `Stopped. I did not pay ${merchant?.name ?? proposal.merchantId} $${fmtUsd(proposal.amountUsd)}.\n${why}`,
      entry,
      usage,
    };
  }

  // 4. APPROVE → broadcast on-chain (no wait), record as pending; a poller
  //    (/api/ledger/[id]/confirm) flips it to settled/failed via getSettlementStatus().
  const rh = receiptHash(base);
  let sent: { txHash: LedgerEntry["txHash"]; explorerUrl: string };
  try {
    sent = await sendPaymentNoWait({ to: merchant!.wallet, amountUsd: proposal.amountUsd, mandateHash: mh, receiptHash: rh });
  } catch (err) {
    // Only a failed BROADCAST is recorded as "failed" (nothing left the wallet).
    const entry: LedgerEntry = { ...base, status: "failed", receiptHash: rh };
    await deps.saveEntry(entry);
    return { text: `Approved but broadcast failed: ${(err as Error).message}`, entry, usage };
  }
  // The payment is on its way. Save it outside the broadcast try/catch, so a DB error here can never
  // relabel money that was actually sent as "failed" (it surfaces as an error; the tx hash is in the log).
  const entry: LedgerEntry = { ...base, status: "pending", txHash: sent.txHash, receiptHash: rh };
  await deps.saveEntry(entry);
  return {
    text: `Approved. Paying ${merchant!.name} ${fmtUsd(proposal.amountUsd)} for "${proposal.memo}" (est. network fee ${fmtUsd(decision.feeUsd)}). Tx: ${sent.explorerUrl}`,
    entry,
    usage,
  };
}
