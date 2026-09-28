/**
 * POST /api/chat  ChatRequest → ChatResponse
 *
 * mandate (status column merged) + ledger → lib/agent.ts handleTravelerMessage():
 * fast-path | Kiln propose → policy.evaluate() → STOP (recorded, no chain call) | APPROVE (broadcast).
 * Requests for one mandate are serialized (see _lib/lock.ts). Every decision is logged as one JSON
 * line: {"kind":"decision","mandateId","entryId","decision","codes":[...]} → evidence/logs-stop.txt.
 * A payment that was broadcast but could not be written to the ledger is never silent: 502
 * PAYMENT_NOT_RECORDED (details.txHash) and, until it is written, 409 LEDGER_UNRECONCILED for the
 * next request of that mandate (see _lib/ledger-write.ts).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import type { ChatResponse } from "@/contracts/api";
import { handleTravelerMessage } from "@/lib/agent";
import { getMandate, listLedger, saveEntry, saveUsage } from "@/lib/db";
import { toEntryView } from "@/lib/view";
import { HttpError, noStore, readJson, toErrorResponse } from "../_lib/http";
import { createLedgerWriter } from "../_lib/ledger-write";
import { withLock } from "../_lib/lock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ChatSchema = z.object({
  mandateId: z.string().trim().min(1).max(128),
  text: z.string().trim().min(1).max(1000),
});

/** Retries once; a broadcast payment that still cannot be saved is kept and blocks new spend. */
const ledger = createLedgerWriter({ save: saveEntry });

export async function POST(req: Request) {
  try {
    const { mandateId, text } = await readJson(req, ChatSchema);
    return await withLock(`mandate:${mandateId}`, async () => {
      // A payment that left the wallet but is missing from the ledger must be written first:
      // spent-so-far and DUPLICATE are computed from listLedger() below.
      await ledger.reconcile(mandateId);
      const row = await getMandate(mandateId);
      if (!row) throw new HttpError(404, "MANDATE_NOT_FOUND", `No mandate ${mandateId}.`);
      const entries = await listLedger(mandateId);

      const r = await handleTravelerMessage(text, {
        mandate: row.mandate,
        ledger: entries,
        saveEntry: ledger.saveDecision,
        saveUsage: (u) => saveUsage(u, mandateId),
      });

      if (r.entry) {
        console.log(
          JSON.stringify({
            kind: "decision",
            mandateId,
            entryId: r.entry.id,
            decision: r.entry.decision,
            codes: r.entry.reasons.map((x) => x.code),
            status: r.entry.status,
            txHash: r.entry.txHash ?? null,
            kilnResponseId: r.entry.kilnResponseId ?? null,
            at: r.entry.at,
          }),
        );
      }

      const body: ChatResponse = { reply: r.text, entry: r.entry ? toEntryView(r.entry, row) : null, usage: r.usage };
      return noStore(NextResponse.json<ChatResponse>(body));
    });
  } catch (err) {
    return toErrorResponse(err, "POST /api/chat");
  }
}
