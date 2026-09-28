/**
 * contracts/api.ts — THE contract between the frontend (Codex) and the backend (Claude Code).
 *
 * RULES
 *  - This file is read-only for both sides. Any change must be made in BOTH repos/branches
 *    in the same commit, with a one-line note in the PR description.
 *  - Self-contained on purpose: no imports. The frontend must compile with only this file.
 *  - The backend proves compatibility with lib/policy.ts in tests/contract.check.ts.
 *  - Every route returns JSON. Errors always look like `ApiError` with a non-2xx status.
 *  - All money is USD as a plain number (never a string). All times are ISO 8601 strings.
 *  - `Hex` is a 0x-prefixed lowercase-or-checksummed hex string.
 */

export type Hex = `0x${string}`;

// ---------------------------------------------------------------------------
// Domain types (mirrors lib/policy.ts, lib/kiln.ts, lib/chain.ts)
// ---------------------------------------------------------------------------

export type MandateStatus = "active" | "paused" | "revoked";

export interface Merchant {
  id: string; // "m1".."m7"
  name: string;
  category: string; // "meal" | "transport" | "supplies" | "alcohol" | "gift" | ...
  wallet: Hex;
}

/** The hashed terms + mutable status. `catalog` is a snapshot taken at grant time. */
export interface Mandate {
  id: string;
  principal: string;
  traveler: string;
  agentWallet: Hex;
  budgetUsd: number;
  perTxCapUsd: number;
  allowedMerchantIds: string[];
  allowedCategories: string[];
  blockedKeywords: string[];
  startsAt: string;
  expiresAt: string;
  catalog: Merchant[];
  status: MandateStatus;
}

export interface Proposal {
  merchantId: string;
  amountUsd: number;
  memo: string;
  sourceText?: string;
  requestedAt: string;
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
  message: string;
  observed?: number | string;
  limit?: number | string;
}

/**
 * approved → pending (broadcast) → settled (mined) | failed
 * stopped  = policy refused; nothing was sent
 */
export type LedgerStatus = "approved" | "pending" | "stopped" | "settled" | "failed";

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
  actualFeeUsd?: number;
  settledAt?: string;
  kilnResponseId?: string;
  toolArgsRaw?: string;
  at: string;
}

export type FlowName =
  | "propose"
  | "explain"
  | "audit"
  | "status_fastpath"
  | "stop_template"
  | "compare"
  | "other";

export interface UsageRecord {
  flow: FlowName;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number | null;
  latencyMs: number;
  responseId: string | null;
  at: string;
}

export type SettlementStatus =
  | { state: "pending" }
  | { state: "settled"; blockNumber: string; gasUsed: string; actualFeeUsd: number }
  | { state: "failed"; reason: string };

export interface ReplayResult {
  entryId: string;
  storedDecision: "APPROVE" | "STOP";
  recomputedDecision: "APPROVE" | "STOP";
  consistent: boolean;
  mandateHashMatches: boolean;
  recomputedReasons: StopReason[];
}

// ---------------------------------------------------------------------------
// View types (what the API returns; superset of domain types)
// ---------------------------------------------------------------------------

/** LedgerEntry + display helpers computed by the server. */
export interface LedgerEntryView extends LedgerEntry {
  merchantCategory?: string;
  explorerUrl?: string; // https://sepolia.etherscan.io/tx/<txHash>
}

export interface MandateSummary {
  id: string;
  principal: string;
  traveler: string;
  budgetUsd: number;
  perTxCapUsd: number;
  status: MandateStatus;
  startsAt: string;
  expiresAt: string;
  hash: Hex;
  anchorTx: Hex | null;
  anchorUrl: string | null;
  /** sum of totalUsd over entries with status approved|pending|settled */
  spentUsd: number;
  /** subset of spentUsd that is still pending on-chain */
  pendingUsd: number;
  remainingUsd: number; // budgetUsd - spentUsd (may be negative only in theory)
  entryCount: number;
  createdAt: string;
}

export interface MandateDetail extends Mandate {
  hash: Hex;
  anchorTx: Hex | null;
  anchorUrl: string | null;
  spentUsd: number;
  pendingUsd: number;
  remainingUsd: number;
  createdAt: string;
}

export interface UsageByFlowRow {
  flow: FlowName;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  avgLatencyMs: number;
}

export interface EnergyEstimate {
  /** null until ENERGY_J_PER_TOKEN is set */
  assumedJPerToken: number | null;
  source: string | null; // where the assumption comes from (URL or "Bricksum on-site")
  totalTokens: number;
  totalWh: number | null; // totalTokens * assumedJPerToken / 3600
}

export interface ReasoningComparisonRow {
  prompt: string;
  thinkingOn: { toolCall: boolean; completionTokens: number; promptTokens: number; latencyMs: number; costUsd: number | null };
  thinkingOff: { toolCall: boolean; completionTokens: number; promptTokens: number; latencyMs: number; costUsd: number | null };
}

export interface ReasoningComparison {
  measuredAt: string;
  model: string;
  rows: ReasoningComparisonRow[];
  summary: {
    toolCallsOn: number; // e.g. 5
    toolCallsOff: number;
    avgCompletionOn: number;
    avgCompletionOff: number;
    completionSavedPct: number; // (on - off) / on * 100
    avgLatencyOnMs: number;
    avgLatencyOffMs: number;
  };
}

