/**
 * lib/api-client.ts — the ONLY way the frontend talks to data.
 *
 * Two modes, chosen at build time by NEXT_PUBLIC_API_MODE:
 *  - "live": fetch() to the relative paths in ENDPOINTS (contracts/api.ts), JSON in/out.
 *  - anything else (default): an in-memory mock seeded from docs/fixtures/*.json with
 *    300–800 ms latency, deterministic chat answers and pending → settled after ~10 s.
 *
 * Pages and components never call fetch directly and never know which mode is active.
 */
import {
  DEMO_SCRIPT,
  ENDPOINTS,
  type ApiError,
  type AuditResponse,
  type ChatRequest,
  type ChatResponse,
  type ConfirmResponse,
  type CreateMandateRequest,
  type CreateMandateResponse,
  type HealthResponse,
  type Hex,
  type LedgerEntryView,
  type LedgerResponse,
  type LedgerStatus,
  type Mandate,
  type MandateDetail,
  type MandateDetailResponse,
  type MandatesResponse,
  type MandateStatus,
  type MandateSummary,
  type MerchantsResponse,
  type ReplayResult,
  type SettlementStatus,
  type StopReason,
  type TxCheck,
  type UpdateMandateStatusResponse,
  type UsageByFlowRow,
  type UsageRecord,
  type UsageResponse,
} from "@/contracts/api";
import healthJson from "@/docs/fixtures/health.json";
import merchantsJson from "@/docs/fixtures/merchants.json";
import mandatesJson from "@/docs/fixtures/mandates.json";
import mandateAJson from "@/docs/fixtures/mandate-man_A.json";
import mandateBJson from "@/docs/fixtures/mandate-man_B.json";
import mandateCJson from "@/docs/fixtures/mandate-man_C.json";
import chatResponsesJson from "@/docs/fixtures/chat-responses.json";
import settlementSettledJson from "@/docs/fixtures/settlement-settled.json";
import usageJson from "@/docs/fixtures/usage.json";
import auditJson from "@/docs/fixtures/audit-man_A.json";

export { DEMO_SCRIPT };
export type DemoStep = (typeof DEMO_SCRIPT)[number];

export type ApiMode = "live" | "mock";
/** Anything other than "live" means mock (mock is the default when unset). */
export const API_MODE: ApiMode = process.env.NEXT_PUBLIC_API_MODE === "live" ? "live" : "mock";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Normalizes anything thrown by the client into an ApiClientError (for error states). */
export function toApiClientError(e: unknown): ApiClientError {
  if (e instanceof ApiClientError) return e;
  if (e instanceof Error) return new ApiClientError(0, "CLIENT_ERROR", e.message);
  return new ApiClientError(0, "CLIENT_ERROR", String(e));
}

/** DEMO_SCRIPT mandate ids are prefixes (`man_A`); live ids look like `man_A_k3x9`. */
export function matchesMandatePrefix(id: string, prefix: string): boolean {
  return id.startsWith(prefix);
}

export interface PerDiemApi {
  health(): Promise<HealthResponse>;
  merchants(): Promise<MerchantsResponse>;
  mandates(): Promise<MandatesResponse>;
  mandate(id: string): Promise<MandateDetailResponse>;
  createMandate(body: CreateMandateRequest): Promise<CreateMandateResponse>;
  updateMandateStatus(id: string, status: MandateStatus): Promise<UpdateMandateStatusResponse>;
  chat(body: ChatRequest): Promise<ChatResponse>;
  ledger(mandateId: string): Promise<LedgerResponse>;
  confirm(entryId: string): Promise<ConfirmResponse>;
  usage(): Promise<UsageResponse>;
  audit(mandateId: string): Promise<AuditResponse>;
}

// ---------------------------------------------------------------------------
// live
// ---------------------------------------------------------------------------

async function http<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: { "content-type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (e) {
    throw new ApiClientError(0, "NETWORK_ERROR", e instanceof Error ? e.message : "Network request failed");
  }
  if (!res.ok) {
    let code = `HTTP_${res.status}`;
    let message = res.statusText || `Request failed with status ${res.status}`;
    let details: unknown;
    try {
      const parsed = (await res.json()) as Partial<ApiError> | null;
      if (parsed && typeof parsed === "object" && parsed.error && typeof parsed.error.code === "string") {
        code = parsed.error.code;
        message = typeof parsed.error.message === "string" ? parsed.error.message : message;
        details = parsed.error.details;
      }
    } catch {
      // Not JSON (e.g. a Next error page): keep HTTP_<status> + statusText.
    }
    throw new ApiClientError(res.status, code, message, details);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiClientError(res.status, "BAD_RESPONSE", "The server returned a response that is not JSON.");
  }
}

