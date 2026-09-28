"use client";

import { Suspense } from "react";
import { CircleCheck, CircleX, Cpu, Leaf, MessageSquareText, OctagonX, RefreshCw, Sigma, Zap } from "lucide-react";
import type { EnergyEstimate, FlowName, ReasoningComparison, UsageResponse } from "@/contracts/api";
import { api } from "@/lib/api-client";
import { fmtDate, fmtInt, fmtMs, fmtPct, fmtRel, fmtUsd } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableShell, Tbl, Td, Th, THead, Tr } from "@/components/perdiem/data-table";
import { PageContainer, PageHeader, Panel, PanelTitle, StatTile } from "@/components/perdiem/page";
import { EmptyState, ErrorState } from "@/components/perdiem/states";
import { useNow } from "@/hooks/use-now";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/utils";

const FLOW_INFO: Record<FlowName, string> = {
  propose: "qwen3-32b proposes one payment via a tool call",
  status_fastpath: "balance / status questions answered from the ledger",
  stop_template: "refusal text templated from the stop reasons",
  compare: "thinking on vs off measurement script",
  explain: "model-written explanation",
  audit: "model-assisted audit",
  other: "other model calls",
};

const loadUsage = () => api.usage();

function FlowTable({ usage }: { usage: UsageResponse }) {
  const { byFlow, totals } = usage;
  if (byFlow.length === 0) {
    return <EmptyState title="No model usage recorded yet" description="Send a request on the Traveler page; every flow is recorded, including 0-token ones." />;
  }
  return (
    <TableShell>
      <Tbl className="min-w-[860px]">
        <THead>
          <tr>
            <Th>Flow</Th>
            <Th numeric>Calls</Th>
            <Th numeric>Prompt</Th>
            <Th numeric>Completion</Th>
            <Th numeric>Total tokens</Th>
            <Th numeric>Cost</Th>
            <Th numeric>Avg latency</Th>
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
                        <Leaf aria-hidden className="size-3" /> answered without the model
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">{FLOW_INFO[r.flow] ?? ""}</div>
                </Td>
                <Td numeric>{fmtInt(r.calls)}</Td>
                <Td numeric>{fmtInt(r.promptTokens)}</Td>
                <Td numeric>{fmtInt(r.completionTokens)}</Td>
                <Td numeric className={cn("font-medium", zero ? "text-emerald-700" : "text-zinc-900")}>
                  {fmtInt(r.totalTokens)}
                </Td>
                <Td numeric>{fmtUsd(r.costUsd)}</Td>
                <Td numeric>{fmtMs(r.avgLatencyMs)}</Td>
              </Tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-zinc-200 bg-zinc-50 font-medium">
            <Td className="text-zinc-900">Total</Td>
            <Td numeric className="text-zinc-900">{fmtInt(totals.calls)}</Td>
            <Td numeric className="text-zinc-900">{fmtInt(totals.promptTokens)}</Td>
            <Td numeric className="text-zinc-900">{fmtInt(totals.completionTokens)}</Td>
            <Td numeric className="text-zinc-900">{fmtInt(totals.totalTokens)}</Td>
            <Td numeric className="text-zinc-900">{fmtUsd(totals.costUsd)}</Td>
            <Td numeric />
          </tr>
        </tfoot>
      </Tbl>
    </TableShell>
  );
}

