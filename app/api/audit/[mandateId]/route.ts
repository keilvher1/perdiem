/**
 * GET /api/audit/[mandateId] → AuditResponse. The same checks as scripts/verify.ts, from the
 * records + Sepolia RPC:
 *  1. mandateHash recomputed from the PURE Mandate == memo of the anchor tx
 *  2. replayLedger(): every stored decision re-derived by policy.evaluate()
 *  3. every entry with a txHash (every broadcast payment, like scripts/verify.ts — not only the
 *     settled ones): calldata memo, receiptHash recomputation, recipient, amount
 *  4. every such entry whose ledger status is not yet "settled": its receipt on Sepolia must show
 *     it mined (a "failed" entry: reverted), so allVerified stays false while a payment is unmined
 * summary.passed / summary.total count the individual boolean checks (1 anchor + 2 per replayed
 * entry + 4 per tx + 1 per not-yet-settled tx). One or two RPC calls per tx: not meant to be polled.
 * Read-only: the ledger status is updated by /api/ledger/[id]/confirm, never here.
 */
import { NextResponse } from "next/server";
import type { AuditResponse, Hex, TxCheck } from "@/contracts/api";
import { explorerTxUrl, getSettlementStatus, readMemo } from "@/lib/chain";
import { getMandate, listLedger } from "@/lib/db";
import { findMerchant, mandateHash, receiptHash, replayLedger, type LedgerEntry, type Mandate } from "@/lib/policy";
import { toDetail } from "@/lib/view";
import { errorMessage, HttpError, noStore, toErrorResponse } from "../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ mandateId: string }> };

async function checkAnchor(anchorTx: Hex | null, hash: Hex): Promise<AuditResponse["anchor"]> {
  if (!anchorTx) return { txHash: null, explorerUrl: null, memo: null, matches: false };
  try {
    const { memo } = await readMemo(anchorTx);
    return { txHash: anchorTx, explorerUrl: explorerTxUrl(anchorTx), memo, matches: memo === `PERDIEM-MANDATE|${hash}` };
  } catch (err) {
    console.warn(JSON.stringify({ kind: "audit_warning", check: "anchor", txHash: anchorTx, message: errorMessage(err) }));
    return { txHash: anchorTx, explorerUrl: explorerTxUrl(anchorTx), memo: null, matches: false };
  }
}

async function checkTx(mandate: Mandate, hash: Hex, e: LedgerEntry & { txHash: Hex }): Promise<TxCheck> {
  const base = { entryId: e.id, txHash: e.txHash, explorerUrl: explorerTxUrl(e.txHash) };
  try {
    const tx = await readMemo(e.txHash);
    const rh = receiptHash(e);
    const merchant = findMerchant(mandate, e.proposal.merchantId);
    return {
      ...base,
      memo: tx.memo,
      // Against the hash recomputed from the terms (stricter than the entry's own copy).
      memoMatches: tx.memo === `PERDIEM|${hash}|${rh}`,
      receiptHashMatches: rh === e.receiptHash,
      recipientMatches: !!merchant && !!tx.to && tx.to.toLowerCase() === merchant.wallet.toLowerCase(),
      amountMatches: Math.abs(tx.valueUsd - e.proposal.amountUsd) < 0.01,
      valueUsd: tx.valueUsd,
      to: tx.to,
    };
  } catch (err) {
    console.warn(JSON.stringify({ kind: "audit_warning", check: "tx", entryId: e.id, txHash: e.txHash, message: errorMessage(err) }));
    return { ...base, memo: "", memoMatches: false, receiptHashMatches: false, recipientMatches: false, amountMatches: false, valueUsd: 0, to: null };
  }
}

/**
 * The chain agrees with a ledger entry that has not been confirmed as settled yet: pending/approved
 * → the receipt shows it mined successfully; failed (reverted, set by /confirm) → the receipt shows
 * the revert. Unmined, unknown or an RPC error → false.
 */
async function checkSettlement(e: LedgerEntry & { txHash: Hex }): Promise<boolean> {
  const expected = e.status === "failed" ? "failed" : "settled";
  try {
    const st = await getSettlementStatus(e.txHash);
    if (st.state !== expected) {
      console.warn(JSON.stringify({ kind: "audit_warning", check: "settlement", entryId: e.id, txHash: e.txHash, ledgerStatus: e.status, chainState: st.state }));
    }
    return st.state === expected;
  } catch (err) {
    console.warn(JSON.stringify({ kind: "audit_warning", check: "settlement", entryId: e.id, txHash: e.txHash, message: errorMessage(err) }));
    return false;
  }
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { mandateId } = await ctx.params;
    const row = await getMandate(mandateId);
    if (!row) throw new HttpError(404, "MANDATE_NOT_FOUND", `No mandate ${mandateId}.`);
    const ledger = await listLedger(mandateId);

    // Only the pure Mandate and pure LedgerEntry objects are hashed/replayed — never a view.
    const hash = mandateHash(row.mandate);
    // Every broadcast payment, whatever its ledger status (pending ones included).
    const paid = ledger.filter((e): e is LedgerEntry & { txHash: Hex } => !!e.txHash);
    const [anchor, transactions, settlement] = await Promise.all([
      checkAnchor(row.anchorTx, hash),
      Promise.all(paid.map((e) => checkTx(row.mandate, hash, e))),
      Promise.all(paid.filter((e) => e.status !== "settled").map(checkSettlement)),
    ]);
    const replay = replayLedger(row.mandate, ledger);

    const checks: boolean[] = [
      anchor.matches,
      ...replay.flatMap((r) => [r.consistent, r.mandateHashMatches]),
      ...transactions.flatMap((t) => [t.memoMatches, t.receiptHashMatches, t.recipientMatches, t.amountMatches]),
      ...settlement,
    ];
    const passed = checks.filter(Boolean).length;
    const body: AuditResponse = {
      mandate: toDetail(row, ledger),
      mandateHash: hash,
      anchor,
      replay,
      transactions,
      summary: { passed, total: checks.length, allVerified: passed === checks.length },
    };
    return noStore(NextResponse.json<AuditResponse>(body));
  } catch (err) {
    return toErrorResponse(err, "GET /api/audit/[mandateId]");
  }
}
