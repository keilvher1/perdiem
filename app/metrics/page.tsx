"use client";

import { Suspense, useId, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import type { EnergyEstimate, ReasoningComparison, UsageByFlowRow, UsageResponse } from "@/contracts/api";
import { API_MODE, api } from "@/lib/api-client";
import { fmtMs, fmtUsd } from "@/lib/format";
import { useFmt, useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableShell, Tbl, Td, Th, THead, Tr } from "@/components/perdiem/data-table";
import { PageContainer, PageHeader } from "@/components/perdiem/page";
import { StateGlyph } from "@/components/perdiem/state-glyph";
import { EmptyState, ErrorState } from "@/components/perdiem/states";
import { useNow } from "@/hooks/use-now";
import { useResource } from "@/hooks/use-resource";

const loadUsage = () => api.usage();

type Fmt = ReturnType<typeof useFmt>;

// ---------------------------------------------------------------------------------------------
// Derivations: exact arithmetic on what GET /api/usage returns, nothing else.
// ---------------------------------------------------------------------------------------------

/** Watt-hours for `tokens` at the configured J per token: the API's own formula (tokens × J ÷ 3600). */
function whFor(tokens: number, jPerToken: number | null): number | null {
  return jPerToken === null ? null : (tokens * jPerToken) / 3600;
}

function fmtWh(v: number | null): string {
  if (v === null) return "—";
  if (v === 0) return "0 Wh";
  if (v < 0.01) return `${v.toPrecision(2)} Wh`;
  if (v < 100) return `${v.toFixed(3)} Wh`;
  return `${v.toFixed(1)} Wh`;
}

/** Off relative to on, in percent; null when a side is missing or on is 0. */
function relChange(on: number | null, off: number | null): number | null {
  if (on === null || off === null || on === 0) return null;
  return ((off - on) / on) * 100;
}

function fmtChange(p: number | null, same: string): string {
  if (p === null) return "—";
  const r = Math.round(p * 10) / 10;
  if (r === 0) return same;
  const abs = Math.abs(r);
  return `${r < 0 ? "−" : "+"}${Number.isInteger(abs) ? abs : abs.toFixed(1)}%`;
}

/** Sum of per-call costs; null when any call has no recorded cost (never counted as $0). */
function sumOrNull(xs: ReadonlyArray<number | null>): number | null {
  let total = 0;
  for (const x of xs) {
    if (x === null) return null;
    total += x;
  }
  return total;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const oneDecimal = (n: number, f: Fmt) => n.toLocaleString(f.tag, { maximumFractionDigits: 1 });

// ---------------------------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------------------------

function SectionHead({
  id,
  title,
  description,
  aside,
}: {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="max-w-3xl min-w-0">
        <h2 id={id} className="type-section text-ink">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-muted-ink">{description}</p>}
      </div>
      {aside}
    </div>
  );
}

/** "Estimate": dashed like every other value that is not established by a measurement. */
function EstimateTag() {
  const t = useT().metrics.summary;
  return (
    <span className="inline-flex h-5 items-center rounded-md border border-dashed border-line-strong px-1.5 text-[11px] font-medium text-muted-ink">
      {t.estimate}
    </span>
  );
}

function NoModelTag() {
  const t = useT().metrics.flows;
  return (
    <span className="inline-flex h-5 items-center rounded-md border border-line bg-surface-2 px-1.5 text-[11px] font-medium whitespace-nowrap text-muted-ink">
      {t.noModel}
    </span>
  );
}

/** Label / value pair for the stacked (mobile) lists: value right-aligned, tabular. */
function Pair({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted-ink">{label}</dt>
      <dd className="text-right whitespace-nowrap text-ink tabular-nums">{children}</dd>
    </div>
  );
}

/** "on / off" pair in one cell, both sides at the same weight (neither setting is presented as the better one). */
function OnOff({ on, off }: { on: ReactNode; off: ReactNode }) {
  return (
    <span className="whitespace-nowrap text-ink tabular-nums">
      {on}
      <span aria-hidden className="px-1 text-muted-ink">
        /
      </span>
      {off}
    </span>
  );
}

function ToolCall({ ok }: { ok: boolean }) {
  const t = useT().metrics.comparison;
  return ok ? (
    <span className="inline-flex items-center gap-1 text-ink">
      <StateGlyph glyph="circle-check" className="size-3 text-muted-ink" />
      {t.yes}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-danger">
      <StateGlyph glyph="triangle" className="size-3" />
      {t.no}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// 1 · Totals
// ---------------------------------------------------------------------------------------------

function Stat({
  label,
  value,
  hint,
  className,
  valueClassName,
}: {
  label: ReactNode;
  value: ReactNode;
  hint: ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn("min-w-0 border-line px-4 py-4 sm:px-5", className)}>
      <dt className="type-label flex flex-wrap items-center gap-1.5 text-muted-ink">{label}</dt>
      <dd className={cn("type-amount-sm mt-1.5 text-ink", valueClassName)}>{value}</dd>
      <dd className="mt-0.5 text-xs text-muted-ink">{hint}</dd>
    </div>
  );
}

function Totals({ u }: { u: UsageResponse }) {
  const t = useT().metrics.summary;
  const f = useFmt();
  const inCode = u.zeroTokenCalls.statusFastpath + u.zeroTokenCalls.stopTemplate;
  const e = u.energy;
  const set = e.assumedJPerToken !== null && e.totalWh !== null;
  return (
    <section aria-label={t.region} className="rounded-lg border border-line bg-surface">
      <dl className="grid grid-cols-2 lg:grid-cols-[minmax(0,1.35fr)_repeat(3,minmax(0,1fr))]">
        {/* The one key amount of the page. */}
        <div className="col-span-2 border-b border-line px-4 py-4 sm:px-5 lg:col-span-1 lg:border-r lg:border-b-0">
          <dt className="type-label text-muted-ink">{t.cost}</dt>
          <dd className="type-amount mt-1 text-ink">{fmtUsd(u.totals.costUsd)}</dd>
          <dd className="mt-1 text-xs text-muted-ink">{t.costHint}</dd>
        </div>
        <Stat
          label={t.tokens}
          value={f.int(u.totals.totalTokens)}
          hint={t.tokensHint(f.int(u.totals.promptTokens), f.int(u.totals.completionTokens))}
          className="border-r"
        />
        <Stat label={t.calls} value={f.int(u.totals.calls)} hint={t.callsHint(f.int(inCode))} className="lg:border-r" />
        <Stat
          label={
            <>
              {t.energy}
              <EstimateTag />
            </>
          }
          value={set ? fmtWh(e.totalWh) : t.energyNotSet}
          valueClassName={set ? undefined : "text-muted-ink"}
          hint={
            set
              ? t.energyHint(
                  (e.assumedJPerToken as number).toLocaleString(f.tag, {
                    maximumFractionDigits: 6,
                  }),
                )
              : t.energyNotSetHint
          }
          className="col-span-2 border-t lg:col-span-1 lg:border-t-0"
        />
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// 2 · By flow
// ---------------------------------------------------------------------------------------------

function FlowLabel({ r }: { r: UsageByFlowRow }) {
  const t = useT().metrics.flows;
  const zero = r.calls > 0 && r.totalTokens === 0;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="type-id font-medium text-ink">{r.flow}</span>
        {zero && <NoModelTag />}
      </div>
      <p className="mt-0.5 text-xs text-muted-ink">{t.info[r.flow] ?? ""}</p>
    </>
  );
}

function Flows({ u }: { u: UsageResponse }) {
  const t = useT().metrics.flows;
  const f = useFmt();
  const headingId = useId();
  const { byFlow, totals, energy } = u;
  const j = energy.assumedJPerToken;
  const muted = (v: number) => (v === 0 ? "text-muted-ink" : undefined);

  return (
    <section aria-labelledby={headingId}>
      <SectionHead id={headingId} title={t.title} description={t.description} />
      {byFlow.length === 0 ? (
        <EmptyState title={t.emptyTitle} description={t.emptyBody} />
      ) : (
        <>
          {/* Wide: one table, every flow on the same columns. */}
          <TableShell className="hidden lg:block">
            <Tbl>
              <THead>
                <tr>
                  <Th>{t.cols.flow}</Th>
                  <Th numeric>{t.cols.calls}</Th>
                  <Th numeric>{t.cols.prompt}</Th>
                  <Th numeric>{t.cols.completion}</Th>
                  <Th numeric>{t.cols.total}</Th>
                  <Th numeric>{t.cols.cost}</Th>
                  <Th numeric>{t.cols.latency}</Th>
                  <Th numeric>{t.cols.energy}</Th>
                </tr>
              </THead>
              <tbody>
                {byFlow.map((r) => (
                  <Tr key={r.flow}>
                    <Td className="min-w-[15rem]">
                      <FlowLabel r={r} />
                    </Td>
                    <Td numeric>{f.int(r.calls)}</Td>
                    <Td numeric className={muted(r.promptTokens)}>
                      {f.int(r.promptTokens)}
                    </Td>
                    <Td numeric className={muted(r.completionTokens)}>
                      {f.int(r.completionTokens)}
                    </Td>
                    <Td numeric className={cn("font-medium", muted(r.totalTokens))}>
                      {f.int(r.totalTokens)}
                    </Td>
                    <Td numeric className={muted(r.costUsd)}>
                      {fmtUsd(r.costUsd)}
                    </Td>
                    <Td numeric className={muted(r.avgLatencyMs)}>
                      {fmtMs(r.avgLatencyMs)}
                    </Td>
                    <Td numeric className={cn(j === null && "text-muted-ink")}>
                      {fmtWh(whFor(r.totalTokens, j))}
                    </Td>
                  </Tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line-strong bg-surface-2 font-semibold">
                  <Td>{t.total}</Td>
                  <Td numeric>{f.int(totals.calls)}</Td>
                  <Td numeric>{f.int(totals.promptTokens)}</Td>
                  <Td numeric>{f.int(totals.completionTokens)}</Td>
                  <Td numeric>{f.int(totals.totalTokens)}</Td>
                  <Td numeric>{fmtUsd(totals.costUsd)}</Td>
                  <Td numeric />
                  <Td numeric className={cn(energy.totalWh === null && "font-normal text-muted-ink")}>
                    {fmtWh(energy.totalWh)}
                  </Td>
                </tr>
              </tfoot>
            </Tbl>
          </TableShell>

          {/* Narrow: one block per flow, the same fields as the table's columns. */}
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface lg:hidden">
            {byFlow.map((r) => (
              <li key={r.flow} className="px-4 py-3">
                <FlowLabel r={r} />
                <dl className="mt-2.5 grid grid-cols-2 gap-x-5 gap-y-1 text-sm">
                  <Pair label={t.cols.calls}>{f.int(r.calls)}</Pair>
                  <Pair label={t.cols.total}>{f.int(r.totalTokens)}</Pair>
                  <Pair label={t.cols.prompt}>{f.int(r.promptTokens)}</Pair>
                  <Pair label={t.cols.completion}>{f.int(r.completionTokens)}</Pair>
                  <Pair label={t.cols.cost}>{fmtUsd(r.costUsd)}</Pair>
                  <Pair label={t.cols.latency}>{fmtMs(r.avgLatencyMs)}</Pair>
                  <Pair label={t.cols.energy}>{fmtWh(whFor(r.totalTokens, j))}</Pair>
                </dl>
              </li>
            ))}
            <li className="bg-surface-2 px-4 py-3">
              <p className="font-semibold text-ink">{t.total}</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-5 gap-y-1 text-sm">
                <Pair label={t.cols.calls}>{f.int(totals.calls)}</Pair>
                <Pair label={t.cols.total}>{f.int(totals.totalTokens)}</Pair>
                <Pair label={t.cols.prompt}>{f.int(totals.promptTokens)}</Pair>
                <Pair label={t.cols.completion}>{f.int(totals.completionTokens)}</Pair>
                <Pair label={t.cols.cost}>{fmtUsd(totals.costUsd)}</Pair>
                <Pair label={t.cols.energy}>{fmtWh(energy.totalWh)}</Pair>
              </dl>
            </li>
          </ul>
          {j === null && <p className="mt-2 text-xs text-muted-ink">{t.energyMissing}</p>}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// 3 · Thinking on vs off
// ---------------------------------------------------------------------------------------------

function Conditions({ c }: { c: ReasoningComparison }) {
  const t = useT().metrics.comparison.conditions;
  const f = useFmt();
  const n = c.rows.length;
  const item = "min-w-0";
  const dt = "type-label text-muted-ink";
  const dd = "mt-0.5 text-sm text-ink";
  const src = useT().metrics.comparison;
  return (
    <div className="rounded-lg border border-line bg-surface">
      <dl
        aria-label={t.region}
        className="grid grid-cols-1 gap-x-6 gap-y-3 px-4 py-3 sm:grid-cols-2 sm:px-5 lg:grid-cols-5"
      >
        <div className={item}>
          <dt className={dt}>{t.measured}</dt>
          <dd className={cn(dd, "tabular-nums")}>{f.date(c.measuredAt, true)}</dd>
        </div>
        <div className={item}>
          <dt className={dt}>{t.model}</dt>
          <dd className={dd}>
            <span className="type-id">{c.model}</span>
          </dd>
        </div>
        <div className={item}>
          <dt className={dt}>{t.sample}</dt>
          <dd className={dd}>{t.sampleValue(n, n * 2)}</dd>
        </div>
        <div className={item}>
          <dt className={dt}>{t.off}</dt>
          <dd className={dd}>
            {t.offValue.before}
            <code className="type-id">/no_think</code>
            {t.offValue.after}
          </dd>
        </div>
        <div className={item}>
          <dt className={dt}>{t.appDefault}</dt>
          <dd className={dd}>
            {t.appDefaultValue.before}
            <code className="type-id">KILN_NO_THINK=0</code>
            {t.appDefaultValue.after}
          </dd>
        </div>
      </dl>
      {/* Where the rows come from: the measurement file live, the fixture in mock mode (never mixed up). */}
      {API_MODE === "mock" ? (
        <p className="flex items-start gap-1.5 border-t border-line px-4 py-2 text-xs text-unverified sm:px-5">
          <StateGlyph glyph="dashed-slash" className="mt-0.5 size-3" />
          <span className="min-w-0">{src.sourceMock}</span>
        </p>
      ) : (
        <p className="border-t border-line px-4 py-2 text-xs text-muted-ink sm:px-5">{src.source}</p>
      )}
    </div>
  );
}

function SideBySide({ c, energy }: { c: ReasoningComparison; energy: EnergyEstimate }) {
  const t = useT().metrics.comparison.side;
  const f = useFmt();
  const s = c.summary;
  const n = c.rows.length;
  const j = energy.assumedJPerToken;
  const promptOn = avg(c.rows.map((r) => r.thinkingOn.promptTokens));
  const promptOff = avg(c.rows.map((r) => r.thinkingOff.promptTokens));
  const costOn = sumOrNull(c.rows.map((r) => r.thinkingOn.costUsd));
  const costOff = sumOrNull(c.rows.map((r) => r.thinkingOff.costUsd));
  const tokensOn = c.rows.reduce((a, r) => a + r.thinkingOn.promptTokens + r.thinkingOn.completionTokens, 0);
  const tokensOff = c.rows.reduce((a, r) => a + r.thinkingOff.promptTokens + r.thinkingOff.completionTokens, 0);
  const whOn = whFor(tokensOn, j);
  const whOff = whFor(tokensOff, j);
  const toolDiff = s.toolCallsOff - s.toolCallsOn;

  const rows: Array<{
    key: string;
    label: string;
    on: string;
    off: string;
    change: string;
  }> = [
    {
      key: "tool",
      label: t.toolCalls,
      on: t.ofN(s.toolCallsOn, n),
      off: t.ofN(s.toolCallsOff, n),
      change: toolDiff === 0 ? t.same : `${toolDiff > 0 ? "+" : "−"}${Math.abs(toolDiff)}`,
    },
    {
      key: "completion",
      label: t.completion,
      on: oneDecimal(s.avgCompletionOn, f),
      off: oneDecimal(s.avgCompletionOff, f),
      change: fmtChange(relChange(s.avgCompletionOn, s.avgCompletionOff), t.same),
    },
    {
      key: "prompt",
      label: t.prompt,
      on: oneDecimal(promptOn, f),
      off: oneDecimal(promptOff, f),
      change: fmtChange(relChange(promptOn, promptOff), t.same),
    },
    {
      key: "latency",
      label: t.latency,
      on: fmtMs(s.avgLatencyOnMs),
      off: fmtMs(s.avgLatencyOffMs),
      change: fmtChange(relChange(s.avgLatencyOnMs, s.avgLatencyOffMs), t.same),
    },
    {
      key: "cost",
      label: t.cost(n),
      on: fmtUsd(costOn),
      off: fmtUsd(costOff),
      change: fmtChange(relChange(costOn, costOff), t.same),
    },
    {
      key: "energy",
      label: t.energy(n),
      on: fmtWh(whOn),
      off: fmtWh(whOff),
      change: fmtChange(relChange(whOn, whOff), t.same),
    },
  ];

  return (
    <TableShell>
      <Tbl className="[&_td]:px-2.5 [&_th]:px-2.5 sm:[&_td]:px-3 sm:[&_th]:px-3">
        <caption className="sr-only">{t.caption}</caption>
        <THead>
          <tr>
            <Th>{t.measure}</Th>
            <Th numeric>{t.on}</Th>
            <Th numeric>{t.off}</Th>
            <Th numeric>{t.change}</Th>
          </tr>
        </THead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.key}>
              <Th scope="row" className="h-auto py-2.5 text-sm font-normal whitespace-normal text-ink">
                {r.label}
              </Th>
              <Td numeric>{r.on}</Td>
              <Td numeric>{r.off}</Td>
              <Td numeric className={cn(r.change === "—" ? "text-muted-ink" : "text-ink")}>
                {r.change}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Tbl>
    </TableShell>
  );
}

function Quality({ c }: { c: ReasoningComparison }) {
  const t = useT().metrics.comparison.quality;
  const s = c.summary;
  const n = c.rows.length;
  return (
    <aside aria-label={t.title} className="rounded-lg border border-line bg-surface px-4 py-4 sm:px-5">
      <h3 className="text-[15px] leading-6 font-semibold text-ink">{t.title}</h3>
      <ul className="mt-3 space-y-3 text-sm">
        <li className="flex gap-2.5">
          <StateGlyph glyph="circle-check" className="mt-1 size-3 text-ink" />
          <span className="text-ink">{t.measured(s.toolCallsOn, s.toolCallsOff, n)}</span>
        </li>
        <li className="flex gap-2.5">
          <StateGlyph glyph="dashed" className="mt-1 size-3 text-unverified" />
          <span className="text-ink">{t.notMeasured}</span>
        </li>
      </ul>
      <p className="mt-4 border-t border-line pt-3 text-sm text-muted-ink">{t.policy}</p>
    </aside>
  );
}

function PerPrompt({ c }: { c: ReasoningComparison }) {
  const t = useT().metrics.comparison;
  const p = t.perPrompt;
  const f = useFmt();
  const sub = <span className="block text-[11px] font-normal text-muted-ink">{p.onOff}</span>;
  return (
    <div>
      <h3 className="mb-3 text-[15px] leading-6 font-semibold text-ink">
        {p.title}
        <span className="ml-2 text-xs font-normal text-muted-ink lg:hidden">{p.onOff}</span>
      </h3>
      <TableShell className="hidden lg:block">
        <Tbl>
          <THead>
            <tr>
              <Th className="h-auto py-2">{p.cols.prompt}</Th>
              <Th className="h-auto py-2">
                {p.cols.toolCall}
                {sub}
              </Th>
              <Th numeric className="h-auto py-2">
                {p.cols.completion}
                {sub}
              </Th>
              <Th numeric className="h-auto py-2">
                {p.cols.latency}
                {sub}
              </Th>
              <Th numeric className="h-auto py-2">
                {p.cols.cost}
                {sub}
              </Th>
            </tr>
          </THead>
          <tbody>
            {c.rows.map((r) => (
              <Tr key={r.prompt}>
                <Td className="max-w-[26rem]">{t.quote(r.prompt)}</Td>
                <Td>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <ToolCall ok={r.thinkingOn.toolCall} />
                    <span aria-hidden className="text-muted-ink">
                      /
                    </span>
                    <ToolCall ok={r.thinkingOff.toolCall} />
                  </span>
                </Td>
                <Td numeric>
                  <OnOff on={f.int(r.thinkingOn.completionTokens)} off={f.int(r.thinkingOff.completionTokens)} />
                </Td>
                <Td numeric>
                  <OnOff on={fmtMs(r.thinkingOn.latencyMs)} off={fmtMs(r.thinkingOff.latencyMs)} />
                </Td>
                <Td numeric>
                  <OnOff on={fmtUsd(r.thinkingOn.costUsd)} off={fmtUsd(r.thinkingOff.costUsd)} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Tbl>
      </TableShell>

      <ul className="divide-y divide-line rounded-lg border border-line bg-surface lg:hidden">
        {c.rows.map((r) => (
          <li key={r.prompt} className="px-4 py-3">
            <p className="text-sm text-ink">{t.quote(r.prompt)}</p>
            <dl className="mt-2 space-y-1 text-sm">
              <Pair label={p.cols.toolCall}>
                <span className="inline-flex items-center gap-1.5">
                  <ToolCall ok={r.thinkingOn.toolCall} />
                  <span aria-hidden className="text-muted-ink">
                    /
                  </span>
                  <ToolCall ok={r.thinkingOff.toolCall} />
                </span>
              </Pair>
              <Pair label={p.cols.completion}>
                <OnOff on={f.int(r.thinkingOn.completionTokens)} off={f.int(r.thinkingOff.completionTokens)} />
              </Pair>
              <Pair label={p.cols.latency}>
                <OnOff on={fmtMs(r.thinkingOn.latencyMs)} off={fmtMs(r.thinkingOff.latencyMs)} />
              </Pair>
              <Pair label={p.cols.cost}>
                <OnOff on={fmtUsd(r.thinkingOn.costUsd)} off={fmtUsd(r.thinkingOff.costUsd)} />
              </Pair>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Comparison({ u }: { u: UsageResponse }) {
  const t = useT().metrics.comparison;
  const headingId = useId();
  const c = u.comparison;
  return (
    <section aria-labelledby={headingId}>
      <SectionHead id={headingId} title={t.title} description={t.description} />
      {c === null || c.rows.length === 0 ? (
        <EmptyState
          title={t.emptyTitle}
          description={
            <>
              {t.emptyBody.before}
              <code className="type-id text-ink">npm run compare</code>
              {t.emptyBody.after}
            </>
          }
        />
      ) : (
        <div className="space-y-6">
          <Conditions c={c} />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
            <SideBySide c={c} energy={u.energy} />
            <Quality c={c} />
          </div>
          <PerPrompt c={c} />
          <p className="text-xs text-muted-ink">{t.derived}</p>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// 4 · Energy estimate and where tokens are saved
// ---------------------------------------------------------------------------------------------

function Energy({ e }: { e: EnergyEstimate }) {
  const t = useT().metrics.energy;
  const f = useFmt();
  const headingId = useId();
  const set = e.assumedJPerToken !== null && e.totalWh !== null;
  const row = "grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 py-2 sm:grid-cols-[8rem_minmax(0,1fr)]";
  return (
    <section aria-labelledby={headingId} className="rounded-lg border border-line bg-surface px-4 py-5 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={headingId} className="type-section text-ink">
          {t.title}
        </h2>
        <EstimateTag />
      </div>
      {set ? (
        <div className="mt-3">
          <p className="type-amount-sm text-ink">{fmtWh(e.totalWh)}</p>
          <p className="text-sm text-muted-ink">{t.total(f.int(e.totalTokens))}</p>
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-dashed border-line-strong px-4 py-3">
          <p className="font-medium text-ink">{t.notSetTitle}</p>
          <p className="mt-1 text-sm text-muted-ink">
            {t.notSet.before}
            <code className="type-id text-ink">ENERGY_J_PER_TOKEN</code>
            {t.notSet.and}
            <code className="type-id text-ink">ENERGY_SOURCE</code>
            {t.notSet.middle}
            <span className="font-medium text-ink tabular-nums">{f.int(e.totalTokens)}</span>
            {t.notSet.after}
          </p>
        </div>
      )}
      <dl className="mt-4 divide-y divide-line border-y border-line text-sm">
        <div className={row}>
          <dt className="text-muted-ink">{t.unit}</dt>
          <dd className="text-ink">{t.unitValue}</dd>
        </div>
        <div className={row}>
          <dt className="text-muted-ink">{t.formulaLabel}</dt>
          <dd className="text-ink">{t.formula}</dd>
        </div>
        <div className={row}>
          <dt className="text-muted-ink">{t.assumption}</dt>
          <dd className={cn("tabular-nums", set ? "text-ink" : "text-muted-ink")}>
            {set
              ? t.assumptionValue(
                  (e.assumedJPerToken as number).toLocaleString(f.tag, {
                    maximumFractionDigits: 6,
                  }),
                )
              : "—"}
          </dd>
        </div>
        <div className={row}>
          <dt className="text-muted-ink">{t.source}</dt>
          <dd className="min-w-0 wrap-anywhere">
            {e.source ? (
              <span className="text-ink">{e.source}</span>
            ) : set ? (
              <span className="inline-flex items-start gap-1.5 text-unverified">
                <StateGlyph glyph="dashed-slash" className="mt-1 size-3" />
                {t.noSource}
              </span>
            ) : (
              <span className="text-muted-ink">—</span>
            )}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted-ink">{t.caveat}</p>
    </section>
  );
}

function Savings({ c }: { c: ReasoningComparison | null }) {
  const t = useT().metrics.savings;
  const f = useFmt();
  const headingId = useId();
  const measured = c !== null && c.rows.length > 0;
  const items: Array<{ key: string; title: string; body: string }> = [
    { key: "status", ...t.statusFastpath },
    { key: "stop", ...t.stopTemplate },
    {
      key: "thinking",
      title: t.thinking.title,
      body: measured
        ? t.thinking.measured({
            completionOff: oneDecimal(c.summary.avgCompletionOff, f),
            completionOn: oneDecimal(c.summary.avgCompletionOn, f),
            latencyOff: fmtMs(c.summary.avgLatencyOffMs),
            latencyOn: fmtMs(c.summary.avgLatencyOnMs),
            toolOff: c.summary.toolCallsOff,
            toolOn: c.summary.toolCallsOn,
            n: c.rows.length,
          })
        : t.thinking.notMeasured,
    },
    { key: "prompt", ...t.compactPrompt },
  ];
  return (
    <section aria-labelledby={headingId} className="rounded-lg border border-line bg-surface px-4 py-5 sm:px-5">
      <h2 id={headingId} className="type-section text-ink">
        {t.title}
      </h2>
      <p className="mt-1 text-sm text-muted-ink">{t.description}</p>
      <ol className="mt-3 divide-y divide-line border-t border-line">
        {items.map((x, i) => (
          <li key={x.key} className="flex gap-3 py-3">
            <span aria-hidden className="w-4 shrink-0 pt-px text-right text-sm font-medium text-muted-ink tabular-nums">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{x.title}</p>
              <p className="mt-0.5 text-sm text-muted-ink">{x.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------------

function MetricsSkeleton() {
  const t = useT();
  return (
    <div className="space-y-10" aria-busy="true" aria-label={t.metrics.loading}>
      <Skeleton className="h-[132px] rounded-lg" />
      <div className="space-y-3">
        <Skeleton className="h-6 w-40 rounded" />
        <Skeleton className="h-[300px] rounded-lg" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-56 rounded" />
        <Skeleton className="h-[360px] rounded-lg" />
      </div>
    </div>
  );
}

function MetricsInner() {
  const usage = useResource(loadUsage);
  const now = useNow(5000);
  const t = useT().metrics;
  const f = useFmt();
  const u = usage.data;
  const busy = usage.loading || usage.refreshing;

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t.header.eyebrow}
        title={t.header.title}
        description={t.header.description}
        actions={
          <>
            {usage.updatedAt !== null && (
              <span className="text-xs text-muted-ink tabular-nums">
                {t.header.updated(f.rel(new Date(usage.updatedAt).toISOString(), now === null ? null : Math.max(now, usage.updatedAt)))}
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-surface"
              onClick={usage.refresh}
              disabled={busy}
              aria-busy={busy || undefined}
            >
              <RefreshCw aria-hidden />
              {usage.refreshing ? t.header.refreshing : t.header.refresh}
            </Button>
          </>
        }
      />
      {usage.loading ? (
        <MetricsSkeleton />
      ) : usage.error && !u ? (
        <ErrorState title={t.loadError} error={usage.error} onRetry={usage.refresh} retrying={usage.refreshing} />
      ) : u ? (
        <div className={cn("space-y-10 transition-opacity duration-200", usage.refreshing && "opacity-70")}>
          {usage.error && (
            <p role="status" className="flex items-start gap-1.5 text-sm text-danger">
              <StateGlyph glyph="triangle" className="mt-1 size-3" />
              {t.stale(usage.error.message)}
            </p>
          )}
          <Totals u={u} />
          <Flows u={u} />
          <Comparison u={u} />
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <Energy e={u.energy} />
            <Savings c={u.comparison} />
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}

export default function MetricsPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <MetricsSkeleton />
        </PageContainer>
      }
    >
      <MetricsInner />
    </Suspense>
  );
}
