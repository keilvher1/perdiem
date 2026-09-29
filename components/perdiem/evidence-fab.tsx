"use client";

import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ChevronRight, FileCheck, ListChecks, Printer } from "lucide-react";
import type { AuditResponse, LedgerEntryView, MandateSummary } from "@/contracts/api";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { API_MODE, api, toApiClientError } from "@/lib/api-client";
import { fmtUsd } from "@/lib/format";
import { useFmt, useLocale, useT } from "@/lib/i18n/provider";
import {
  authorityState,
  decisionState,
  executionState,
  stateSpec,
  verificationState,
  type DecisionState,
  type ExecutionState,
  type FamilyStates,
  type StateFamily,
  type VerificationState,
} from "@/lib/ui-state";
import { cn } from "@/lib/utils";
import { useNow } from "@/hooks/use-now";
import { useResource } from "@/hooks/use-resource";
import type { BudgetFigures } from "./budget-breakdown";
import { CopyButton } from "./copy-button";
import { SELECTED_MARKER } from "./decision-ledger";
import { EvidenceActions } from "./evidence-actions";
import { StateBadge, TONE_TEXT } from "./state-badge";
import { StateGlyph } from "./state-glyph";
import { ErrorState } from "./states";
import { localizeReason } from "./stop-codes";

const LINK =
  "flex items-center justify-between gap-3 rounded-md px-2 py-2.5 text-sm font-medium text-cobalt outline-none transition-colors duration-150 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring";

/** Execution states counted in the drawer, in the order a payment moves through them. */
const EXECUTION_ORDER: ReadonlyArray<ExecutionState> = ["settled", "pending", "approved", "failed"];

type Checks =
  | { state: "idle" }
  | { state: "running"; last: AuditResponse["summary"] | null }
  | { state: "done"; result: AuditResponse; at: string }
  | { state: "error"; message: string };

type ScopeKey = "anchor" | "replay" | "payments";
type ScopeRow = {
  key: ScopeKey;
  state: VerificationState | null;
  detail: string | null;
};

// ---------------------------------------------------------------------------------------------
// "View this decision's evidence": use the page's own evidence panel when it has one (never a
// second EvidencePanel in the drawer), otherwise the audit page with ?d=.
// ---------------------------------------------------------------------------------------------

/** The element if it is rendered (display:none ancestors give no client rects). */
function shown(el: Element | null): HTMLElement | null {
  return el instanceof HTMLElement && el.getClientRects().length > 0 ? el : null;
}

/** The page's EvidencePanel for this entry (its root <section> carries data-entry-id). */
function findPanel(entryId: string): HTMLElement | null {
  return shown(document.querySelector(`section[data-entry-id="${CSS.escape(entryId)}"]`));
}

/** The DecisionLedger row for this entry (role="option" + data-entry-id). */
function findRow(entryId: string): HTMLElement | null {
  return shown(document.querySelector(`[role="option"][data-entry-id="${CSS.escape(entryId)}"]`));
}

/**
 * Scrolls so `el` starts just under the sticky app header, unless it already sits in the upper half.
 * Scrollable ancestors (a sticky evidence column that scrolls inside itself) are aligned first, so
 * the window scroll is computed from where the element really is.
 */
function bringIntoView(el: HTMLElement) {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(p).overflowY) && p.scrollHeight > p.clientHeight) {
      p.scrollTop += el.getBoundingClientRect().top - p.getBoundingClientRect().top;
    }
  }
  const header = document.querySelector<HTMLElement>("body > header");
  const offset = (header?.getBoundingClientRect().bottom ?? 0) + 12;
  const top = el.getBoundingClientRect().top;
  if (top >= offset && top <= window.innerHeight * 0.5) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({
    top: Math.max(0, window.scrollY + top - offset),
    behavior: reduce ? "auto" : "smooth",
  });
}

function focusPanel(panel: HTMLElement) {
  const heading = panel.querySelector<HTMLElement>("h2[tabindex]");
  if (heading) heading.focus({ preventScroll: true });
  bringIntoView(panel);
}

/** True when the page could show the entry's evidence (a visible panel, or a ledger row to select). */
function onPage(entryId: string): boolean {
  return findPanel(entryId) !== null || findRow(entryId) !== null;
}

