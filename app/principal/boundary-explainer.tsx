"use client";

import { useState } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { STOP_CODES } from "@/components/perdiem/stop-codes";
import { cn } from "@/lib/utils";

/** The 12 stop codes with one-line meanings. */
export function BoundaryExplainer({ defaultOpen = true }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-xl px-6 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <span className="flex items-center gap-2">
            <ShieldCheck aria-hidden className="size-4 text-zinc-500" />
            <span className="text-base font-semibold text-zinc-900">How the boundary works</span>
          </span>
          <ChevronDown aria-hidden className={cn("size-4 text-zinc-400 transition-transform", open && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-zinc-100 px-6 pt-4 pb-5">
          <p className="text-sm text-zinc-600">
            Every proposal runs through 12 checks in <span className="font-mono text-xs text-zinc-800">lib/policy.ts evaluate()</span> — plain
            code, before any on-chain call. The model never holds keys, and every failing rule is reported, not just the first.
          </p>
          <ul className="mt-4 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {STOP_CODES.map((c) => (
              <li key={c.code} className="min-w-0">
                <span className="font-mono text-[11px] font-semibold text-rose-700">[{c.code}]</span>
                <p className="text-xs text-zinc-600">{c.meaning}</p>
              </li>
            ))}
          </ul>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
