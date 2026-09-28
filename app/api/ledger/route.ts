/** GET /api/ledger?mandateId=... → LedgerResponse (oldest first). */
import { NextResponse, type NextRequest } from "next/server";
import type { LedgerResponse } from "@/contracts/api";
import { getMandate, listLedger } from "@/lib/db";
import { toEntryView } from "@/lib/view";
import { HttpError, noStore, toErrorResponse } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const mandateId = req.nextUrl.searchParams.get("mandateId")?.trim();
    if (!mandateId) throw new HttpError(400, "VALIDATION_FAILED", "mandateId query parameter is required.");
    const row = await getMandate(mandateId);
    if (!row) throw new HttpError(404, "MANDATE_NOT_FOUND", `No mandate ${mandateId}.`);
    const entries = await listLedger(mandateId);
    const body: LedgerResponse = { entries: entries.map((e) => toEntryView(e, row)) };
    return noStore(NextResponse.json<LedgerResponse>(body));
  } catch (err) {
    return toErrorResponse(err, "GET /api/ledger");
  }
}
