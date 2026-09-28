"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { MandateSummary } from "@/contracts/api";
import { useMandates } from "@/components/perdiem/mandates-provider";
import { useStoredMandateId, writeStoredMandateId } from "@/hooks/use-stored-mandate";

/**
 * Picks the mandate to show: ?m= (exact id, else newest id starting with it — DEMO_SCRIPT
 * uses prefixes like man_A), then the remembered id, then the newest man_A*, then the
 * newest active one, then the newest. Returns null until the list has loaded.
 */
export function resolveMandateId(
  mandates: MandateSummary[] | null,
  wanted: string | null,
  stored: string | null,
): string | null {
  if (!mandates || mandates.length === 0) return null;
  if (wanted) {
    const hit = mandates.find((m) => m.id === wanted) ?? mandates.find((m) => m.id.startsWith(wanted));
    if (hit) return hit.id;
  }
  if (stored) {
    const hit = mandates.find((m) => m.id === stored);
    if (hit) return hit.id;
  }
  const fallback =
    mandates.find((m) => m.id.startsWith("man_A")) ?? mandates.find((m) => m.status === "active") ?? mandates[0]!;
  return fallback.id;
}

/** Newest mandate whose id starts with `prefix` (DEMO_SCRIPT ids are prefixes). */
export function findByPrefix(mandates: MandateSummary[] | null, prefix: string): MandateSummary | null {
  return mandates?.find((m) => m.id.startsWith(prefix)) ?? null;
}

/** Selected mandate for Traveler / Principal / Metrics (shared through ?m=). Needs a <Suspense> parent. */
export function useSelectedMandate() {
  const { mandates, error, loading, refresh, addOptimistic } = useMandates();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const stored = useStoredMandateId();
  const id = resolveMandateId(mandates, params.get("m"), stored);
  const summary = id && mandates ? (mandates.find((m) => m.id === id) ?? null) : null;

  const select = useCallback(
    (next: string) => {
      writeStoredMandateId(next);
      if (pathname.startsWith("/audit")) {
        router.push(`/audit/${encodeURIComponent(next)}`);
        return;
      }
      const sp = new URLSearchParams(params.toString());
      sp.set("m", next);
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  return { id, summary, mandates, error, loading, refresh, select, addOptimistic };
}
