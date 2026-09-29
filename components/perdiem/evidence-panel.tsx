"use client";

import { useState, type ReactNode, type Ref } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { LedgerEntryView, StopReason } from "@/contracts/api";
import { fmtUsd } from "@/lib/format";
import type { Messages } from "@/lib/i18n/messages";
import { useFmt, useLocale, useT } from "@/lib/i18n/provider";
import { countRuleChecks, deriveRuleChecks, type RuleCheck, type RuleResult } from "@/lib/rule-checks";
import { decisionState, executionState, type Glyph, type Tone } from "@/lib/ui-state";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";
import { SELECTED_MARKER } from "./decision-ledger";
import { HashChip } from "./hash-chip";
import { JsonView } from "./json-view";
import type { RuleMandate } from "./rule-summary";
import { StateBadge, TONE_TEXT } from "./state-badge";
import { StateGlyph } from "./state-glyph";
import { fmtReasonValue } from "./stop-codes";

/** Mandate terms for the "allowed" column. `id` / `hash` (MandateDetail has both) let the panel refuse
 *  terms that are not this entry's: another mandate id, or a hash the entry was not stamped with. */
export type EvidenceMandate = RuleMandate & { id?: string; hash?: string };

const RESULT_LOOK: Record<RuleResult, { glyph: Glyph; tone: Tone }> = {
  passed: { glyph: "circle-check", tone: "approve" },
  failed: { glyph: "square", tone: "stop" },
  not_evaluated: { glyph: "dashed", tone: "unverified" },
};

type Fmt = ReturnType<typeof useFmt>;

/**
 * Rule table columns by the panel's own width (container queries): one line per check from 42rem,
 * otherwise check + result on the first line and requested / allowed under it (side by side from
 * 28rem, stacked below that) with their captions repeated.
 */
const RULE_COLS = "@2xl:grid-cols-[minmax(0,1.3fr)_6.5rem_minmax(0,1fr)_minmax(0,1.2fr)]";

/**
 * Requested value vs allowed range for one check, only from what the entry and the mandate hold
 * (or the recorded reason's observed / limit). null = the data does not say; nothing is invented.
 */
function compare(
  c: RuleCheck,
  e: LedgerEntryView,
  m: EvidenceMandate | null,
  t: Messages,
  f: Fmt,
): { requested: ReactNode; allowed: ReactNode } {
  const v = t.ui.evidence.values;
  const r: StopReason | undefined = c.reasons[0];
  const val = (x: number | string | undefined) => (r ? fmtReasonValue(r.code, x, f.locale) : null);
  const category = (x: string) => t.common.category[x] ?? x;
  const merchantNames = (ids: string[]) =>
    ids.map((id) => m?.catalog.find((x) => x.id === id)?.name ?? id).join(", ");
  switch (c.code) {
    case "MANDATE_NOT_ACTIVE":
      // Passing this check means the status was "active" when the decision was made.
      return { requested: r ? val(r.observed) : c.result === "passed" ? v.active : null, allowed: v.active };
    case "BEFORE_START":
      return {
        requested: f.date(e.at, true),
        allowed: m ? v.from(f.date(m.startsAt, true)) : r ? v.from(val(r.limit) ?? "") : null,
      };
    case "EXPIRED":
      return {
        requested: f.date(e.at, true),
        allowed: m ? v.until(f.date(m.expiresAt, true)) : r ? v.until(val(r.limit) ?? "") : null,
      };
    case "UNKNOWN_MERCHANT":
      return {
        requested: <span className="font-mono text-xs">{e.proposal.merchantId}</span>,
        allowed: m ? v.inCatalog(m.catalog.length) : null,
      };
    case "MERCHANT_NOT_ALLOWED":
      return {
        requested: e.merchantName ?? e.proposal.merchantId,
        allowed: m
          ? merchantNames(m.allowedMerchantIds)
          : typeof r?.limit === "string"
            ? r.limit
            : null,
      };
    case "CATEGORY_NOT_ALLOWED": {
      const req = e.merchantCategory ?? (typeof r?.observed === "string" ? r.observed : null);
      const allowed = m
        ? m.allowedCategories
        : typeof r?.limit === "string"
          ? r.limit.split(",").map((s) => s.trim())
          : null;
      return { requested: req ? category(req) : null, allowed: allowed ? allowed.map(category).join(", ") : null };
    }
    case "BLOCKED_KEYWORD":
      return {
        requested: r ? `“${String(r.observed ?? "")}”` : v.noHit,
        allowed: m ? v.noneOf(m.blockedKeywords.join(", ")) : null,
      };
    case "INVALID_AMOUNT":
      return { requested: fmtUsd(e.proposal.amountUsd), allowed: v.positive };
    case "OVER_PER_TX_CAP":
      return {
        requested: fmtUsd(e.proposal.amountUsd),
        allowed: m ? v.atMost(fmtUsd(m.perTxCapUsd)) : r ? v.atMost(val(r.limit) ?? "") : null,
      };
    case "FEE_UNAVAILABLE":
      return {
        requested: r
          ? v.feeUnknown
          : v.withSource(fmtUsd(e.feeUsd), t.ledger.feeSourceValue[e.feeSource ?? ""] ?? e.feeSource ?? "—"),
        allowed: v.feeRequired,
      };
    case "OVER_BUDGET_WITH_FEES":
      return r
        ? { requested: val(r.observed), allowed: v.remaining(val(r.limit) ?? "") }
        : { requested: fmtUsd(e.totalUsd), allowed: v.remainingNotRecorded };
    case "DUPLICATE":
      return { requested: r ? v.repeats(String(r.observed ?? "")) : null, allowed: v.noRepeat };
  }
}