function ToolCall({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
      <CircleCheck aria-hidden className="size-3.5" /> yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700">
      <CircleX aria-hidden className="size-3.5" /> no
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
  const s = c.summary;
  const max = Math.max(...c.rows.flatMap((r) => [r.thinkingOn.completionTokens, r.thinkingOff.completionTokens]), 1);
  const latencySaved = s.avgLatencyOnMs > 0 ? ((s.avgLatencyOnMs - s.avgLatencyOffMs) / s.avgLatencyOnMs) * 100 : null;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Tool calls (on → off)"
          value={<span className="text-xl">{`${s.toolCallsOn}/${c.rows.length} → ${s.toolCallsOff}/${c.rows.length}`}</span>}
          hint={s.toolCallsOff >= s.toolCallsOn ? "same accuracy without thinking" : "fewer tool calls without thinking"}
        />
        <StatTile
          label="Completion tokens saved"
          value={<span className="text-xl">{`−${fmtPct(s.completionSavedPct)}`}</span>}
          tone="emerald"
          hint={`${fmtInt(s.avgCompletionOn)} → ${fmtInt(s.avgCompletionOff)} per proposal`}
        />
        <StatTile label="Avg latency (on → off)" value={<span className="text-xl">{`${fmtMs(s.avgLatencyOnMs)} → ${fmtMs(s.avgLatencyOffMs)}`}</span>} hint={latencySaved !== null ? `−${fmtPct(Math.round(latencySaved))}` : undefined} />
        <StatTile label="Measured on" value={<span className="font-mono text-base">{c.model}</span>} hint={`${fmtDate(c.measuredAt, true)} · ${c.rows.length} prompts`} />
      </div>
      <TableShell>
        <Tbl className="min-w-[900px]">
          <THead>
            <tr>
              <Th>Prompt</Th>
              <Th>Tool call on / off</Th>
              <Th numeric>Completion on</Th>
              <Th numeric>Completion off</Th>
              <Th>
                <span className="inline-flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full bg-zinc-300" /> on
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full bg-zinc-800" /> off
                  </span>
                </span>
              </Th>
              <Th numeric>Latency on</Th>
              <Th numeric>Latency off</Th>
            </tr>
          </THead>
          <tbody>
            {c.rows.map((r) => (
              <Tr key={r.prompt}>
                <Td className="max-w-[280px] text-zinc-800">“{r.prompt}”</Td>
                <Td>
                  <span className="inline-flex items-center gap-2">
                    <ToolCall ok={r.thinkingOn.toolCall} />
                    <span className="text-zinc-300">/</span>
                    <ToolCall ok={r.thinkingOff.toolCall} />
                  </span>
                </Td>
                <Td numeric>{fmtInt(r.thinkingOn.completionTokens)}</Td>
                <Td numeric className="font-medium text-zinc-900">
                  {fmtInt(r.thinkingOff.completionTokens)}
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
        Same production prompt and tool; “off” appends Qwen3’s <span className="font-mono">/no_think</span> switch to the user message. Numbers come
        from the measurement file, not from this page.
      </p>
    </div>
  );
}

function EnergyCard({ e }: { e: EnergyEstimate }) {
  const set = e.assumedJPerToken !== null && e.totalWh !== null;
  return (
    <Panel className="h-full">
      <PanelTitle description="energy_Wh = total tokens × J per token ÷ 3600">
        <span className="inline-flex items-center gap-2">
          <Zap aria-hidden className="size-4 text-zinc-500" /> Energy estimate
        </span>
      </PanelTitle>
      {set ? (
        <div>
          <p className="text-[28px] leading-9 font-semibold tracking-tight text-zinc-900 tabular-nums">
            {e.totalWh! < 0.01 ? e.totalWh!.toPrecision(2) : e.totalWh!.toFixed(3)} Wh
          </p>
          <p className="mt-1 text-sm text-zinc-700">
            assuming <span className="font-medium tabular-nums">{e.assumedJPerToken} J/token</span> × {fmtInt(e.totalTokens)} tokens
          </p>
          <p className="mt-1 text-xs break-words text-zinc-500">
            Source of the assumption: {e.source ?? <span className="text-amber-700">not stated — treat as unverified</span>}
          </p>
          <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500 ring-1 ring-zinc-200 ring-inset">
            An estimate, not a measurement: it is only as good as the J/token figure above.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-5">
          <p className="font-medium text-zinc-900">Assumption not set — see README</p>
          <p className="mt-1 text-sm text-zinc-500">
            No energy figure is shown until <span className="font-mono text-xs">ENERGY_J_PER_TOKEN</span> and its source are configured. Tokens so
            far: <span className="font-medium text-zinc-700 tabular-nums">{fmtInt(e.totalTokens)}</span>.
          </p>
        </div>
      )}
    </Panel>
  );
}

const SAVINGS: { title: string; body: string }[] = [
  { title: "Status questions skip the model", body: "A rule fast-path answers balance questions from the ledger: status_fastpath, 0 tokens." },
  { title: "Refusals are templated", body: "STOP text is built from the policy's reason codes: stop_template, 0 tokens, no extra call." },
  { title: "Thinking off for proposals", body: "Picking a merchant and an amount needs no hidden reasoning; /no_think cuts completion tokens (table above)." },
  { title: "Compact prompt", body: "The catalog goes in as 7 short “id | name | category” lines, never JSON; one tool, one call per request." },
];

function SavingsCard() {
  return (
    <Panel className="h-full">
      <PanelTitle description="Each one shows up in the numbers on this page.">Where the tokens are saved</PanelTitle>
      <ul className="space-y-3">
        {SAVINGS.map((x, i) => (
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
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading metrics">
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
  const u = usage.data;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Metrics"
        title="Tokens, cost and energy — by flow"
        description="Every model call is recorded with its flow. Work done without the model is recorded too, as 0-token rows, so avoided inference is visible."
        actions={
          <>
            {usage.updatedAt !== null && <span className="text-xs text-zinc-400 tabular-nums">Updated {fmtRel(new Date(usage.updatedAt).toISOString(), now)}</span>}
            <Button type="button" variant="outline" size="sm" onClick={usage.refresh} disabled={usage.loading || usage.refreshing}>
              <RefreshCw aria-hidden className={cn((usage.loading || usage.refreshing) && "animate-spin")} />
              Refresh
            </Button>
          </>
        }
      />
      {usage.loading ? (
        <MetricsSkeleton />
      ) : usage.error && !u ? (
        <ErrorState title="Couldn’t load usage" error={usage.error} onRetry={usage.refresh} retrying={usage.refreshing} />
      ) : u ? (
        <div className={cn("space-y-6 transition-opacity", usage.refreshing && "opacity-60")}>
          {usage.error && (
            <p role="status" className="text-xs text-amber-700">
              Showing the previous numbers — refresh failed: {usage.error.message}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              icon={<MessageSquareText aria-hidden className="size-3.5" />}
              label="Status questions answered without the model" labelClassName="min-h-8"
              value={fmtInt(u.zeroTokenCalls.statusFastpath)}
              tone="emerald"
              hint="status_fastpath · 0 tokens each"
            />
            <StatTile
              icon={<OctagonX aria-hidden className="size-3.5" />}
              label="Refusals explained without the model" labelClassName="min-h-8"
              value={fmtInt(u.zeroTokenCalls.stopTemplate)}
              tone="emerald"
              hint="stop_template · 0 tokens each"
            />
            <StatTile icon={<Sigma aria-hidden className="size-3.5" />} label="Cost so far" labelClassName="min-h-8" value={fmtUsd(u.totals.costUsd)} hint="Kiln usage.cost, all flows" />
            <StatTile
              icon={<Cpu aria-hidden className="size-3.5" />}
              label="Tokens so far" labelClassName="min-h-8"
              value={fmtInt(u.totals.totalTokens)}
              hint={`${fmtInt(u.totals.calls)} recorded calls`}
            />
          </div>

          <Panel>
            <PanelTitle description="Grouped from usage_records. Green rows were handled in code — the model was never called.">Tokens by flow</PanelTitle>
            <FlowTable usage={u} />
          </Panel>

          <div className="space-y-6">
            <Panel>
              <PanelTitle description="The propose step with Qwen3 thinking on vs off, same prompts, same tool.">Thinking on vs off</PanelTitle>
              {u.comparison ? (
                <Comparison c={u.comparison} />
              ) : (
                <EmptyState
                  title="No comparison measured yet"
                  description={
                    <>
                      Run <span className="font-mono text-xs text-zinc-700">npm run compare</span> to measure thinking on vs off on Kiln.
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
