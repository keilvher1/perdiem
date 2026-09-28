/**
 * GET /api/ledger/[id]/confirm → ConfirmResponse. The client polls this after an APPROVE.
 *
 * Reads the receipt of the entry's txHash (getSettlementStatus — never waits for mining):
 *   settled → update status, actualFeeUsd, settledAt ONLY (all excluded from receiptHash)
 *   failed  → update status only
 *   pending → no write
 * A write prints {"kind":"settlement","mandateId","entryId","txHash","state",…,"at"} (_lib/events.ts).
 * 400 when the entry has no txHash (stopped, or broadcast failed); 502 when the RPC errors.
 */
import { NextResponse } from "next/server";
import type { ConfirmResponse, SettlementStatus } from "@/contracts/api";
import { getSettlementStatus } from "@/lib/chain";
import { getEntry, getMandate, updateEntry } from "@/lib/db";
import { toEntryView } from "@/lib/view";
import { logEvent } from "../../../_lib/events";
import { apiError, errorMessage, HttpError, noStore, toErrorResponse } from "../../../_lib/http";
import { withLock } from "../../../_lib/lock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    // Serialize polls of one entry so two tabs cannot both write settledAt.
    return await withLock(`entry:${id}`, async () => {
      const entry = await getEntry(id);
      if (!entry) throw new HttpError(404, "ENTRY_NOT_FOUND", `No ledger entry ${id}.`);
      if (!entry.txHash) {
        throw new HttpError(400, "NO_TX_HASH", `Entry ${id} has no transaction (status ${entry.status}); nothing to confirm.`);
      }
      const row = await getMandate(entry.mandateId);
      if (!row) throw new HttpError(404, "MANDATE_NOT_FOUND", `No mandate ${entry.mandateId}.`);

      let settlement: SettlementStatus;
      try {
        settlement = await getSettlementStatus(entry.txHash);
      } catch (err) {
        return apiError(502, "RPC_ERROR", `Sepolia RPC error while reading ${entry.txHash}: ${errorMessage(err)}`);
      }

      let current = entry;
      if (settlement.state === "settled" && entry.status !== "settled") {
        const settledAt = new Date().toISOString();
        current = await updateEntry(id, { status: "settled", actualFeeUsd: settlement.actualFeeUsd, settledAt });
        logEvent({ kind: "settlement", mandateId: entry.mandateId, entryId: id, txHash: entry.txHash, state: "settled", blockNumber: settlement.blockNumber, actualFeeUsd: settlement.actualFeeUsd, at: settledAt });
      } else if (settlement.state === "failed" && entry.status !== "failed") {
        current = await updateEntry(id, { status: "failed" });
        logEvent({ kind: "settlement", mandateId: entry.mandateId, entryId: id, txHash: entry.txHash, state: "failed", reason: settlement.reason, at: new Date().toISOString() });
      }

      const body: ConfirmResponse = { entry: toEntryView(current, row), settlement };
      return noStore(NextResponse.json<ConfirmResponse>(body));
    });
  } catch (err) {
    return toErrorResponse(err, "GET /api/ledger/[id]/confirm");
  }
}
