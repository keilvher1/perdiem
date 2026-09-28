/**
 * GET  /api/mandates → MandatesResponse (newest first, spent/pending/remaining from the ledger)
 * POST /api/mandates  CreateMandateRequest → 201 CreateMandateResponse
 *
 * POST: validate → catalog snapshot (merchants table) + env agent wallet + status active →
 * mandateHash → anchorMandate (broadcast only, spends gas) → save. Everything that can refuse
 * the request (validation, unknown merchants, duplicate id) runs BEFORE the anchor tx.
 */
import { NextResponse } from "next/server";
import type { CreateMandateResponse, MandatesResponse } from "@/contracts/api";
import { agentAccount, anchorMandate } from "@/lib/chain";
import { createMandate, DbError, getMandate, listLedgerForMandates, listMandates, listMerchants } from "@/lib/db";
import { mandateHash } from "@/lib/policy";
import { toDetail, toSummary } from "@/lib/view";
import { apiError, errorMessage, HttpError, noStore, readJson, toErrorResponse } from "../_lib/http";
import { withLock } from "../_lib/lock";
import { buildMandate, CreateMandateSchema, unknownMerchantIds } from "../_lib/mandate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await listMandates();
    const ledgers = await listLedgerForMandates(rows.map((r) => r.mandate.id));
    const body: MandatesResponse = { mandates: rows.map((r) => toSummary(r, ledgers.get(r.mandate.id) ?? [])) };
    return noStore(NextResponse.json<MandatesResponse>(body));
  } catch (err) {
    return toErrorResponse(err, "GET /api/mandates");
  }
}

export async function POST(req: Request) {
  try {
    const input = await readJson(req, CreateMandateSchema);

    const catalog = await listMerchants();
    if (catalog.length === 0) {
      throw new HttpError(409, "NO_MERCHANTS", "The merchant catalog is empty; run `npm run seed` first.");
    }
    const unknown = unknownMerchantIds(input, catalog);
    if (unknown.length > 0) {
      throw new HttpError(400, "UNKNOWN_MERCHANT_IDS", `Not in the merchant catalog: ${unknown.join(", ")}`, { unknown });
    }

    let agentWallet;
    try {
      agentWallet = agentAccount().address;
    } catch (err) {
      throw new HttpError(500, "WALLET_UNAVAILABLE", errorMessage(err));
    }
    const mandate = buildMandate(input, catalog, agentWallet, new Date());

    return await withLock(`mandate:${mandate.id}`, async () => {
      if (await getMandate(mandate.id)) {
        throw new HttpError(409, "MANDATE_EXISTS", `Mandate ${mandate.id} already exists.`);
      }
      const hash = mandateHash(mandate);

      let anchor;
      try {
        anchor = await anchorMandate(hash); // broadcast only — confirmation is visible via the explorer
      } catch (err) {
        // viem's shortMessage: the full message can echo the RPC URL, which may embed an API key.
        const msg = (err as { shortMessage?: string }).shortMessage ?? errorMessage(err);
        console.error(JSON.stringify({ kind: "api_error", route: "POST /api/mandates", code: "ANCHOR_FAILED", message: msg }));
        return apiError(502, "ANCHOR_FAILED", `Could not broadcast the mandate anchor: ${msg}`);
      }

      try {
        const row = await createMandate(mandate, hash, anchor.txHash);
        console.log(JSON.stringify({ kind: "mandate_created", mandateId: row.mandate.id, hash, anchorTx: anchor.txHash }));
        const body: CreateMandateResponse = { mandate: toDetail(row, []), anchor };
        return noStore(NextResponse.json<CreateMandateResponse>(body, { status: 201 }));
      } catch (err) {
        // The anchor is already on its way: keep its hash in the error so it is never lost.
        const status = err instanceof DbError && err.isDuplicate ? 409 : 502;
        return apiError(status, status === 409 ? "MANDATE_EXISTS" : "DB_ERROR", errorMessage(err), { anchorTx: anchor.txHash });
      }
    });
  } catch (err) {
    return toErrorResponse(err, "POST /api/mandates");
  }
}
