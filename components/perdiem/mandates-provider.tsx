"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { MandateSummary } from "@/contracts/api";
import { api, type ApiClientError } from "@/lib/api-client";
import { useResource } from "@/hooks/use-resource";

interface MandatesState {
  mandates: MandateSummary[] | null;
  error: ApiClientError | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => void;
}

const MandatesContext = createContext<MandatesState | null>(null);

const loadMandates = () => api.mandates();

/** One shared, polled (5 s) mandate list for the header selector and every page. */
export function MandatesProvider({ children }: { children: ReactNode }) {
  const r = useResource(loadMandates, 5000);
  const value = useMemo<MandatesState>(
    () => ({
      mandates: r.data?.mandates ?? null,
      error: r.error,
      loading: r.loading,
      refreshing: r.refreshing,
      refresh: r.refresh,
    }),
    [r.data, r.error, r.loading, r.refreshing, r.refresh],
  );
  return <MandatesContext.Provider value={value}>{children}</MandatesContext.Provider>;
}

export function useMandates(): MandatesState {
  const v = useContext(MandatesContext);
  if (!v) throw new Error("useMandates() must be used inside <MandatesProvider>.");
  return v;
}
