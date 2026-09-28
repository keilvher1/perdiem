"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { MandateDetail, MandateSummary } from "@/contracts/api";
import { api, type ApiClientError } from "@/lib/api-client";
import { useResource } from "@/hooks/use-resource";

interface MandatesState {
  mandates: MandateSummary[] | null;
  error: ApiClientError | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => void;
  /** Show a just-created mandate before the next poll returns it (so it can be selected at once). */
  addOptimistic: (m: MandateDetail) => void;
}

const MandatesContext = createContext<MandatesState | null>(null);

const loadMandates = () => api.mandates();

export function toSummary(m: MandateDetail, entryCount = 0): MandateSummary {
  return {
    id: m.id,
    principal: m.principal,
    traveler: m.traveler,
    budgetUsd: m.budgetUsd,
    perTxCapUsd: m.perTxCapUsd,
    status: m.status,
    startsAt: m.startsAt,
    expiresAt: m.expiresAt,
    hash: m.hash,
    anchorTx: m.anchorTx,
    anchorUrl: m.anchorUrl,
    spentUsd: m.spentUsd,
    pendingUsd: m.pendingUsd,
    remainingUsd: m.remainingUsd,
    entryCount,
    createdAt: m.createdAt,
  };
}

/** One shared, polled (5 s) mandate list for the header selector and every page. */
export function MandatesProvider({ children }: { children: ReactNode }) {
  const r = useResource(loadMandates, 5000);
  const [extra, setExtra] = useState<MandateSummary[]>([]);
  const { refresh } = r;

  const addOptimistic = useCallback(
    (m: MandateDetail) => {
      setExtra((prev) => [toSummary(m), ...prev.filter((x) => x.id !== m.id)]);
      refresh();
    },
    [refresh],
  );

  const mandates = useMemo(() => {
    const fetched = r.data?.mandates;
    if (!fetched) return null;
    const missing = extra.filter((e) => !fetched.some((f) => f.id === e.id));
    return missing.length ? [...missing, ...fetched] : fetched;
  }, [r.data, extra]);

  const value = useMemo<MandatesState>(
    () => ({ mandates, error: r.error, loading: r.loading, refreshing: r.refreshing, refresh, addOptimistic }),
    [mandates, r.error, r.loading, r.refreshing, refresh, addOptimistic],
  );
  return <MandatesContext.Provider value={value}>{children}</MandatesContext.Provider>;
}

export function useMandates(): MandatesState {
  const v = useContext(MandatesContext);
  if (!v) throw new Error("useMandates() must be used inside <MandatesProvider>.");
  return v;
}
