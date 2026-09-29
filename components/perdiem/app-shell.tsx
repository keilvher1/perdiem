"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Database, ReceiptText } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { API_MODE } from "@/lib/api-client";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { resolveMandateId } from "@/hooks/use-selected-mandate";
import { useStoredMandateId, writeStoredMandateId } from "@/hooks/use-stored-mandate";
import { CurrencySwitcher } from "./currency-switcher";
import { EvidenceFab } from "./evidence-fab";
import { HealthBadge } from "./health-badge";
import { LocaleSwitcher } from "./locale-switcher";
import { MandateSelector } from "./mandate-selector";
import { useMandates } from "./mandates-provider";
import { ThemeSwitcher } from "./theme-switcher";

const NAV = [
  { key: "traveler", base: "/traveler" },
  { key: "principal", base: "/principal" },
  { key: "audit", base: "/audit" },
  { key: "metrics", base: "/metrics" },
] as const;

/** The pages that read ?m=; only these get it written back (not /audit/<id>, the labs or a 404). */
const M_PAGES = new Set(["/traveler", "/principal", "/metrics"]);

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
  const t = useT();
  return (
    <Link
      href="/traveler"
      aria-label={t.ui.shell.home}
      className="group flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
        <ReceiptText aria-hidden className="size-4" />
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight text-ink">PerDiem</span>
        <span className="mt-1 hidden truncate text-xs text-muted-ink lg:block">{t.ui.shell.message}</span>
      </span>
    </Link>
  );
}

/** Top bar: wordmark, nav, network badge; context bar: global mandate selector. */
export function AppShell() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const t = useT();
  const { mandates, error, refresh } = useMandates();
  const stored = useStoredMandateId();
  const headerRef = useRef<HTMLElement>(null);

  // The sticky header's height changes with the width and the language (it wraps to 2–3 rows on
  // phones and tablets). <html> scroll-padding-top reads it (app/globals.css), so what keyboard
  // focus, scrollIntoView() or an #anchor brings into view is never left under the header.
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const update = () => root.style.setProperty("--app-header-offset", `${Math.ceil(el.getBoundingClientRect().height) + 14}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--app-header-offset");
    };
  }, []);

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
    if (!M_PAGES.has(pathname)) return;
    if (params.get("m") !== current) {
      const sp = new URLSearchParams(params.toString());
      sp.set("m", current);
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    }
  }, [current, exists, pathname, params, router]);

  const onSelect = (id: string) => {
    writeStoredMandateId(id);
    if (pathname.startsWith("/audit")) {
      router.push(`/audit/${encodeURIComponent(id)}${pathname.endsWith("/report") ? "/report" : ""}`);
      return;
    }
    const sp = new URLSearchParams(params.toString());
    // ?d= names a decision of the mandate being left: it goes (every other param stays).
    if (id !== current) sp.delete("d");
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
      <header ref={headerRef} className="sticky top-0 z-40 border-b border-line bg-surface print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 px-4 sm:gap-x-4 sm:px-6 lg:gap-x-8">
          <div className="flex h-14 min-w-0 items-center">
            <Wordmark />
          </div>
          <nav
            aria-label={t.shell.nav.label}
            className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-5 overflow-x-auto border-t border-line px-4 sm:order-none sm:mx-0 sm:w-auto sm:border-0 sm:px-0"
          >
            {NAV.map((n) => {
              const active = pathname === n.base || pathname.startsWith(`${n.base}/`);
              return (
                <Link
                  key={n.key}
                  href={hrefFor(n.base)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center border-b-2 text-sm font-medium whitespace-nowrap outline-none transition-colors duration-150 focus-visible:rounded-t-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:h-14",
                    active ? "border-cobalt text-cobalt" : "border-transparent text-muted-ink hover:border-line-strong hover:text-ink",
                  )}
                >
                  {t.shell.nav[n.key]}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex h-14 items-center gap-1.5 sm:gap-2">
            <HealthBadge />
            <LocaleSwitcher />
            <CurrencySwitcher />
            <ThemeSwitcher />
          </div>
        </div>
        <div className="border-t border-line bg-surface-2">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6">
            <span className="type-label text-muted-ink">{t.shell.context.mandate}</span>
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
                    className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-dashed border-line-strong px-2 py-0.5 text-xs font-medium text-muted-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Database aria-hidden className="size-3" />
                    <span className="sr-only sm:not-sr-only">{t.shell.context.mockData}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end" className="max-w-xs">
                  {t.shell.context.mockTooltip}
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
    <header className="sticky top-0 z-40 border-b border-line bg-surface print:hidden">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-8 px-4 sm:px-6">
        <Wordmark />
      </div>
      <div className="h-12 border-t border-line bg-surface-2" />
    </header>
  );
}
