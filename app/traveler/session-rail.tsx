"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { FlowName } from "@/contracts/api";
import type { ChatMessage } from "@/hooks/use-chat-session";
import { StateGlyph } from "@/components/perdiem/state-glyph";
import { fmtUsd } from "@/lib/format";
import { useFmt, useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

const CORE_FLOWS: FlowName[] = ["propose", "status_fastpath", "stop_template"];
const FLOW_LABEL: Partial<Record<FlowName, string>> = {
  propose: "propose (Kiln)",
  status_fastpath: "status_fastpath",
  stop_template: "stop_template",
};

/**
 * Quiet desktop footnote to the conversation: this session's replies and decisions, tokens per
 * flow from the replies' usage arrays (0-token refusals), and how a request is decided. The full
 * numbers live on /metrics; this stays out of the payment flow's way.
 */
export function SessionRail({ messages, mandateId }: { messages: ChatMessage[]; mandateId: string | null }) {
  const t = useT();
  const f = useFmt();
  const tr = t.traveler.rail;
  const flows = new Map<FlowName, { calls: number; tokens: number; cost: number }>();
  for (const name of CORE_FLOWS) flows.set(name, { calls: 0, tokens: 0, cost: 0 });
  let approved = 0;
  let stopped = 0;
  let answered = 0;
  let modelCalls = 0;
  for (const m of messages) {
    if (m.kind !== "agent") continue;
    answered += 1;
    if (m.entry?.decision === "APPROVE") approved += 1;
    if (m.entry?.decision === "STOP") stopped += 1;
    for (const u of m.usage) {
      const row = flows.get(u.flow) ?? { calls: 0, tokens: 0, cost: 0 };
      row.calls += 1;
      row.tokens += u.totalTokens;
      row.cost += u.costUsd ?? 0;
      flows.set(u.flow, row);
      if (u.totalTokens > 0) modelCalls += 1;
    }
  }
  const rows = [...flows.entries()];
  const tokens = rows.reduce((a, [, r]) => a + r.tokens, 0);
  const cost = rows.reduce((a, [, r]) => a + r.cost, 0);
  const metricsHref = mandateId ? `/metrics?m=${encodeURIComponent(mandateId)}` : "/metrics";

  return (
    <aside aria-label={tr.title} className="hidden rounded-lg border border-line bg-surface lg:block">
      <div className="px-4 py-4 sm:px-5">
        <h2 className="type-label text-muted-ink">{tr.title}</h2>
        <dl className="mt-2 grid grid-cols-3 gap-2">
          <div>
            <dt className="text-xs text-muted-ink">{tr.replies}</dt>
            <dd className="text-lg font-semibold text-ink tabular-nums">{f.int(answered)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-xs text-muted-ink">
              <StateGlyph glyph="circle" className="size-2.5 text-approve" />
              {tr.approved}
            </dt>
            <dd className="text-lg font-semibold text-ink tabular-nums">{f.int(approved)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-xs text-muted-ink">
              <StateGlyph glyph="square" className="size-2.5 text-stop" />
              {tr.stopped}
            </dt>
            <dd className="text-lg font-semibold text-ink tabular-nums">{f.int(stopped)}</dd>
          </div>
        </dl>

        <table className="mt-4 w-full text-xs">
          <caption className="sr-only">{tr.caption}</caption>
          <thead>
            <tr className="text-muted-ink">
              <th scope="col" className="pb-1.5 text-left font-medium">
                {tr.flow}
              </th>
              <th scope="col" className="pb-1.5 text-right font-medium">
                {tr.calls}
              </th>
              <th scope="col" className="pb-1.5 text-right font-medium">
                {tr.tokens}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([flow, r]) => (
              <tr key={flow} className="border-t border-line">
                <td className="py-1.5 font-mono text-[11px] text-ink">{FLOW_LABEL[flow] ?? flow}</td>
                <td className="py-1.5 text-right text-muted-ink tabular-nums">{f.int(r.calls)}</td>
                <td className={cn("py-1.5 text-right tabular-nums", r.calls > 0 && r.tokens === 0 ? "font-medium text-ink" : "text-ink")}>
                  {f.int(r.tokens)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-2 space-y-1 border-t border-line pt-2 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-ink">{tr.modelCalls}</dt>
            <dd className="text-ink tabular-nums">{f.int(modelCalls)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-ink">{tr.tokens}</dt>
            <dd className="text-ink tabular-nums">{f.int(tokens)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-ink">{tr.kilnCost}</dt>
            <dd className="text-ink tabular-nums">{fmtUsd(cost)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-ink">{tr.zeroTokenNote}</p>
        <Link
          href={metricsHref}
          className="mt-2 inline-flex items-center gap-1 rounded-sm text-xs font-medium text-cobalt underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {tr.metricsLink} <ArrowRight aria-hidden className="size-3" />
        </Link>
      </div>

      <div className="border-t border-line px-4 py-4 sm:px-5">
        <h2 className="type-label text-muted-ink">{tr.howTitle}</h2>
        <ol className="mt-2.5 space-y-2.5 text-xs text-muted-ink">
          <li className="flex gap-2.5">
            <span aria-hidden className="w-3 shrink-0 font-semibold text-ink tabular-nums">
              1
            </span>
            <span>
              <span className="font-medium text-ink">{tr.step1.strong}</span>
              {tr.step1.rest}
            </span>
          </li>
          <li className="flex gap-2.5">
            <span aria-hidden className="w-3 shrink-0 font-semibold text-ink tabular-nums">
              2
            </span>
            <span>
              <span className="font-medium text-ink">{tr.step2.strong}</span>
              {tr.step2.rest}
            </span>
          </li>
          <li className="flex gap-2.5">
            <span aria-hidden className="w-3 shrink-0 font-semibold text-ink tabular-nums">
              3
            </span>
            <span>
              <span className="inline-flex items-baseline gap-1 font-medium text-approve">
                <StateGlyph glyph="circle" className="size-2" />
                {tr.step3.approved}
              </span>
              {tr.step3.approvedRest}
              <span className="inline-flex items-baseline gap-1 font-medium text-stop">
                <StateGlyph glyph="square" className="size-2" />
                {tr.step3.stopped}
              </span>
              {tr.step3.stoppedRest}
            </span>
          </li>
        </ol>
      </div>
    </aside>
  );
}
