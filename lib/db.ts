import "server-only";
/**
 * lib/db.ts — Supabase persistence (server only, service-role key).
 *
 * INTERFACE CONTRACT (fixed in Phase 0 so backend, scripts and integration can work in parallel):
 * the signatures below are the API. The backend developer implements the bodies; nobody else
 * changes the signatures without updating every caller in the same commit.
 *
 * Rules (CLAUDE.md #8): getMandate/listMandates merge the `mandates.status` column over the stored
 * JSON; hash/anchorTx/createdAt stay BESIDE the pure Mandate. updateEntry may change only
 * status | txHash | actualFeeUsd | settledAt and must rewrite both the json column and the
 * status/tx_hash columns. Scripts import this file via `tsx --conditions=react-server`.
 *
 * Implementation notes:
 *  - The service-role key bypasses RLS (RLS is ON with no policies on purpose). Never expose it.
 *  - Every Supabase error is rethrown as a DbError whose message carries op, message, details, hint.
 *  - Objects read back are rebuilt from a key whitelist, so what leaves this module is always a
 *    pure domain object (never a view with merchantCategory/explorerUrl, never DB columns).
 */
import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";
import type { Hex } from "viem";
import type { LedgerEntry, LedgerStatus, Mandate, MandateStatus, Merchant } from "./policy";
import type { UsageRecord } from "./kiln";
import type { FlowName, UsageByFlowRow, UsageResponse } from "../contracts/api";

export interface MandateRow {
  mandate: Mandate; // pure Mandate (terms + merged status) — the only thing ever hashed/replayed/exported
  hash: Hex;
  anchorTx: Hex | null;
  createdAt: string;
}

/** The only fields that may change after a ledger entry is written (they are excluded from receiptHash). */
export type EntryPatch = Partial<Pick<LedgerEntry, "status" | "txHash" | "actualFeeUsd" | "settledAt">>;

// ---------------------------------------------------------------------------
// Client + errors
// ---------------------------------------------------------------------------

/** A Supabase/PostgREST failure with the operation name attached. `code` is the PostgREST/PG code. */
export class DbError extends Error {
  constructor(
    readonly op: string,
    readonly code: string | null,
    readonly pgMessage: string,
    readonly details: string | null = null,
    readonly hint: string | null = null,
  ) {
    super(
      `db.${op}: ${pgMessage}` +
        (details ? ` | details: ${details}` : "") +
        (hint ? ` | hint: ${hint}` : "") +
        (code ? ` [${code}]` : ""),
    );
    this.name = "DbError";
  }
  /** Unique-key violation (e.g. a mandate id that already exists). */
  get isDuplicate(): boolean {
    return this.code === "23505";
  }
  get isNotFound(): boolean {
    return this.code === "NOT_FOUND";
  }
}

function fail(op: string, e: PostgrestError): never {
  throw new DbError(op, e.code || null, e.message || "unknown error", e.details || null, e.hint || null);
}

let client: SupabaseClient | null = null;

function sb(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new DbError("client", "CONFIG", "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    // Route Handlers must always read fresh rows (never Next's fetch cache).
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  return client;
}

// ---------------------------------------------------------------------------
// Row mapping (DB row → pure domain object)
// ---------------------------------------------------------------------------

interface MandateDbRow {
  id: string;
  json: Mandate;
  hash: string;
  status: MandateStatus;
  anchor_tx: string | null;
  created_at: string;
}

interface LedgerDbRow {
  id: string;
  mandate_id: string;
  json: LedgerEntry;
  status: LedgerStatus;
  tx_hash: string | null;
  created_at: string;
}

const MANDATE_COLS = "id,json,hash,status,anchor_tx,created_at";
const LEDGER_COLS = "id,mandate_id,json,status,tx_hash,created_at";

function iso(ts: string): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toISOString();
}

