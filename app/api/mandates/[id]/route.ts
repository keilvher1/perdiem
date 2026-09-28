/**
 * GET   /api/mandates/[id] → MandateDetailResponse (mandate + ledger, oldest first)
 * PATCH /api/mandates/[id]  UpdateMandateStatusRequest → UpdateMandateStatusResponse
 *
 * Status is not part of the mandate hash, so Pause/Resume never breaks the on-chain anchor.
 * Revoked is final: revoked → active|paused is a 409.
 * Logs (shapes in _lib/events.ts): every accepted PATCH — pause, resume and revoke, also a no-op —
 * prints {"kind":"mandate_status","mandateId","from","to","changed","at"}; a 409 prints
 * {"kind":"mandate_status_refused",…,"code":"MANDATE_REVOKED","at"} instead.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import type { MandateDetailResponse, UpdateMandateStatusResponse } from "@/contracts/api";
import { getMandate, listLedger, updateMandateStatus } from "@/lib/db";
import { toDetail, toEntryView, toSummary } from "@/lib/view";
import { logEvent } from "../../_lib/events";
import { HttpError, noStore, readJson, toErrorResponse } from "../../_lib/http";
import { withLock } from "../../_lib/lock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const PatchSchema = z.object({ status: z.enum(["active", "paused", "revoked"]) });

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const row = await getMandate(id);
    if (!row) throw new HttpError(404, "MANDATE_NOT_FOUND", `No mandate ${id}.`);
    const ledger = await listLedger(id);
    const body: MandateDetailResponse = { mandate: toDetail(row, ledger), ledger: ledger.map((e) => toEntryView(e, row)) };
    return noStore(NextResponse.json<MandateDetailResponse>(body));
  } catch (err) {
    return toErrorResponse(err, "GET /api/mandates/[id]");
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { status } = await readJson(req, PatchSchema);
    // Same lock as POST /api/chat: once this returns, no in-flight purchase still sees the old status.
    return await withLock(`mandate:${id}`, async () => {
      const row = await getMandate(id);
      if (!row) throw new HttpError(404, "MANDATE_NOT_FOUND", `No mandate ${id}.`);
      const from = row.mandate.status;
      if (from === "revoked" && status !== "revoked") {
        logEvent({ kind: "mandate_status_refused", mandateId: id, from, to: status, code: "MANDATE_REVOKED", at: new Date().toISOString() });
        throw new HttpError(409, "MANDATE_REVOKED", `Mandate ${id} is revoked; a revoked mandate cannot become ${status}.`, { from, to: status });
      }
      const changed = from !== status;
      const next = changed ? await updateMandateStatus(id, status) : row;
      logEvent({ kind: "mandate_status", mandateId: id, from, to: status, changed, at: new Date().toISOString() });
      const body: UpdateMandateStatusResponse = { mandate: toSummary(next, await listLedger(id)) };
      return noStore(NextResponse.json<UpdateMandateStatusResponse>(body));
    });
  } catch (err) {
    return toErrorResponse(err, "PATCH /api/mandates/[id]");
  }
}
