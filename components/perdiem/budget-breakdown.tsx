"use client";

import type { ReactNode } from "react";
import type { MandateSummary } from "@/contracts/api";
import { fmtUsd } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { StateGlyph } from "./state-glyph";

export type BudgetFigures = Pick<MandateSummary, "budgetUsd" | "spentUsd" | "pendingUsd" | "remainingUsd">;

/** Diagonal hatch for the reserved (pending) share: reads without colour. */
const HATCH = "bg-[repeating-linear-gradient(135deg,var(--pending)_0_3px,transparent_3px_6px)]";

function Figure({
  swatch,
  label,
  value,
  hint,
  valueClassName,
}: {
  swatch?: ReactNode;
  label: string;
  value: string;
  hint: string;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-ink">
        {swatch}
        {label}
      </dt>
      <dd className={cn("type-amount-sm mt-0.5 text-ink", valueClassName)}>{value}</dd>
      <dd className="mt-0.5 text-xs text-muted-ink">{hint}</dd>
    </div>
  );
}

/**
 * Budget, spent, pending and remaining exactly as the API computes them (lib/view.ts):
 * spent = Σ totalUsd over approved | pending | settled, pending ⊂ spent, remaining = budget − spent.
 * So pending money is ALREADY reserved: it is inside spent and already taken out of remaining —
 * the pending figure is labelled that way and never subtracted a second time. The bar shows
 * spent as two parts (approved or settled = spent − pending, solid; pending, hatched) and the rest
 * of the budget as remaining.
 */
export function BudgetBreakdown({
  budget,
  className,
}: {
  budget: BudgetFigures;
  className?: string;
}) {
  const t = useT();
  const b = t.ui.budget;
  const { budgetUsd, spentUsd, pendingUsd, remainingUsd } = budget;
  const committed = Math.max(0, spentUsd - pendingUsd);
  const scale = Math.max(budgetUsd, spentUsd, 0) || 1;
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / scale) * 100))}%`;
  const over = remainingUsd < 0;

  return (
    <section aria-label={b.title} className={cn("@container rounded-lg border border-line bg-surface px-4 py-4 sm:px-5", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div>
          <p className="type-label text-muted-ink">{b.remaining}</p>
          <p className={cn("type-amount mt-1", over ? "text-danger" : "text-ink")}>{fmtUsd(remainingUsd)}</p>
        </div>
        <p className="pb-1 text-sm text-muted-ink">
          {b.budget} <span className="font-medium text-ink tabular-nums">{fmtUsd(budgetUsd)}</span>
        </p>
      </div>

      <div
        role="img"
        aria-label={b.bar(fmtUsd(spentUsd), fmtUsd(pendingUsd), fmtUsd(remainingUsd))}
        className="mt-3 flex h-2.5 overflow-hidden rounded-sm border border-line bg-surface-2"
      >
        <span className="h-full bg-ink" style={{ width: pct(committed) }} />
        <span className={cn("h-full", committed > 0 && "border-l border-surface", HATCH)} style={{ width: pct(pendingUsd) }} />
      </div>
      {over && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-danger">
          <StateGlyph glyph="triangle" className="size-3" />
          {b.over}
        </p>
      )}

      {/* Three columns once the breakdown itself is 32rem wide (container query), not the viewport. */}
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-line pt-3 @lg:grid-cols-3">
        <Figure label={b.spent} value={fmtUsd(spentUsd)} hint={b.spentHint} />
        <Figure
          swatch={<span aria-hidden className="h-1.5 w-3.5 shrink-0 rounded-[1px] bg-ink" />}
          label={b.committed}
          value={fmtUsd(committed)}
          hint={b.committedHint}
        />
        <Figure
          swatch={<span aria-hidden className={cn("h-1.5 w-3.5 shrink-0 rounded-[1px] ring-1 ring-pending-line", HATCH)} />}
          label={b.pending}
          value={fmtUsd(pendingUsd)}
          hint={b.pendingHint}
          valueClassName="text-pending"
        />
      </dl>
    </section>
  );
}
