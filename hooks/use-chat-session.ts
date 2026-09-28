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
  | { kind: "error"; id: string; mandateId: string; text: string; at: string; request: string; code: string };

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