/** Exactly the Mandate fields, status taken from the column (the JSON copy may lag behind). */
function pureMandate(json: Mandate, status: MandateStatus): Mandate {
  return {
    id: json.id,
    principal: json.principal,
    traveler: json.traveler,
    agentWallet: json.agentWallet,
    budgetUsd: json.budgetUsd,
    perTxCapUsd: json.perTxCapUsd,
    allowedMerchantIds: json.allowedMerchantIds,
    allowedCategories: json.allowedCategories,
    blockedKeywords: json.blockedKeywords,
    startsAt: json.startsAt,
    expiresAt: json.expiresAt,
    catalog: json.catalog.map((c) => ({ id: c.id, name: c.name, category: c.category, wallet: c.wallet })),
    status,
  };
}

function toMandateRow(r: MandateDbRow): MandateRow {
  return {
    mandate: pureMandate(r.json, r.status),
    hash: r.hash as Hex,
    anchorTx: (r.anchor_tx as Hex | null) ?? null,
    createdAt: iso(r.created_at),
  };
}

const LEDGER_KEYS = [
  "id", "mandateId", "mandateHash", "proposal", "merchantName", "decision", "reasons", "feeUsd",
  "feeSource", "totalUsd", "status", "txHash", "receiptHash", "actualFeeUsd", "settledAt",
  "kilnResponseId", "toolArgsRaw", "at",
] as const satisfies ReadonlyArray<keyof LedgerEntry>;

/** Pure LedgerEntry: whitelisted keys only (undefined dropped), status/tx_hash columns merged over json. */
function pureEntry(json: LedgerEntry, status: LedgerStatus, txHash: string | null | undefined): LedgerEntry {
  const merged: Record<string, unknown> = { ...json, status };
  if (txHash) merged.txHash = txHash;
  const out: Record<string, unknown> = {};
  for (const k of LEDGER_KEYS) if (merged[k] !== undefined) out[k] = merged[k];
  return out as unknown as LedgerEntry;
}

function toEntry(r: LedgerDbRow): LedgerEntry {
  return pureEntry(r.json, r.status, r.tx_hash);
}

// ---------------------------------------------------------------------------
// Probe
// ---------------------------------------------------------------------------

/**
 * Fast connectivity check (no retries: supabase-js would otherwise retry a failed GET 3× over 7 s).
 * Throws DbError when the database is unreachable or misconfigured.
 * `responseIdColumn` tells whether the `usage_records.response_id` migration has been applied.
 */
export async function dbProbe(): Promise<{ latencyMs: number; mandates: number; responseIdColumn: boolean }> {
  const t0 = Date.now();
  const { count, error } = await sb().from("mandates").select("id", { count: "exact" }).limit(1).retry(false);
  if (error) fail("dbProbe", error);
  const col = await sb().from("usage_records").select("response_id").limit(1).retry(false);
  const responseIdColumn = !col.error;
  usageHasResponseId = responseIdColumn;
  return { latencyMs: Date.now() - t0, mandates: count ?? 0, responseIdColumn };
}

// ---------------------------------------------------------------------------
// Mandates
// ---------------------------------------------------------------------------

/** One mandate with the status column merged over the JSON, or null. */
export async function getMandate(id: string): Promise<MandateRow | null> {
  const { data, error } = await sb().from("mandates").select(MANDATE_COLS).eq("id", id).maybeSingle();
  if (error) fail("getMandate", error);
  return data ? toMandateRow(data as MandateDbRow) : null;
}

/** All mandates, newest first. */
export async function listMandates(): Promise<MandateRow[]> {
  const { data, error } = await sb()
    .from("mandates")
    .select(MANDATE_COLS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) fail("listMandates", error);
  return (data as MandateDbRow[]).map(toMandateRow);
}

export async function createMandate(mandate: Mandate, hash: Hex, anchorTx: Hex | null): Promise<MandateRow> {
  const json = pureMandate(mandate, mandate.status);
  const { data, error } = await sb()
    .from("mandates")
    .insert({ id: json.id, json, hash, status: json.status, anchor_tx: anchorTx })
    .select(MANDATE_COLS)
    .single();
  if (error) fail("createMandate", error);
  return toMandateRow(data as MandateDbRow);
}

