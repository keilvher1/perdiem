"use client";

import { useId, useState, type ReactNode } from "react";
import { ArrowUpRight, ChevronRight, FileSearch } from "lucide-react";
import type { LedgerEntryView, StopCode } from "@/contracts/api";
import { Button } from "@/components/ui/button";
import { fmtUsd } from "@/lib/format";
import type { Messages } from "@/lib/i18n/messages";
import { useFmt, useLocale, useT } from "@/lib/i18n/provider";
import { countRuleChecks, deriveRuleChecks, type RuleCheck, type RuleResult } from "@/lib/rule-checks";
import { decisionState, executionState, type Glyph, type Tone } from "@/lib/ui-state";
import { cn } from "@/lib/utils";
import { SELECTED_MARKER } from "./decision-ledger";
import type { EvidenceMandate } from "./evidence-panel";
import { HashChip } from "./hash-chip";
import { LocalAmount } from "./local-amount";
import { StateBadge, TONE_TEXT } from "./state-badge";
import { StateGlyph } from "./state-glyph";
import { fmtReasonValue } from "./stop-codes";

type Fmt = ReturnType<typeof useFmt>;

/** The mandate's budget right now (MandateSummary fits). Not recorded per decision. */
export type ReceiptBudget = { remainingUsd: number; budgetUsd: number };

/** Who holds the input a failed check looked at. */
type Where = "request" | "principal" | "system";

const WHERE: Record<StopCode, Where> = {
  MANDATE_NOT_ACTIVE: "principal",
  BEFORE_START: "principal",
  EXPIRED: "principal",
  UNKNOWN_MERCHANT: "request",
  MERCHANT_NOT_ALLOWED: "request",
  CATEGORY_NOT_ALLOWED: "request",
  BLOCKED_KEYWORD: "request",
  INVALID_AMOUNT: "request",
  OVER_PER_TX_CAP: "request",
  FEE_UNAVAILABLE: "system",
  OVER_BUDGET_WITH_FEES: "request",
  DUPLICATE: "request",
};

const FIELD: Record<StopCode, keyof Messages["receipt"]["field"]> = {
  MANDATE_NOT_ACTIVE: "status",
  BEFORE_START: "date",
  EXPIRED: "date",
  UNKNOWN_MERCHANT: "merchant",
  MERCHANT_NOT_ALLOWED: "merchant",
  CATEGORY_NOT_ALLOWED: "category",
  BLOCKED_KEYWORD: "wording",
  INVALID_AMOUNT: "amount",
  OVER_PER_TX_CAP: "amount",
  FEE_UNAVAILABLE: "fee",
  OVER_BUDGET_WITH_FEES: "total",
  DUPLICATE: "repeat",
};

const RESULT_LOOK: Record<RuleResult, { glyph: Glyph; tone: Tone }> = {
  passed: { glyph: "circle-check", tone: "approve" },
  failed: { glyph: "square", tone: "stop" },
  not_evaluated: { glyph: "dashed", tone: "unverified" },
};

/**
 * Mandate terms only when they are this entry's terms: the same mandate id and, when the terms
 * carry their hash, the hash the entry was stamped with (same rule as EvidencePanel).
 */
function termsFor(e: LedgerEntryView, m: EvidenceMandate | null | undefined): EvidenceMandate | null {
  if (!m) return null;
  if (m.id && m.id !== e.mandateId) return null;
  if (m.hash && m.hash !== e.mandateHash) return null;
  return m;
}

/**
 * What the request asked for vs what the mandate allows, for one failed check. Only from the entry,
 * the mandate terms (termsFor) or the recorded reason's observed / limit; null = the data does not
 * say (shown as "—"). Nothing is invented.
 */
