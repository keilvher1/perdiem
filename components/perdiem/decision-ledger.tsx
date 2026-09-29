"use client";

import {
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from "react";
import type { LedgerEntryView } from "@/contracts/api";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtUsd } from "@/lib/format";
import { useFmt, useLocale, useT } from "@/lib/i18n/provider";
import { decisionState, executionState } from "@/lib/ui-state";
import { cn } from "@/lib/utils";
import { StateBadge } from "./state-badge";
import { localizeReason } from "./stop-codes";

export type LedgerFilter = "all" | "approved" | "stopped" | "pending";
export const LEDGER_FILTERS: ReadonlyArray<LedgerFilter> = ["all", "approved", "stopped", "pending"];

/** approved = decision APPROVE (any execution state); pending = broadcast, not mined yet. */
export function matchesFilter(e: Pick<LedgerEntryView, "decision" | "status">, f: LedgerFilter): boolean {
  if (f === "approved") return e.decision === "APPROVE";
  if (f === "stopped") return e.decision === "STOP";
  if (f === "pending") return e.status === "pending";
  return true;
}

export interface DecisionLedgerHandle {
  /** Move keyboard focus to the selected row (e.g. after closing the mobile detail view). */
  focusSelected: () => void;
}

/**
 * Selected-row style shared with the evidence panel header (utility in app/globals.css):
 * cobalt left rule + cobalt-soft background.
 */
export const SELECTED_MARKER = "selected-marker";

/**
 * Row layouts follow the ledger's own width (container queries on the section), not the viewport,
 * so the same component works full width and as the narrow column next to the evidence panel:
 *   < 36rem   stacked: merchant + amount, badges + time, reason
 *   ≥ 36rem   two lines: time | merchant / reason | amount / badges
 *   ≥ 56rem   one line, six columns (the header captions show only here)
 */
const WIDE_COLS = "@4xl:grid-cols-[4.75rem_minmax(0,1.3fr)_6.5rem_7.25rem_8.25rem_minmax(0,2fr)] @4xl:items-center";

/**
 * Chronological decisions (approvals and stops at equal weight) as a single-select listbox.
 * Rows: time, merchant, amount (right, tabular), decision badge, execution badge, one-line key
 * reason. Keyboard: roving tabindex, ↑/↓ move, Home/End jump, Enter/Space select. The selected id
 * is owned by the parent (`selectedId` + `onSelect`) so the evidence panel follows it.
 */
