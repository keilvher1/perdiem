import "server-only";
/**
 * app/api/_lib/ledger-write.ts — ledger writes that follow a decision in POST /api/chat.
 *
 * lib/agent.ts saves the entry AFTER sendPaymentNoWait() succeeded (outside its broadcast
 * try/catch). If that write is lost, the next request would not see the payment: neither the
 * spent-so-far sum nor the DUPLICATE check (both read the ledger) — so a retry could pay again.
 *
 *  - saveDecision(): one retry; a unique-key error on the retry means the first insert committed
 *    (the id carries a ms timestamp + random suffix, so a real collision is not a concern) → ok.
 *    If the entry carries a txHash (money left the wallet) and the write still fails, the entry
 *    is kept in an in-process backlog and the request fails with 502 PAYMENT_NOT_RECORDED
 *    (details: txHash, entryId) — the client must not retry. Without a txHash (STOP or failed
 *    broadcast: nothing was sent) the DB error is rethrown as before.
 *  - reconcile(): called first inside the per-mandate lock of every chat request. It re-inserts
 *    the backlog; while an entry still cannot be written it answers 409 LEDGER_UNRECONCILED and
 *    no new spend is evaluated (fail closed). It recovers by itself once the DB is back.
 *
 * The backlog lives in this Node process only (like the lock). Every failure also prints the full
 * entry as one `ledger_write_failed` JSON line, so it can be re-inserted from the log after a restart.
 */
import type { LedgerEntry } from "../../../lib/policy";
import { DbError } from "../../../lib/db";
import { errorMessage, HttpError } from "./http";

export interface LedgerWriterOptions {
  save: (e: LedgerEntry) => Promise<void>;
  retryDelayMs?: number;
  log?: (line: string) => void;
}

export interface LedgerWriter {
  saveDecision(entry: LedgerEntry): Promise<void>;
  reconcile(mandateId: string): Promise<void>;
  /** Broadcast entries of this mandate not yet in the DB (read-only copy). */
  unrecorded(mandateId: string): LedgerEntry[];
}

function isDuplicate(err: unknown): boolean {
  return err instanceof DbError && err.isDuplicate;
}

export function createLedgerWriter({ save, retryDelayMs = 500, log = (l) => console.error(l) }: LedgerWriterOptions): LedgerWriter {
  const backlog = new Map<string, LedgerEntry[]>(); // mandateId → broadcast entries not yet in the DB

  function remember(entry: LedgerEntry) {
    const list = backlog.get(entry.mandateId) ?? [];
    if (!list.some((e) => e.id === entry.id)) list.push(entry);
    backlog.set(entry.mandateId, list);
  }

  return {
    async saveDecision(entry) {
      try {
        await save(entry);
        return;
      } catch (first) {
        if (retryDelayMs > 0) await new Promise((r) => setTimeout(r, retryDelayMs));
        try {
          await save(entry);
          return;
        } catch (second) {
          if (isDuplicate(second)) return; // the first insert committed; only its response was lost
          log(
            JSON.stringify({
              kind: "ledger_write_failed",
              entryId: entry.id,
              txHash: entry.txHash ?? null,
              error: errorMessage(second),
              firstError: errorMessage(first),
              entry,
            }),
          );
          if (!entry.txHash) throw second; // nothing was sent: an ordinary DB error
          remember(entry);
          throw new HttpError(
            502,
            "PAYMENT_NOT_RECORDED",
            `Payment ${entry.txHash} was broadcast but could not be written to the ledger. Do not retry.`,
            { txHash: entry.txHash, entryId: entry.id },
          );
        }
      }
    },

    async reconcile(mandateId) {
      const list = backlog.get(mandateId);
      if (!list || list.length === 0) return;
      while (list.length > 0) {
        const e = list[0]!;
        try {
          await save(e);
        } catch (err) {
          if (!isDuplicate(err)) {
            log(JSON.stringify({ kind: "ledger_unreconciled", mandateId, entryId: e.id, txHash: e.txHash ?? null, error: errorMessage(err) }));
            throw new HttpError(
              409,
              "LEDGER_UNRECONCILED",
              `Payment ${e.txHash} is not in the ledger yet; no new spend is evaluated until it is recorded.`,
              { txHash: e.txHash, entryId: e.id },
            );
          }
        }
        list.shift();
        log(JSON.stringify({ kind: "ledger_reconciled", mandateId, entryId: e.id, txHash: e.txHash ?? null }));
      }
      backlog.delete(mandateId);
    },

    unrecorded(mandateId) {
      return [...(backlog.get(mandateId) ?? [])];
    },
  };
}