function compare(
  c: RuleCheck,
  e: LedgerEntryView,
  m: EvidenceMandate | null,
  t: Messages,
  f: Fmt,
): { asked: ReactNode; allowed: ReactNode } {
  const tr = t.receipt;
  const v = tr.value;
  const r = c.reasons[0];
  const val = (x: number | string | undefined) => (r ? fmtReasonValue(r.code, x, f.locale) : null);
  const category = (x: string) => t.common.category[x] ?? x;
  const merchantNames = (ids: string[]) =>
    ids.map((id) => m?.catalog.find((x) => x.id === id)?.name ?? id).join(tr.listSep);
  switch (c.code) {
    case "MANDATE_NOT_ACTIVE": {
      const obs = typeof r?.observed === "string" ? r.observed : null;
      const authority = t.ui.state.authority as Record<string, string>;
      return { asked: obs ? (authority[obs] ?? obs) : null, allowed: t.ui.state.authority.active };
    }
    case "BEFORE_START": {
      const from = m ? f.date(m.startsAt, true) : val(r?.limit);
      return { asked: f.date(e.at, true), allowed: from ? v.from(from) : null };
    }
    case "EXPIRED": {
      const until = m ? f.date(m.expiresAt, true) : val(r?.limit);
      return { asked: f.date(e.at, true), allowed: until ? v.until(until) : null };
    }
    case "UNKNOWN_MERCHANT":
      return {
        asked: <span className="type-id">{e.proposal.merchantId}</span>,
        allowed: m ? merchantNames(m.allowedMerchantIds) : null,
      };
    case "MERCHANT_NOT_ALLOWED":
      return {
        asked: e.merchantName ?? e.proposal.merchantId,
        allowed: m ? (
          merchantNames(m.allowedMerchantIds)
        ) : typeof r?.limit === "string" ? (
          <span className="type-id">{r.limit}</span>
        ) : null,
      };
    case "CATEGORY_NOT_ALLOWED": {
      const req = e.merchantCategory ?? (typeof r?.observed === "string" ? r.observed : null);
      const allowed = m
        ? m.allowedCategories
        : typeof r?.limit === "string"
          ? r.limit.split(",").map((s) => s.trim()).filter(Boolean)
          : null;
      return { asked: req ? category(req) : null, allowed: allowed ? allowed.map(category).join(tr.listSep) : null };
    }
    case "BLOCKED_KEYWORD":
      return {
        asked: r?.observed !== undefined ? tr.quoted(String(r.observed)) : null,
        allowed: m && m.blockedKeywords.length > 0 ? v.noneOf(m.blockedKeywords.join(tr.listSep)) : null,
      };
    case "INVALID_AMOUNT":
      return { asked: fmtUsd(e.proposal.amountUsd), allowed: v.positive };
    case "OVER_PER_TX_CAP": {
      const cap = m ? fmtUsd(m.perTxCapUsd) : val(r?.limit);
      return { asked: fmtUsd(e.proposal.amountUsd), allowed: cap ? v.perPayment(cap) : null };
    }
    case "FEE_UNAVAILABLE":
      return { asked: v.feeUnknown, allowed: v.feeRequired };
    case "OVER_BUDGET_WITH_FEES": {
      const limit = val(r?.limit);
      return { asked: val(r?.observed), allowed: limit ? v.remainingAtDecision(limit) : null };
    }
    case "DUPLICATE":
      return {
        asked: r?.observed !== undefined ? v.repeats(String(r.observed)) : null,
        allowed: v.noRepeat,
      };
  }
}

/** Extra line under a failed check whose input is not the traveler's to change. */
function noteFor(code: StopCode, tr: Messages["receipt"]): string | null {
  if (code === "MANDATE_NOT_ACTIVE" || code === "EXPIRED" || code === "BEFORE_START") return tr.principalNote[code];
  if (code === "FEE_UNAVAILABLE") return tr.systemNote;
  if (code === "DUPLICATE") return tr.duplicateNote;
  return null;
}

/**
 * A failed approval never counts against the budget (lib/view.ts spends only approved|pending|
 * settled). Without a txHash the broadcast call itself errored; with one, the confirm route saw
 * the transaction revert on-chain.
 */