export function DecisionLedger({
  entries,
  selectedId,
  onSelect,
  now = null,
  order = "newest",
  filter: filterProp,
  onFilterChange,
  defaultFilter = "all",
  loading = false,
  label,
  maxHeightClass,
  className,
  ref,
}: {
  /** Oldest first, as the API returns them. */
  entries: LedgerEntryView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  now?: number | null;
  order?: "newest" | "oldest";
  /** Controlled filter (optional); uncontrolled starts at `defaultFilter`. */
  filter?: LedgerFilter;
  onFilterChange?: (f: LedgerFilter) => void;
  defaultFilter?: LedgerFilter;
  loading?: boolean;
  /** Accessible name of the list (defaults to "Decision ledger"). */
  label?: string;
  /** e.g. "max-h-[560px]" to scroll inside the page. */
  maxHeightClass?: string;
  className?: string;
  ref?: Ref<DecisionLedgerHandle>;
}) {
  const t = useT();
  const f = useFmt();
  const locale = useLocale();
  const l = t.ui.ledger;
  const baseId = useId();
  const [innerFilter, setInnerFilter] = useState<LedgerFilter>(defaultFilter);
  const filter = filterProp ?? innerFilter;
  const setFilter = (next: LedgerFilter) => {
    if (filterProp === undefined) setInnerFilter(next);
    onFilterChange?.(next);
  };
  const [focusId, setFocusId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  const ordered = useMemo(() => (order === "newest" ? [...entries].reverse() : entries), [entries, order]);
  const counts = useMemo(() => {
    const c: Record<LedgerFilter, number> = { all: 0, approved: 0, stopped: 0, pending: 0 };
    for (const e of entries) for (const k of LEDGER_FILTERS) if (matchesFilter(e, k)) c[k] += 1;
    return c;
  }, [entries]);
  const visible = useMemo(() => ordered.filter((e) => matchesFilter(e, filter)), [ordered, filter]);

  // The one row in the tab order: the focused one, else the selected one, else the first.
  const tabId =
    (focusId && visible.some((e) => e.id === focusId) && focusId) ||
    (selectedId && visible.some((e) => e.id === selectedId) && selectedId) ||
    visible[0]?.id ||
    null;

  const focusRow = (id: string | undefined) => {
    if (!id) return;
    setFocusId(id);
    rowRefs.current.get(id)?.focus();
  };

  useImperativeHandle(ref, () => ({ focusSelected: () => focusRow(selectedId ?? undefined) }), [selectedId]);

  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>, index: number, id: string) => {
    switch (ev.key) {
      case "ArrowDown":
        ev.preventDefault();
        focusRow(visible[Math.min(visible.length - 1, index + 1)]?.id);
        break;
      case "ArrowUp":
        ev.preventDefault();
        focusRow(visible[Math.max(0, index - 1)]?.id);
        break;
      case "Home":
        ev.preventDefault();
        focusRow(visible[0]?.id);
        break;
      case "End":
        ev.preventDefault();
        focusRow(visible[visible.length - 1]?.id);
        break;
      case "Enter":
      case " ":
        ev.preventDefault();
        onSelect(id);
        break;
    }
  };

  const listLabel = label ?? l.title;

  return (
    <section aria-label={listLabel} className={cn("@container overflow-hidden rounded-lg border border-line bg-surface", className)}>
      <div
        role="group"
        aria-label={l.filterLabel}
        className="flex gap-0.5 overflow-x-auto border-b border-line px-2 pt-2 @md:gap-1 @md:px-3"
      >
        {LEDGER_FILTERS.map((k) => {
          const on = filter === k;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(k)}
              className={cn(
                "-mb-px inline-flex h-9 shrink-0 items-center gap-1 border-b-2 px-2 text-[13px] font-medium whitespace-nowrap outline-none transition-colors duration-150 focus-visible:rounded-t-md focus-visible:ring-2 focus-visible:ring-ring @md:gap-1.5 @md:px-2.5 @md:text-sm",
                on ? "border-cobalt text-ink" : "border-transparent text-muted-ink hover:text-ink",
              )}
            >
              {l.filters[k]}
              {/* No count while loading: "0" would claim there are no decisions. */}
              {!loading && (
                <span
                  className={cn(
                    "min-w-5 rounded-sm px-1 text-center text-xs tabular-nums",
                    on ? "bg-cobalt-soft text-cobalt" : "bg-surface-2 text-muted-ink",
                  )}
                >
                  {f.int(counts[k])}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Column captions for sighted users; each row reads fully on its own for screen readers. */}
      <div
        aria-hidden
        className={cn(
          "hidden gap-x-4 border-b border-line bg-surface-2 px-4 py-2 text-xs font-medium text-muted-ink @4xl:grid",
          WIDE_COLS,
        )}
      >
        <span>{l.col.time}</span>
        <span>{l.col.merchant}</span>
        <span className="text-right">{l.col.amount}</span>
        <span>{l.col.decision}</span>
        <span>{l.col.execution}</span>
        <span>{l.col.reason}</span>
      </div>

      {loading ? (
        <div className="space-y-2 p-4" aria-busy="true" aria-label={l.loading}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="font-medium text-ink">{entries.length === 0 ? l.empty : l.emptyFiltered}</p>
          {entries.length === 0 && <p className="mt-1 text-sm text-muted-ink">{l.emptyHint}</p>}
        </div>
      ) : (
        <div
          role="listbox"
          aria-label={listLabel}
          aria-describedby={`${baseId}-kbd`}
          className={cn("divide-y divide-line overflow-y-auto", maxHeightClass)}
        >
          {visible.map((e, i) => {
            const selected = e.id === selectedId;
            const decision = decisionState(e);
            const execution = executionState(e);
            const first = e.reasons[0];
            // Approvals passed all 12 checks; a stop shows its first recorded reason ("—" if a
            // record carries none, which evaluate() never produces).
            const reason =
              e.decision === "APPROVE" ? l.allPassed : first ? localizeReason(first, locale).message : "—";
            const merchant = e.merchantName ?? e.proposal.merchantId;
            return (
              <div
                key={e.id}
                id={`${baseId}-opt-${e.id}`}
                ref={(el) => {
                  if (el) rowRefs.current.set(e.id, el);
                  else rowRefs.current.delete(e.id);
                }}
                role="option"
                aria-selected={selected}
                tabIndex={e.id === tabId ? 0 : -1}
                data-entry-id={e.id}
                onClick={() => {
                  setFocusId(e.id);
                  onSelect(e.id);
                }}
                onFocus={() => setFocusId(e.id)}
                onKeyDown={(ev) => onKeyDown(ev, i, e.id)}
                className={cn(
                  "grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 px-4 py-3 outline-none transition-colors duration-150",
                  "@xl:grid-cols-[4.25rem_minmax(0,1fr)_auto] @xl:gap-x-4 @xl:gap-y-1 @4xl:py-2.5",
                  WIDE_COLS,
                  // outline-none zeroes --tw-outline-style, so the focus outline must name its style.
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring",
                  selected ? SELECTED_MARKER : "hover:bg-surface-2",
                )}
              >
                {/* merchant */}
                <div className="min-w-0 @xl:col-start-2 @xl:row-start-1">
                  <p className="truncate font-medium text-ink">{merchant}</p>
                  <p className="truncate text-xs text-muted-ink">
                    {e.merchantCategory != null ? (t.common.category[e.merchantCategory] ?? e.merchantCategory) : e.proposal.merchantId}
                  </p>
                </div>
                {/* amount */}
                <p className="text-right font-medium whitespace-nowrap text-ink tabular-nums @xl:col-start-3 @xl:row-start-1">
                  {fmtUsd(e.proposal.amountUsd)}
                </p>
                {/* time + badges: one wrapped line when narrow, their own grid cells when wider */}
                <div className="col-span-2 flex flex-wrap items-center gap-x-2 gap-y-1 @xl:contents">
                  <p
                    className="order-last text-xs text-muted-ink tabular-nums @xl:order-none @xl:col-start-1 @xl:row-span-2 @xl:row-start-1 @xl:text-sm @xl:text-ink @4xl:row-span-1"
                    title={f.date(e.at, true)}
                  >
                    <time dateTime={e.at}>{f.time(e.at)}</time>
                    <span className="hidden text-xs text-muted-ink @xl:block">{f.rel(e.at, now)}</span>
                  </p>
                  <span className="flex flex-wrap items-center gap-1.5 @xl:col-start-3 @xl:row-start-2 @xl:justify-end @4xl:contents">
                    <span className="@4xl:col-start-4 @4xl:row-start-1">
                      <StateBadge family="decision" state={decision} />
                    </span>
                    <span className="@4xl:col-start-5 @4xl:row-start-1">
                      {execution ? (
                        <StateBadge family="execution" state={execution} />
                      ) : (
                        <span className="text-xs text-muted-ink">{l.nothingSent}</span>
                      )}
                    </span>
                  </span>
                </div>
                {/* key reason */}
                <p
                  title={reason}
                  className="col-span-2 min-w-0 truncate text-sm text-muted-ink @xl:col-span-1 @xl:col-start-2 @xl:row-start-2 @xl:self-center @4xl:col-start-6 @4xl:row-start-1"
                >
                  {reason}
                  {e.reasons.length > 1 && <span className="ml-1.5 text-xs text-muted-ink">{l.more(e.reasons.length - 1)}</span>}
                </p>
              </div>
            );
          })}
        </div>
      )}
      <p id={`${baseId}-kbd`} className="sr-only">
        {l.keyboard}
      </p>
    </section>
  );
}
