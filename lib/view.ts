import "server-only";
/**
 * lib/view.ts — domain objects → API view types (display only).
 * INTERFACE CONTRACT (Phase 0): the backend developer implements the bodies.
 * Never pass a view object to mandateHash/receiptHash/replayLedger/export.
 */
import type { LedgerEntry } from "./policy";
import type { MandateRow } from "./db";
import type { LedgerEntryView, MandateDetail, MandateSummary } from "../contracts/api";

const todo = (fn: string): never => {
  throw new Error(`lib/view.ts ${fn}: not implemented yet`);
};

/** merchantCategory from mandate.catalog, explorerUrl from lib/chain.ts explorerTxUrl. */
export function toEntryView(entry: LedgerEntry, row: MandateRow): LedgerEntryView { void entry; void row; return todo("toEntryView"); }
/** spent = Σ totalUsd of approved|pending|settled; pending = Σ of pending; remaining = budget − spent. */
export function toSummary(row: MandateRow, ledger: LedgerEntry[]): MandateSummary { void row; void ledger; return todo("toSummary"); }
export function toDetail(row: MandateRow, ledger: LedgerEntry[]): MandateDetail { void row; void ledger; return todo("toDetail"); }
