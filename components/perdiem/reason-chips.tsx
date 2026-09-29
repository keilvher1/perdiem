"use client";

import type { StopReason } from "@/contracts/api";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocale, useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { fmtReasonValue, localizeReason } from "./stop-codes";

/** One chip per StopReason: monospace [CODE] + message; tooltip shows observed / limit. */
export function ReasonChips({
  reasons,
  compact = false,
  className,
}: {
  reasons: StopReason[];
  /** Codes only (message moves into the tooltip) — for dense tables. */
  compact?: boolean;
  className?: string;
}) {
  const locale = useLocale();
  if (reasons.length === 0) return <span className="text-xs text-zinc-400">—</span>;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {reasons.map((r, i) => {
        const { message, detail } = localizeReason(r, locale);
        const chip = (
          <span
            tabIndex={detail || compact ? 0 : undefined}
            className={cn(
              "inline-flex max-w-full items-baseline gap-1.5 rounded-md bg-rose-50 px-2 py-0.5 text-xs text-rose-800 ring-1 ring-rose-200 ring-inset outline-none focus-visible:ring-2 focus-visible:ring-rose-400",
              compact && "whitespace-nowrap",
            )}
          >
            <span className="font-mono text-[11px] font-semibold tracking-tight">[{r.code}]</span>
            {!compact && <span className="text-rose-900/90">{message}</span>}
          </span>
        );
        if (!detail && !compact) return <span key={`${r.code}-${i}`}>{chip}</span>;
        return (
          <Tooltip key={`${r.code}-${i}`}>
            <TooltipTrigger asChild>{chip}</TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm flex-col items-start gap-0.5">
              {compact && <span>{message}</span>}
              {detail && <span className="font-mono text-[11px] opacity-80">{detail}</span>}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

/** Roomier list for receipt cards: code, message and observed vs limit on their own line. */
export function ReasonList({ reasons }: { reasons: StopReason[] }) {
  const locale = useLocale();
  const t = useT();
  return (
    <ul className="space-y-2">
      {reasons.map((r, i) => {
        const { message } = localizeReason(r, locale);
        const observed = fmtReasonValue(r.code, r.observed, locale);
        const limit = fmtReasonValue(r.code, r.limit, locale);
        return (
          <li key={`${r.code}-${i}`} className="rounded-lg bg-rose-50/70 px-3 py-2 ring-1 ring-rose-100 ring-inset">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-mono text-[11px] font-semibold text-rose-700">[{r.code}]</span>
              <span className="text-sm text-zinc-800">{message}</span>
            </div>
            {(observed !== null || limit !== null) && (
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-zinc-500">
                {observed !== null && (
                  <span>
                    {t.receipt.reasons.observed} <span className="font-mono text-zinc-700 tabular-nums">{observed}</span>
                  </span>
                )}
                {limit !== null && (
                  <span>
                    {t.receipt.reasons.limit} <span className="font-mono text-zinc-700 tabular-nums">{limit}</span>
                  </span>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
