"use client";

import { useCallback } from "react";
import { CalendarRange, CircleAlert, Gauge, ListChecks } from "lucide-react";
import type { MandateSummary } from "@/contracts/api";
import { api } from "@/lib/api-client";
import { fmtDate, fmtUsd } from "@/lib/format";
import { useResource } from "@/hooks/use-resource";
import { Skeleton } from "@/components/ui/skeleton";
import { effectiveMandateStatus, StatusPill } from "@/components/perdiem/status-pill";
import { Panel } from "@/components/perdiem/page";
import { cn } from "@/lib/utils";

function Banner({ tone, children }: { tone: "amber" | "slate"; children: React.ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        "mb-4 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-inset",
        tone === "amber" ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-slate-50 text-slate-700 ring-slate-200",
      )}
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/** Selected mandate: who, remaining / budget, cap, window, rules; quiet banner when not usable. */
export function MandateCard({ summary, now }: { summary: MandateSummary; now: number | null }) {
  const eff = effectiveMandateStatus(summary, now);
  const load = useCallback(() => api.mandate(summary.id), [summary.id]);
  const detail = useResource(load);
  const d = detail.data?.mandate;

  const budget = summary.budgetUsd;
  const remaining = Math.max(0, summary.remainingUsd);
  const pct = budget > 0 ? Math.min(100, (remaining / budget) * 100) : 0;
  const pendingPct = budget > 0 ? Math.min(100 - pct, (summary.pendingUsd / budget) * 100) : 0;
  const barTone = pct <= 10 ? "bg-rose-500" : pct <= 25 ? "bg-amber-500" : "bg-emerald-500";

  const allowedMerchants = d
    ? d.catalog.filter((c) => d.allowedMerchantIds.includes(c.id)).map((c) => c.name)
    : null;

  return (
    <Panel className="p-5">
      {eff === "paused" && <Banner tone="amber">The principal paused this mandate. Requests will be stopped and recorded.</Banner>}
      {eff === "revoked" && <Banner tone="slate">The principal revoked this mandate. Every request will be stopped and recorded.</Banner>}
      {eff === "expired" && (
        <Banner tone="slate">This mandate expired on {fmtDate(summary.expiresAt, true)}. Requests will be stopped and recorded.</Banner>
      )}
      {eff === "scheduled" && (
        <Banner tone="slate">This mandate opens on {fmtDate(summary.startsAt, true)}. Requests before then will be stopped.</Banner>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Acting for</p>
          <h2 className="mt-0.5 truncate text-xl font-semibold tracking-tight text-zinc-900">{summary.traveler}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            <span className="font-mono text-zinc-600">{summary.id}</span> · granted by{" "}
            <span className="font-medium text-zinc-700">{summary.principal}</span>
          </p>
        </div>
        <StatusPill status={eff} />
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium text-zinc-500">Remaining budget</p>
        <p className="mt-0.5 text-[28px] leading-9 font-semibold tracking-tight text-zinc-900 tabular-nums">
          {fmtUsd(summary.remainingUsd)}
          <span className="ml-1.5 text-sm font-normal text-zinc-400">of {fmtUsd(budget)}</span>
        </p>
        <div
          className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-zinc-100"
          role="progressbar"
          aria-label="Remaining budget"
          aria-valuemin={0}
          aria-valuemax={budget}
          aria-valuenow={remaining}
          aria-valuetext={`${fmtUsd(summary.remainingUsd)} of ${fmtUsd(budget)} remaining`}
        >
          <div className={cn("h-full transition-all duration-500", barTone)} style={{ width: `${pct}%` }} />
          {pendingPct > 0 && <div className="h-full bg-amber-300" style={{ width: `${pendingPct}%` }} />}
        </div>
        <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-xs text-zinc-500 tabular-nums">
          <span>
            Spent {fmtUsd(summary.spentUsd)}
            {summary.pendingUsd > 0 && <> · {fmtUsd(summary.pendingUsd)} pending</>}
          </span>
          <span>{summary.entryCount} ledger entries</span>
        </div>
      </div>

      <dl className="mt-4 space-y-2.5 border-t border-zinc-100 pt-4 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-500">
            <Gauge aria-hidden className="size-3.5" /> Per-payment cap
          </dt>
          <dd className="font-medium text-zinc-900 tabular-nums">{fmtUsd(summary.perTxCapUsd)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-500">
            <CalendarRange aria-hidden className="size-3.5" /> Trip window
          </dt>
          <dd className="text-right text-zinc-900 tabular-nums">
            <span className="block">{fmtDate(summary.startsAt)} →</span>
            <span className="block">{fmtDate(summary.expiresAt, true)}</span>
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-500">
            <ListChecks aria-hidden className="size-3.5" /> Categories
          </dt>
          <dd className="text-right text-zinc-900">
            {d ? d.allowedCategories.join(", ") || "none" : detail.error ? "—" : <Skeleton className="h-4 w-28" />}
          </dd>
        </div>
        {d && (
          <>
            <div className="pl-5">
              <dt className="text-xs text-zinc-500">Permitted merchants</dt>
              <dd className="mt-0.5 text-xs leading-5 text-zinc-700">{allowedMerchants?.join(" · ") || "none"}</dd>
            </div>
            {d.blockedKeywords.length > 0 && (
              <div className="pl-5">
                <dt className="text-xs text-zinc-500">Blocked words</dt>
                <dd className="mt-0.5 flex flex-wrap gap-1">
                  {d.blockedKeywords.map((k) => (
                    <span key={k} className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600">
                      {k}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </>
        )}
      </dl>
    </Panel>
  );
}

export function MandateCardSkeleton() {
  return (
    <Panel className="space-y-4 p-5">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-9 w-44" />
      <Skeleton className="h-2 w-full" />
      <div className="space-y-2.5 pt-2">
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
      </div>
    </Panel>
  );
}
