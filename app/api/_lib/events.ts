import "server-only";
/**
 * app/api/_lib/events.ts — the JSON log lines the evidence tooling reads from the dev-server log
 * (scripts/metrics.ts: logs-stop.txt from "decision", the status timeline from "mandate_status" +
 * "decision"). One object per line, printed with console.log(JSON.stringify(...)); `kind` is always
 * the first key, so `{"kind":"<kind>"` finds the start of the object. Every line carries `at`
 * (ISO 8601 UTC) and `mandateId`.
 *
 *  mandate_created         POST /api/mandates after the anchor broadcast and the DB insert
 *    {"kind":"mandate_created","mandateId","hash","anchorTx","status","at"}   (status: "active")
 *  mandate_status          every accepted PATCH /api/mandates/[id]: pause, resume AND revoke;
 *                          also a no-op PATCH (from == to, changed:false, nothing written)
 *    {"kind":"mandate_status","mandateId","from","to","changed","at"}
 *  mandate_status_refused  a PATCH answered 409 (revoked is final: revoked → active|paused);
 *                          a different kind on purpose, so a timeline never reads it as a change
 *    {"kind":"mandate_status_refused","mandateId","from","to","code":"MANDATE_REVOKED","at"}
 *  decision                one per ledger entry created by POST /api/chat (STOP and APPROVE; the
 *                          status fast path makes no entry and prints none). `at` = entry.at.
 *                          recorded:false = the ledger write failed (a broadcast one answers 502
 *                          PAYMENT_NOT_RECORDED and stays in the in-process backlog)
 *    {"kind":"decision","mandateId","entryId","decision","codes","status","txHash","kilnResponseId","at","recorded"}
 *  settlement              GET /api/ledger/[id]/confirm when it writes settled or failed
 *    {"kind":"settlement","mandateId","entryId","txHash","state":"settled","blockNumber","actualFeeUsd","at"}
 *    {"kind":"settlement","mandateId","entryId","txHash","state":"failed","reason","at"}
 */
import type { Hex, LedgerStatus, MandateStatus, StopCode } from "@/contracts/api";
import type { LedgerEntry } from "@/lib/policy";

export interface MandateCreatedEvent {
  kind: "mandate_created";
  mandateId: string;
  hash: Hex;
  anchorTx: Hex;
  status: MandateStatus;
  at: string;
}

export interface MandateStatusEvent {
  kind: "mandate_status";
  mandateId: string;
  from: MandateStatus;
  to: MandateStatus;
  changed: boolean;
  at: string;
}

export interface MandateStatusRefusedEvent {
  kind: "mandate_status_refused";
  mandateId: string;
  from: MandateStatus;
  to: MandateStatus;
  code: string;
  at: string;
}

export interface DecisionEvent {
  kind: "decision";
  mandateId: string;
  entryId: string;
  decision: "APPROVE" | "STOP";
  codes: StopCode[];
  status: LedgerStatus;
  txHash: Hex | null;
  kilnResponseId: string | null;
  at: string;
  recorded: boolean;
}

export type SettlementEvent =
  | { kind: "settlement"; mandateId: string; entryId: string; txHash: Hex; state: "settled"; blockNumber: string; actualFeeUsd: number; at: string }
  | { kind: "settlement"; mandateId: string; entryId: string; txHash: Hex; state: "failed"; reason: string; at: string };

export type LogEvent = MandateCreatedEvent | MandateStatusEvent | MandateStatusRefusedEvent | DecisionEvent | SettlementEvent;

export function logEvent(e: LogEvent, out: (line: string) => void = (l) => console.log(l)): void {
  out(JSON.stringify(e));
}

export function decisionEvent(mandateId: string, e: LedgerEntry, recorded: boolean): DecisionEvent {
  return {
    kind: "decision",
    mandateId,
    entryId: e.id,
    decision: e.decision,
    codes: e.reasons.map((x) => x.code),
    status: e.status,
    txHash: e.txHash ?? null,
    kilnResponseId: e.kilnResponseId ?? null,
    at: e.at,
    recorded,
  };
}

/**
 * Wraps the ledger save handed to lib/agent.ts so the route knows the entry even when the save (or
 * anything after it, e.g. saveUsage) throws: the decision line is printed either way.
 */
export function trackDecision(save: (e: LedgerEntry) => Promise<void>) {
  let entry: LedgerEntry | null = null;
  let recorded = false;
  return {
    save: async (e: LedgerEntry): Promise<void> => {
      entry = e;
      recorded = false;
      await save(e);
      recorded = true;
    },
    /** The entry handed to save(), and whether that save resolved; null when no entry was made. */
    decided: (): { entry: LedgerEntry; recorded: boolean } | null => (entry ? { entry, recorded } : null),
  };
}
