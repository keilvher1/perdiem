"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { stopCodesFor } from "@/components/perdiem/stop-codes";
import { useFmt, useLocale, useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * The 12 checks of lib/policy.ts evaluate(), in evaluation order, with one-line meanings.
 * Secondary reference content: collapsed by default.
 */
export function BoundaryExplainer({ defaultOpen = false, className }: { defaultOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const locale = useLocale();
  const f = useFmt();
  const tb = useT().principal.boundary;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("rounded-lg border border-line bg-surface", className)}>
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3.5 text-left outline-none transition-colors duration-150 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring sm:px-5">
        <span className="text-sm font-semibold text-ink">{tb.title}</span>
        <ChevronDown
          aria-hidden
          className={cn("size-4 shrink-0 text-muted-ink transition-transform duration-150", open && "rotate-180")}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-line px-4 pt-4 pb-5 sm:px-5">
          <p className="type-body max-w-3xl text-muted-ink">
            {tb.introBefore}
            <span className="type-id text-ink">lib/policy.ts evaluate()</span>
            {tb.introAfter}
          </p>
          <ol className="mt-4 grid gap-x-8 sm:grid-cols-2">
            {stopCodesFor(locale).map((c, i) => (
              <li key={c.code} className="grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)] border-t border-line py-2.5">
                <span aria-hidden className="pt-px text-xs text-muted-ink tabular-nums">
                  {f.int(i + 1)}
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-medium text-ink">{c.title}</span>
                    <span className="type-id text-[11px] text-muted-ink">{c.code}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-muted-ink">{c.meaning}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
