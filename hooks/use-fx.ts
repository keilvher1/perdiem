"use client";

/**
 * Display currency and exchange rates for client components.
 *
 * - Display currency: the viewer's choice in the header "Currency" menu, stored in localStorage
 *   "perdiem-currency" (default USD). It only adds approximate equivalents next to USD amounts
 *   (<LocalAmount usd={n} />); nothing stored, requested or paid changes: PerDiem settles in USD.
 * - Rates: GET /api/fx (same origin, behind the site login), fetched once when first needed and
 *   refreshed after an hour. A response that fails lib/fx/normalize.ts parseFxRates is "no rates".
 *
 * Both are module-level stores read with useSyncExternalStore, so no provider is needed, every
 * component sees the same state, and the server render (and hydration) always sees USD / no rates:
 * equivalents appear only after mount, without a hydration mismatch.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { isCurrencyCode } from "@/lib/fx/currencies";
import { parseFxRates, type FxRates } from "@/lib/fx/normalize";

// ---------------------------------------------------------------------------------------------
// Display currency (localStorage)
// ---------------------------------------------------------------------------------------------

export const CURRENCY_STORAGE_KEY = "perdiem-currency";
const currencyListeners = new Set<() => void>();

function readCurrency(): string {
  try {
    const v = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    return isCurrencyCode(v) ? v : "USD";
  } catch {
    return "USD";
  }
}

function subscribeCurrency(onChange: () => void): () => void {
  currencyListeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === CURRENCY_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    currencyListeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The display currency ("USD" on the server and during hydration). */
export function useDisplayCurrency(): string {
  return useSyncExternalStore(subscribeCurrency, readCurrency, () => "USD");
}

export function setDisplayCurrency(code: string): void {
  if (!isCurrencyCode(code)) return;
  try {
    if (code === "USD") window.localStorage.removeItem(CURRENCY_STORAGE_KEY);
    else window.localStorage.setItem(CURRENCY_STORAGE_KEY, code);
  } catch {
    // Storage blocked: nothing to remember the choice in; it stays USD.
  }
  currencyListeners.forEach((l) => l());
}

// ---------------------------------------------------------------------------------------------
// Rates (GET /api/fx)
// ---------------------------------------------------------------------------------------------

export type FxStatus = "idle" | "loading" | "ready" | "error";

export interface FxState {
  status: FxStatus;
  /** The last good rates (kept while a refresh runs or fails). */
  rates: FxRates | null;
  /** Why the last load failed (English, from the server or the network), when it did. */
  error: string | null;
}

const REFRESH_MS = 60 * 60 * 1000;
const IDLE: FxState = { status: "idle", rates: null, error: null };
let fxState: FxState = IDLE;
let loadedAt = 0;
let inflight: Promise<void> | null = null;
const fxListeners = new Set<() => void>();

function setFx(next: FxState) {
  fxState = next;
  fxListeners.forEach((l) => l());
}

async function loadRates(): Promise<void> {
  setFx({ ...fxState, status: "loading" });
  try {
    const res = await fetch("/api/fx", { headers: { accept: "application/json" } });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (body as { error?: { message?: unknown } } | null)?.error?.message;
      throw new Error(typeof msg === "string" ? msg : `HTTP ${res.status}`);
    }
    const rates = parseFxRates(body);
    if (!rates) throw new Error("The exchange-rate response was not usable.");
    loadedAt = Date.now();
    setFx({ status: "ready", rates, error: null });
  } catch (e) {
    loadedAt = Date.now();
    setFx({ status: "error", rates: fxState.rates, error: e instanceof Error ? e.message : String(e) });
  }
}

/** Starts a load unless one is running or the last one is recent (errors retry after a minute). */
function ensureRates(force = false): void {
  if (inflight) return;
  const age = Date.now() - loadedAt;
  const fresh = fxState.status === "ready" ? age < REFRESH_MS : fxState.status === "error" ? age < 60_000 : false;
  if (!force && fresh) return;
  inflight = loadRates().finally(() => {
    inflight = null;
  });
}

function subscribeFx(onChange: () => void): () => void {
  fxListeners.add(onChange);
  return () => fxListeners.delete(onChange);
}

/**
 * The exchange rates, loaded on first use when `enabled` (idle and null otherwise, and always on the
 * server). `retry()` loads again at once.
 */
export function useFxRates(enabled = true): FxState & { retry: () => void } {
  const state = useSyncExternalStore(subscribeFx, () => fxState, () => IDLE);
  useEffect(() => {
    if (enabled) ensureRates();
  }, [enabled]);
  const retry = useCallback(() => ensureRates(true), []);
  return { ...state, retry };
}
