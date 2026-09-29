"use client";

import { useId, type ReactNode } from "react";
import type { MandateDetail, MandateSummary } from "@/contracts/api";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/perdiem/copy-button";
import { StateBadge, TONE_SOFT } from "@/components/perdiem/state-badge";
import { StateGlyph } from "@/components/perdiem/state-glyph";
import { fmtUsd, windowState } from "@/lib/format";
import { useFmt, useT } from "@/lib/i18n/provider";
import { authorityState, stateSpec, type AuthorityState } from "@/lib/ui-state";
import { cn } from "@/lib/utils";

/** Diagonal hatch for the reserved (pending) share, as in BudgetBreakdown: reads without colour. */
const HATCH = "bg-[repeating-linear-gradient(135deg,var(--pending)_0_3px,transparent_3px_6px)]";

/**
 * Why new requests are stopped right now, when the authority is not active. A state, not an error:
 * it takes the authority state's tone and glyph (paused / revoked ink, expired grey, not started blue).
 */
function AuthorityNote({ state, summary }: { state: AuthorityState; summary: MandateSummary }) {
  const t = useT();
  const f = useFmt();
  const tm = t.traveler.mandate;
  if (state === "active") return null;
  const spec = stateSpec("authority", state);
  const text =
    state === "paused"
      ? tm.paused
      : state === "revoked"
        ? tm.revoked
        : state === "expired"
          ? tm.expired(f.date(summary.expiresAt, true))
          : tm.scheduled(f.date(summary.startsAt, true));
  return (
    <p role="status" className={cn("flex items-start gap-2 rounded-md border px-3 py-2 text-sm", TONE_SOFT[spec.tone])}>
      <StateGlyph glyph={spec.glyph} className="mt-1 size-3 shrink-0" />
      <span className="text-ink">{text}</span>
    </p>
  );
}

