"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { CreateMandateResponse, MandateDetailResponse } from "@/contracts/api";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthoritySummary } from "@/components/perdiem/authority-summary";
import { BudgetBreakdown } from "@/components/perdiem/budget-breakdown";
import { DecisionWorkspace } from "@/components/perdiem/decision-workspace";
import { countPayments, LedgerTable } from "@/components/perdiem/ledger-table";
import { PageContainer, PageHeader } from "@/components/perdiem/page";
import { RuleSummary } from "@/components/perdiem/rule-summary";
import { StateGlyph } from "@/components/perdiem/state-glyph";
import { EmptyState, ErrorState } from "@/components/perdiem/states";
import { useNow } from "@/hooks/use-now";
import { useResource } from "@/hooks/use-resource";
import { useSelectedMandate } from "@/hooks/use-selected-mandate";
import { writeStoredMandateId } from "@/hooks/use-stored-mandate";
import { useFmt, useT } from "@/lib/i18n/provider";
import { BoundaryExplainer } from "./boundary-explainer";
import { GrantSheet } from "./grant-form";
import { MandateAnchor, MandateControls } from "./mandate-controls";

/** Loads the mandate + ledger and nudges confirm for entries still pending on-chain. */
async function loadDetailWithConfirm(id: string): Promise<MandateDetailResponse> {
  const d = await api.mandate(id);
  const pending = d.ledger.filter((e) => e.status === "pending" && e.txHash);
  if (pending.length === 0) return d;
  const results = await Promise.allSettled(pending.map((e) => api.confirm(e.id)));
  const updated = new Map<string, (typeof d.ledger)[number]>();
  for (const r of results) if (r.status === "fulfilled") updated.set(r.value.entry.id, r.value.entry);
  if (updated.size === 0) return d;
  const changed = [...updated.values()].some((e) => e.status !== "pending");
  const fresh = changed ? await api.mandate(id) : d;
  return { ...fresh, ledger: fresh.ledger.map((e) => updated.get(e.id) ?? e) };
}

/** Same column split as DecisionWorkspace, so budget lines up with the ledger and controls with the panel. */
const SPLIT = "grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-stretch";

function SummarySkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-[122px] rounded-lg" />
      <div className={SPLIT}>
        <Skeleton className="h-[212px] rounded-lg" />
        <Skeleton className="h-[212px] rounded-lg" />
      </div>
      <Skeleton className="h-12 rounded-lg" />
    </div>
  );
}