/** Updates the status column AND json.status. */
export async function updateMandateStatus(id: string, status: MandateStatus): Promise<MandateRow> {
  const cur = await sb().from("mandates").select("json").eq("id", id).maybeSingle();
  if (cur.error) fail("updateMandateStatus.read", cur.error);
  if (!cur.data) throw new DbError("updateMandateStatus", "NOT_FOUND", `mandate ${id} not found`);
  const json = { ...(cur.data as { json: Mandate }).json, status };
  const { data, error } = await sb()
    .from("mandates")
    .update({ status, json })
    .eq("id", id)
    .select(MANDATE_COLS)
    .single();
  if (error) fail("updateMandateStatus", error);
  return toMandateRow(data as MandateDbRow);
}

// ---------------------------------------------------------------------------
// Merchants
// ---------------------------------------------------------------------------

export async function listMerchants(): Promise<Merchant[]> {
  const { data, error } = await sb().from("merchants").select("id,name,category,wallet").order("id");
  if (error) fail("listMerchants", error);
  return (data as Merchant[]).map((m) => ({ id: m.id, name: m.name, category: m.category, wallet: m.wallet }));
}

export async function upsertMerchants(merchants: Merchant[]): Promise<void> {
  if (merchants.length === 0) return;
  const rows = merchants.map((m) => ({ id: m.id, name: m.name, category: m.category, wallet: m.wallet }));
  const { error } = await sb().from("merchants").upsert(rows, { onConflict: "id" });
  if (error) fail("upsertMerchants", error);
}

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

/** Ledger entries of one mandate, oldest first (status/tx_hash columns merged over json). */
export async function listLedger(mandateId: string): Promise<LedgerEntry[]> {
  const { data, error } = await sb()
    .from("ledger_entries")
    .select(LEDGER_COLS)
    .eq("mandate_id", mandateId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) fail("listLedger", error);
  return (data as LedgerDbRow[]).map(toEntry);
}

/** Additive: ledgers of many mandates in one query (for GET /api/mandates). Oldest first per mandate. */
export async function listLedgerForMandates(mandateIds: string[]): Promise<Map<string, LedgerEntry[]>> {
  const out = new Map<string, LedgerEntry[]>(mandateIds.map((id) => [id, []]));
  if (mandateIds.length === 0) return out;
  const { data, error } = await sb()
    .from("ledger_entries")
    .select(LEDGER_COLS)
    .in("mandate_id", mandateIds)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) fail("listLedgerForMandates", error);
  for (const r of data as LedgerDbRow[]) out.get(r.mandate_id)?.push(toEntry(r));
  return out;
}

export async function getEntry(id: string): Promise<LedgerEntry | null> {
  const { data, error } = await sb().from("ledger_entries").select(LEDGER_COLS).eq("id", id).maybeSingle();
  if (error) fail("getEntry", error);
  return data ? toEntry(data as LedgerDbRow) : null;
}

export async function saveEntry(entry: LedgerEntry): Promise<void> {
  const json = pureEntry(entry, entry.status, entry.txHash);
  const { error } = await sb().from("ledger_entries").insert({
    id: json.id,
    mandate_id: json.mandateId,
    json,
    status: json.status,
    tx_hash: json.txHash ?? null,
    created_at: json.at,
  });
  if (error) fail("saveEntry", error);
}

const PATCH_KEYS = ["status", "txHash", "actualFeeUsd", "settledAt"] as const satisfies ReadonlyArray<keyof EntryPatch>;

