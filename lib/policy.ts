/**
 * lib/policy.ts — the boundary the agent cannot cross.
 *
 * Pure functions, no I/O, fully unit-testable. This file IS the answer to the
 * challenge's "Boundaries & Stopping" criterion: state the boundary and where it
 * is enforced. It is enforced HERE, in code, before any on-chain call, never
 * inside the LLM.
 *
 * Every STOP returns ALL failing reasons (not just the first) so the ledger and
 * the auditor view can show exactly why an action was refused.
 *
 * Hashing rule: the mandate hash covers the TERMS (budget, caps, allowlists,
 * window, catalog snapshot) and deliberately excludes `status`, so Pause/Resume
 * does not change the anchored hash. Status lives beside the mandate in the DB.
 */
import { keccak256, stringToHex, type Hex } from "viem";

// ---------- Domain types ----------

export type MandateStatus = "active" | "paused" | "revoked";

export interface Merchant {
  id: string;
  name: string;
  category: string;
  wallet: Hex; // testnet address that receives the payment
}

export interface Mandate {
  id: string;
  principal: string; // who granted the budget (e.g. "MICEMore Finance")
  traveler: string; // who the agent acts for
  agentWallet: Hex; // the agent's testnet address
  budgetUsd: number; // total allowance for the trip
  perTxCapUsd: number; // max single payment
  allowedMerchantIds: string[];
  allowedCategories: string[]; // e.g. ["meal", "transport", "supplies"]
  blockedKeywords: string[]; // e.g. ["alcohol", "gift", "wine"]
  startsAt: string; // ISO
  expiresAt: string; // ISO
  /** Snapshot of the merchant catalog at grant time — part of the hash, so an
   *  auditor's replay cannot be fooled by editing the merchants table later. */
  catalog: Merchant[];
  /** Mutable, NOT part of the hash. */
  status: MandateStatus;
}

export interface Proposal {
  merchantId: string;
  amountUsd: number;
  memo: string; // model-written summary
  sourceText?: string; // the traveler's original words (also checked for blocked keywords)
  requestedAt: string; // ISO
}

export type StopCode =
  | "MANDATE_NOT_ACTIVE"
  | "BEFORE_START"
  | "EXPIRED"
  | "UNKNOWN_MERCHANT"
  | "MERCHANT_NOT_ALLOWED"
  | "CATEGORY_NOT_ALLOWED"
  | "BLOCKED_KEYWORD"
  | "INVALID_AMOUNT"
  | "OVER_PER_TX_CAP"
  | "FEE_UNAVAILABLE"
  | "OVER_BUDGET_WITH_FEES"
  | "DUPLICATE";

export interface StopReason {
  code: StopCode;
  message: string; // human-readable, shown in UI and stored in ledger
  observed?: number | string;
  limit?: number | string;
}

export type Decision =
  | { decision: "APPROVE"; totalUsd: number; feeUsd: number }
  | { decision: "STOP"; reasons: StopReason[]; totalUsd: number; feeUsd: number };

/**
 * approved → pending (broadcast) → settled (mined) | failed
 * stopped  = policy refused; nothing was sent
 */
export type LedgerStatus = "approved" | "pending" | "stopped" | "settled" | "failed";

/** Entries that count against the budget (money is committed once broadcast). */
export const SPEND_STATUSES: ReadonlySet<LedgerStatus> = new Set(["approved", "pending", "settled"]);

export interface LedgerEntry {
  id: string;
  mandateId: string;
  mandateHash: Hex;
  proposal: Proposal;
  merchantName?: string;
  decision: "APPROVE" | "STOP";
  reasons: StopReason[];
  feeUsd: number;
  feeSource?: "estimate" | "fallback" | "actual" | "none";
  totalUsd: number;
  status: LedgerStatus;
  txHash?: Hex;
  receiptHash?: Hex;
  /** Filled by the confirm poller after mining. NOT part of the receipt hash. */
  actualFeeUsd?: number;
  settledAt?: string;
  /** Evidence that a real Kiln call produced this entry. */
  kilnResponseId?: string;
  toolArgsRaw?: string;
  at: string; // ISO
}

export interface PolicyContext {
  mandate: Mandate;
  merchant: Merchant | undefined; // looked up from mandate.catalog
  spentUsd: number; // sum of totalUsd for entries with a SPEND_STATUSES status
  /** null = we could not estimate the network fee → STOP (fail closed). */
  estimatedFeeUsd: number | null;
  now: Date;
  recent: LedgerEntry[]; // recent entries for duplicate detection
}

// ---------- Helpers ----------

