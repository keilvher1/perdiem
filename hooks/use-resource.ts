"use client";

import { useCallback, useEffect, useState } from "react";
import { toApiClientError, type ApiClientError } from "@/lib/api-client";

interface ResourceState<T> {
  source: unknown;
  key: number;
  data: T | null;
  error: ApiClientError | null;
}

export interface Resource<T> {
  data: T | null;
  error: ApiClientError | null;
  /** First load for the current loader (no data and no error yet). */
  loading: boolean;
  /** A manual refresh is in flight while older data is still shown. */
  refreshing: boolean;
  refresh: () => void;
}

/**
 * Loads `load()` when it changes (memoize it with useCallback), optionally polls every
 * `pollMs`, and reloads when refresh() bumps the refresh key. `null` disables loading.
 * Loading is derived from data (no setState inside the effect body).
 */
export function useResource<T>(load: (() => Promise<T>) | null, pollMs = 0): Resource<T> {
  const [state, setState] = useState<ResourceState<T>>({ source: null, key: -1, data: null, error: null });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!load) return;
    let alive = true;
    const run = async () => {
      try {
        const data = await load();
        if (alive) setState({ source: load, key: refreshKey, data, error: null });
      } catch (e) {
        if (!alive) return;
        const error = toApiClientError(e);
        setState((prev) => ({ source: load, key: refreshKey, data: prev.source === load ? prev.data : null, error }));
      }
    };
    void run();
    const timer = pollMs > 0 ? setInterval(() => void run(), pollMs) : null;
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
    refresh,
  };
}