function Section({ n, title, aside, children }: { n: number; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-line px-4 py-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="flex items-baseline gap-2 text-sm font-semibold text-ink">
          <span aria-hidden className="text-xs font-medium text-muted-ink tabular-nums">
            {n}
          </span>
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * Network fee and total as recorded, with what the fee figure is. evaluate() records fee 0 when the
 * fee could not be estimated (FEE_UNAVAILABLE), and the agent passes 0 for an unknown merchant
 * (feeSource "none"): neither is a real fee, so the panel says so instead of showing "$0.00".
 */
function feeAndTotal(e: LedgerEntryView, t: Messages): { fee: string; total: string } {
  const v = t.ui.evidence.values;
  const source = e.feeSource ? (t.ledger.feeSourceValue[e.feeSource] ?? e.feeSource) : null;
  if (e.reasons.some((r) => r.code === "FEE_UNAVAILABLE")) {
    return { fee: v.feeUnknown, total: v.amountOnly(fmtUsd(e.totalUsd)) };
  }
  if (e.feeSource === "none") {
    return { fee: v.withSource(fmtUsd(e.feeUsd), source ?? "none"), total: v.amountOnly(fmtUsd(e.totalUsd)) };
  }
  return { fee: source ? v.withSource(fmtUsd(e.feeUsd), source) : fmtUsd(e.feeUsd), total: fmtUsd(e.totalUsd) };
}

function Pair({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-ink">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink tabular-nums">{children}</dd>
    </div>
  );
}

/** The full record, collapsed until asked for. */
function JsonToggle({ value, show, hide }: { value: unknown; show: string; hide: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-cobalt outline-none hover:bg-cobalt-soft focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight aria-hidden className={cn("size-4 transition-transform duration-150", open && "rotate-90")} />
        {open ? hide : show}
      </button>
      {open && <JsonView value={value} className="mt-2 max-h-96" />}
    </>
  );
}

/**
 * Evidence for the selected decision, in reading order: (1) decision and reason, (2) the 12 rule
 * checks with requested value vs allowed range, (3) raw evidence — tx / receipt / mandate hashes
 * and the full JSON record (collapsed). Carries the same selected marker as the ledger row and
 * announces a new selection politely. Place it as the column next to <DecisionLedger> on desktop;
 * on mobile pass `onBack` to render it as a stacked detail view (see DecisionWorkspace).
 */
export function EvidencePanel({
  entry,
  mandate = null,
  onBack,
  backClassName,
  headingRef,
  className,
}: {
  entry: LedgerEntryView | null;
  /** Mandate terms for "allowed" values (MandateDetail fits). Omit to show only the entry's own data. */
  mandate?: EvidenceMandate | null;
  /** Renders a "Back to ledger" control (mobile stacked view). */
  onBack?: () => void;
  /** e.g. "lg:hidden" so the back control only shows where the panel is stacked. */
  backClassName?: string;
  /** Focus target when the stacked view opens (the panel heading, tabIndex -1). */
  headingRef?: Ref<HTMLHeadingElement>;
  className?: string;
}) {
  const t = useT();
  const f = useFmt();
  const locale = useLocale();
  const ev = t.ui.evidence;

  const back = onBack ? (
    <button
      type="button"
      onClick={onBack}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-sm font-medium text-ink outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring",
        backClassName,
      )}
    >
      <ArrowLeft aria-hidden className="size-4" />
      {ev.back}
    </button>
  ) : null;

  if (!entry) {
    return (
      <section aria-label={ev.title} className={cn("@container overflow-hidden rounded-lg border border-line bg-surface", className)}>
        {/* Same element as the announcement below, kept mounted so the first selection is announced. */}
        <p aria-live="polite" aria-atomic="true" className="sr-only" />
        <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
          {back}
          <h2 ref={headingRef} tabIndex={-1} className="type-label text-muted-ink outline-none">
            {ev.title}
          </h2>
        </div>
        <div className="border-t border-line px-4 py-10 text-center sm:px-5">
          <p className="font-medium text-ink">{ev.emptyTitle}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-ink">{ev.emptyHint}</p>
        </div>
      </section>
    );
  }

  const decision = decisionState(entry);
  const execution = executionState(entry);
  const checks = deriveRuleChecks(entry, locale);
  const counts = countRuleChecks(checks);
  // Allowed values come from the mandate's terms only when they are this entry's terms: the same
  // mandate id and, when the mandate carries its hash, the hash the entry was stamped with.
  const sameId = !mandate?.id || mandate.id === entry.mandateId;
  const hashMismatch = mandate != null && sameId && mandate.hash != null && mandate.hash !== entry.mandateHash;
  const terms = mandate && sameId && !hashMismatch ? mandate : null;
  const money = feeAndTotal(entry, t);
  const merchant = entry.merchantName ?? entry.proposal.merchantId;
  const announce = ev.announce(entry.id, t.ui.state.decision[decision], merchant, fmtUsd(entry.proposal.amountUsd));

  return (
    <section
      aria-label={`${ev.title} · ${entry.id}`}
      data-entry-id={entry.id}
      className={cn("@container overflow-hidden rounded-lg border border-line bg-surface", className)}
    >
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </p>

      <header className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5", SELECTED_MARKER)}>
        {back}
        <h2 ref={headingRef} tabIndex={-1} className="type-label text-muted-ink outline-none">
          {ev.title}
        </h2>
        <span className="flex min-w-0 items-center gap-1 text-sm font-medium text-cobalt">
          <span className="truncate">{ev.selected(entry.id)}</span>
          <CopyButton value={entry.id} label={t.common.hash.copy(entry.id)} />
        </span>
      </header>

      {/* 1 · Decision and reason */}
      <Section n={1} title={ev.sections.decision}>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StateBadge family="decision" state={decision} size="md" />
              {execution && <StateBadge family="execution" state={execution} size="md" />}
            </div>
            <p className="mt-2 truncate text-base font-semibold text-ink">{merchant}</p>
            <p className="text-xs text-muted-ink">
              {entry.merchantCategory != null ? (t.common.category[entry.merchantCategory] ?? entry.merchantCategory) : "—"} ·{" "}
              <span className="font-mono">{entry.proposal.merchantId}</span>
            </p>
          </div>
          <p className="type-amount-sm text-ink">{fmtUsd(entry.proposal.amountUsd)}</p>
        </div>

        {decision === "stop" ? (
          <div className="mt-3">
            <p className="text-sm font-medium text-stop">{ev.stopped(entry.reasons.length)}</p>
            <ul className="mt-2 divide-y divide-stop-line/60 rounded-md border border-stop-line bg-stop-soft">
              {checks
                .filter((c) => c.result === "failed")
                .map((c) => (
                  <li key={c.code} className="px-3 py-2">
                    <p className="flex items-baseline gap-2 text-sm text-ink">
                      <StateGlyph glyph="square" className="size-2.5 translate-y-px text-stop" />
                      <span>
                        <span className="font-medium">{c.title}</span>
                        <span className="text-muted-ink"> · </span>
                        {c.localized?.message}
                      </span>
                    </p>
                    <p className="mt-0.5 pl-[18px] text-xs text-muted-ink tabular-nums">
                      <span className="type-id text-[11px]">[{c.code}]</span>
                      {c.localized?.detail ? ` ${c.localized.detail}` : ""}
                    </p>
                  </li>
                ))}
            </ul>
          </div>
        ) : (
          <div className="mt-3 space-y-1">
            <p className="text-sm font-medium text-approve">{ev.approved}</p>
            {execution && <p className="text-sm text-muted-ink">{t.ui.hint.execution[execution]}</p>}
          </div>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 @lg:grid-cols-4">
          <Pair label={ev.amount}>{fmtUsd(entry.proposal.amountUsd)}</Pair>
          <Pair label={ev.fee}>{money.fee}</Pair>
          <Pair label={ev.total}>{money.total}</Pair>
          <Pair label={ev.decidedAt}>
            <time dateTime={entry.at} title={f.date(entry.at, true)}>
              {f.time(entry.at)}
            </time>
          </Pair>
        </dl>
        {entry.proposal.sourceText && (
          <p className="mt-3 text-sm text-muted-ink">
            {ev.travelerSaid}: <span className="text-ink">{t.ledger.quote(entry.proposal.sourceText)}</span>
          </p>
        )}
      </Section>

      {/* 2 · Rule comparison */}
      <Section
        n={2}
        title={ev.sections.rules}
        aside={
          <span className="text-xs text-muted-ink tabular-nums">
            {ev.counts(counts.passed, counts.failed, counts.not_evaluated)}
          </span>
        }
      >
        {hashMismatch && (
          // A record inconsistency, not a rule stop: danger tone, triangle and text.
          <p role="note" className="mb-3 flex items-start gap-2 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-xs text-ink">
            <StateGlyph glyph="triangle" className="mt-px size-3 text-danger" />
            <span>
              <span className="font-medium text-danger">{t.ui.state.verification.mismatch}</span> · {ev.hashMismatch}
            </span>
          </p>
        )}
        <div role="table" aria-label={ev.sections.rules} className="text-sm">
          <div role="row" className={cn("hidden gap-3 border-b border-line pb-1.5 text-xs font-medium text-muted-ink @2xl:grid", RULE_COLS)}>
            <span role="columnheader">{ev.col.check}</span>
            <span role="columnheader">{ev.col.result}</span>
            <span role="columnheader">{ev.col.requested}</span>
            <span role="columnheader">{ev.col.allowed}</span>
          </div>
          {checks.map((c) => {
            const look = RESULT_LOOK[c.result];
            const cmp = c.result === "not_evaluated" ? null : compare(c, entry, terms, t, f);
            const skippedTitle = c.skippedBecause ? (checks.find((x) => x.code === c.skippedBecause)?.title ?? c.skippedBecause) : "";
            return (
              <div
                key={c.code}
                role="row"
                data-rule={c.code}
                data-result={c.result}
                className={cn(
                  // Narrow: check title takes the room the result label leaves; from 28rem requested and
                  // allowed sit side by side in two equal columns; from 42rem one line (RULE_COLS).
                  "-mx-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 rounded-sm border-b border-line px-2 py-2 last:border-0 @md:grid-cols-2",
                  RULE_COLS,
                  c.result === "failed" && "bg-stop-soft/60",
                )}
              >
                <span role="cell" className="min-w-0">
                  <span className="block font-medium break-words text-ink" title={c.meaning}>
                    {c.title}
                  </span>
                  <span className="type-id block truncate text-[11px] text-muted-ink">{c.code}</span>
                </span>
                <span
                  role="cell"
                  className={cn(
                    "inline-flex items-center gap-1.5 self-start justify-self-end pt-0.5 text-xs font-medium @2xl:justify-self-start",
                    TONE_TEXT[look.tone],
                  )}
                >
                  <StateGlyph glyph={look.glyph} className="size-2.5" />
                  {ev.result[c.result]}
                </span>
                {cmp ? (
                  <>
                    <span role="cell" className="col-span-2 min-w-0 break-words text-ink tabular-nums @md:col-span-1">
                      <span className="block text-xs text-muted-ink @2xl:hidden">{ev.col.requested}</span>
                      {cmp.requested ?? "—"}
                    </span>
                    <span role="cell" className="col-span-2 min-w-0 break-words text-muted-ink tabular-nums @md:col-span-1">
                      <span className="block text-xs @2xl:hidden">{ev.col.allowed}</span>
                      {cmp.allowed ?? "—"}
                    </span>
                  </>
                ) : (
                  <span role="cell" className="col-span-2 text-xs text-muted-ink">
                    {ev.skipped(skippedTitle)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-ink">{ev.rulesNote}</p>
      </Section>

      {/* 3 · Raw evidence */}
      <Section n={3} title={ev.sections.raw}>
        <dl className="grid gap-x-4 gap-y-3 @lg:grid-cols-2">
          <Pair label={ev.raw.tx}>
            <HashChip value={entry.txHash} href={entry.explorerUrl} what={t.ledger.txWhat} emptyText={ev.raw.notBroadcast} />
          </Pair>
          <Pair label={ev.raw.receipt}>
            <HashChip value={entry.receiptHash} what={t.ledger.receiptHashWhat} />
          </Pair>
          <Pair label={ev.raw.mandate}>
            <HashChip value={entry.mandateHash} what={t.ledger.mandateHashWhat} />
          </Pair>
          <Pair label={ev.entry}>
            <span className="inline-flex items-center gap-1 font-mono text-xs">
              {entry.id}
              <CopyButton value={entry.id} label={t.common.hash.copy(entry.id)} />
            </span>
          </Pair>
        </dl>
        {/* Keyed by entry: a newly selected decision starts with the JSON collapsed again. */}
        <JsonToggle key={entry.id} value={entry} show={ev.raw.showJson} hide={ev.raw.hideJson} />
      </Section>
    </section>
  );
}