/**
 * Money display. Sepolia fees can be a fraction of a cent at the demo rate, so
 * amounts are NEVER rounded before comparing (rounding would hide the fee and
 * silently approve "exactly the remaining budget"). Rounding is display-only.
 */
export function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (Math.abs(n) >= 0.01 || n === 0) {
    // show sub-cent tails when they matter, e.g. 10.000123
    const exact = n.toFixed(6).replace(/0+$/, "");
    const cents = n.toFixed(2);
    return exact.length > cents.length ? exact : cents;
  }
  return n.toPrecision(2);
}

/** Stable JSON: sorted keys so the same object always hashes the same. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (v as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return v;
  });
}

/** Exactly the fields that make up the mandate TERMS. Whitelisted (not "everything but
 *  status") so that objects carrying extra fields — a DB row with hash/anchorTx/createdAt,
 *  a MandateDetail view — hash identically to the bare Mandate. */
const TERM_KEYS = [
  "id", "principal", "traveler", "agentWallet", "budgetUsd", "perTxCapUsd",
  "allowedMerchantIds", "allowedCategories", "blockedKeywords", "startsAt", "expiresAt", "catalog",
] as const satisfies ReadonlyArray<keyof Omit<Mandate, "status">>;

export function mandateTerms(m: Mandate): Omit<Mandate, "status"> {
  const terms = {} as Record<string, unknown>;
  for (const k of TERM_KEYS) terms[k] = m[k];
  terms.catalog = m.catalog.map((c) => ({ id: c.id, name: c.name, category: c.category, wallet: c.wallet }));
  return terms as unknown as Omit<Mandate, "status">;
}

/** keccak256 of the canonical mandate TERMS — anchored on-chain and stamped on every receipt. */
export function mandateHash(m: Mandate): Hex {
  return keccak256(stringToHex(canonicalJson(mandateTerms(m))));
}

/** Exactly the fields hashed into the receipt. Fields that change AFTER the decision
 *  (txHash, receiptHash, status, actualFeeUsd, settledAt) and any view-only extras
 *  (merchantCategory, explorerUrl) are excluded, so the hash stamped into calldata at
 *  broadcast time can be recomputed by an auditor from a ledger export or an API view. */
const RECEIPT_KEYS = [
  "id", "mandateId", "mandateHash", "proposal", "merchantName", "decision", "reasons",
  "feeUsd", "feeSource", "totalUsd", "kilnResponseId", "toolArgsRaw", "at",
] as const satisfies ReadonlyArray<keyof LedgerEntry>;

export function receiptHash(entry: Omit<LedgerEntry, "txHash" | "receiptHash" | "status"> | LedgerEntry): Hex {
  const picked: Record<string, unknown> = {};
  for (const k of RECEIPT_KEYS) {
    const v = (entry as Record<string, unknown>)[k];
    if (v !== undefined) picked[k] = v;
  }
  return keccak256(stringToHex(canonicalJson(picked)));
}

export function findMerchant(m: Mandate, merchantId: string): Merchant | undefined {
  const id = merchantId.trim().toLowerCase();
  return m.catalog.find((x) => x.id.toLowerCase() === id);
}

// ---------- The boundary ----------

export const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