const live: PerDiemApi = {
  health: () => http<HealthResponse>("GET", ENDPOINTS.health),
  merchants: () => http<MerchantsResponse>("GET", ENDPOINTS.merchants),
  mandates: () => http<MandatesResponse>("GET", ENDPOINTS.mandates),
  mandate: (id) => http<MandateDetailResponse>("GET", ENDPOINTS.mandate(id)),
  createMandate: (body) => http<CreateMandateResponse>("POST", ENDPOINTS.mandates, body),
  updateMandateStatus: (id, status) => http<UpdateMandateStatusResponse>("PATCH", ENDPOINTS.mandate(id), { status }),
  chat: (body) => http<ChatResponse>("POST", ENDPOINTS.chat, body),
  ledger: (mandateId) => http<LedgerResponse>("GET", ENDPOINTS.ledger(mandateId)),
  confirm: (entryId) => http<ConfirmResponse>("GET", ENDPOINTS.confirm(entryId)),
  usage: () => http<UsageResponse>("GET", ENDPOINTS.usage),
  audit: (mandateId) => http<AuditResponse>("GET", ENDPOINTS.audit(mandateId)),
};

// ---------------------------------------------------------------------------
// mock — fixtures (JSON imports widen literal types, so cast once here)
// ---------------------------------------------------------------------------

interface ChatRule {
  match: string;
  /** "*", a mandate id prefix, or "<prefix>:paused" (only while that mandate is paused). */
  mandateId: string;
  response: ChatResponse;
}
interface ChatFixture {
  rules: ChatRule[];
  fallback: ChatResponse;
}

const fx = {
  health: healthJson as unknown as HealthResponse,
  merchants: merchantsJson as unknown as MerchantsResponse,
  mandates: mandatesJson as unknown as MandatesResponse,
  details: [mandateAJson, mandateBJson, mandateCJson] as unknown as MandateDetailResponse[],
  chat: chatResponsesJson as unknown as ChatFixture,
  settled: settlementSettledJson as unknown as Extract<SettlementStatus, { state: "settled" }>,
  usage: usageJson as unknown as UsageResponse,
  audit: auditJson as unknown as AuditResponse,
};

const SPEND_STATUSES: ReadonlySet<LedgerStatus> = new Set<LedgerStatus>(["approved", "pending", "settled"]);
const SETTLE_AFTER_MS = 10_000;
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;
const EXPLORER_TX = "https://sepolia.etherscan.io/tx/";

interface StoredMandate {
  mandate: Mandate;
  hash: Hex;
  anchorTx: Hex | null;
  anchorUrl: string | null;
  createdAt: string;
  order: number;
}

interface MockStore {
  mandates: Map<string, StoredMandate>;
  ledgers: Map<string, LedgerEntryView[]>;
  /** Usage records produced by chats in this browser session (added to usage.json). */
  sessionUsage: UsageRecord[];
  /** Entries created in this session (only these count for the mock DUPLICATE guard). */
  sessionEntryIds: Set<string>;
  seq: number;
}

let store: MockStore | null = null;

const clone = <T,>(v: T): T => structuredClone(v);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const latency = () => sleep(300 + Math.floor(Math.random() * 500));
/** Display-only tidy-up of float sums (12.1006 + 5.1006 = 17.201200000000004). */
const tidy = (n: number) => Math.round(n * 1e9) / 1e9;

function fnv1a(input: string, seed: number): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Fake but stable 32-byte hex hash (no crypto libs in the browser bundle). */
function fakeHash(input: string): Hex {
  let out = "";
  for (let i = 0; i < 8; i++) out += fnv1a(`${i}|${input}`, Math.imul(i + 1, 0x9e3779b1)).toString(16).padStart(8, "0");
  return `0x${out}`;
}

function getStore(): MockStore {
  if (store) return store;
  const s: MockStore = { mandates: new Map(), ledgers: new Map(), sessionUsage: [], sessionEntryIds: new Set(), seq: 0 };
  // mandates.json is newest first; insert oldest first so `order` grows with recency.
  const ids = fx.mandates.mandates.map((m) => m.id).reverse();
  for (const id of ids) {
    const d = fx.details.find((x) => x.mandate.id === id);
    if (!d) continue;
    const { hash, anchorTx, anchorUrl, createdAt, spentUsd, pendingUsd, remainingUsd, ...mandate } = clone(d.mandate);
    void spentUsd;
    void pendingUsd;
    void remainingUsd;
    s.mandates.set(id, { mandate, hash, anchorTx, anchorUrl, createdAt, order: s.seq++ });
    s.ledgers.set(id, clone(d.ledger));
  }
  store = s;
  return s;
}