export interface TxCheck {
  entryId: string;
  txHash: Hex;
  explorerUrl: string;
  memo: string; // decoded calldata
  memoMatches: boolean; // memo === `PERDIEM|<mandateHash>|<recomputed receiptHash>`
  receiptHashMatches: boolean; // recomputed receiptHash === stored
  recipientMatches: boolean; // tx.to === catalog wallet of the merchant
  amountMatches: boolean; // |tx value in USD - proposal.amountUsd| < 0.01
  valueUsd: number;
  to: Hex | null;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

/** GET /api/health */
export interface HealthResponse {
  ok: boolean;
  model: string; // "qwen3-32b"
  models: string[]; // from Kiln GET /models
  modelAvailable: boolean;
  agentAddress: Hex | null;
  balanceEth: string | null;
  balanceUsd: number | null;
  demoEthUsd: number;
  chain: "sepolia";
  rpc: "publicnode" | "custom";
  errors: string[]; // non-fatal problems (e.g. "kiln: 401")
}

/** GET /api/merchants */
export interface MerchantsResponse {
  merchants: Merchant[];
}

/** GET /api/mandates */
export interface MandatesResponse {
  mandates: MandateSummary[]; // newest first
}

/** POST /api/mandates — body */
export interface CreateMandateRequest {
  principal: string;
  traveler: string;
  budgetUsd: number;
  perTxCapUsd: number;
  allowedMerchantIds: string[];
  allowedCategories: string[];
  blockedKeywords: string[];
  startsAt: string; // ISO
  expiresAt: string; // ISO
  /** optional custom id; server generates `man_<timestamp>` when absent */
  id?: string;
}

/** POST /api/mandates — 201 */
export interface CreateMandateResponse {
  mandate: MandateDetail;
  anchor: { txHash: Hex; explorerUrl: string };
}

/** GET /api/mandates/[id] */
export interface MandateDetailResponse {
  mandate: MandateDetail;
  ledger: LedgerEntryView[]; // oldest first
}

/** PATCH /api/mandates/[id] — body */
export interface UpdateMandateStatusRequest {
  status: MandateStatus;
}

/** PATCH /api/mandates/[id] — 200 */
export interface UpdateMandateStatusResponse {
  mandate: MandateSummary;
}

/** POST /api/chat — body */
export interface ChatRequest {
  mandateId: string;
  text: string;
}

/** POST /api/chat — 200 */
export interface ChatResponse {
  reply: string; // what the traveler sees (may contain newlines)
  entry: LedgerEntryView | null; // null when the model made no proposal / status question
  usage: UsageRecord[]; // every flow touched, including 0-token rows
}

/** GET /api/ledger?mandateId=... */
export interface LedgerResponse {
  entries: LedgerEntryView[]; // oldest first
}

/** GET /api/ledger/[id]/confirm — polls the chain and updates the entry */
export interface ConfirmResponse {
  entry: LedgerEntryView;
  settlement: SettlementStatus;
}

/** GET /api/usage */
export interface UsageResponse {
  byFlow: UsageByFlowRow[];
  totals: { calls: number; promptTokens: number; completionTokens: number; totalTokens: number; costUsd: number };
  zeroTokenCalls: { statusFastpath: number; stopTemplate: number };
  energy: EnergyEstimate;
  comparison: ReasoningComparison | null; // from docs/reasoning-comparison.json when present
}

/** GET /api/audit/[mandateId] */
export interface AuditResponse {
  mandate: MandateDetail;
  mandateHash: Hex; // recomputed from terms
  anchor: { txHash: Hex | null; explorerUrl: string | null; memo: string | null; matches: boolean };
  replay: ReplayResult[];
  transactions: TxCheck[];
  summary: { passed: number; total: number; allVerified: boolean };
}

/** Route table — the frontend api-client must use exactly these paths. */
export const ENDPOINTS = {
  health: "/api/health",
  merchants: "/api/merchants",
  mandates: "/api/mandates",
  mandate: (id: string) => `/api/mandates/${encodeURIComponent(id)}`,
  chat: "/api/chat",
  ledger: (mandateId: string) => `/api/ledger?mandateId=${encodeURIComponent(mandateId)}`,
  confirm: (entryId: string) => `/api/ledger/${encodeURIComponent(entryId)}/confirm`,
  usage: "/api/usage",
  audit: (mandateId: string) => `/api/audit/${encodeURIComponent(mandateId)}`,
} as const;

/**
 * Scripted demo requests (PRD §7). The mock api-client must answer these deterministically.
 * `mandateId` values are PREFIXES: live mandates are created as `man_A_<suffix>` (a fresh set per
 * demo take), so match with `id.startsWith(mandateId)`, never equality.
 */
export const DEMO_SCRIPT = [
  { n: 0, mandateId: "man_A", text: "Order a bibimbap lunch from Yangjae Kitchen, $12", expect: "APPROVE" },
  { n: 1, mandateId: "man_A", text: "Taxi to Incheon airport, about $85", expect: "STOP:OVER_PER_TX_CAP" },
  { n: 2, mandateId: "man_A", text: "Buy a bottle of wine as a gift for the client, $30", expect: "STOP:MERCHANT_NOT_ALLOWED,CATEGORY_NOT_ALLOWED,BLOCKED_KEYWORD" },
  { n: 3, mandateId: "man_B", text: "Dinner from Yangjae Kitchen, $10", expect: "STOP:OVER_BUDGET_WITH_FEES" },
  { n: 4, mandateId: "man_A", text: "Coffee at Starbucks, $5", expect: "STOP:MANDATE_NOT_ACTIVE (while paused)" },
  { n: 5, mandateId: "man_C", text: "Coffee at Starbucks, $5", expect: "STOP:EXPIRED" },
  { n: 6, mandateId: "man_A", text: "Coffee at Starbucks, $5", expect: "APPROVE (after resume)" },
  { n: 7, mandateId: "man_A", text: "How much do I have left?", expect: "status_fastpath, 0 tokens, entry null" },
] as const;
