"use client";

import { Suspense, useCallback } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { CreateMandateResponse, MandateDetailResponse } from "@/contracts/api";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LedgerTable } from "@/components/perdiem/ledger-table";
import { PageContainer, PageHeader, Panel, PanelTitle } from "@/components/perdiem/page";
import { EmptyState, ErrorState, LoadingRows } from "@/components/perdiem/states";
import { useNow } from "@/hooks/use-now";
import { useResource } from "@/hooks/use-resource";
import { useSelectedMandate } from "@/hooks/use-selected-mandate";
import { useFmt, useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { BoundaryExplainer } from "./boundary-explainer";
import { GrantForm } from "./grant-form";
import { MandateControls } from "./mandate-controls";

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

function ControlsSkeleton() {
  return (
    <Panel className="space-y-5">
      <div className="flex justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-44" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[84px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-12" />
    </Panel>
  );
}

function PrincipalInner() {
  const { id, mandates, error: listError, loading: listLoading, refresh: refreshList, select, addOptimistic } = useSelectedMandate();
  const now = useNow(5000);
  const load = useCallback(() => loadDetailWithConfirm(id ?? ""), [id]);
  const detail = useResource(id ? load : null, 5000);
  const t = useT();
  const f = useFmt();
  const tp = t.principal.page;

  const onCreated = (res: CreateMandateResponse) => {
    addOptimistic(res.mandate);
    select(res.mandate.id);
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

  let right: React.ReactNode;
  if (listLoading || (id && detail.loading)) right = <ControlsSkeleton />;
  else if (listError && !mandates) right = <ErrorState title={tp.loadMandatesFailed} error={listError} onRetry={refreshList} />;
  else if (mandates && mandates.length === 0)
    right = <EmptyState title={tp.noMandates} description={tp.noMandatesHint} />;
  else if (detail.error && !detail.data)
    right = <ErrorState title={tp.loadMandateFailed(String(id))} error={detail.error} onRetry={detail.refresh} retrying={detail.refreshing} />;
  else if (detail.data) right = <MandateControls mandate={detail.data.mandate} now={now} onChanged={onChanged} />;
  else right = <ControlsSkeleton />;

  const ledger = detail.data?.ledger ?? null;

  return (
    <PageContainer>
      <PageHeader
        eyebrow={tp.eyebrow}
        title={tp.title}
        description={tp.description}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        <GrantForm onCreated={onCreated} />
        <div className="min-w-0 space-y-6">
          {right}
          <BoundaryExplainer />
        </div>
      </div>

      <Panel className="mt-6" as="section">
        <PanelTitle
          description={tp.ledgerDescription}
          actions={
            <>
              {detail.updatedAt !== null && (
                <span className="text-xs text-zinc-400 tabular-nums" aria-live="polite">
                  {tp.updated(f.rel(new Date(detail.updatedAt).toISOString(), now))}
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={detail.refresh}
                disabled={!id || detail.refreshing}
                aria-label={tp.refreshLedger}
              >
                <RefreshCw aria-hidden className={cn(detail.refreshing && "animate-spin")} />
                {tp.refresh}
              </Button>
            </>
          }
        >
          {tp.ledgerTitle}{id ? <span className="ml-2 font-mono text-sm font-normal text-zinc-500">{id}</span> : null}
        </PanelTitle>
        {detail.error && ledger && (
          <p role="status" className="mb-3 text-xs text-amber-700">
            {tp.staleCopy(detail.error.message)}
          </p>
        )}
        {ledger === null ? (
          detail.error ? (
            <ErrorState title={tp.loadLedgerFailed} error={detail.error} onRetry={detail.refresh} />
          ) : (
            <LoadingRows rows={5} />
          )
        ) : ledger.length === 0 ? (
          <EmptyState
            title={tp.noRequests}
            description={tp.noRequestsHint}
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={`/traveler?m=${encodeURIComponent(id ?? "")}`}>{tp.openTraveler}</Link>
              </Button>
            }
          />
        ) : (
          <LedgerTable entries={ledger} now={now} />
        )}
      </Panel>
    </PageContainer>
  );
}

function PrincipalFallback() {
  return (
    <PageContainer>
      <div className="mb-6 h-16" />
      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Skeleton className="h-[640px] rounded-xl" />
        <ControlsSkeleton />
      </div>
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