/** Spent as two parts (approved or settled solid, pending hatched) and the rest of the budget empty. */
function BudgetBar({ summary }: { summary: MandateSummary }) {
  const t = useT();
  const { budgetUsd, spentUsd, pendingUsd, remainingUsd } = summary;
  const committed = Math.max(0, spentUsd - pendingUsd);
  const scale = Math.max(budgetUsd, spentUsd, 0) || 1;
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / scale) * 100))}%`;
  return (
    <div
      role="img"
      aria-label={t.ui.budget.bar(fmtUsd(spentUsd), fmtUsd(pendingUsd), fmtUsd(remainingUsd))}
      className="mt-3 flex h-2 overflow-hidden rounded-sm border border-line bg-surface-2"
    >
      <span className="h-full bg-ink" style={{ width: pct(committed) }} />
      <span className={cn("h-full", committed > 0 && "border-l border-surface", HATCH)} style={{ width: pct(pendingUsd) }} />
    </div>
  );
}

function Figure({
  label,
  value,
  hint,
  swatch,
  valueClassName,
}: {
  label: string;
  value: string;
  hint: string;
  swatch?: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-ink">
        {swatch}
        {label}
      </dt>
      <dd className={cn("mt-0.5 text-base font-semibold text-ink tabular-nums", valueClassName)}>{value}</dd>
      <dd className="mt-0.5 text-xs text-muted-ink">{hint}</dd>
    </div>
  );
}

function Rule({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-2.5 first:pt-0 last:pb-0">
      <dt className="type-label text-muted-ink">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  );
}

/**
 * The traveler's side panel: whose mandate it is and whether it is in force (authority), the budget
 * remaining now (the screen's key amount; pending is already inside spent), and what the mandate
 * lets the traveler ask for. Rule values are the mandate's own terms, shown only when the loaded
 * terms carry this mandate's id and hash.
 */
export function MandatePanel({
  summary,
  terms,
  termsError = false,
  now,
  className,
}: {
  summary: MandateSummary;
  terms: MandateDetail | null;
  termsError?: boolean;
  now: number | null;
  className?: string;
}) {
  const t = useT();
  const f = useFmt();
  const tm = t.traveler.mandate;
  const a = t.ui.authority;
  const b = t.ui.budget;
  const r = t.ui.rules.full;
  const headingId = useId();
  const state = authorityState(summary, now);
  const w = windowState(summary.startsAt, summary.expiresAt, now);
  const deadline =
    w === "before"
      ? a.opens(f.rel(summary.startsAt, now))
      : w === "expired"
        ? a.closed(f.rel(summary.expiresAt, now))
        : a.closes(f.rel(summary.expiresAt, now));
  const d = terms && terms.id === summary.id && terms.hash === summary.hash ? terms : null;
  const category = (c: string) => t.common.category[c] ?? c;
  const pendingTerm = termsError ? "—" : <Skeleton className="h-4 w-32" />;
  const over = summary.remainingUsd < 0;

  return (
    <section aria-labelledby={headingId} className={cn("rounded-lg border border-line bg-surface", className)}>
      <div className="space-y-3 px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={headingId} className="type-label text-muted-ink">
              {tm.title}
            </h2>
            <p className="mt-1 flex min-w-0 items-center gap-1">
              <span className="truncate font-mono text-sm font-semibold text-ink">{summary.id}</span>
              <CopyButton value={summary.id} label={t.common.hash.copy(summary.id)} />
            </p>
          </div>
          <StateBadge family="authority" state={state} size="md" />
        </div>
        <dl className="grid grid-cols-2 gap-x-4">
          <div className="min-w-0">
            <dt className="type-label text-muted-ink">{a.traveler}</dt>
            <dd className="mt-0.5 truncate text-sm text-ink">{summary.traveler}</dd>
          </div>
          <div className="min-w-0">
            <dt className="type-label text-muted-ink">{a.principal}</dt>
            <dd className="mt-0.5 truncate text-sm text-ink">{summary.principal}</dd>
          </div>
        </dl>
        <AuthorityNote state={state} summary={summary} />
      </div>

      <div className="border-t border-line px-4 py-4 sm:px-5">
        <p className="type-label text-muted-ink">{tm.remainingNow}</p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className={cn("type-amount", over ? "text-danger" : "text-ink")}>{fmtUsd(summary.remainingUsd)}</span>
          <span className="text-sm text-muted-ink">{tm.ofBudget(fmtUsd(summary.budgetUsd))}</span>
        </p>
        <BudgetBar summary={summary} />
        {over && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-danger">
            <StateGlyph glyph="triangle" className="size-3" />
            {b.over}
          </p>
        )}
        {/* Spent is the whole filled bar; its two parts carry the swatches (as in BudgetBreakdown). */}
        <dl className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3">
          <dt className="text-xs font-medium text-muted-ink">{b.spent}</dt>
          <dd className="text-base font-semibold text-ink tabular-nums">{fmtUsd(summary.spentUsd)}</dd>
          <dd className="basis-full text-xs text-muted-ink">{b.spentHint}</dd>
        </dl>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 border-t border-line pt-3">
          <Figure
            label={b.committed}
            value={fmtUsd(Math.max(0, summary.spentUsd - summary.pendingUsd))}
            hint={b.committedHint}
            swatch={<span aria-hidden className="h-1.5 w-3.5 shrink-0 rounded-[1px] bg-ink" />}
          />
          <Figure
            label={b.pending}
            value={fmtUsd(summary.pendingUsd)}
            hint={b.pendingHint}
            valueClassName="text-pending"
            swatch={<span aria-hidden className={cn("h-1.5 w-3.5 shrink-0 rounded-[1px] ring-1 ring-pending-line", HATCH)} />}
          />
        </dl>
      </div>

      <div className="border-t border-line px-4 py-4 sm:px-5">
        <h3 className="type-label text-muted-ink">{tm.rulesTitle}</h3>
        <dl className="mt-2.5 divide-y divide-line">
          <Rule label={r.perTxCap}>
            <span className="font-medium tabular-nums">{tm.perPayment(fmtUsd(summary.perTxCapUsd))}</span>
          </Rule>
          <Rule label={r.merchants}>
            {d
              ? d.allowedMerchantIds.map((id) => d.catalog.find((c) => c.id === id)?.name ?? id).join(tm.listSep) || r.none
              : pendingTerm}
          </Rule>
          <Rule label={r.categories}>{d ? d.allowedCategories.map(category).join(tm.listSep) || r.none : pendingTerm}</Rule>
          <Rule label={r.blocked}>
            {d ? (
              d.blockedKeywords.length === 0 ? (
                r.none
              ) : (
                <ul className="flex flex-wrap gap-1.5 pt-0.5">
                  {d.blockedKeywords.map((k) => (
                    <li key={k} className="rounded-sm border border-line bg-surface-2 px-1.5 text-xs text-ink">
                      {k}
                    </li>
                  ))}
                </ul>
              )
            ) : (
              pendingTerm
            )}
          </Rule>
          <Rule label={a.window}>
            <span className="tabular-nums">{a.range(f.date(summary.startsAt), f.date(summary.expiresAt, true))}</span>
            <span className={cn("mt-0.5 block text-xs tabular-nums", w === "expired" ? "text-muted-ink" : "text-ink")}>{deadline}</span>
          </Rule>
        </dl>
        {termsError && <p className="mt-2 text-xs text-muted-ink">{tm.termsError}</p>}
      </div>
    </section>
  );
}

/** Mobile only: authority and the budget remaining now above the conversation. */
export function MandateStrip({
  summary,
  now,
  className,
}: {
  summary: MandateSummary;
  now: number | null;
  className?: string;
}) {
  const t = useT();
  const tm = t.traveler.mandate;
  const state = authorityState(summary, now);
  return (
    <section aria-label={tm.stripLabel} className={cn("space-y-2.5 rounded-lg border border-line bg-surface px-4 py-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <StateBadge family="authority" state={state} size="md" />
        <p className="text-sm text-muted-ink">
          {tm.remainingNow}{" "}
          <span className="text-base font-semibold text-ink tabular-nums">{fmtUsd(summary.remainingUsd)}</span>{" "}
          <span className="whitespace-nowrap">{tm.ofBudget(fmtUsd(summary.budgetUsd))}</span>
        </p>
      </div>
      <AuthorityNote state={state} summary={summary} />
    </section>
  );
}

export function MandatePanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4 rounded-lg border border-line bg-surface px-4 py-4 sm:px-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-7 w-20" />
      </div>
      <Skeleton className="h-10 w-44" />
      <Skeleton className="h-2 w-full" />
      <div className="space-y-2.5 pt-2">
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
      </div>
    </div>
  );
}

export function MandateStripSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 rounded-lg border border-line bg-surface px-4 py-3", className)}>
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-5 w-40" />
    </div>
  );
}