export async function updateEntry(id: string, patch: EntryPatch): Promise<LedgerEntry> {
  const cur = await sb().from("ledger_entries").select(LEDGER_COLS).eq("id", id).maybeSingle();
  if (cur.error) fail("updateEntry.read", cur.error);
  if (!cur.data) throw new DbError("updateEntry", "NOT_FOUND", `ledger entry ${id} not found`);
  // Runtime whitelist too: a caller that casts around EntryPatch still cannot touch hashed fields.
  const picked: EntryPatch = {};
  for (const k of PATCH_KEYS) if (patch[k] !== undefined) Object.assign(picked, { [k]: patch[k] });
  const merged: LedgerEntry = { ...toEntry(cur.data as LedgerDbRow), ...picked };
  const next = pureEntry(merged, merged.status, merged.txHash);
  const { data, error } = await sb()
    .from("ledger_entries")
    .update({ json: next, status: next.status, tx_hash: next.txHash ?? null })
    .eq("id", id)
    .select(LEDGER_COLS)
    .single();
  if (error) fail("updateEntry", error);
  return toEntry(data as LedgerDbRow);
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

/**
 * Whether usage_records has the `response_id` column (migration `usage_response_id`).
 * null = unknown yet. If the column is missing the record is still saved without the id and a
 * warning is logged — metrics must never break because of evidence plumbing.
 */
let usageHasResponseId: boolean | null = null;

function isMissingColumn(e: PostgrestError, column: string): boolean {
  return e.code === "PGRST204" || e.code === "42703" || (e.message ?? "").includes(column);
}

export async function saveUsage(record: UsageRecord, mandateId?: string): Promise<void> {
  const row = {
    mandate_id: mandateId ?? null,
    flow: record.flow,
    model: record.model,
    prompt_tokens: Math.round(record.promptTokens),
    completion_tokens: Math.round(record.completionTokens),
    total_tokens: Math.round(record.totalTokens),
    cost_usd: record.costUsd,
    latency_ms: Math.round(record.latencyMs),
    created_at: record.at,
  };
  if (usageHasResponseId !== false) {
    const { error } = await sb().from("usage_records").insert({ ...row, response_id: record.responseId });
    if (!error) {
      usageHasResponseId = true;
      return;
    }
    if (!isMissingColumn(error, "response_id")) fail("saveUsage", error);
    usageHasResponseId = false;
    console.warn(
      JSON.stringify({
        kind: "db_warning",
        op: "saveUsage",
        message: "usage_records.response_id is missing — apply migration usage_response_id (docs/schema.sql); saving without it",
      }),
    );
  }
  const { error } = await sb().from("usage_records").insert(row);
  if (error) fail("saveUsage", error);
}

const FLOW_ORDER: FlowName[] = ["propose", "status_fastpath", "stop_template", "compare", "explain", "audit", "other"];

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Rows of the usage_by_flow_v view (numbers guaranteed, cost_usd coalesced to 0). */
export async function usageByFlow(): Promise<UsageByFlowRow[]> {
  const { data, error } = await sb()
    .from("usage_by_flow_v")
    .select("flow,calls,prompt_tokens,completion_tokens,total_tokens,cost_usd,avg_latency_ms");
  if (error) fail("usageByFlow", error);
  const rank = (f: string) => {
    const i = FLOW_ORDER.indexOf(f as FlowName);
    return i === -1 ? FLOW_ORDER.length : i;
  };
  return (data as Record<string, unknown>[])
    .map(
      (r): UsageByFlowRow => ({
        flow: String(r.flow) as FlowName,
        calls: num(r.calls),
        promptTokens: num(r.prompt_tokens),
        completionTokens: num(r.completion_tokens),
        totalTokens: num(r.total_tokens),
        costUsd: num(r.cost_usd), // sum() over all-null costs is NULL → 0
        avgLatencyMs: num(r.avg_latency_ms),
      }),
    )
    .sort((a, b) => rank(a.flow) - rank(b.flow) || a.flow.localeCompare(b.flow));
}

/** Additive: totals over all flows (the sum of usageByFlow(); pass rows to avoid a second query). */
export async function usageTotals(rows?: UsageByFlowRow[]): Promise<UsageResponse["totals"]> {
  const byFlow = rows ?? (await usageByFlow());
  return byFlow.reduce(
    (t, r) => ({
      calls: t.calls + r.calls,
      promptTokens: t.promptTokens + r.promptTokens,
      completionTokens: t.completionTokens + r.completionTokens,
      totalTokens: t.totalTokens + r.totalTokens,
      costUsd: t.costUsd + r.costUsd,
    }),
    { calls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0 },
  );
}
