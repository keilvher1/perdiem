"use client";

import { useCallback, useEffect, useState } from "react";
import { toApiClientError, type ApiClientError } from "@/lib/api-client";
import { createRunOrder, failedState, loadedState, toJson, type ResourceState } from "./resource-state";

export interface Resource<T> {
  data: T | null;
  error: ApiClientError | null;
  /** First load for the current loader (no data and no error yet). */
  loading: boolean;
  /** A manual refresh is in flight while older data is still shown. */
  refreshing: boolean;
  /** Epoch ms of the last successful load. */
  updatedAt: number | null;
  refresh: () => void;
}

/**
 * Loads `load()` when it changes (memoize it with useCallback), optionally polls every
 * `pollMs`, and reloads when refresh() bumps the refresh key. `null` disables loading.
 * Loading is derived from data (no setState inside the effect body). A poll that returns the same
 * JSON keeps the previous `data` reference, and an older response never overwrites a newer one.
 */
export function useResource<T>(load: (() => Promise<T>) | null, pollMs = 0): Resource<T> {
  const [state, setState] = useState<ResourceState<T, ApiClientError>>({ source: null, key: -1, data: null, json: null, error: null, updatedAt: null });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!load) return;
    let alive = true;
    const order = createRunOrder();
    const run = async (poll: boolean) => {
      const ticket = order.issue();
      try {
        const data = await load();
        if (!alive || !order.accept(ticket)) return;
        const updatedAt = Date.now();
        const json = toJson(data);
        setState((prev) => loadedState(prev, { source: load, key: refreshKey, data, json, poll, updatedAt }));
      } catch (e) {
        if (!alive || !order.accept(ticket)) return;
        const error = toApiClientError(e);
        setState((prev) => failedState(prev, { source: load, key: refreshKey, error }));
      }
    };
    void run(false);
    const timer = pollMs > 0 ? setInterval(() => void run(true), pollMs) : null;
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [load, pollMs, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const current = load !== null && state.source === load;
  const data = current ? state.data : null;
  const error = current ? state.error : null;
  return {
    data,
    error,
    loading: load !== null && data === null && error === null,
    refreshing: current && state.key !== refreshKey,
    updatedAt: current ? state.updatedAt : null,
    refresh,
  };
}
