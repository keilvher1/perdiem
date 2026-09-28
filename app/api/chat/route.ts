/**
 * POST /api/chat  ChatRequest → ChatResponse
 *
 * mandate (status column merged) + ledger → lib/agent.ts handleTravelerMessage():
 * fast-path | Kiln propose → policy.evaluate() → STOP (recorded, no chain call) | APPROVE (broadcast).
 * Requests for one mandate are serialized (see _lib/lock.ts). Every ledger entry the agent creates
 * (STOP and APPROVE, pending with its txHash or failed) is logged as exactly one JSON line —
 * {"kind":"decision","mandateId","entryId","decision","codes","status","txHash","kilnResponseId","at","recorded"}
 * (_lib/events.ts) → evidence/logs-stop.txt — even when the ledger write (recorded:false) or a later
 * step throws. The status fast path creates no entry and prints no decision line.
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
import { decisionEvent, logEvent, trackDecision } from "../_lib/events";
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

      // The decision line is printed in `finally`: a broadcast payment whose ledger write fails
      // (502 PAYMENT_NOT_RECORDED) or a STOP whose usage write fails is still logged.
      const tracked = trackDecision(ledger.saveDecision);
      try {
        const r = await handleTravelerMessage(text, {
          mandate: row.mandate,
          ledger: entries,
          saveEntry: tracked.save,
          saveUsage: (u) => saveUsage(u, mandateId),
        });
        const body: ChatResponse = { reply: r.text, entry: r.entry ? toEntryView(r.entry, row) : null, usage: r.usage };
        return noStore(NextResponse.json<ChatResponse>(body));
      } finally {
        const d = tracked.decided();
        if (d) logEvent(decisionEvent(mandateId, d.entry, d.recorded));
      }
    });
  } catch (err) {
    return toErrorResponse(err, "POST /api/chat");
  }
}
