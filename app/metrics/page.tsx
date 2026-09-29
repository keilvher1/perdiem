"use client";

import { Suspense } from "react";
import { CircleCheck, CircleX, Cpu, Leaf, MessageSquareText, OctagonX, RefreshCw, Sigma, Zap } from "lucide-react";
import type { EnergyEstimate, ReasoningComparison, UsageResponse } from "@/contracts/api";
import { api } from "@/lib/api-client";
import { fmtMs, fmtPct, fmtUsd } from "@/lib/format";
import { useFmt, useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableShell, Tbl, Td, Th, THead, Tr } from "@/components/perdiem/data-table";
import { PageContainer, PageHeader, Panel, PanelTitle, StatTile } from "@/components/perdiem/page";
import { EmptyState, ErrorState } from "@/components/perdiem/states";
import { useNow } from "@/hooks/use-now";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/utils";

const loadUsage = () => api.usage();

function FlowTable({ usage }: { usage: UsageResponse }) {
  const t = useT().metrics.flows;
  const f = useFmt();
  const { byFlow, totals } = usage;
  if (byFlow.length === 0) {
    return <EmptyState title={t.emptyTitle} description={t.emptyBody} />;
  }
  return (
    <TableShell>
      <Tbl className="min-w-[860px]">
        <THead>
          <tr>
            <Th>{t.cols.flow}</Th>
            <Th numeric>{t.cols.calls}</Th>
            <Th numeric>{t.cols.prompt}</Th>
            <Th numeric>{t.cols.completion}</Th>
            <Th numeric>{t.cols.total}</Th>
            <Th numeric>{t.cols.cost}</Th>
            <Th numeric>{t.cols.latency}</Th>
          </tr>
        </THead>
        <tbody>
          {byFlow.map((r) => {
            const zero = r.calls > 0 && r.totalTokens === 0;
            return (
              <Tr key={r.flow} className={cn(zero && "bg-emerald-50/60 hover:bg-emerald-50")}>
                <Td>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-medium text-zinc-900">{r.flow}</span>
                    {zero && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/80 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                        <Leaf aria-hidden className="size-3" /> {t.zero}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">{t.info[r.flow] ?? ""}</div>
                </Td>
                <Td numeric>{f.int(r.calls)}</Td>
                <Td numeric>{f.int(r.promptTokens)}</Td>
                <Td numeric>{f.int(r.completionTokens)}</Td>
                <Td numeric className={cn("font-medium", zero ? "text-emerald-700" : "text-zinc-900")}>
                  {f.int(r.totalTokens)}
                </Td>
                <Td numeric>{fmtUsd(r.costUsd)}</Td>
                <Td numeric>{fmtMs(r.avgLatencyMs)}</Td>
              </Tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-zinc-200 bg-zinc-50 font-medium">
            <Td className="text-zinc-900">{t.total}</Td>
            <Td numeric className="text-zinc-900">{f.int(totals.calls)}</Td>
            <Td numeric className="text-zinc-900">{f.int(totals.promptTokens)}</Td>
            <Td numeric className="text-zinc-900">{f.int(totals.completionTokens)}</Td>
            <Td numeric className="text-zinc-900">{f.int(totals.totalTokens)}</Td>
            <Td numeric className="text-zinc-900">{fmtUsd(totals.costUsd)}</Td>
            <Td numeric />
          </tr>
        </tfoot>
      </Tbl>
    </TableShell>
  );
}

function ToolCall({ ok }: { ok: boolean }) {
  const t = useT().metrics.comparison;
  return ok ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
      <CircleCheck aria-hidden className="size-3.5" /> {t.yes}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700">
      <CircleX aria-hidden className="size-3.5" /> {t.no}
    </span>
  );
}

/** Two thin bars on one scale: thinking on (light) vs off (dark); numbers printed beside them. */
function PairBar({ on, off, max }: { on: number; off: number; max: number }) {
  const w = (v: number) => `${max > 0 ? Math.max(2, (v / max) * 100) : 0}%`;
  return (
    <div className="w-40 space-y-1" aria-hidden>
      <div className="h-1.5 rounded-full bg-zinc-100">
        <div className="h-1.5 rounded-full bg-zinc-300" style={{ width: w(on) }} />
      </div>
      <div className="h-1.5 rounded-full bg-zinc-100">
        <div className="h-1.5 rounded-full bg-zinc-800" style={{ width: w(off) }} />
      </div>
    </div>
  );
}

function Comparison({ c }: { c: ReasoningComparison }) {
  const t = useT().metrics.comparison;
  const f = useFmt();
  const s = c.summary;
  const max = Math.max(...c.rows.flatMap((r) => [r.thinkingOn.completionTokens, r.thinkingOff.completionTokens]), 1);
  const latencySaved = s.avgLatencyOnMs > 0 ? ((s.avgLatencyOnMs - s.avgLatencyOffMs) / s.avgLatencyOnMs) * 100 : null;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={t.toolCalls}
          value={<span className="text-xl">{`${s.toolCallsOn}/${c.rows.length} → ${s.toolCallsOff}/${c.rows.length}`}</span>}
          hint={s.toolCallsOff >= s.toolCallsOn ? t.sameAccuracy : t.fewerToolCalls}
        />
        <StatTile
          label={t.saved}
          value={<span className="text-xl">{`−${fmtPct(s.completionSavedPct)}`}</span>}
          tone="emerald"
          hint={t.perProposal(f.int(s.avgCompletionOn), f.int(s.avgCompletionOff))}
        />
        <StatTile label={t.latency} value={<span className="text-xl">{`${fmtMs(s.avgLatencyOnMs)} → ${fmtMs(s.avgLatencyOffMs)}`}</span>} hint={latencySaved !== null ? `−${fmtPct(Math.round(latencySaved))}` : undefined} />
        <StatTile label={t.measuredOn} value={<span className="font-mono text-base">{c.model}</span>} hint={t.measuredHint(f.date(c.measuredAt, true), c.rows.length)} />
      </div>
      <TableShell>
        <Tbl className="min-w-[900px]">
          <THead>
            <tr>
              <Th>{t.cols.prompt}</Th>
              <Th>{t.cols.toolCall}</Th>
              <Th numeric>{t.cols.completionOn}</Th>
              <Th numeric>{t.cols.completionOff}</Th>
              <Th>
                <span className="inline-flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full bg-zinc-300" /> {t.cols.on}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full bg-zinc-800" /> {t.cols.off}
                  </span>
                </span>
              </Th>
              <Th numeric>{t.cols.latencyOn}</Th>
              <Th numeric>{t.cols.latencyOff}</Th>
            </tr>
          </THead>
          <tbody>
            {c.rows.map((r) => (
              <Tr key={r.prompt}>
                <Td className="max-w-[280px] text-zinc-800">{t.quote(r.prompt)}</Td>
                <Td>
                  <span className="inline-flex items-center gap-2">
                    <ToolCall ok={r.thinkingOn.toolCall} />
                    <span className="text-zinc-300">/</span>
                    <ToolCall ok={r.thinkingOff.toolCall} />
                  </span>
                </Td>
                <Td numeric>{f.int(r.thinkingOn.completionTokens)}</Td>
                <Td numeric className="font-medium text-zinc-900">
                  {f.int(r.thinkingOff.completionTokens)}
                </Td>
                <Td>
                  <PairBar on={r.thinkingOn.completionTokens} off={r.thinkingOff.completionTokens} max={max} />
                </Td>
                <Td numeric>{fmtMs(r.thinkingOn.latencyMs)}</Td>
                <Td numeric className="font-medium text-zinc-900">
                  {fmtMs(r.thinkingOff.latencyMs)}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Tbl>
      </TableShell>
      <p className="text-xs text-zinc-500">
        {t.footnote.before}
        <span className="font-mono">/no_think</span>
        {t.footnote.after}
      </p>
    </div>
  );
}

function EnergyCard({ e }: { e: EnergyEstimate }) {
  const t = useT().metrics.energy;
  const f = useFmt();
  const set = e.assumedJPerToken !== null && e.totalWh !== null;
  return (
    <Panel className="h-full">
      <PanelTitle description={t.formula}>
        <span className="inline-flex items-center gap-2">
          <Zap aria-hidden className="size-4 text-zinc-500" /> {t.title}
        </span>
      </PanelTitle>
      {set ? (
        <div>
          <p className="text-[28px] leading-9 font-semibold tracking-tight text-zinc-900 tabular-nums">
            {e.totalWh! < 0.01 ? e.totalWh!.toPrecision(2) : e.totalWh!.toFixed(3)} Wh
          </p>
          <p className="mt-1 text-sm text-zinc-700">
            {t.assuming.before}
            <span className="font-medium tabular-nums">{e.assumedJPerToken} J/token</span>
            {t.assuming.after(f.int(e.totalTokens))}
          </p>
          <p className="mt-1 text-xs break-words text-zinc-500">
            {t.source}
            {e.source ?? <span className="text-amber-700">{t.noSource}</span>}
          </p>
          <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500 ring-1 ring-zinc-200 ring-inset">{t.caveat}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-5">
          <p className="font-medium text-zinc-900">{t.notSetTitle}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {t.notSet.before}
            <span className="font-mono text-xs">ENERGY_J_PER_TOKEN</span>
            {t.notSet.middle}
            <span className="font-medium text-zinc-700 tabular-nums">{f.int(e.totalTokens)}</span>
            {t.notSet.after}
          </p>
        </div>
      )}
    </Panel>
  );
}

function SavingsCard() {
  const t = useT().metrics.savings;
  return (
    <Panel className="h-full">
      <PanelTitle description={t.description}>{t.title}</PanelTitle>
      <ul className="space-y-3">
        {t.items.map((x, i) => (
          <li key={x.title} className="flex gap-3">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-zinc-100 font-mono text-[10px] text-zinc-600">{i + 1}</span>
            <div>
              <p className="text-sm font-medium text-zinc-900">{x.title}</p>
              <p className="text-xs text-zinc-500">{x.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function MetricsSkeleton() {
  const t = useT();
  return (
    <div className="space-y-6" aria-busy="true" aria-label={t.metrics.loading}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[92px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[320px] rounded-xl" />
      <Skeleton className="h-[360px] rounded-xl" />
    </div>
  );
}

function MetricsInner() {
  const usage = useResource(loadUsage);
  const now = useNow(5000);
  const t = useT().metrics;
  const f = useFmt();
  const u = usage.data;

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t.header.eyebrow}
        title={t.header.title}
        description={t.header.description}
        actions={
          <>
            {usage.updatedAt !== null && <span className="text-xs text-zinc-400 tabular-nums">{t.header.updated(f.rel(new Date(usage.updatedAt).toISOString(), now))}</span>}
            <Button type="button" variant="outline" size="sm" onClick={usage.refresh} disabled={usage.loading || usage.refreshing}>
              <RefreshCw aria-hidden className={cn((usage.loading || usage.refreshing) && "animate-spin")} />
              {t.header.refresh}
            </Button>
          </>
        }
      />
      {usage.loading ? (
        <MetricsSkeleton />
      ) : usage.error && !u ? (
        <ErrorState title={t.loadError} error={usage.error} onRetry={usage.refresh} retrying={usage.refreshing} />
      ) : u ? (
        <div className={cn("space-y-6 transition-opacity", usage.refreshing && "opacity-60")}>
          {usage.error && (
            <p role="status" className="text-xs text-amber-700">
              {t.stale(usage.error.message)}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              icon={<MessageSquareText aria-hidden className="size-3.5" />}
              label={t.tiles.statusFastpath} labelClassName="min-h-8"
              value={f.int(u.zeroTokenCalls.statusFastpath)}
              tone="emerald"
              hint={t.tiles.statusFastpathHint}
            />
            <StatTile
              icon={<OctagonX aria-hidden className="size-3.5" />}
              label={t.tiles.stopTemplate} labelClassName="min-h-8"
              value={f.int(u.zeroTokenCalls.stopTemplate)}
              tone="emerald"
              hint={t.tiles.stopTemplateHint}
            />
            <StatTile icon={<Sigma aria-hidden className="size-3.5" />} label={t.tiles.cost} labelClassName="min-h-8" value={fmtUsd(u.totals.costUsd)} hint={t.tiles.costHint} />
            <StatTile
              icon={<Cpu aria-hidden className="size-3.5" />}
              label={t.tiles.tokens} labelClassName="min-h-8"
              value={f.int(u.totals.totalTokens)}
              hint={t.tiles.tokensHint(f.int(u.totals.calls))}
            />
          </div>

          <Panel>
            <PanelTitle description={t.flows.description}>{t.flows.title}</PanelTitle>
            <FlowTable usage={u} />
          </Panel>

          <div className="space-y-6">
            <Panel>
              <PanelTitle description={t.comparison.description}>{t.comparison.title}</PanelTitle>
              {u.comparison ? (
                <Comparison c={u.comparison} />
              ) : (
                <EmptyState
                  title={t.comparison.emptyTitle}
                  description={
                    <>
                      {t.comparison.emptyBody.before}
                      <span className="font-mono text-xs text-zinc-700">npm run compare</span>
                      {t.comparison.emptyBody.after}
                    </>
                  }
                />
              )}
            </Panel>
            <div className="grid gap-6 lg:grid-cols-2">
              <EnergyCard e={u.energy} />
              <SavingsCard />
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}

export default function MetricsPage() {
  return (
    <Suspense fallback={<PageContainer><MetricsSkeleton /></PageContainer>}>
      <MetricsInner />
    </Suspense>
  );
}
