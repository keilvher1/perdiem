"use client";

import { Suspense, useCallback } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { CreateMandateResponse, MandateDetailResponse } from "@/contracts/api";
import { api } from "@/lib/api-client";
import { fmtRel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LedgerTable } from "@/components/perdiem/ledger-table";
import { PageContainer, PageHeader, Panel, PanelTitle } from "@/components/perdiem/page";
import { EmptyState, ErrorState, LoadingRows } from "@/components/perdiem/states";
import { useNow } from "@/hooks/use-now";
import { useResource } from "@/hooks/use-resource";
import { useSelectedMandate } from "@/hooks/use-selected-mandate";
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

  const onCreated = (res: CreateMandateResponse) => {
    addOptimistic(res.mandate);
    select(res.mandate.id);
    toast.success("Mandate granted — anchored on Sepolia", {
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
  else if (listError && !mandates) right = <ErrorState title="Couldn’t load mandates" error={listError} onRetry={refreshList} />;
  else if (mandates && mandates.length === 0)
    right = <EmptyState title="No mandates yet" description="Grant the first one with the form. It is hashed and anchored on Sepolia." />;
  else if (detail.error && !detail.data)
    right = <ErrorState title={`Couldn’t load ${id}`} error={detail.error} onRetry={detail.refresh} retrying={detail.refreshing} />;
  else if (detail.data) right = <MandateControls mandate={detail.data.mandate} now={now} onChanged={onChanged} />;
  else right = <ControlsSkeleton />;

  const ledger = detail.data?.ledger ?? null;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Principal"
        title="Grant a budget, watch it, stop it"
        description="Set the terms once. Every agent payment is checked against them in code; pause is a kill switch, revoke is final."
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
          description="Every decision, approved or stopped, newest first. Refreshes every 5 s; click a row for the proposal, hashes and Kiln evidence."
          actions={
            <>
              {detail.updatedAt !== null && (
                <span className="text-xs text-zinc-400 tabular-nums" aria-live="polite">
                  Updated {fmtRel(new Date(detail.updatedAt).toISOString(), now)}
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={detail.refresh}
                disabled={!id || detail.refreshing}
                aria-label="Refresh ledger"
              >
                <RefreshCw aria-hidden className={cn(detail.refreshing && "animate-spin")} />
                Refresh
              </Button>
            </>
          }
        >
          Ledger{id ? <span className="ml-2 font-mono text-sm font-normal text-zinc-500">{id}</span> : null}
        </PanelTitle>
        {detail.error && ledger && (
          <p role="status" className="mb-3 text-xs text-amber-700">
            Showing the last good copy — refresh failed: {detail.error.message}
          </p>
        )}
        {ledger === null ? (
          detail.error ? (
            <ErrorState title="Couldn’t load the ledger" error={detail.error} onRetry={detail.refresh} />
          ) : (
            <LoadingRows rows={5} />
          )
        ) : ledger.length === 0 ? (
          <EmptyState
            title="No requests yet — try a quick prompt"
            description="The traveler has not asked the agent for anything under this mandate."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={`/traveler?m=${encodeURIComponent(id ?? "")}`}>Open Traveler</Link>
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
