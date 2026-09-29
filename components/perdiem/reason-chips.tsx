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
  if (reasons.length === 0) return <span className="text-xs text-muted-ink">—</span>;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {reasons.map((r, i) => {
        const { message, detail } = localizeReason(r, locale);
        const chip = (
          <span
            tabIndex={detail || compact ? 0 : undefined}
            className={cn(
              "inline-flex max-w-full items-baseline gap-1.5 rounded-sm bg-stop-soft px-2 py-0.5 text-xs text-stop ring-1 ring-stop-line ring-inset outline-none focus-visible:ring-2 focus-visible:ring-ring",
              compact && "whitespace-nowrap",
            )}
          >
            <span className="font-mono text-[11px] font-semibold tracking-tight">[{r.code}]</span>
            {!compact && <span className="text-ink">{message}</span>}
          </span>
        );
        if (!detail && !compact) return <span key={`${r.code}-${i}`}>{chip}</span>;
        return (
          <Tooltip key={`${r.code}-${i}`}>
            <TooltipTrigger asChild>{chip}</TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm flex-col items-start gap-0.5">
              {compact && <span>{message}</span>}
              {detail && <span className="text-[11px] tabular-nums opacity-80">{detail}</span>}
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
          <li key={`${r.code}-${i}`} className="rounded-md bg-stop-soft px-3 py-2 ring-1 ring-stop-line ring-inset">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-mono text-[11px] font-semibold text-stop">[{r.code}]</span>
              <span className="text-sm text-ink">{message}</span>
            </div>
            {(observed !== null || limit !== null) && (
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-ink">
                {observed !== null && (
                  <span>
                    {t.receipt.reasons.observed} <span className="text-ink tabular-nums">{observed}</span>
                  </span>
                )}
                {limit !== null && (
                  <span>
                    {t.receipt.reasons.limit} <span className="text-ink tabular-nums">{limit}</span>
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