function failedHeadline(entry: LedgerEntryView, tr: Messages["receipt"]): string {
  return entry.txHash ? tr.failedOnChain : tr.broadcastUnconfirmed;
}

interface RuleRow {
  code: StopCode;
  result: RuleResult;
  title: string;
  /** The recorded reason, for a failed check. */
  message: string | null;
  field: string;
  where: string;
  note: string | null;
  asked: ReactNode;
  allowed: ReactNode;
}

/** Rule / you asked / allowed, one line per check from 32rem of card width, stacked below that. */
const RULE_COLS = "@lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.75fr)_minmax(0,1.2fr)]";

function RuleRows({ rows }: { rows: RuleRow[] }) {
  const t = useT();
  const tr = t.receipt;
  return (
    <div role="table" aria-label={tr.rule} className="mt-2 text-sm">
      <div role="row" className={cn("hidden gap-x-4 border-b border-line pb-1 text-xs text-muted-ink @lg:grid", RULE_COLS)}>
        <span role="columnheader">{tr.rule}</span>
        <span role="columnheader">{tr.asked}</span>
        <span role="columnheader">{tr.allowed}</span>
      </div>
      {rows.map((r) => {
        const look = RESULT_LOOK[r.result];
        const failed = r.result === "failed";
        return (
          <div
            key={r.code}
            role="row"
            data-rule={r.code}
            data-result={r.result}
            className={cn("grid grid-cols-2 gap-x-4 gap-y-1.5 border-b border-line py-2.5 last:border-0 last:pb-0", RULE_COLS)}
          >
            <div role="cell" className="col-span-2 flex min-w-0 items-start gap-2 @lg:col-span-1">
              <StateGlyph glyph={look.glyph} className={cn("mt-1 size-2.5 shrink-0", TONE_TEXT[look.tone])} />
              <div className="min-w-0">
                <p>
                  <span className="sr-only">{t.ui.evidence.result[r.result]}: </span>
                  <span className="font-medium text-ink">{r.title}</span>{" "}
                  <span className="type-id text-[11px] text-muted-ink">[{r.code}]</span>
                </p>
                {r.message && <p className="text-muted-ink">{r.message}</p>}
                <p className="mt-0.5 text-xs text-muted-ink">
                  <span className="font-medium text-ink">{r.field}</span> · {r.where}
                </p>
                {r.note && <p className="mt-0.5 text-xs text-muted-ink">{r.note}</p>}
              </div>
            </div>
            <div role="cell" className="min-w-0 pl-[18px] break-words tabular-nums @lg:pl-0">
              <span className="block text-xs text-muted-ink @lg:hidden">{tr.asked}</span>
              <span className={failed ? "font-medium text-stop" : "text-ink"}>{r.asked ?? "—"}</span>
            </div>
            <div role="cell" className="min-w-0 break-words text-ink tabular-nums">
              <span className="block text-xs text-muted-ink @lg:hidden">{tr.allowed}</span>
              {r.allowed ?? "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MoneyRow({ label, hint, value, strong = false }: { label: string; hint?: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-0.5">
      <dt className="text-muted-ink">
        {label}
        {hint && <span className="ml-1.5 text-xs">{hint}</span>}
      </dt>
      <dd className={cn("text-right whitespace-nowrap tabular-nums", strong ? "font-semibold text-ink" : "text-ink")}>{value}</dd>
    </div>
  );
}

/** The 12 checks as recorded (deriveRuleChecks), collapsed until asked for. */
function ChecksDisclosure({ checks }: { checks: RuleCheck[] }) {
  const t = useT();
  const tr = t.receipt;
  const ev = t.ui.evidence;
  const id = useId();
  const [open, setOpen] = useState(false);
  const counts = countRuleChecks(checks);
  return (
    <div className="border-t border-line px-4 py-1.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-checks`}
        onClick={() => setOpen((o) => !o)}
        className="-mx-1.5 inline-flex min-h-8 items-center gap-1.5 rounded-md px-1.5 text-left text-sm font-medium text-cobalt outline-none transition-colors duration-150 hover:bg-cobalt-soft focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight aria-hidden className={cn("size-4 shrink-0 transition-transform duration-150", open && "rotate-90")} />
        {open ? tr.checks.hide : tr.checks.show(counts.passed, counts.failed, counts.not_evaluated)}
      </button>
      {open && (
        <div id={`${id}-checks`} className="pb-2">
          <ol className="mt-1 grid gap-x-6 @lg:grid-cols-2">
            {checks.map((c) => {
              const look = RESULT_LOOK[c.result];
              const skippedTitle = c.skippedBecause
                ? (checks.find((x) => x.code === c.skippedBecause)?.title ?? c.skippedBecause)
                : "";
              return (
                <li key={c.code} data-rule={c.code} data-result={c.result} className="flex items-baseline gap-2 border-b border-line py-1.5 text-sm">
                  <StateGlyph glyph={look.glyph} className={cn("size-2.5 shrink-0 translate-y-px", TONE_TEXT[look.tone])} />
                  <span className="min-w-0 flex-1 text-ink" title={c.meaning}>
                    {c.title}
                    {c.result === "not_evaluated" && <span className="block text-xs text-muted-ink">{ev.skipped(skippedTitle)}</span>}
                  </span>
                  <span className={cn("shrink-0 text-xs font-medium", TONE_TEXT[look.tone])}>{ev.result[c.result]}</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-xs text-muted-ink">{tr.checks.note}</p>
        </div>
      )}
    </div>
  );
}

/**
 * One decision as a structured receipt, in reading order: decision (and, for an approval, its
 * execution state) → merchant and requested amount → why (the failed checks with what was asked vs
 * what the mandate allows and who can change it; or "all 12 passed") → payment (approvals) →
 * remaining budget, labelled truthfully → the 12 checks (collapsed) → hashes and actions.
 * Approvals and stops have the same structure and weight: a stop is a recorded decision, not an
 * error. English aria-labels start with "Receipt <id>: " (scripts/capture.ts selects on it).
 */
export function ReceiptCard({
  entry,
  terms,
  budgetNow,
  onOpenEvidence,
  selected = false,
  className,
}: {
  entry: LedgerEntryView;
  /** The mandate's terms (MandateDetail fits); used only when id and hash match the entry. */
  terms?: EvidenceMandate | null;
  /** The mandate's budget right now; shown as "Remaining now", never as the budget at decision time. */
  budgetNow?: ReceiptBudget | null;
  /** Shows "Open evidence" (the parent selects this decision, e.g. ?d=). */
  onOpenEvidence?: (entry: LedgerEntryView) => void;
  /** This decision is the selected one (same marker as the ledger row and the evidence panel). */
  selected?: boolean;
  className?: string;
}) {
  const t = useT();
  const f = useFmt();
  const locale = useLocale();
  const tr = t.receipt;
  const decision = decisionState(entry);
  const execution = executionState(entry);
  const stop = decision === "stop";
  const failed = execution === "failed";
  const settled = execution === "settled";
  const checks = deriveRuleChecks(entry, locale);
  const failedChecks = checks.filter((c) => c.result === "failed");
  const capCheck = checks.find((c) => c.code === "OVER_PER_TX_CAP");
  const m = termsFor(entry, terms);
  const budgetReason = entry.reasons.find((r) => r.code === "OVER_BUDGET_WITH_FEES");
  const atDecision = budgetReason ? fmtReasonValue(budgetReason.code, budgetReason.limit, locale) : null;

  const aria = stop
    ? tr.aria.stopped(entry.id, entry.reasons.length)
    : failed
      ? tr.aria.approvedFailed(entry.id, failedHeadline(entry, tr))
      : tr.aria.approved(entry.id, tr.status[entry.status] ?? entry.status);

  const feeValue =
    entry.feeSource === "none" ? tr.rows.noFee : fmtUsd(entry.feeUsd);
  const feeHint =
    entry.feeSource === "fallback"
      ? tr.rows.fallbackEstimate
      : entry.feeSource === "none"
        ? undefined
        : tr.rows.estimate;

  const said = entry.proposal.sourceText?.trim();
  const category = entry.merchantCategory;

  return (
    <article
      aria-label={aria}
      data-entry-id={entry.id}
      className={cn("@container overflow-hidden rounded-lg border border-line bg-surface", className)}
    >
      {/* Decision, then execution (approvals) or "Nothing was sent" (stops). */}
      <header className={cn("flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-line px-4 py-2.5", selected && SELECTED_MARKER)}>
        <StateBadge family="decision" state={decision} size="md" />
        {execution ? (
          <StateBadge family="execution" state={execution} size="md" />
        ) : (
          <span className="text-sm text-muted-ink">{tr.stoppedHeadline}</span>
        )}
        {selected && <span className="sr-only">{tr.selected}</span>}
        <time dateTime={entry.at} title={f.date(entry.at, true)} className="ml-auto text-xs text-muted-ink tabular-nums">
          {f.time(entry.at)}
        </time>
      </header>

      {/* What was requested. */}
      <div className="flex items-start justify-between gap-4 px-4 pt-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-ink">{entry.merchantName ?? entry.proposal.merchantId}</p>
          <p className="truncate text-xs text-muted-ink">
            {category != null ? (t.common.category[category] ?? category) : tr.unknownCategory} ·{" "}
            <span className="type-id text-[11px]">{entry.proposal.merchantId}</span>
            {entry.proposal.memo ? <> · {tr.quoted(entry.proposal.memo)}</> : null}
          </p>
          {/* Plain text only (React escapes it); the title carries the full request. */}
          {said ? (
            <p className="mt-0.5 truncate text-xs text-muted-ink" title={said}>
              {tr.youSaid(said)}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="type-amount-sm text-ink">{fmtUsd(entry.proposal.amountUsd)}</p>
          <p className="empty:hidden">
            <LocalAmount usd={entry.proposal.amountUsd} />
          </p>
          <p className="text-xs text-muted-ink">{tr.requested}</p>
        </div>
      </div>

      {/* Why: the reason and the rule it was compared with. */}
      <section aria-label={tr.why} className="px-4 pt-3 pb-3.5">
        <h3 className="type-label text-muted-ink">{tr.why}</h3>
        {stop ? (
          <>
            <p className="mt-1 text-sm font-medium text-stop">{tr.checksFailed(failedChecks.length, checks.length)}</p>
            <RuleRows
              rows={failedChecks.map((c) => {
                const cmp = compare(c, entry, m, t, f);
                return {
                  code: c.code,
                  result: c.result,
                  title: c.title,
                  message: c.localized?.message ?? null,
                  field: tr.field[FIELD[c.code]],
                  where: tr.where[WHERE[c.code]],
                  note: noteFor(c.code, tr),
                  asked: cmp.asked,
                  allowed: cmp.allowed,
                };
              })}
            />
            <p className="mt-3 text-sm text-ink">
              {failedChecks.some((c) => WHERE[c.code] === "request") ? tr.nextStop : tr.nextStopOutside}
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm font-medium text-approve">{tr.allPassed}</p>
            {/* The rule an approval is closest to: the per-payment cap (only from this entry's terms). */}
            {m && capCheck && (
              <RuleRows
                rows={[
                  {
                    code: capCheck.code,
                    result: capCheck.result,
                    // A passed check reads as the rule's name, not its failure title.
                    title: t.ui.rules.full.perTxCap,
                    message: null,
                    field: tr.field.amount,
                    where: tr.where.request,
                    note: null,
                    asked: fmtUsd(entry.proposal.amountUsd),
                    allowed: tr.value.perPayment(fmtUsd(m.perTxCapUsd)),
                  },
                ]}
              />
            )}
          </>
        )}
      </section>

      {/* Payment: what happened after the approval (execution is its own state). */}
      {!stop && (
        <section aria-label={tr.payment} className="border-t border-line px-4 py-3">
          <h3 className="type-label text-muted-ink">{tr.payment}</h3>
          {failed ? (
            <p className="mt-1 flex items-start gap-2 text-sm font-medium text-danger">
              <StateGlyph glyph="triangle" className="mt-1 size-2.5 shrink-0" />
              {failedHeadline(entry, tr)}
            </p>
          ) : execution ? (
            <p className="mt-1 text-sm text-muted-ink">{t.ui.hint.execution[execution]}</p>
          ) : null}
          <dl className="mt-2 text-sm">
            <MoneyRow label={tr.rows.amount} value={fmtUsd(entry.proposal.amountUsd)} />
            <MoneyRow label={tr.rows.networkFee} hint={feeHint} value={feeValue} />
            {settled && entry.actualFeeUsd !== undefined && (
              <MoneyRow label={tr.rows.actualFee} hint={tr.rows.afterMining} value={fmtUsd(entry.actualFeeUsd)} />
            )}
            {/* A failed payment counts nothing (lib/view.ts spends approved | pending | settled only). */}
            <MoneyRow
              label={tr.rows.counted}
              hint={failed ? tr.rows.paymentFailed : undefined}
              value={fmtUsd(failed ? 0 : entry.totalUsd)}
              strong
            />
          </dl>
        </section>
      )}

      {/* Remaining budget: at decision time only when the stop reason recorded it; otherwise "now". */}
      {(atDecision || budgetNow) && (
        <dl className="space-y-1 border-t border-line px-4 py-2.5 text-sm">
          {atDecision && (
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <dt className="text-muted-ink">
                {tr.budget.atDecision} <span className="text-xs">({tr.budget.atDecisionHint})</span>
              </dt>
              <dd className="font-semibold text-ink tabular-nums">{atDecision}</dd>
            </div>
          )}
          {budgetNow && (
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <dt className="text-muted-ink" title={tr.budget.remainingNowHint}>
                {tr.budget.remainingNow}
              </dt>
              <dd className="text-ink tabular-nums">
                <span className="font-semibold">{fmtUsd(budgetNow.remainingUsd)}</span>{" "}
                <span className="text-muted-ink">{tr.budget.ofBudget(fmtUsd(budgetNow.budgetUsd))}</span>
              </dd>
            </div>
          )}
        </dl>
      )}

      <ChecksDisclosure checks={checks} />

      {/* Raw records and actions. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-2.5">
        <HashChip label={tr.hash.tx} what={tr.hash.txWhat} value={entry.txHash} href={entry.explorerUrl} emptyText={tr.hash.notBroadcast} />
        <HashChip label={tr.hash.receipt} what={tr.hash.receiptWhat} value={entry.receiptHash} />
        <HashChip label={tr.hash.mandate} what={tr.hash.mandateWhat} value={entry.mandateHash} />
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line bg-surface-2 px-4 py-2">
        <p className="min-w-0 text-xs text-muted-ink">
          {tr.recordedAs}
          <span className="type-id text-ink">{entry.id}</span>
          {stop ? <> · {tr.noBroadcast}</> : null}
          {settled && entry.settledAt ? <> · {tr.settledAt(f.time(entry.settledAt))}</> : null}
        </p>
        {(entry.explorerUrl || onOpenEvidence) && (
          <div className="flex flex-wrap items-center gap-2">
            {entry.explorerUrl && (
              <Button asChild variant="outline" size="sm" className="bg-surface">
                <a href={entry.explorerUrl} target="_blank" rel="noopener noreferrer">
                  {tr.viewOnEtherscan}
                  <ArrowUpRight aria-hidden />
                </a>
              </Button>
            )}
            {onOpenEvidence && (
              <Button type="button" variant="outline" size="sm" className="bg-surface" onClick={() => onOpenEvidence(entry)}>
                <FileSearch aria-hidden />
                {tr.openEvidence}
              </Button>
            )}
          </div>
        )}
      </footer>
    </article>
  );
}