/** Dev/test helper: forget everything the mock has recorded in this session. */
export function resetMockStore(): void {
  store = null;
}

function notFound(what: string, id: string): ApiClientError {
  return new ApiClientError(404, "NOT_FOUND", `${what} "${id}" was not found.`);
}

function getStored(id: string): StoredMandate {
  const m = getStore().mandates.get(id);
  if (!m) throw notFound("Mandate", id);
  return m;
}

function ledgerOf(id: string): LedgerEntryView[] {
  const s = getStore();
  let l = s.ledgers.get(id);
  if (!l) {
    l = [];
    s.ledgers.set(id, l);
  }
  return l;
}

function money(id: string, budgetUsd: number) {
  const ledger = ledgerOf(id);
  const spentUsd = tidy(ledger.filter((e) => SPEND_STATUSES.has(e.status)).reduce((a, e) => a + e.totalUsd, 0));
  const pendingUsd = tidy(ledger.filter((e) => e.status === "pending").reduce((a, e) => a + e.totalUsd, 0));
  return { spentUsd, pendingUsd, remainingUsd: tidy(budgetUsd - spentUsd), entryCount: ledger.length };
}

function toDetail(s: StoredMandate): MandateDetail {
  const { spentUsd, pendingUsd, remainingUsd } = money(s.mandate.id, s.mandate.budgetUsd);
  return {
    ...clone(s.mandate),
    hash: s.hash,
    anchorTx: s.anchorTx,
    anchorUrl: s.anchorUrl,
    spentUsd,
    pendingUsd,
    remainingUsd,
    createdAt: s.createdAt,
  };
}

function toSummary(s: StoredMandate): MandateSummary {
  const m = s.mandate;
  return {
    id: m.id,
    principal: m.principal,
    traveler: m.traveler,
    budgetUsd: m.budgetUsd,
    perTxCapUsd: m.perTxCapUsd,
    status: m.status,
    startsAt: m.startsAt,
    expiresAt: m.expiresAt,
    hash: s.hash,
    anchorTx: s.anchorTx,
    anchorUrl: s.anchorUrl,
    ...money(m.id, m.budgetUsd),
    createdAt: s.createdAt,
  };
}

/** Same number formatting as lib/policy.ts fmtUsd (used in templated replies). */
function usd(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (Math.abs(n) >= 0.01 || n === 0) {
    const exact = n.toFixed(6).replace(/0+$/, "");
    const cents = n.toFixed(2);
    return exact.length > cents.length ? exact : cents;
  }
  return n.toPrecision(2);
}

function zeroUsage(flow: "status_fastpath" | "stop_template", at: string): UsageRecord {
  return { flow, model: "none", promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0, latencyMs: 0, responseId: null, at };
}

/** Rule-agnostic checks the mock applies before it lets a fixture APPROVE through. */
function mockGuard(s: StoredMandate, e: LedgerEntryView, now: number): StopReason[] {
  const m = s.mandate;
  const reasons: StopReason[] = [];
  if (m.status !== "active") {
    reasons.push({
      code: "MANDATE_NOT_ACTIVE",
      message: `Mandate is ${m.status}; the principal must resume it before the agent can spend.`,
      observed: m.status,
      limit: "active",
    });
  }
  const { remainingUsd } = money(m.id, m.budgetUsd);
  if (e.totalUsd > remainingUsd) {
    reasons.push({
      code: "OVER_BUDGET_WITH_FEES",
      message: `Amount $${usd(e.proposal.amountUsd)} + network fee $${usd(e.feeUsd)} = $${usd(e.totalUsd)} exceeds remaining budget $${usd(remainingUsd)}.`,
      observed: e.totalUsd,
      limit: remainingUsd,
    });
  }
  const st = getStore();
  const dup = ledgerOf(m.id).find(
    (x) =>
      st.sessionEntryIds.has(x.id) &&
      SPEND_STATUSES.has(x.status) &&
      x.proposal.merchantId === e.proposal.merchantId &&
      x.proposal.amountUsd === e.proposal.amountUsd &&
      Math.abs(now - new Date(x.at).getTime()) < DUPLICATE_WINDOW_MS,
  );
  if (dup) {
    reasons.push({ code: "DUPLICATE", message: "Same merchant and amount within 5 minutes — looks like a duplicate.", observed: dup.id });
  }
  return reasons;
}

