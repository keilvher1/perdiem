/**
 * GET /api/audit/[mandateId] → AuditResponse. The same checks as scripts/verify.ts, from the
 * records + Sepolia RPC:
 *  1. mandateHash recomputed from the PURE Mandate == memo of the anchor tx
 *  2. replayLedger(): every stored decision re-derived by policy.evaluate()
 *  3. every SETTLED entry: calldata memo, receiptHash recomputation, recipient, amount
 * summary.passed / summary.total count the individual boolean checks (1 anchor + 2 per replayed
 * entry + 4 per tx). One RPC call per tx: this route is not meant to be polled.
 */
import { NextResponse } from "next/server";
import type { AuditResponse, Hex, TxCheck } from "@/contracts/api";
import { explorerTxUrl, readMemo } from "@/lib/chain";
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

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { mandateId } = await ctx.params;
    const row = await getMandate(mandateId);
    if (!row) throw new HttpError(404, "MANDATE_NOT_FOUND", `No mandate ${mandateId}.`);
    const ledger = await listLedger(mandateId);

    // Only the pure Mandate and pure LedgerEntry objects are hashed/replayed — never a view.
    const hash = mandateHash(row.mandate);
    const settled = ledger.filter((e): e is LedgerEntry & { txHash: Hex } => e.status === "settled" && !!e.txHash);
    const [anchor, transactions] = await Promise.all([
      checkAnchor(row.anchorTx, hash),
      Promise.all(settled.map((e) => checkTx(row.mandate, hash, e))),
    ]);
    const replay = replayLedger(row.mandate, ledger);

    const checks: boolean[] = [
      anchor.matches,
      ...replay.flatMap((r) => [r.consistent, r.mandateHashMatches]),
      ...transactions.flatMap((t) => [t.memoMatches, t.receiptHashMatches, t.recipientMatches, t.amountMatches]),
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
