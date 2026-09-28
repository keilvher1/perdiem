"use client";

import { useSyncExternalStore } from "react";
import type { ChatResponse, LedgerEntryView, UsageRecord } from "@/contracts/api";
import { api, toApiClientError } from "@/lib/api-client";

/**
 * The traveler's conversation for this browser tab. Module-level (not component state) so it
 * survives client-side navigation — e.g. going to /principal to pause and coming back.
 */
export type ChatMessage =
  | { kind: "user"; id: string; mandateId: string; text: string; at: string }
  | {
      kind: "agent";
      id: string;
      mandateId: string;
      text: string;
      at: string;
      entry: LedgerEntryView | null;
      usage: UsageRecord[];
    }
  | {
      kind: "error";
      id: string;
      mandateId: string;
      text: string;
      at: string;
      request: string;
      code: string;
      /** HTTP status of the failed request; 0 when no response arrived (NETWORK_ERROR). */
      status: number;
      /** ApiError.details (e.g. `{ txHash }` when the ledger write after a broadcast failed). */
      details?: unknown;
    };

/**
 * Error codes that /api/chat raises BEFORE the proposal is evaluated, so nothing was proposed and
 * nothing can have been paid: request validation (400), unknown mandate (404) and the Kiln call
 * itself (502). Both spellings on purpose: the live routes use VALIDATION_FAILED /
 * MANDATE_NOT_FOUND, the mock client VALIDATION_ERROR / NOT_FOUND.
 * Anything else (DB_ERROR or LEDGER_WRITE_FAILED after a broadcast, a dropped connection, a
 * non-JSON 5xx) leaves the outcome unknown: a payment may have been sent, and retrying could pay
 * twice because the ledger may not hold the entry that DUPLICATE checks against.
 */
const NOTHING_SENT_CODES: ReadonlySet<string> = new Set([
  "VALIDATION_FAILED",
  "VALIDATION_ERROR",
  "INVALID_JSON",
  "MANDATE_NOT_FOUND",
  "NOT_FOUND",
  "KILN_ERROR",
]);

/**
 * True only when the failed chat request provably proposed and paid nothing (safe to retry): a
 * whitelisted code that also came back as a 4xx rejection (or the Kiln 502, which precedes any
 * proposal). A 5xx or no response at all (status 0) is never "nothing sent".
 */
export function nothingWasSent(err: { code: string; status: number }): boolean {
  if (unrecordedPaymentCode(err.code)) return false;
  if (!NOTHING_SENT_CODES.has(err.code)) return false;
  return (err.status >= 400 && err.status < 500) || err.code === "KILN_ERROR";
}

/**
 * /api/chat codes for a payment that was broadcast but is not (yet) in the ledger
 * (app/api/_lib/ledger-write.ts): 502 PAYMENT_NOT_RECORDED (this request's payment left the wallet,
 * details.txHash) and 409 LEDGER_UNRECONCILED (an earlier one did; no new spend is evaluated until
 * it is written). Retrying could pay twice, so the chat never offers "Try again" for them.
 */
export type UnrecordedPaymentCode = "PAYMENT_NOT_RECORDED" | "LEDGER_UNRECONCILED";

export function unrecordedPaymentCode(code: string): UnrecordedPaymentCode | null {
  return code === "PAYMENT_NOT_RECORDED" || code === "LEDGER_UNRECONCILED" ? code : null;
}

/** A tx hash the server attached to an error (PAYMENT_NOT_RECORDED, LEDGER_UNRECONCILED), or null. */
export function errorTxHash(details: unknown): `0x${string}` | null {
  if (!details || typeof details !== "object") return null;
  const h = (details as { txHash?: unknown }).txHash;
  return typeof h === "string" && /^0x[0-9a-fA-F]{64}$/.test(h) ? (h as `0x${string}`) : null;
}

export interface ChatSnapshot {
  messages: ChatMessage[];
  /** The request in flight (one at a time), or null. */
  pending: { mandateId: string; text: string } | null;
}

const EMPTY: ChatSnapshot = { messages: [], pending: null };
let snapshot: ChatSnapshot = EMPTY;
let seq = 0;
const listeners = new Set<() => void>();

function set(next: ChatSnapshot) {
  snapshot = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const nextId = () => `msg_${++seq}`;

export function useChatSession(): ChatSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
}

/** Sends one request; resolves with the response, or null if another one is in flight. Throws ApiClientError. */
export async function sendChat(mandateId: string, text: string): Promise<ChatResponse | null> {
  if (snapshot.pending) return null;
  const user: ChatMessage = { kind: "user", id: nextId(), mandateId, text, at: new Date().toISOString() };
  set({ messages: [...snapshot.messages, user], pending: { mandateId, text } });
  try {
    const res = await api.chat({ mandateId, text });
    const agent: ChatMessage = {
      kind: "agent",
      id: nextId(),
      mandateId,
      text: res.reply,
      at: new Date().toISOString(),
      entry: res.entry,
      usage: res.usage,
    };
    set({ messages: [...snapshot.messages, agent], pending: null });
    return res;
  } catch (e) {
    const err = toApiClientError(e);
    const msg: ChatMessage = {
      kind: "error",
      id: nextId(),
      mandateId,
      text: err.message,
      at: new Date().toISOString(),
      request: text,
      code: err.code,
      status: err.status,
      details: err.details,
    };
    set({ messages: [...snapshot.messages, msg], pending: null });
    throw err;
  }
}

/** Replaces a ledger entry (e.g. pending → settled) wherever it appears in the conversation. */
export function updateChatEntry(entry: LedgerEntryView): void {
  let changed = false;
  const messages = snapshot.messages.map((m) => {
    if (m.kind === "agent" && m.entry && m.entry.id === entry.id) {
      changed = true;
      return { ...m, entry };
    }
    return m;
  });
  if (changed) set({ ...snapshot, messages });
}

export function clearChatSession(): void {
  if (snapshot.pending) return;
  set(EMPTY);
}