function SectionHeading({
  id,
  title,
  description,
  actions,
}: {
  id: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        {/* The sticky app header is cleared by scroll-padding-top on <html> (app/globals.css). */}
        <h2 id={id} className="type-section text-ink">
          {title}
        </h2>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted-ink">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

function PrincipalInner() {
  const { id, mandates, error: listError, loading: listLoading, refresh: refreshList, addOptimistic } = useSelectedMandate();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const now = useNow(5000);
  const load = useCallback(() => loadDetailWithConfirm(id ?? ""), [id]);
  const detail = useResource(id ? load : null, 5000);
  const t = useT();
  const f = useFmt();
  const tp = t.principal.page;
  const [grantOpen, setGrantOpen] = useState(false);
  /** "Grant a new mandate": the sheet gives the keyboard focus back to it when it closes. */
  const grantRef = useRef<HTMLButtonElement>(null);

  /** Replace some search params and keep the rest (?m=, ?d= and anything else). */
  const replaceParams = useCallback(
    (patch: Record<string, string | null>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) sp.delete(k);
        else sp.set(k, v);
      }
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  // The selected decision lives in ?d=. A local copy answers the click at once; it follows the URL
  // whenever ?d= changes from elsewhere (back / forward, a link, the Evidence drawer).
  const urlD = params.get("d");
  const [selected, setSelected] = useState<string | null>(urlD);
  const [seenD, setSeenD] = useState<string | null>(urlD);
  if (urlD !== seenD) {
    setSeenD(urlD);
    setSelected(urlD);
  }
  const onSelect = (entryId: string) => {
    setSelected(entryId);
    if (entryId !== urlD) replaceParams({ d: entryId });
  };

  const data = detail.data;
  const ledger = data?.ledger ?? null;
  const selectedId = selected && ledger?.some((e) => e.id === selected) ? selected : null;

  // A ?d= that is not in this mandate's ledger (another mandate was picked) is dropped once it loaded.
  useEffect(() => {
    if (!ledger || !urlD) return;
    if (!ledger.some((e) => e.id === urlD)) replaceParams({ d: null });
  }, [ledger, urlD, replaceParams]);

  // Arriving with ?d= (a link from Traveler, Audit or the Evidence drawer): once the ledger is in,
  // bring the selected row into view, next to its evidence. Only for the ?d= the page opened with.
  const arrivedWith = useRef(urlD);
  useEffect(() => {
    const want = arrivedWith.current;
    if (!want || !ledger) return;
    arrivedWith.current = null;
    if (!ledger.some((e) => e.id === want)) return;
    requestAnimationFrame(() => {
      // The section heading first (ledger and evidence in view), then the row if it is still out of view.
      document.getElementById("principal-ledger")?.scrollIntoView({ block: "start" });
      const row = document.querySelector<HTMLElement>(`[role="option"][data-entry-id="${CSS.escape(want)}"]`);
      const r = row?.getBoundingClientRect();
      if (row && r && r.bottom > window.innerHeight) row.scrollIntoView({ block: "center" });
    });
  }, [ledger]);

  const onCreated = (res: CreateMandateResponse) => {
    setGrantOpen(false);
    addOptimistic(res.mandate);
    writeStoredMandateId(res.mandate.id);
    replaceParams({ m: res.mandate.id, d: null });
    toast.success(tp.granted, {
      description: `${res.mandate.id} · ${res.anchor.txHash.slice(0, 10)}…`,
      action: { label: "Etherscan", onClick: () => window.open(res.anchor.explorerUrl, "_blank", "noopener,noreferrer") },
      duration: 8000,
    });
  };

  const onChanged = () => {
    detail.refresh();
    refreshList();
  };

  const grantButton = (
    <Button ref={grantRef} type="button" size="lg" onClick={() => setGrantOpen(true)} className="px-3.5">
      <Plus aria-hidden />
      {tp.grantNew}
    </Button>
  );

  const noMandates = mandates !== null && mandates.length === 0;
  const auditHref = id
    ? `/audit/${encodeURIComponent(id)}${selectedId ? `?d=${encodeURIComponent(selectedId)}` : ""}`
    : "/audit";

  // ---- Authority, budget, controls, rules ----
  let summary: React.ReactNode;
  if (listError && !mandates) {
    summary = <ErrorState title={tp.loadMandatesFailed} error={listError} onRetry={refreshList} />;
  } else if (noMandates) {
    summary = <EmptyState title={tp.noMandates} description={tp.noMandatesHint} action={grantButton} />;
  } else if (detail.error && !data) {
    summary = (
      <ErrorState title={tp.loadMandateFailed(String(id))} error={detail.error} onRetry={detail.refresh} retrying={detail.refreshing} />
    );
  } else if (listLoading || !data) {
    summary = <SummarySkeleton />;
  } else {
    const m = data.mandate;
    summary = (
      <div className="space-y-4">
        <AuthoritySummary mandate={m} now={now} />
        <div className={SPLIT}>
          <BudgetBreakdown budget={m} />
          <MandateControls mandate={m} now={now} onChanged={onChanged} />
        </div>
        <div className="space-y-2.5">
          <RuleSummary mandate={m} headingLevel={2} />
          <MandateAnchor mandate={m} />
        </div>
      </div>
    );
  }

  // ---- Decision ledger + evidence ----
  let workspace: React.ReactNode = null;
  if (!noMandates && !(listError && !mandates)) {
    if (ledger === null) {
      workspace =
        detail.error && !data ? null : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
            <div className="space-y-2 rounded-lg border border-line bg-surface p-4" aria-busy="true" aria-label={t.ui.ledger.loading}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
            <Skeleton className="hidden h-64 rounded-lg lg:block" />
          </div>
        );
    } else if (ledger.length === 0) {
      workspace = (
        <EmptyState
          title={tp.noRequests}
          description={tp.noRequestsHint}
          action={
            <Button asChild variant="outline" size="lg">
              <Link href={`/traveler?m=${encodeURIComponent(id ?? "")}`}>{tp.openTraveler}</Link>
            </Button>
          }
        />
      );
    } else {
      workspace = (
        <DecisionWorkspace
          entries={ledger}
          mandate={data?.mandate ?? null}
          selectedId={selectedId}
          onSelect={onSelect}
          now={now}
        />
      );
    }
  }

  const payments = ledger && data ? countPayments(ledger) : 0;

  return (
    <PageContainer>
      <PageHeader eyebrow={tp.eyebrow} title={tp.title} description={tp.description} actions={noMandates ? undefined : grantButton} />

      {summary}

      {workspace && (
        <section aria-labelledby="principal-ledger" className="mt-10">
          <SectionHeading
            id="principal-ledger"
            title={tp.ledgerTitle}
            description={tp.ledgerDescription}
            actions={
              <>
                {detail.updatedAt !== null && (
                  <span className="text-xs text-muted-ink tabular-nums">
                    {tp.updated(f.rel(new Date(detail.updatedAt).toISOString(), now === null ? null : Math.max(now, detail.updatedAt)))}
                  </span>
                )}
                {/* aria-disabled while refreshing: `disabled` would drop the keyboard focus to <body>. */}
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  title={tp.refreshLedger}
                  onClick={() => {
                    if (id && !detail.refreshing) detail.refresh();
                  }}
                  disabled={!id}
                  aria-disabled={detail.refreshing || undefined}
                  className="aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
                >
                  <RefreshCw aria-hidden />
                  {detail.refreshing ? tp.refreshing : tp.refresh}
                </Button>
                {id && (
                  <Button asChild variant="ghost" size="lg" className="text-cobalt hover:text-cobalt">
                    <Link href={auditHref}>
                      {tp.openAudit}
                      <ArrowUpRight aria-hidden />
                    </Link>
                  </Button>
                )}
              </>
            }
          />
          {detail.error && ledger && (
            <p role="status" className="mb-3 flex items-start gap-2 text-xs text-danger">
              <StateGlyph glyph="triangle" className="mt-0.5 size-2.5 shrink-0" />
              {tp.staleCopy(detail.error.message)}
            </p>
          )}
          {workspace}
        </section>
      )}

      {ledger && data && ledger.length > 0 && (
        <section aria-labelledby="principal-payments" className="mt-10">
          <SectionHeading id="principal-payments" title={t.ledger.payments.title} description={t.ledger.payments.description} />
          {payments > 0 ? (
            <LedgerTable entries={ledger} now={now} selectedId={selectedId} caption={t.ledger.payments.caption(data.mandate.id)} />
          ) : (
            <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted-ink">
              {t.ledger.payments.empty}
            </p>
          )}
        </section>
      )}

      {!noMandates && <BoundaryExplainer className="mt-10" />}

      <GrantSheet open={grantOpen} onOpenChange={setGrantOpen} onCreated={onCreated} returnFocusRef={grantRef} />
    </PageContainer>
  );
}

function PrincipalFallback() {
  return (
    <PageContainer>
      <div className="mb-6 h-[92px]" />
      <SummarySkeleton />
    </PageContainer>
  );
}

export default function PrincipalPage() {
  return (
    <Suspense fallback={<PrincipalFallback />}>
      <PrincipalInner />
    </Suspense>
  );
}