function pickRule(mandateId: string, status: MandateStatus, text: string): ChatResponse {
  const hits = fx.chat.rules.filter((r) => {
    try {
      return new RegExp(r.match, "i").test(text);
    } catch {
      return false;
    }
  });
  if (status === "paused") {
    const paused = hits.find((r) => r.mandateId.endsWith(":paused") && mandateId.startsWith(r.mandateId.slice(0, -":paused".length)));
    if (paused) return clone(paused.response);
  }
  const rule = hits.find((r) => r.mandateId === "*" || (!r.mandateId.includes(":") && mandateId.startsWith(r.mandateId)));
  return clone(rule ? rule.response : fx.chat.fallback);
}

async function mockChat(body: ChatRequest): Promise<ChatResponse> {
  const st = getStore();
  const s = getStored(body.mandateId);
  const m = s.mandate;
  const text = body.text.trim();
  if (!text) throw new ApiClientError(400, "VALIDATION_ERROR", "Message text is required.");

  const nowMs = Date.now();
  const at = new Date(nowMs).toISOString();
  st.seq += 1;
  const stamp = findEntry(`led_${nowMs}`) ? `${nowMs}_${st.seq}` : String(nowMs);
  const res = pickRule(m.id, m.status, text);
  const responseId = `chatcmpl-mock-${stamp}`;
  const usage: UsageRecord[] = res.usage.map((u) => ({ ...u, at, responseId: u.responseId ? responseId : null }));

  let reply = res.reply;
  let entry: LedgerEntryView | null = res.entry;

  if (!entry) {
    if (usage.some((u) => u.flow === "status_fastpath")) {
      const { spentUsd } = money(m.id, m.budgetUsd);
      reply = `Spent $${spentUsd.toFixed(2)} of $${m.budgetUsd.toFixed(2)}. Remaining $${(m.budgetUsd - spentUsd).toFixed(2)}. Mandate ${m.status}, expires ${m.expiresAt}.`;
    }
  } else {
    const e: LedgerEntryView = entry;
    e.id = `led_${stamp}`;
    e.mandateId = m.id;
    e.mandateHash = s.hash;
    e.at = at;
    e.proposal.requestedAt = at;
    e.proposal.sourceText = text;
    e.kilnResponseId = responseId;
    e.receiptHash = fakeHash(`receipt|${e.id}|${text}`);
    delete e.actualFeeUsd;
    delete e.settledAt;
    for (const r of e.reasons) if (r.code === "EXPIRED" || r.code === "BEFORE_START") r.observed = at;

    const name = e.merchantName ?? e.proposal.merchantId;
    if (e.decision === "APPROVE") {
      const stops = mockGuard(s, e, nowMs);
      if (stops.length > 0) {
        e.decision = "STOP";
        e.reasons = stops;
        e.status = "stopped";
        delete e.txHash;
        delete e.explorerUrl;
        usage.push(zeroUsage("stop_template", at));
        reply = `Stopped. I did not pay ${name} $${usd(e.proposal.amountUsd)}.\n${stops.map((x) => `• [${x.code}] ${x.message}`).join("\n")}`;
      } else {
        e.status = "pending";
        e.txHash = fakeHash(`tx|${e.id}`);
        e.explorerUrl = EXPLORER_TX + e.txHash;
        reply = `Approved. Paying ${name} $${usd(e.proposal.amountUsd)} for "${e.proposal.memo}" (est. network fee $${usd(e.feeUsd)}). Tx: ${e.explorerUrl}`;
      }
    } else {
      e.status = "stopped";
      delete e.txHash;
      delete e.explorerUrl;
    }
    ledgerOf(m.id).push(clone(e));
    st.sessionEntryIds.add(e.id);
    entry = e;
  }

  st.sessionUsage.push(...clone(usage));
  return { reply, entry, usage };
}

function findEntry(entryId: string): { list: LedgerEntryView[]; index: number } | null {
  for (const list of getStore().ledgers.values()) {
    const index = list.findIndex((e) => e.id === entryId);
    if (index >= 0) return { list, index };
  }
  return null;
}

