/** GET /api/merchants → MerchantsResponse (the catalog new mandates snapshot). */
import { NextResponse } from "next/server";
import type { MerchantsResponse } from "@/contracts/api";
import { listMerchants } from "@/lib/db";
import { noStore, toErrorResponse } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const body: MerchantsResponse = { merchants: await listMerchants() };
    return noStore(NextResponse.json<MerchantsResponse>(body));
  } catch (err) {
    return toErrorResponse(err, "GET /api/merchants");
  }
}