export function evaluate(p: Proposal, ctx: PolicyContext): Decision {
  const { mandate: m, merchant, now } = ctx;
  const reasons: StopReason[] = [];
  const feeKnown = typeof ctx.estimatedFeeUsd === "number" && Number.isFinite(ctx.estimatedFeeUsd);
  const feeUsd = feeKnown ? (ctx.estimatedFeeUsd as number) : 0; // unrounded on purpose
  const totalUsd = p.amountUsd + feeUsd;
  const remainingUsd = m.budgetUsd - ctx.spentUsd;

  if (m.status !== "active") {
    reasons.push({
      code: "MANDATE_NOT_ACTIVE",
      message: `Mandate is ${m.status}; the principal must resume it before the agent can spend.`,
      observed: m.status,
      limit: "active",
    });
  }
  if (now < new Date(m.startsAt)) {
    reasons.push({ code: "BEFORE_START", message: "Trip has not started yet.", observed: now.toISOString(), limit: m.startsAt });
  }
  if (now > new Date(m.expiresAt)) {
    reasons.push({ code: "EXPIRED", message: "Mandate deadline has passed.", observed: now.toISOString(), limit: m.expiresAt });
  }
  if (!merchant) {
    reasons.push({ code: "UNKNOWN_MERCHANT", message: `Merchant "${p.merchantId}" is not in the catalog.`, observed: p.merchantId });
  } else {
    if (!m.allowedMerchantIds.includes(merchant.id)) {
      reasons.push({
        code: "MERCHANT_NOT_ALLOWED",
        message: `${merchant.name} is not on the permitted list.`,
        observed: merchant.id,
        limit: m.allowedMerchantIds.join(", "),
      });
    }
    if (!m.allowedCategories.includes(merchant.category)) {
      reasons.push({
        code: "CATEGORY_NOT_ALLOWED",
        message: `Category "${merchant.category}" is not permitted.`,
        observed: merchant.category,
        limit: m.allowedCategories.join(", "),
      });
    }
  }
  const haystack = `${p.memo} ${p.sourceText ?? ""}`.toLowerCase();
  const hit = m.blockedKeywords.find((k) => haystack.includes(k.toLowerCase()));
  if (hit) {
    reasons.push({ code: "BLOCKED_KEYWORD", message: `Request mentions a blocked item ("${hit}").`, observed: hit });
  }
  if (!(p.amountUsd > 0) || !Number.isFinite(p.amountUsd)) {
    reasons.push({ code: "INVALID_AMOUNT", message: "Amount must be a positive number.", observed: p.amountUsd });
  }
  if (p.amountUsd > m.perTxCapUsd) {
    reasons.push({
      code: "OVER_PER_TX_CAP",
      message: `Single payment cap is $${m.perTxCapUsd}.`,
      observed: p.amountUsd,
      limit: m.perTxCapUsd,
    });
  }
  if (!feeKnown) {
    // Fail closed: without a fee we cannot prove the payment fits the budget.
    reasons.push({ code: "FEE_UNAVAILABLE", message: "Network fee could not be estimated; refusing rather than guessing." });
  } else if (totalUsd > remainingUsd) {
    reasons.push({
      code: "OVER_BUDGET_WITH_FEES",
      message: `Amount $${fmtUsd(p.amountUsd)} + network fee $${fmtUsd(feeUsd)} = $${fmtUsd(totalUsd)} exceeds remaining budget $${fmtUsd(remainingUsd)}.`,
      observed: totalUsd,
      limit: remainingUsd,
    });
  }
  const dup = ctx.recent.find(
    (e) =>
      SPEND_STATUSES.has(e.status) &&
      e.proposal.merchantId === p.merchantId &&
      e.proposal.amountUsd === p.amountUsd &&
      Math.abs(now.getTime() - new Date(e.at).getTime()) < DUPLICATE_WINDOW_MS,
  );
  if (dup) {
    reasons.push({
      code: "DUPLICATE",
      message: "Same merchant and amount within 5 minutes — looks like a duplicate.",
      observed: dup.id,
    });
  }

  return reasons.length === 0
    ? { decision: "APPROVE", totalUsd, feeUsd }
    : { decision: "STOP", reasons, totalUsd, feeUsd };
}

// ---------- Evidence: reconstruct from records alone ----------

export interface ReplayResult {
  entryId: string;
  storedDecision: "APPROVE" | "STOP";
  recomputedDecision: "APPROVE" | "STOP";
  consistent: boolean;
  mandateHashMatches: boolean;
  recomputedReasons: StopReason[];
}

/**
 * An auditor with only the mandate (which carries its own catalog snapshot)
 * and the ledger can re-run the policy for every entry and confirm each stored
 * decision. Spend-so-far is rebuilt from earlier entries, so the verdict does
 * not trust the app. Status at replay time is taken from the entry's own
 * reasons (a MANDATE_NOT_ACTIVE stop is replayed with status "paused").
 */
export function replayLedger(mandate: Mandate, entries: LedgerEntry[]): ReplayResult[] {
  const expectedHash = mandateHash(mandate);
  const sorted = [...entries].sort((a, b) => a.at.localeCompare(b.at));
  let spent = 0;
  const out: ReplayResult[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i]!;
    const wasPaused = e.reasons.some((r) => r.code === "MANDATE_NOT_ACTIVE");
    const d = evaluate(e.proposal, {
      mandate: { ...mandate, status: wasPaused ? "paused" : "active" },
      merchant: findMerchant(mandate, e.proposal.merchantId),
      spentUsd: spent,
      estimatedFeeUsd: e.feeSource === "none" ? null : e.feeUsd,
      now: new Date(e.at),
      recent: sorted.slice(0, i),
    });
    out.push({
      entryId: e.id,
      storedDecision: e.decision,
      recomputedDecision: d.decision,
      consistent: d.decision === e.decision,
      mandateHashMatches: e.mandateHash === expectedHash,
      recomputedReasons: d.decision === "STOP" ? d.reasons : [],
    });
    if (SPEND_STATUSES.has(e.status)) spent += e.totalUsd;
  }
  return out;
}