function mockConfirm(entryId: string): ConfirmResponse {
  const hit = findEntry(entryId);
  if (!hit) throw notFound("Ledger entry", entryId);
  const e = hit.list[hit.index]!;
  if (!e.txHash) throw new ApiClientError(400, "NO_TX", `Entry "${entryId}" has no transaction to confirm.`);
  if (e.status === "pending" && Date.now() - new Date(e.at).getTime() >= SETTLE_AFTER_MS) {
    const updated: LedgerEntryView = {
      ...e,
      status: "settled",
      actualFeeUsd: fx.settled.actualFeeUsd,
      settledAt: new Date().toISOString(),
    };
    hit.list[hit.index] = updated;
  }
  const cur = hit.list[hit.index]!;
  let settlement: SettlementStatus;
  if (cur.status === "settled") settlement = { ...fx.settled, actualFeeUsd: cur.actualFeeUsd ?? fx.settled.actualFeeUsd };
  else if (cur.status === "failed") settlement = { state: "failed", reason: "Transaction reverted (mock)." };
  else settlement = { state: "pending" };
  return { entry: clone(cur), settlement };
}

function mockCreateMandate(body: CreateMandateRequest): CreateMandateResponse {
  const st = getStore();
  const bad = (message: string) => new ApiClientError(400, "VALIDATION_ERROR", message);
  if (!body.principal?.trim()) throw bad("Principal is required.");
  if (!body.traveler?.trim()) throw bad("Traveler is required.");
  if (!(body.budgetUsd > 0) || !Number.isFinite(body.budgetUsd)) throw bad("Budget must be a positive number.");
  if (!(body.perTxCapUsd > 0) || !Number.isFinite(body.perTxCapUsd)) throw bad("Per-transaction cap must be a positive number.");
  if (body.perTxCapUsd > body.budgetUsd) throw bad("Per-transaction cap cannot exceed the budget.");
  const starts = new Date(body.startsAt).getTime();
  const ends = new Date(body.expiresAt).getTime();
  if (!Number.isFinite(starts) || !Number.isFinite(ends)) throw bad("Window start and end must be ISO dates.");
  if (ends <= starts) throw bad("Window end must be after its start.");
  const known = new Set(fx.merchants.merchants.map((x) => x.id));
  const unknown = body.allowedMerchantIds.filter((id) => !known.has(id));
  if (unknown.length) throw bad(`Unknown merchant ids: ${unknown.join(", ")}.`);

  const id = body.id?.trim() || `man_${Date.now()}`;
  if (st.mandates.has(id)) throw new ApiClientError(409, "CONFLICT", `Mandate "${id}" already exists.`);

  const mandate: Mandate = {
    id,
    principal: body.principal.trim(),
    traveler: body.traveler.trim(),
    agentWallet: fx.health.agentAddress ?? "0x0000000000000000000000000000000000000000",
    budgetUsd: body.budgetUsd,
    perTxCapUsd: body.perTxCapUsd,
    allowedMerchantIds: [...body.allowedMerchantIds],
    allowedCategories: [...body.allowedCategories],
    blockedKeywords: [...body.blockedKeywords],
    startsAt: body.startsAt,
    expiresAt: body.expiresAt,
    catalog: clone(fx.merchants.merchants),
    status: "active",
  };
  const hash = fakeHash(JSON.stringify({ ...body, id }));
  const anchorTx = fakeHash(`anchor|${hash}`);
  const stored: StoredMandate = {
    mandate,
    hash,
    anchorTx,
    anchorUrl: EXPLORER_TX + anchorTx,
    createdAt: new Date().toISOString(),
    order: st.seq++,
  };
  st.mandates.set(id, stored);
  st.ledgers.set(id, []);
  return { mandate: toDetail(stored), anchor: { txHash: anchorTx, explorerUrl: EXPLORER_TX + anchorTx } };
}

function mockUsage(): UsageResponse {
  const base = clone(fx.usage);
  const rows = base.byFlow;
  for (const u of getStore().sessionUsage) {
    let row: UsageByFlowRow | undefined = rows.find((r) => r.flow === u.flow);
    if (!row) {
      row = { flow: u.flow, calls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0, avgLatencyMs: 0 };
      rows.push(row);
    }
    row.avgLatencyMs = Math.round((row.avgLatencyMs * row.calls + u.latencyMs) / (row.calls + 1));
    row.calls += 1;
    row.promptTokens += u.promptTokens;
    row.completionTokens += u.completionTokens;
    row.totalTokens += u.totalTokens;
    row.costUsd = tidy(row.costUsd + (u.costUsd ?? 0));
    base.totals.calls += 1;
    base.totals.promptTokens += u.promptTokens;
    base.totals.completionTokens += u.completionTokens;
    base.totals.totalTokens += u.totalTokens;
    base.totals.costUsd = tidy(base.totals.costUsd + (u.costUsd ?? 0));
    if (u.flow === "status_fastpath") base.zeroTokenCalls.statusFastpath += 1;
    if (u.flow === "stop_template") base.zeroTokenCalls.stopTemplate += 1;
  }
  base.energy.totalTokens = base.totals.totalTokens;
  base.energy.totalWh =
    base.energy.assumedJPerToken === null ? null : (base.totals.totalTokens * base.energy.assumedJPerToken) / 3600;
  return base;
}

