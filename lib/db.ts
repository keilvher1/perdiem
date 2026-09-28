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
 */
import type { Hex } from "viem";
import type { LedgerEntry, Mandate, MandateStatus, Merchant } from "./policy";
import type { UsageRecord } from "./kiln";
import type { UsageByFlowRow } from "../contracts/api";

export interface MandateRow {
  mandate: Mandate; // pure Mandate (terms + merged status) — the only thing ever hashed/replayed/exported
  hash: Hex;
  anchorTx: Hex | null;
  createdAt: string;
}

/** The only fields that may change after a ledger entry is written (they are excluded from receiptHash). */
export type EntryPatch = Partial<Pick<LedgerEntry, "status" | "txHash" | "actualFeeUsd" | "settledAt">>;

const todo = (fn: string): never => {
  throw new Error(`lib/db.ts ${fn}: not implemented yet`);
};

/** One mandate with the status column merged over the JSON, or null. */
export async function getMandate(id: string): Promise<MandateRow | null> { void id; return todo("getMandate"); }
/** All mandates, newest first. */
export async function listMandates(): Promise<MandateRow[]> { return todo("listMandates"); }
export async function createMandate(mandate: Mandate, hash: Hex, anchorTx: Hex | null): Promise<MandateRow> { void mandate; void hash; void anchorTx; return todo("createMandate"); }
/** Updates the status column AND json.status. */
export async function updateMandateStatus(id: string, status: MandateStatus): Promise<MandateRow> { void id; void status; return todo("updateMandateStatus"); }

export async function listMerchants(): Promise<Merchant[]> { return todo("listMerchants"); }
export async function upsertMerchants(merchants: Merchant[]): Promise<void> { void merchants; return todo("upsertMerchants"); }

/** Ledger entries of one mandate, oldest first (status/tx_hash columns merged over json). */
export async function listLedger(mandateId: string): Promise<LedgerEntry[]> { void mandateId; return todo("listLedger"); }
export async function getEntry(id: string): Promise<LedgerEntry | null> { void id; return todo("getEntry"); }
export async function saveEntry(entry: LedgerEntry): Promise<void> { void entry; return todo("saveEntry"); }
export async function updateEntry(id: string, patch: EntryPatch): Promise<LedgerEntry> { void id; void patch; return todo("updateEntry"); }

export async function saveUsage(record: UsageRecord, mandateId?: string): Promise<void> { void record; void mandateId; return todo("saveUsage"); }
/** Rows of the usage_by_flow_v view (numbers guaranteed, cost_usd coalesced to 0). */
export async function usageByFlow(): Promise<UsageByFlowRow[]> { return todo("usageByFlow"); }
