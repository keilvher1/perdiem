/**
 * GET /api/audit/[mandateId] → AuditResponse. The same checks as scripts/verify.ts, from the
 * records + Sepolia RPC (implemented in app/api/_lib/audit.ts, tested offline in tests/audit.test.ts):
 *  1. anchor: memo == `PERDIEM-MANDATE|<mandateHash recomputed from the PURE Mandate>`, and the
 *     anchor tx was sent by the mandate's agent wallet
 *  2. replayLedger(): per entry, it carries the mandate hash and its stored decision == policy.evaluate()
 *  3. every entry with a txHash (every broadcast payment, pending/failed included): receiptHash
 *     recomputation, calldata memo, recipient, amount, sent by the agent wallet, mined and succeeded
 *
 * summary.passed / summary.total count those boolean checks, one per ✅/❌ line that
 * `npm run verify -- evidence/mandate-<id>.json evidence/ledger-<id>.json` prints for the same records:
 *
 *   summary.total = (anchorTx ? 2 : 1) + 2 × ledger entries + 6 × ledger entries with a txHash
 *
 * e.g. 1 anchor + 5 entries + 2 payments = 2 + 10 + 12 = 24. anchor.matches and each TxCheck carry
 * the memo/receipt/recipient/amount results; the anchor sender, tx sender and tx mined results have
 * no contract field and show up in summary only (and as {"kind":"audit_warning"} lines when false).
 * Two RPC calls per tx + one for the anchor: not meant to be polled.
 * Read-only: the ledger status is updated by /api/ledger/[id]/confirm, never here.
 */
import { NextResponse } from "next/server";
import type { AuditResponse } from "@/contracts/api";
import { getMandate, listLedger } from "@/lib/db";
import { toDetail } from "@/lib/view";
import { auditRecords } from "../../_lib/audit";
import { HttpError, noStore, toErrorResponse } from "../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ mandateId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { mandateId } = await ctx.params;
    const row = await getMandate(mandateId);
    if (!row) throw new HttpError(404, "MANDATE_NOT_FOUND", `No mandate ${mandateId}.`);
    const ledger = await listLedger(mandateId);

    const audit = await auditRecords(row.mandate, row.anchorTx, ledger);
    const body: AuditResponse = {
      mandate: toDetail(row, ledger),
      mandateHash: audit.mandateHash,
      anchor: audit.anchor,
      replay: audit.replay,
      transactions: audit.transactions,
      summary: audit.summary,
    };
    return noStore(NextResponse.json<AuditResponse>(body));
  } catch (err) {
    return toErrorResponse(err, "GET /api/audit/[mandateId]");
  }
}