function revealOnPage(entryId: string): boolean {
  const panel = findPanel(entryId);
  if (panel) {
    focusPanel(panel);
    return true;
  }
  const row = findRow(entryId);
  if (!row) return false;
  // Selecting the row lets the page open its panel (the stacked detail view on mobile).
  row.click();
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const p = findPanel(entryId);
      if (p) {
        focusPanel(p);
      } else {
        row.focus({ preventScroll: true });
        bringIntoView(row);
      }
    }),
  );
  return true;
}

// ---------------------------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------------------------

function SectionHeading({ id, children, aside }: { id?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h3 id={id} className="text-[15px] leading-6 font-semibold text-ink">
        {children}
      </h3>
      {aside}
    </div>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return <h4 className="type-label mb-2 text-muted-ink">{children}</h4>;
}

/** Budget, spent (pending inside it, already reserved) and remaining, exactly as the API returns them. */
function BudgetSummary({ budget }: { budget: BudgetFigures }) {
  const messages = useT();
  const b = messages.ui.budget;
  const t = messages.evidence.mandate;
  const pending = budget.pendingUsd > 0;
  const over = budget.remainingUsd < 0;
  const row = "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 px-3 py-2";
  return (
    <div>
      <SubHeading>{t.budget}</SubHeading>
      <dl className="divide-y divide-line rounded-lg border border-line text-sm">
        <div className={row}>
          <dt className="text-muted-ink">{b.budget}</dt>
          <dd className="text-right font-medium text-ink tabular-nums">{fmtUsd(budget.budgetUsd)}</dd>
        </div>
        <div className={row}>
          <dt className="text-muted-ink">{b.spent}</dt>
          <dd className="text-right font-medium text-ink tabular-nums">{fmtUsd(budget.spentUsd)}</dd>
          <dd
            className={cn(
              "col-span-2 mt-0.5 flex items-center gap-1.5 text-xs",
              pending ? "text-pending" : "text-muted-ink",
            )}
          >
            {pending && <StateGlyph glyph="clock" className="size-3" />}
            {pending ? t.pendingIncluded(fmtUsd(budget.pendingUsd)) : t.nonePending}
          </dd>
        </div>
        <div className={row}>
          <dt className="font-medium text-ink">{b.remaining}</dt>
          <dd className={cn("type-amount-sm text-right", over ? "text-danger" : "text-ink")}>
            {fmtUsd(budget.remainingUsd)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function CountItem<F extends StateFamily>({ family, state, n }: { family: F; state: FamilyStates[F]; n: number }) {
  const t = useT();
  const spec = stateSpec(family, state);
  const label = (t.ui.state[family] as Record<string, string>)[state as string] ?? String(state);
  return (
    <li className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <StateGlyph glyph={spec.glyph} className={cn("size-3", n > 0 ? TONE_TEXT[spec.tone] : "text-muted-ink")} />
      <span className={n > 0 ? "text-ink" : "text-muted-ink"}>
        <span className="sr-only">{t.ui.family[family]}: </span>
        {label}
      </span>
      <span className={cn("font-semibold tabular-nums", n > 0 ? "text-ink" : "text-muted-ink")}>{n}</span>
    </li>
  );
}

/** Decisions (approve / stop) and payments (execution of approvals) counted apart: never merged. */
function Counts({ ledger }: { ledger: LedgerEntryView[] }) {
  const t = useT().evidence.mandate;
  const decisions: Array<[DecisionState, number]> = [
    ["approve", ledger.filter((e) => decisionState(e) === "approve").length],
    ["stop", ledger.filter((e) => decisionState(e) === "stop").length],
  ];
  const payments: Array<[ExecutionState, number]> = EXECUTION_ORDER.map((s) => [
    s,
    ledger.filter((e) => executionState(e) === s).length,
  ]);
  const failed = payments.find(([s]) => s === "failed")?.[1] ?? 0;
  return (
    <div>
      <SubHeading>{t.counts}</SubHeading>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
        <dt className="text-muted-ink">{t.decisions}</dt>
        <dd>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {decisions.map(([s, n]) => (
              <CountItem key={s} family="decision" state={s} n={n} />
            ))}
          </ul>
        </dd>
        <dt className="text-muted-ink">{t.payments}</dt>
        <dd>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {payments.map(([s, n]) => (
              <CountItem key={s} family="execution" state={s} n={n} />
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted-ink">{t.paymentsHint}</p>
        </dd>
      </dl>
      {failed > 0 && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-danger">
          <StateGlyph glyph="triangle" className="mt-0.5 size-3" />
          {t.failed(failed)}
        </p>
      )}
    </div>
  );
}

/** The selected decision in one compact block; the full evidence stays on the page (one panel). */
function DecisionSummary({ entry, onView }: { entry: LedgerEntryView; onView: () => void }) {
  const messages = useT();
  const t = messages.evidence.decision;
  const ui = messages.ui;
  const f = useFmt();
  const locale = useLocale();
  const decision = decisionState(entry);
  const execution = executionState(entry);
  const merchant = entry.merchantName ?? entry.proposal.merchantId;
  const first = entry.reasons[0];
  // An approval passed all 12 checks; a stop shows its first recorded reason, like the ledger row.
  const reason =
    entry.decision === "APPROVE" ? ui.evidence.approved : first ? localizeReason(first, locale).message : "—";
  const more =
    entry.decision !== "APPROVE" && entry.reasons.length > 1 ? ui.ledger.more(entry.reasons.length - 1) : null;
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-line" data-selected-entry={entry.id}>
      <div className={cn("flex min-w-0 items-center gap-1 px-3 py-2 text-sm font-medium text-cobalt", SELECTED_MARKER)}>
        <span className="truncate">{ui.evidence.selected(entry.id)}</span>
        <CopyButton value={entry.id} label={messages.common.hash.copy(entry.id)} />
      </div>
      <div className="space-y-2.5 px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <StateBadge family="decision" state={decision} />
          {execution && <StateBadge family="execution" state={execution} />}
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-ink">{merchant}</p>
            <p className="text-xs text-muted-ink tabular-nums">{f.date(entry.at, true)}</p>
          </div>
          <p className="type-amount-sm shrink-0 text-right text-ink">
            <span className="sr-only">{t.amount}: </span>
            {fmtUsd(entry.proposal.amountUsd)}
          </p>
        </div>
        <p className="text-sm text-ink">
          {reason}
          {more && <span className="ml-1.5 text-muted-ink">{more}</span>}
        </p>
      </div>
      <div className="border-t border-line px-3 py-2.5">
        <Button type="button" onClick={onView} className="w-full sm:w-auto">
          {t.view}
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function scopeRows(checks: Checks, t: ReturnType<typeof useT>["evidence"]["checks"]): ScopeRow[] {
  if (checks.state !== "done") {
    // Nothing is "matched" before a check ran: not run (or running) for every scope.
    const state = verificationState(null, {
      running: checks.state === "running",
    });
    return (["anchor", "replay", "payments"] as const).map((key) => ({
      key,
      state,
      detail: null,
    }));
  }
  const r = checks.result;
  const anchor: ScopeRow =
    r.anchor.txHash === null
      ? {
          key: "anchor",
          state: verificationState(null, { verifiable: false }),
          detail: t.detail.notAnchored,
        }
      : {
          key: "anchor",
          state: verificationState(r.anchor.matches),
          detail: null,
        };
  const replayOk = r.replay.filter((x) => x.consistent && x.mandateHashMatches).length;
  const replay: ScopeRow =
    r.replay.length === 0
      ? { key: "replay", state: null, detail: t.detail.noDecisions }
      : {
          key: "replay",
          state: verificationState(replayOk === r.replay.length),
          detail: t.detail.count(replayOk, r.replay.length),
        };
  const txOk = r.transactions.filter(
    (x) => x.memoMatches && x.receiptHashMatches && x.recipientMatches && x.amountMatches,
  ).length;
  const payments: ScopeRow =
    r.transactions.length === 0
      ? { key: "payments", state: null, detail: t.detail.noPayments }
      : {
          key: "payments",
          state: verificationState(txOk === r.transactions.length),
          detail: t.detail.count(txOk, r.transactions.length),
        };
  return [anchor, replay, payments];
}

/** Failed boolean checks that the three scope rows account for (the rest: senders, mined). */
function failedInScopes(r: AuditResponse): number {
  const anchor = r.anchor.matches ? 0 : 1;
  const replay = r.replay.reduce((n, x) => n + (x.consistent ? 0 : 1) + (x.mandateHashMatches ? 0 : 1), 0);
  const tx = r.transactions.reduce(
    (n, x) => n + [x.memoMatches, x.receiptHashMatches, x.recipientMatches, x.amountMatches].filter((ok) => !ok).length,
    0,
  );
  return anchor + replay + tx;
}

/** Failed checks outside the three scopes (anchor/tx sender, mined): summary-only, no contract field. */
function failedElsewhere(r: AuditResponse): number {
  return Math.max(0, r.summary.total - r.summary.passed - failedInScopes(r));
}

/**
 * The overall line takes its state from what actually failed: red (mismatch) only for a scope that
 * mismatched or a failed check outside the scopes; dashed "can't verify" when the only gap is a
 * missing anchor; a match only when every check passed.
 */
function summaryState(r: AuditResponse, scopes: ScopeRow[]): VerificationState {
  if (r.summary.allVerified) return "match";
  if (failedElsewhere(r) > 0 || scopes.some((s) => s.state === "mismatch")) return "mismatch";
  return "unverifiable";
}

function ChecksResult({ checks, scopes }: { checks: Checks; scopes: ScopeRow[] }) {
  const t = useT().evidence.checks;
  const f = useFmt();
  if (checks.state === "idle") return null;
  if (checks.state === "running") {
    return checks.last ? (
      <span className="text-xs text-muted-ink tabular-nums">{t.last(checks.last.passed, checks.last.total)}</span>
    ) : null;
  }
  if (checks.state === "error") {
    return (
      <p role="alert" className="flex items-start gap-1.5 text-xs text-danger">
        <StateGlyph glyph="triangle" className="mt-0.5 size-3" />
        {t.error(checks.message)}
      </p>
    );
  }
  const { passed, total } = checks.result.summary;
  const spec = stateSpec("verification", summaryState(checks.result, scopes));
  return (
    <p
      role="status"
      className={cn("flex flex-wrap items-center gap-x-1.5 text-sm font-semibold tabular-nums", TONE_TEXT[spec.tone])}
    >
      <StateGlyph glyph={spec.glyph} className="size-3.5" />
      {t.passed(passed, total)}
      <span className="text-xs font-normal text-muted-ink">· {t.at(f.time(checks.at))}</span>
    </p>
  );
}

/**
 * The Evidence control and drawer for one mandate. The drawer keeps two things apart:
 *  - "This decision": the decision selected on the page (URL ?d=), as a compact summary with
 *    "View this decision's evidence" (the page's own evidence panel, or /audit/<id>?d=<entry>).
 *  - "All records for this mandate": budget, decision and payment counts, the two record files
 *    (byte-identical to scripts/export.ts) and "Run checks now" (one GET /api/audit/[id] on click,
 *    never polled). Everything is templated; no model call.
 * Mounted by AppShell on /traveler, /principal and /audit/<id> only; keyed by the mandate id.
 */
export function EvidenceFab({
  id,
  summary,
  onAuditPage,
}: {
  id: string;
  summary: MandateSummary | null;
  onAuditPage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [checks, setChecks] = useState<Checks>({ state: "idle" });
  /** Entry to show on the page once the drawer has closed (focus goes there, not back to the button). */
  const reveal = useRef<string | null>(null);
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("d");
  const now = useNow(30_000);
  const messages = useT();
  const t = messages.evidence;
  const decisionHeading = useId();
  const recordsHeading = useId();

  const loadRecords = useCallback(() => api.mandate(id), [id]);
  const records = useResource(open ? loadRecords : null);

  const runChecks = async () => {
    setChecks((c) => ({
      state: "running",
      last: c.state === "done" ? c.result.summary : null,
    }));
    try {
      const res = await api.audit(id);
      setChecks({ state: "done", result: res, at: new Date().toISOString() });
    } catch (e) {
      setChecks({ state: "error", message: toApiClientError(e).message });
    }
  };

  const detail = records.data?.mandate ?? null;
  const ledger = records.data?.ledger ?? [];
  const mandate = detail ?? summary;
  const selected = selectedId ? (ledger.find((e) => e.id === selectedId) ?? null) : null;
  // The audit link keeps ?d= unless the loaded records show the id is not in this mandate.
  const linkEntryId = selected?.id ?? (records.data ? null : selectedId);
  const auditHref = (entryId?: string | null) =>
    `/audit/${encodeURIComponent(id)}${entryId ? `?d=${encodeURIComponent(entryId)}` : ""}`;

  const viewDecision = (entryId: string) => {
    if (onPage(entryId)) {
      reveal.current = entryId;
      setOpen(false);
      return;
    }
    setOpen(false);
    router.push(auditHref(entryId));
  };

  const scopes = scopeRows(checks, t.checks);

  // One element (capture hooks click [data-evidence-fab]), two layouts, never over the page's content:
  //  - sm and up: a slim tab on the right edge, vertically centred, inside the 24 px page gutter, so it
  //    never rests on text, a sticky evidence column, a composer or the footer;
  //  - phones: the gutter is 16 px, too narrow for a 24 px target, so the control is an in-flow row
  //    right under the header (AppShell renders it between <header> and <main>).
  // Evidence per decision is also linked from each screen.
  const trigger = (
    <button
      type="button"
      data-evidence-fab=""
      aria-label={t.fab.ariaLabel(id)}
      className={cn(
        "flex items-center font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring print:hidden",
        "max-sm:h-10 max-sm:w-full max-sm:gap-2 max-sm:border-b max-sm:border-line max-sm:bg-surface-2 max-sm:px-4 max-sm:text-sm max-sm:text-cobalt max-sm:hover:bg-surface max-sm:focus-visible:ring-inset",
        "sm:fixed sm:top-1/2 sm:right-0 sm:z-40 sm:w-6 sm:-translate-y-1/2 sm:flex-col sm:justify-center sm:gap-1.5 sm:rounded-l-md sm:bg-primary sm:py-3 sm:text-xs sm:text-primary-foreground sm:hover:bg-primary/85 sm:focus-visible:ring-offset-2 sm:focus-visible:ring-offset-page",
      )}
    >
      <FileCheck aria-hidden className="size-4 shrink-0 sm:size-3.5" />
      <span className="shrink-0 sm:[writing-mode:vertical-rl]">{t.fab.button}</span>
      <span className="min-w-0 truncate text-xs font-normal text-muted-ink sm:hidden">{t.fab.hint}</span>
      <ChevronRight aria-hidden className="ml-auto size-4 shrink-0 text-muted-ink sm:hidden" />
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        closeLabel={messages.common.close}
        side="right"
        className="gap-0 bg-surface outline-none data-[side=right]:w-full data-[side=right]:sm:max-w-[30rem]"
        // Focus the drawer itself, not its first control (that would pop the mock-mode tooltip open).
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement | null)?.focus();
        }}
        onCloseAutoFocus={(e) => {
          const entryId = reveal.current;
          if (entryId === null) return;
          reveal.current = null;
          e.preventDefault();
          if (!revealOnPage(entryId)) router.push(auditHref(entryId));
        }}
      >
        <SheetHeader className="gap-1 border-b border-line px-4 pt-4 pb-3 pr-12 sm:px-5">
          <SheetTitle className="type-section text-ink">
            {t.drawer.title} <span className="text-muted-ink">·</span>{" "}
            <span className="font-mono font-medium">{id}</span>
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-ink">{t.drawer.description}</SheetDescription>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {mandate && <StateBadge family="authority" state={authorityState(mandate, now)} />}
            <span
              className={cn(
                "inline-flex h-6 items-center rounded-md border px-1.5 text-xs font-medium",
                API_MODE === "live"
                  ? "border-cobalt-line bg-cobalt-soft text-cobalt"
                  : "border-dashed border-line-strong text-muted-ink",
              )}
            >
              {API_MODE === "live" ? t.drawer.live : t.drawer.mock}
            </span>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* 1 · The decision selected on the page (?d=) */}
          <section aria-labelledby={decisionHeading} className="px-4 py-5 sm:px-5">
            <SectionHeading id={decisionHeading}>{t.decision.title}</SectionHeading>
            {selectedId === null ? (
              <div className="mt-2 rounded-lg border border-dashed border-line-strong px-3 py-3">
                <p className="text-sm font-medium text-ink">{t.decision.none}</p>
                <p className="mt-0.5 text-sm text-muted-ink">{t.decision.noneHint}</p>
              </div>
            ) : records.loading ? (
              <Skeleton className="mt-3 h-44 rounded-lg" />
            ) : selected ? (
              <DecisionSummary entry={selected} onView={() => viewDecision(selected.id)} />
            ) : records.data ? (
              <p className="mt-2 text-sm text-muted-ink">{t.decision.notFound(selectedId)}</p>
            ) : records.error ? (
              <p className="mt-2 flex items-start gap-1.5 text-sm text-danger">
                <StateGlyph glyph="triangle" className="mt-1 size-3" />
                {t.decision.loadError}
              </p>
            ) : null}
          </section>

          {/* 2 · The whole mandate record */}
          <section aria-labelledby={recordsHeading} className="border-t border-line px-4 py-5 sm:px-5">
            <SectionHeading
              id={recordsHeading}
              aside={
                records.data ? (
                  <span className="text-sm text-muted-ink tabular-nums">{t.mandate.recorded(ledger.length)}</span>
                ) : null
              }
            >
              {t.mandate.title}
            </SectionHeading>

            <div className="mt-4 space-y-6">
              {mandate && <BudgetSummary budget={mandate} />}

              {records.loading ? (
                <div className="space-y-2" aria-busy="true" aria-label={t.drawer.loading}>
                  <Skeleton className="h-4 w-1/3 rounded" />
                  <Skeleton className="h-14 rounded-lg" />
                </div>
              ) : records.error && !records.data ? (
                <ErrorState
                  title={t.drawer.loadError}
                  error={records.error}
                  onRetry={records.refresh}
                  retrying={records.refreshing}
                />
              ) : records.data ? (
                <Counts ledger={ledger} />
              ) : null}

              <section aria-label={t.download.title}>
                <SubHeading>{t.download.title}</SubHeading>
                <p className="mb-3 text-xs text-muted-ink">{t.download.explain}</p>
                <EvidenceActions
                  id={id}
                  records={records.data}
                  loading={records.loading || records.refreshing}
                  error={records.error}
                  onRetry={records.refresh}
                />
              </section>

              <section aria-label={t.checks.region}>
                <SubHeading>{t.checks.title}</SubHeading>
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {scopes.map((s) => (
                    <li key={s.key} className="flex items-start justify-between gap-3 px-3 py-2">
                      <span className="min-w-0 pt-0.5 text-sm text-ink">{t.checks.scope[s.key]}</span>
                      <span className="flex shrink-0 flex-col items-end gap-0.5">
                        {s.state && <StateBadge family="verification" state={s.state} />}
                        {s.detail && <span className="text-xs text-muted-ink tabular-nums">{s.detail}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="bg-surface"
                    onClick={() => void runChecks()}
                    disabled={checks.state === "running"}
                  >
                    <ListChecks aria-hidden />
                    {checks.state === "running" ? t.checks.running : t.checks.run}
                  </Button>
                  <ChecksResult checks={checks} scopes={scopes} />
                </div>
                {checks.state === "done" && failedElsewhere(checks.result) > 0 && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-danger">
                    <StateGlyph glyph="triangle" className="mt-0.5 size-3" />
                    {t.checks.other(failedElsewhere(checks.result))}
                  </p>
                )}
                {checks.state === "done" && API_MODE === "mock" && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-unverified">
                    <StateGlyph glyph="dashed-slash" className="mt-0.5 size-3" />
                    {t.checks.mock}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-ink">
                  {t.checks.explain}
                  {checks.state === "done" && <> {t.checks.totalNote}</>}
                </p>
              </section>
            </div>
          </section>

          <nav aria-label={t.links.region} className="border-t border-line px-2 py-2 sm:px-3">
            <ul>
              {!onAuditPage && (
                <li>
                  <Link href={auditHref(linkEntryId)} onClick={() => setOpen(false)} className={LINK}>
                    {linkEntryId ? t.links.auditDecision : t.links.audit}
                    <ArrowRight aria-hidden className="size-4 shrink-0" />
                  </Link>
                </li>
              )}
              <li>
                <Link href={`/audit/${encodeURIComponent(id)}/report`} onClick={() => setOpen(false)} className={LINK}>
                  <span className="inline-flex items-center gap-2">
                    <Printer aria-hidden className="size-4 shrink-0" />
                    {t.links.statement}
                  </span>
                  <ArrowRight aria-hidden className="size-4 shrink-0" />
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
