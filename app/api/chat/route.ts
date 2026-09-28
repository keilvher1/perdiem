/**
 * POST /api/chat  ChatRequest → ChatResponse
 *
 * mandate (status column merged) + ledger → lib/agent.ts handleTravelerMessage():
 * fast-path | Kiln propose → policy.evaluate() → STOP (recorded, no chain call) | APPROVE (broadcast).
 * Requests for one mandate are serialized (see _lib/lock.ts). Every decision is logged as one JSON
 * line: {"kind":"decision","mandateId","entryId","decision","codes":[...]} → evidence/logs-stop.txt.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import type { ChatResponse } from "@/contracts/api";
import { handleTravelerMessage } from "@/lib/agent";
import { getMandate, listLedger, saveEntry, saveUsage } from "@/lib/db";
import type { LedgerEntry } from "@/lib/policy";
import { toEntryView } from "@/lib/view";
import { errorMessage, HttpError, noStore, readJson, toErrorResponse } from "../_lib/http";
import { withLock } from "../_lib/lock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ChatSchema = z.object({
  mandateId: z.string().trim().min(1).max(128),
  text: z.string().trim().min(1).max(1000),
});

/**
 * A ledger write that follows a broadcast must not get lost: retry once, and if it still fails
 * print the full entry (no secrets in it) so it can be re-inserted from the log.
 */
async function saveEntryDurably(entry: LedgerEntry): Promise<void> {
  try {
    await saveEntry(entry);
  } catch (first) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      await saveEntry(entry);
    } catch (second) {
      console.error(JSON.stringify({ kind: "ledger_write_failed", error: errorMessage(second), firstError: errorMessage(first), entry }));
      throw second;
    }
  }
}

export async function POST(req: Request) {
  try {
    const { mandateId, text } = await readJson(req, ChatSchema);
    return await withLock(`mandate:${mandateId}`, async () => {
      const row = await getMandate(mandateId);
      if (!row) throw new HttpError(404, "MANDATE_NOT_FOUND", `No mandate ${mandateId}.`);
      const ledger = await listLedger(mandateId);

      const r = await handleTravelerMessage(text, {
        mandate: row.mandate,
        ledger,
        saveEntry: saveEntryDurably,
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
