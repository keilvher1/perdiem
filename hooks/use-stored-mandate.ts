"use client";

import { useSyncExternalStore } from "react";

/** localStorage is used for exactly one thing: the last selected mandate id. */
const KEY = "perdiem:selected-mandate";
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useStoredMandateId(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function writeStoredMandateId(id: string): void {
  if (read() === id) return;
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // Private mode or storage disabled: selection still lives in ?m=.
  }
  listeners.forEach((l) => l());
}
