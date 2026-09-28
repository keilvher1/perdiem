"use client";

import Link from "next/link";
import { ArrowRight, Leaf } from "lucide-react";
import type { FlowName } from "@/contracts/api";
import type { ChatMessage } from "@/hooks/use-chat-session";
import { fmtInt, fmtUsd } from "@/lib/format";
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
  const flows = new Map<FlowName, { calls: number; tokens: number; cost: number }>();
  for (const f of CORE_FLOWS) flows.set(f, { calls: 0, tokens: 0, cost: 0 });
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
    <aside aria-label="This session" className="hidden space-y-4 lg:block">
      <Panel as="div" className="p-5">
        <h2 className="text-sm font-semibold text-zinc-900">This session</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-zinc-50 px-2 py-2">
            <p className="text-lg font-semibold text-zinc-900 tabular-nums">{answered}</p>
            <p className="text-[11px] text-zinc-500">replies</p>
          </div>
          <div className="rounded-lg bg-emerald-50 px-2 py-2">
            <p className="text-lg font-semibold text-emerald-700 tabular-nums">{approved}</p>
            <p className="text-[11px] text-emerald-800/80">approved</p>
          </div>
          <div className="rounded-lg bg-rose-50 px-2 py-2">
            <p className="text-lg font-semibold text-rose-700 tabular-nums">{stopped}</p>
            <p className="text-[11px] text-rose-800/80">stopped</p>
          </div>
        </div>

        <table className="mt-4 w-full text-xs">
          <caption className="sr-only">Tokens used per flow in this session</caption>
          <thead>
            <tr className="text-zinc-500">
              <th scope="col" className="pb-1.5 text-left font-medium">Flow</th>
              <th scope="col" className="pb-1.5 text-right font-medium">Calls</th>
              <th scope="col" className="pb-1.5 text-right font-medium">Tokens</th>
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
                    {fmtInt(r.tokens)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <dl className="mt-3 space-y-1 border-t border-zinc-100 pt-3 text-xs">
          <div className="flex justify-between">
            <dt className="text-zinc-500">Model calls</dt>
            <dd className="text-zinc-900 tabular-nums">{modelCalls}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Tokens</dt>
            <dd className="text-zinc-900 tabular-nums">{fmtInt(tokens)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Kiln cost</dt>
            <dd className="text-zinc-900 tabular-nums">{fmtUsd(cost)}</dd>
          </div>
        </dl>
        <p className="mt-4 flex gap-2 rounded-lg bg-emerald-50/70 px-3 py-2 text-xs text-emerald-900 ring-1 ring-emerald-100 ring-inset">
          <Leaf aria-hidden className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
          <span>
            Refusals never call the model: stop reasons are templated from the policy’s codes, and balance questions are answered from the
            ledger. Both are recorded as 0-token flows.
          </span>
        </p>
        <Link
          href="/metrics"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-700 underline-offset-2 hover:underline"
        >
          All flows on Metrics <ArrowRight aria-hidden className="size-3" />
        </Link>
      </Panel>

      <Panel as="div" className="p-5">
        <h2 className="text-sm font-semibold text-zinc-900">How a request is decided</h2>
        <ol className="mt-3 space-y-2.5 text-xs text-zinc-600">
          <li className="flex gap-2">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-zinc-100 font-mono text-[10px] text-zinc-600">1</span>
            <span>
              <span className="font-medium text-zinc-800">qwen3-32b on Kiln proposes</span> one payment through a tool call. It holds no keys.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-zinc-100 font-mono text-[10px] text-zinc-600">2</span>
            <span>
              <span className="font-medium text-zinc-800">Policy code checks 12 rules</span> against the mandate: status, window, merchant,
              category, keywords, cap, fees, budget, duplicates.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-zinc-100 font-mono text-[10px] text-zinc-600">3</span>
            <span>
              <span className="font-medium text-zinc-800">Approved</span> payments go to Sepolia with the mandate and receipt hashes in
              calldata. <span className="font-medium text-zinc-800">Stopped</span> ones are recorded with reasons; nothing is sent.
            </span>
          </li>
        </ol>
      </Panel>
    </aside>
  );
}
