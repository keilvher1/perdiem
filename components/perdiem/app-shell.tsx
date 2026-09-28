"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Database, ReceiptText } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { API_MODE } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { resolveMandateId } from "@/hooks/use-selected-mandate";
import { useStoredMandateId, writeStoredMandateId } from "@/hooks/use-stored-mandate";
import { EvidenceFab } from "./evidence-fab";
import { HealthBadge } from "./health-badge";
import { MandateSelector } from "./mandate-selector";
import { useMandates } from "./mandates-provider";

const NAV = [
  { key: "traveler", label: "Traveler", base: "/traveler" },
  { key: "principal", label: "Principal", base: "/principal" },
  { key: "audit", label: "Audit", base: "/audit" },
  { key: "metrics", label: "Metrics", base: "/metrics" },
] as const;

function auditIdFromPath(pathname: string): string | null {
  const m = /^\/audit\/([^/]+)/.exec(pathname);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]!);
  } catch {
    return m[1]!;
  }
}

function Wordmark() {
  return (
    <Link href="/traveler" className="group flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
      <span className="grid size-7 place-items-center rounded-lg bg-indigo-600 text-white shadow-sm">
        <ReceiptText aria-hidden className="size-4" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight text-zinc-900">PerDiem</span>
        <span className="mt-0.5 hidden text-[11px] text-zinc-500 lg:block">delegated spend, kept inside the line</span>
      </span>
    </Link>
  );
}

/** Top bar: wordmark, nav, network badge; context bar: global mandate selector. */
export function AppShell() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const { mandates, error, refresh } = useMandates();
  const stored = useStoredMandateId();

  const auditId = auditIdFromPath(pathname);
  const current = auditId ?? resolveMandateId(mandates, params.get("m"), stored);
  const exists = current !== null && (mandates?.some((m) => m.id === current) ?? false);
  // The Evidence button: only on /traveler, /principal and /audit/<id> (not /audit, /metrics, /report).
  const onAuditPage = auditId !== null && /^\/audit\/[^/]+\/?$/.test(pathname);
  const fabPage = pathname === "/traveler" || pathname === "/principal" || onAuditPage;
  const summary = exists ? (mandates?.find((m) => m.id === current) ?? null) : null;

  // Keep ?m= and the remembered id in sync with what is shown (no React state involved).
  useEffect(() => {
    if (!current || !exists) return;
    writeStoredMandateId(current);
    if (auditId || pathname === "/audit" || pathname === "/") return;
    if (params.get("m") !== current) {
      const sp = new URLSearchParams(params.toString());
      sp.set("m", current);
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    }
  }, [current, exists, auditId, pathname, params, router]);

  const onSelect = (id: string) => {
    writeStoredMandateId(id);
    if (pathname.startsWith("/audit")) {
      router.push(`/audit/${encodeURIComponent(id)}${pathname.endsWith("/report") ? "/report" : ""}`);
      return;
    }
    const sp = new URLSearchParams(params.toString());
    sp.set("m", id);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  const hrefFor = (base: string) => {
    if (!current) return base;
    if (base === "/audit") return `/audit/${encodeURIComponent(current)}`;
    return `${base}?m=${encodeURIComponent(current)}`;
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 px-4 sm:px-6">
          <div className="flex h-14 items-center">
            <Wordmark />
          </div>
          <nav aria-label="Roles" className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-6 overflow-x-auto border-t border-zinc-100 px-4 sm:order-none sm:mx-0 sm:w-auto sm:border-0 sm:px-0">
            {NAV.map((n) => {
              const active = pathname === n.base || pathname.startsWith(`${n.base}/`);
              return (
                <Link
                  key={n.key}
                  href={hrefFor(n.base)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center border-b-2 text-sm font-medium whitespace-nowrap outline-none focus-visible:text-indigo-700 sm:h-14",
                    active ? "border-indigo-600 text-zinc-900" : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-900",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex h-14 items-center gap-2">
            <HealthBadge />
          </div>
        </div>
        <div className="border-t border-zinc-100 bg-zinc-50/90">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6">
            <span className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Mandate</span>
            <MandateSelector
              mandates={mandates}
              value={current}
              onChange={onSelect}
              error={error}
              onRetry={refresh}
              className="min-w-0 flex-1 sm:flex-none"
            />
            {API_MODE === "mock" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    tabIndex={0}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-dashed border-zinc-300 px-2 py-0.5 text-[11px] font-medium text-zinc-500 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <Database aria-hidden className="size-3" />
                    <span className="sr-only sm:not-sr-only">Mock data</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end" className="max-w-xs">
                  Served from docs/fixtures in the browser. Set NEXT_PUBLIC_API_MODE=live to use the real backend.
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </header>
      {fabPage && exists && current && <EvidenceFab key={current} id={current} summary={summary} onAuditPage={onAuditPage} />}
    </>
  );
}

/** Static stand-in while the shell's search params resolve (same height, no layout shift). */
export function AppShellFallback() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white print:hidden">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-8 px-4 sm:px-6">
        <Wordmark />
      </div>
      <div className="h-12 border-t border-zinc-100 bg-zinc-50/90" />
    </header>
  );
}
