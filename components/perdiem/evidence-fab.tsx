"use client";

import { useCallback, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  FileCheck,
  ListChecks,
  LoaderCircle,
  OctagonAlert,
  Printer,
  ShieldCheck,
} from "lucide-react";
import type {
  AuditResponse,
  LedgerStatus,
  MandateSummary,
} from "@/contracts/api";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { API_MODE, api, toApiClientError } from "@/lib/api-client";
import { fmtUsd } from "@/lib/format";
import { useFmt, useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { useNow } from "@/hooks/use-now";
import { useResource } from "@/hooks/use-resource";
import { EvidenceActions } from "./evidence-actions";
import { ReceiptCard } from "./receipt-card";
import { EmptyState, ErrorState } from "./states";
import { StatusPill, effectiveMandateStatus } from "./status-pill";

const LINK =
  "flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-900 outline-none hover:border-indigo-300 hover:bg-indigo-50/40 focus-visible:ring-2 focus-visible:ring-indigo-500";

/** Counted in this order; labels come from t.evidence.decisions.status. */
const COUNTED = [
  "settled",
  "pending",
  "stopped",
  "failed",
] as const satisfies ReadonlyArray<LedgerStatus>;

type Checks =
  | { state: "idle" }
  | { state: "running"; last: AuditResponse["summary"] | null }
  | { state: "done"; summary: AuditResponse["summary"]; at: string }
  | { state: "error"; message: string };

function SectionTitle({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
        {children}
      </h3>
      {aside}
    </div>
  );
}

function Money({
  label,
  value,
  hint,
  warn = false,
}: {
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-zinc-200 bg-white px-3 py-2">
      <dt className="text-[11px] text-zinc-500">{label}</dt>
      <dd className="truncate text-base font-semibold tracking-tight text-zinc-900 tabular-nums">
        {value}
      </dd>
      {hint && (
        <dd
          className={cn(
            "truncate text-[11px] tabular-nums",
            warn ? "text-amber-700" : "text-zinc-400",
          )}
        >
          {hint}
        </dd>
      )}
    </div>
  );
}

function DrawerSkeleton() {
  const t = useT();
  return (
    <div
      className="space-y-3"
      aria-busy="true"
      aria-label={t.evidence.drawer.loading}
    >
      <Skeleton className="h-16 rounded-lg" />
      <Skeleton className="h-6 w-2/3 rounded" />
      <Skeleton className="h-56 rounded-xl" />
      <Skeleton className="h-24 rounded-lg" />
    </div>
  );
}

/**
 * Floating "Evidence" button (bottom-right) + right-side drawer for one mandate: status and money,
 * the latest receipt, "Download records" for scripts/verify.ts, and "Run checks now" (one GET
 * /api/audit/[id] on click — never polled). Everything is templated; no model call.
 * Mounted by AppShell on /traveler, /principal and /audit/<id> only; keyed by the mandate id.
 */
export function EvidenceFab({
  id,
  summary,
  onAuditPage,
}: {
  id: string;
  summary: MandateSummary | null;
  onAuditPage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [checks, setChecks] = useState<Checks>({ state: "idle" });
  const now = useNow(30_000);
  const messages = useT();
  const t = messages.evidence;

  const loadRecords = useCallback(() => api.mandate(id), [id]);
  const records = useResource(open ? loadRecords : null);

  const runChecks = async () => {
    setChecks((c) => ({
      state: "running",
      last: c.state === "done" ? c.summary : null,
    }));
    try {
      const res = await api.audit(id);
      setChecks({
        state: "done",
        summary: res.summary,
        at: new Date().toISOString(),
      });
    } catch (e) {
      setChecks({ state: "error", message: toApiClientError(e).message });
    }
  };

  const detail = records.data?.mandate ?? null;
  const ledger = records.data?.ledger ?? [];
  const money = detail ?? summary;
  const statusSource = detail ?? summary;
  const latest = ledger.at(-1) ?? null;
  const newestFirst = [...ledger].reverse();
  const count = (s: LedgerStatus) =>
    ledger.filter((e) => e.status === s).length;
  const failed = count("failed");
  const approvedOnly = count("approved");

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          data-evidence-fab=""
          aria-label={t.fab.ariaLabel(id)}
          className="fixed right-6 bottom-6 z-40 size-12 rounded-full bg-indigo-600 p-0 text-white shadow-lg shadow-indigo-900/20 ring-1 ring-indigo-700/40 hover:bg-indigo-700 sm:h-11 sm:w-auto sm:gap-2 sm:px-4 print:hidden"
        >
          <FileCheck aria-hidden className="size-5 sm:size-4.5" />
          <span className="hidden sm:inline">{t.fab.button}</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        closeLabel={messages.common.close}
        side="right"
        className="gap-0 bg-zinc-50 outline-none data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        // Focus the drawer itself, not its first control (that would pop the mock-mode tooltip open).
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        <SheetHeader className="border-b border-zinc-200 bg-white pr-12">
          <SheetTitle className="text-base font-semibold text-zinc-900">
            {t.drawer.title} · <span className="font-mono">{id}</span>
          </SheetTitle>
          <SheetDescription className="text-xs text-zinc-500">
            {t.drawer.description}
          </SheetDescription>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {statusSource && (
              <StatusPill status={effectiveMandateStatus(statusSource, now)} />
            )}
            <span
              className={cn(
                "inline-flex h-6 items-center rounded-full px-2 text-xs font-medium ring-1 ring-inset",
                API_MODE === "live"
                  ? "bg-indigo-50 text-indigo-700 ring-indigo-600/20"
                  : "border-dashed bg-white text-zinc-500 ring-zinc-300",
              )}
            >
              {API_MODE === "live" ? t.drawer.live : t.drawer.mock}
            </span>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
          {money && (
            <dl className="grid grid-cols-3 gap-2">
              <Money label={t.money.budget} value={fmtUsd(money.budgetUsd)} />
              <Money
                label={t.money.spent}
                value={fmtUsd(money.spentUsd)}
                hint={
                  money.pendingUsd > 0
                    ? t.money.inclPending(fmtUsd(money.pendingUsd))
                    : t.money.nonePending
                }
                warn={money.pendingUsd > 0}
              />
              <Money
                label={t.money.remaining}
                value={fmtUsd(money.remainingUsd)}
              />
            </dl>
          )}

          {records.loading ? (
            <DrawerSkeleton />
          ) : records.error && !records.data ? (
            <ErrorState
              title={t.drawer.loadError}
              error={records.error}
              onRetry={records.refresh}
              retrying={records.refreshing}
            />
          ) : records.data ? (
            <>
              <section aria-label={t.decisions.region}>
                <SectionTitle>
                  {t.decisions.recorded(ledger.length)}
                </SectionTitle>
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 tabular-nums">
                  {COUNTED.map((status) => (
                    <li key={status}>
                      <span className="font-semibold text-zinc-900">
                        {count(status)}
                      </span>{" "}
                      {t.decisions.status[status]}
                    </li>
                  ))}
                  {approvedOnly > 0 && (
                    <li>
                      <span className="font-semibold text-zinc-900">
                        {approvedOnly}
                      </span>{" "}
                      {t.decisions.approvedOnly}
                    </li>
                  )}
                </ul>
                {failed > 0 && (
                  <p className="mt-1.5 text-xs text-zinc-500">
                    {t.decisions.failed(failed)}
                  </p>
                )}
              </section>

              <section aria-label={t.receipts.region}>
                <SectionTitle
                  aside={
                    ledger.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setShowAll((v) => !v)}
                        aria-expanded={showAll}
                        className="text-xs font-medium text-indigo-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-indigo-500"
                      >
                        {showAll
                          ? t.receipts.showLatest
                          : t.receipts.showAll(ledger.length)}
                      </button>
                    ) : null
                  }
                >
                  {showAll ? t.receipts.all : t.receipts.latest}
                </SectionTitle>
                {latest === null ? (
                  <EmptyState
                    title={t.receipts.emptyTitle}
                    description={t.receipts.emptyBody}
                    className="py-6"
                  />
                ) : (
                  <div className="space-y-3">
                    {(showAll ? newestFirst : [latest]).map((e) => (
                      <ReceiptCard key={e.id} entry={e} />
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}

          <section aria-label={t.download.title}>
            <SectionTitle>{t.download.title}</SectionTitle>
            <EvidenceActions
              id={id}
              records={records.data}
              loading={records.loading || records.refreshing}
              error={records.error}
              onRetry={records.refresh}
            />
          </section>

          <section aria-label={t.checks.region}>
            <SectionTitle>{t.checks.title}</SectionTitle>
            <div className="rounded-lg border border-zinc-200 bg-white px-3 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void runChecks()}
                  disabled={checks.state === "running"}
                >
                  {checks.state === "running" ? (
                    <LoaderCircle aria-hidden className="animate-spin" />
                  ) : (
                    <ListChecks aria-hidden />
                  )}
                  {checks.state === "running" ? t.checks.running : t.checks.run}
                </Button>
                <ChecksResult checks={checks} />
              </div>
              <p className="mt-2 text-[11px] text-zinc-500">
                {t.checks.explain}
              </p>
            </div>
          </section>

          <nav aria-label={t.links.region} className="space-y-2">
            {!onAuditPage && (
              <Link
                href={`/audit/${encodeURIComponent(id)}`}
                onClick={() => setOpen(false)}
                className={LINK}
              >
                {t.links.audit}
                <ArrowRight aria-hidden className="size-4 text-zinc-500" />
              </Link>
            )}
            <Link
              href={`/audit/${encodeURIComponent(id)}/report`}
              onClick={() => setOpen(false)}
              className={LINK}
            >
              <span className="inline-flex items-center gap-2">
                <Printer aria-hidden className="size-4 text-zinc-500" />{" "}
                {t.links.statement}
              </span>
              <ArrowRight aria-hidden className="size-4 text-zinc-500" />
            </Link>
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ChecksResult({ checks }: { checks: Checks }) {
  const t = useT().evidence.checks;
  const f = useFmt();
  if (checks.state === "idle") return null;
  if (checks.state === "running") {
    return checks.last ? (
      <span className="text-xs text-zinc-400 tabular-nums">
        {t.last(checks.last.passed, checks.last.total)}
      </span>
    ) : null;
  }
  if (checks.state === "error") {
    return (
      <span role="alert" className="text-xs text-rose-700">
        {t.error(checks.message)}
      </span>
    );
  }
  const { passed, total, allVerified } = checks.summary;
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums",
        allVerified ? "text-emerald-700" : "text-rose-700",
      )}
    >
      {allVerified ? (
        <ShieldCheck aria-hidden className="size-4" />
      ) : (
        <OctagonAlert aria-hidden className="size-4" />
      )}
      {t.passed(passed, total)}
      <span className="text-[11px] font-normal text-zinc-400">
        · {f.time(checks.at)}
      </span>
    </span>
  );
}