/** Audit rebuilt from the mock store (identical to audit-man_A.json for the untouched man_A). */
function mockAudit(id: string): AuditResponse {
  const s = getStored(id);
  const mandate = toDetail(s);
  const ledger = [...ledgerOf(id)].sort((a, b) => a.at.localeCompare(b.at));
  const replay: ReplayResult[] = ledger.map((e) => ({
    entryId: e.id,
    storedDecision: e.decision,
    recomputedDecision: e.decision,
    consistent: true,
    mandateHashMatches: e.mandateHash === s.hash,
    recomputedReasons: clone(e.reasons),
  }));
  const transactions: TxCheck[] = ledger
    .filter((e): e is LedgerEntryView & { txHash: Hex } => Boolean(e.txHash))
    .map((e) => ({
      entryId: e.id,
      txHash: e.txHash,
      explorerUrl: e.explorerUrl ?? EXPLORER_TX + e.txHash,
      memo: `PERDIEM|${e.mandateHash}|${e.receiptHash ?? ""}`,
      memoMatches: true,
      receiptHashMatches: true,
      recipientMatches: true,
      amountMatches: true,
      valueUsd: e.proposal.amountUsd,
      to: s.mandate.catalog.find((c) => c.id === e.proposal.merchantId)?.wallet ?? null,
    }));
  const anchorMemoPrefix = fx.audit.anchor.memo?.split("|")[0] ?? "PERDIEM-MANDATE";
  const anchor = {
    txHash: s.anchorTx,
    explorerUrl: s.anchorUrl,
    memo: s.anchorTx ? `${anchorMemoPrefix}|${s.hash}` : null,
    matches: Boolean(s.anchorTx),
  };
  const checks = [
    anchor.matches,
    ...replay.flatMap((r) => [r.consistent, r.mandateHashMatches]),
    ...transactions.flatMap((t) => [t.memoMatches, t.receiptHashMatches, t.recipientMatches, t.amountMatches]),
  ];
  const passed = checks.filter(Boolean).length;
  return {
    mandate,
    mandateHash: s.hash,
    anchor,
    replay,
    transactions,
    summary: { passed, total: checks.length, allVerified: passed === checks.length },
  };
}

const mock: PerDiemApi = {
  async health() {
    await latency();
    return clone(fx.health);
  },
  async merchants() {
    await latency();
    return clone(fx.merchants);
  },
  async mandates() {
    await latency();
    // Newest first by insertion order (fixture createdAt values are fixed and may lie in the future).
    const list = [...getStore().mandates.values()].sort((a, b) => b.order - a.order);
    return { mandates: list.map(toSummary) };
  },
  async mandate(id) {
    await latency();
    const s = getStored(id);
    return { mandate: toDetail(s), ledger: clone(ledgerOf(id)) };
  },
  async createMandate(body) {
    await latency();
    return mockCreateMandate(body);
  },
  async updateMandateStatus(id, status) {
    await latency();
    const s = getStored(id);
    if (s.mandate.status === "revoked" && status !== "revoked") {
      throw new ApiClientError(409, "MANDATE_REVOKED", "A revoked mandate is final and cannot be resumed.");
    }
    s.mandate.status = status;
    return { mandate: toSummary(s) };
  },
  async chat(body) {
    await latency();
    return mockChat(body);
  },
  async ledger(mandateId) {
    await latency();
    getStored(mandateId);
    return { entries: clone(ledgerOf(mandateId)) };
  },
  async confirm(entryId) {
    await latency();
    return mockConfirm(entryId);
  },
  async usage() {
    await latency();
    return mockUsage();
  },
  async audit(mandateId) {
    await latency();
    return mockAudit(mandateId);
  },
};

export const api: PerDiemApi = API_MODE === "live" ? live : mock;
