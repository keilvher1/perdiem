"use client";

import Link from "next/link";
import { ArrowRight, Leaf } from "lucide-react";
import type { FlowName } from "@/contracts/api";
import type { ChatMessage } from "@/hooks/use-chat-session";
import { fmtUsd } from "@/lib/format";
import { useFmt, useT } from "@/lib/i18n/provider";
import { Panel } from "@/components/perdiem/page";
import { cn } from "@/lib/utils";

const CORE_FLOWS: FlowName[] = ["propose", "status_fastpath", "stop_template"];
const FLOW_LABEL: Partial<Record<FlowName, string>> = {
  propose: "propose (Kiln)",
  status_fastpath: "status_fastpath",
  stop_template: "stop_template",
};

/** "This session": tokens per flow from the replies' usage arrays, approved vs stopped. */
export function SessionRail({ messages }: { messages: ChatMessage[] }) {
  const t = useT();
  const f = useFmt();
  const tr = t.traveler.rail;
  const flows = new Map<FlowName, { calls: number; tokens: number; cost: number }>();
  for (const name of CORE_FLOWS) flows.set(name, { calls: 0, tokens: 0, cost: 0 });
  let approved = 0;
  let stopped = 0;
  let answered = 0;
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
    }
  }
  const rows = [...flows.entries()];
  const modelCalls = messages.reduce(
    (a, m) => a + (m.kind === "agent" ? m.usage.filter((u) => u.totalTokens > 0).length : 0),
    0,
  );
  const tokens = rows.reduce((a, [, r]) => a + r.tokens, 0);
  const cost = rows.reduce((a, [, r]) => a + r.cost, 0);

  return (
    <aside aria-label={tr.title} className="hidden space-y-4 lg:block">
      <Panel as="div" className="p-5">
        <h2 className="text-sm font-semibold text-zinc-900">{tr.title}</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-zinc-50 px-2 py-2">
            <p className="text-lg font-semibold text-zinc-900 tabular-nums">{answered}</p>
            <p className="text-[11px] text-zinc-500">{tr.replies}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 px-2 py-2">
            <p className="text-lg font-semibold text-emerald-700 tabular-nums">{approved}</p>
            <p className="text-[11px] text-emerald-800/80">{tr.approved}</p>
          </div>
          <div className="rounded-lg bg-rose-50 px-2 py-2">
            <p className="text-lg font-semibold text-rose-700 tabular-nums">{stopped}</p>
            <p className="text-[11px] text-rose-800/80">{tr.stopped}</p>
          </div>
        </div>

        <table className="mt-4 w-full text-xs">
          <caption className="sr-only">{tr.caption}</caption>
          <thead>
            <tr className="text-zinc-500">
              <th scope="col" className="pb-1.5 text-left font-medium">{tr.flow}</th>
              <th scope="col" className="pb-1.5 text-right font-medium">{tr.calls}</th>
              <th scope="col" className="pb-1.5 text-right font-medium">{tr.tokens}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([flow, r]) => {
              const zero = r.calls > 0 && r.tokens === 0;
              return (
                <tr key={flow} className="border-t border-zinc-100">
                  <td className="py-1.5 font-mono text-[11px] text-zinc-700">{FLOW_LABEL[flow] ?? flow}</td>
                  <td className="py-1.5 text-right text-zinc-600 tabular-nums">{r.calls}</td>
                  <td className={cn("py-1.5 text-right tabular-nums", zero ? "font-medium text-emerald-700" : "text-zinc-900")}>
                    {f.int(r.tokens)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <dl className="mt-3 space-y-1 border-t border-zinc-100 pt-3 text-xs">
          <div className="flex justify-between">
            <dt className="text-zinc-500">{tr.modelCalls}</dt>
            <dd className="text-zinc-900 tabular-nums">{modelCalls}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">{tr.tokens}</dt>
            <dd className="text-zinc-900 tabular-nums">{f.int(tokens)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">{tr.kilnCost}</dt>
            <dd className="text-zinc-900 tabular-nums">{fmtUsd(cost)}</dd>
          </div>
        </dl>
        <p className="mt-4 flex gap-2 rounded-lg bg-emerald-50/70 px-3 py-2 text-xs text-emerald-900 ring-1 ring-emerald-100 ring-inset">
          <Leaf aria-hidden className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
          <span>{tr.zeroTokenNote}</span>
        </p>
        <Link
          href="/metrics"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-700 underline-offset-2 hover:underline"
        >
          {tr.metricsLink} <ArrowRight aria-hidden className="size-3" />
        </Link>
      </Panel>

      <Panel as="div" className="p-5">
        <h2 className="text-sm font-semibold text-zinc-900">{tr.howTitle}</h2>
        <ol className="mt-3 space-y-2.5 text-xs text-zinc-600">
          <li className="flex gap-2">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-zinc-100 font-mono text-[10px] text-zinc-600">1</span>
            <span>
              <span className="font-medium text-zinc-800">{tr.step1.strong}</span>
              {tr.step1.rest}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-zinc-100 font-mono text-[10px] text-zinc-600">2</span>
            <span>
              <span className="font-medium text-zinc-800">{tr.step2.strong}</span>
              {tr.step2.rest}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-zinc-100 font-mono text-[10px] text-zinc-600">3</span>
            <span>
              <span className="font-medium text-zinc-800">{tr.step3.approved}</span>
              {tr.step3.approvedRest}
              <span className="font-medium text-zinc-800">{tr.step3.stopped}</span>
              {tr.step3.stoppedRest}
            </span>
          </li>
        </ol>
      </Panel>
    </aside>
  );
}
