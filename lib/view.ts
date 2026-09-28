import "server-only";
/**
 * lib/view.ts — domain objects → API view types (display only).
 * INTERFACE CONTRACT (Phase 0): the backend developer implements the bodies.
 * Never pass a view object to mandateHash/receiptHash/replayLedger/export.
 *
 * All functions are pure: they never mutate their inputs and never touch the network.
 */
import { findMerchant, SPEND_STATUSES, type LedgerEntry } from "./policy";
import { explorerTxUrl } from "./chain";
import type { MandateRow } from "./db";
import type { LedgerEntryView, MandateDetail, MandateSummary } from "../contracts/api";

/** merchantCategory from mandate.catalog, explorerUrl from lib/chain.ts explorerTxUrl. */
export function toEntryView(entry: LedgerEntry, row: MandateRow): LedgerEntryView {
  const view: LedgerEntryView = { ...entry, proposal: { ...entry.proposal }, reasons: entry.reasons.map((r) => ({ ...r })) };
  const category = findMerchant(row.mandate, entry.proposal.merchantId)?.category;
  if (category !== undefined) view.merchantCategory = category;
  if (entry.txHash) view.explorerUrl = explorerTxUrl(entry.txHash);
  return view;
}

/** Money figures shared by summary and detail. Unrounded on purpose (display rounds, math does not). */
function spend(row: MandateRow, ledger: LedgerEntry[]): { spentUsd: number; pendingUsd: number; remainingUsd: number } {
  let spentUsd = 0;
  let pendingUsd = 0;
  for (const e of ledger) {
    if (e.mandateId !== row.mandate.id) continue;
    if (SPEND_STATUSES.has(e.status)) spentUsd += e.totalUsd;
    if (e.status === "pending") pendingUsd += e.totalUsd;
  }
  return { spentUsd, pendingUsd, remainingUsd: row.mandate.budgetUsd - spentUsd };
}

function anchor(row: MandateRow): { anchorTx: MandateSummary["anchorTx"]; anchorUrl: string | null } {
  return { anchorTx: row.anchorTx, anchorUrl: row.anchorTx ? explorerTxUrl(row.anchorTx) : null };
}

/** spent = Σ totalUsd of approved|pending|settled; pending = Σ of pending; remaining = budget − spent. */
export function toSummary(row: MandateRow, ledger: LedgerEntry[]): MandateSummary {
  const m = row.mandate;
  return {
    id: m.id,
    principal: m.principal,
    traveler: m.traveler,
    budgetUsd: m.budgetUsd,
    perTxCapUsd: m.perTxCapUsd,
    status: m.status,
    startsAt: m.startsAt,
    expiresAt: m.expiresAt,
    hash: row.hash,
    ...anchor(row),
    ...spend(row, ledger),
    entryCount: ledger.filter((e) => e.mandateId === m.id).length,
    createdAt: row.createdAt,
  };
}

export function toDetail(row: MandateRow, ledger: LedgerEntry[]): MandateDetail {
  const m = row.mandate;
  return {
    ...m,
    allowedMerchantIds: [...m.allowedMerchantIds],
    allowedCategories: [...m.allowedCategories],
    blockedKeywords: [...m.blockedKeywords],
    catalog: m.catalog.map((c) => ({ ...c })),
    hash: row.hash,
    ...anchor(row),
    ...spend(row, ledger),
    createdAt: row.createdAt,
  };
}
