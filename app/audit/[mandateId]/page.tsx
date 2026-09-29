"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronRight, Printer, RefreshCw, SquareTerminal } from "lucide-react";
import type { AuditResponse, LedgerEntryView, MandateDetailResponse, StopReason, TxCheck } from "@/contracts/api";
import { API_MODE, api } from "@/lib/api-client";
import { fmtHash, fmtUsd } from "@/lib/format";
import type { Messages } from "@/lib/i18n/messages";
import { useFmt, useT } from "@/lib/i18n/provider";
import { decisionState, executionState, verificationState, type VerificationState } from "@/lib/ui-state";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SELECTED_MARKER } from "@/components/perdiem/decision-ledger";
import { TableShell, Tbl, Td, Th, THead, Tr } from "@/components/perdiem/data-table";
import { EvidenceActions } from "@/components/perdiem/evidence-actions";
import { EvidencePanel } from "@/components/perdiem/evidence-panel";
import { HashChip } from "@/components/perdiem/hash-chip";
import { JsonView } from "@/components/perdiem/json-view";
import { PageContainer, PageHeader } from "@/components/perdiem/page";
import { StateBadge } from "@/components/perdiem/state-badge";
import { StateGlyph } from "@/components/perdiem/state-glyph";
import { EmptyState, ErrorState } from "@/components/perdiem/states";
import { useNow } from "@/hooks/use-now";
import { useResource, type Resource } from "@/hooks/use-resource";

/*
 * /audit/[mandateId] — "which records were verified how, and what matches or not?"
 *
 * Top to bottom (mobile the same): verification result + the record set it used → the checks that
 * do not match (only when some fail) → area 1, mandate hash vs anchor → areas 2 and 3 per decision
 * (list + the selected decision's audit and evidence, synced to ?d=) → verify it yourself.
 *
 * Every state comes from GET /api/audit/[id] (AuditResponse): nothing reads as a match before that
 * response arrived (loading and re-running = "running"; a failed request = "not run"). The decision
 * list and the evidence come from GET /api/mandates/[id] (the audit response carries no entries).
 */

type AreaKey = "anchor" | "replay" | "payments" | "payerMined";

interface AreaResult {
  key: AreaKey;
  ok: number;
  of: number;
  /** null = nothing to check (no entries / no payments). */
  state: VerificationState | null;
}

/** Where each area's details live on this page. */
const AREA_TARGET: Record<AreaKey, string> = {
  anchor: "audit-anchor",
  replay: "audit-decisions",
  payments: "audit-payments",
  payerMined: "audit-verify",
};

const txFieldsMatch = (x: TxCheck) => x.memoMatches && x.receiptHashMatches && x.recipientMatches && x.amountMatches;

/**
 * False when the server could not read the transaction from Sepolia (app/api/_lib/audit.ts keeps its
 * defaults then: memo "", to null, valueUsd 0, recipient / amount / memo false). A payment always
 * has a recipient, so `to` null with an empty memo means nothing was read: its value is not $0.00
 * and its recipient, amount and memo were never compared (the receipt hash is recomputed from the
 * records alone and stays a real check).
 */
const txRead = (x: TxCheck) => x.to !== null || x.memo !== "";

/** The anchor transaction exists but could not be read (memo null): nothing was compared. */
const anchorUnread = (a: AuditResponse["anchor"]) => a.txHash !== null && a.memo === null;

/**
 * Splits summary.passed / summary.total into the named areas. The anchor memo, the replay pairs and
 * the four payment fields have per-row results in the contract; the server also counts the anchor
 * sender and each payment's sender and "mined and succeeded" (app/api/audit/[mandateId]/route.ts),
 * which it returns as part of the total only, so they form their own group and the groups always
 * add up to the headline.
 */
function computeAreas(audit: AuditResponse | null, running: boolean): AreaResult[] {
  if (!audit) {
    const state: VerificationState = running ? "running" : "not_run";
    return (["anchor", "replay", "payments"] as const).map((key) => ({
      key,
      ok: 0,
      of: 0,
      state,
    }));
  }
  const anchorOk = Number(audit.anchor.matches);
  const replayOf = audit.replay.length * 2;
  const replayOk = audit.replay.reduce((a, r) => a + Number(r.consistent) + Number(r.mandateHashMatches), 0);
  const txOf = audit.transactions.length * 4;
  const txOk = audit.transactions.reduce(
    (a, x) => a + Number(x.memoMatches) + Number(x.receiptHashMatches) + Number(x.recipientMatches) + Number(x.amountMatches),
    0,
  );
  const extraOf = audit.summary.total - (1 + replayOf + txOf);
  const extraOk = audit.summary.passed - (anchorOk + replayOk + txOk);
  const stateOf = (ok: number, of: number): VerificationState | null =>
    running ? "running" : of === 0 ? null : verificationState(ok === of);
  // Unread payments fail recipient, amount and memo without a comparison: when those are the only
  // failures in the area, it could not be verified rather than found not to match.
  const unreadFails = audit.transactions.filter((x) => !txRead(x)).length * 3;
  const txFails = txOf - txOk;
  const areas: AreaResult[] = [
    {
      key: "anchor",
      ok: anchorOk,
      of: 1,
      state: running
        ? "running"
        : !audit.anchor.txHash || anchorUnread(audit.anchor)
          ? "unverifiable"
          : verificationState(audit.anchor.matches),
    },
    {
      key: "replay",
      ok: replayOk,
      of: replayOf,
      state: stateOf(replayOk, replayOf),
    },
    {
      key: "payments",
      ok: txOk,
      of: txOf,
      state: !running && txFails > 0 && txFails === unreadFails ? "unverifiable" : stateOf(txOk, txOf),
    },
  ];
  // An unread anchor or payment always fails its sender check (nothing was read to compare): when
  // those are the only failures here, the group could not be verified rather than did not match.
  const senderUnread = Number(anchorUnread(audit.anchor)) + audit.transactions.filter((x) => !txRead(x)).length;
  const extraFails = extraOf - extraOk;
  if (extraOf > 0)
    areas.push({
      key: "payerMined",
      ok: Math.max(0, extraOk),
      of: extraOf,
      state: !running && extraFails > 0 && extraFails === senderUnread ? "unverifiable" : stateOf(extraOk, extraOf),
    });
  return areas;
}

/**
 * "unverifiable" only when every failed check is explained by a record that is missing or could not
 * be read, as app/api/_lib/audit.ts fails them: no anchor (1: memo), an unread anchor (2: memo and
 * sender), an unread payment (4: recipient, amount, memo and sender). Anything else, including a
 * failed "mined" check the API does not attribute, stays a mismatch.
 */
function overallState(audit: AuditResponse | null, running: boolean): VerificationState {
  if (running) return "running";
  if (!audit) return "not_run";
  if (audit.summary.allVerified) return "match";
  const failed = audit.summary.total - audit.summary.passed;
  const explained =
    (!audit.anchor.txHash ? 1 : anchorUnread(audit.anchor) ? 2 : 0) +
    audit.transactions.filter((x) => !txRead(x) && x.receiptHashMatches).length * 4;
  const hard =
    (audit.anchor.txHash && !anchorUnread(audit.anchor) && !audit.anchor.matches) ||
    audit.replay.some((r) => !r.consistent || !r.mandateHashMatches) ||
    audit.transactions.some((x) => !x.receiptHashMatches || (txRead(x) && !txFieldsMatch(x)));
  return !hard && explained > 0 && failed === explained ? "unverifiable" : "mismatch";
}

function headlineOf(audit: AuditResponse, t: Messages): string {
  const { passed, total, allVerified } = audit.summary;
  return allVerified ? t.audit.checksPassed(passed, total) : t.audit.checksFailed(total - passed, total);
}

interface AttentionItem {
  key: string;
  area: AreaKey;
  state: VerificationState;
  text: string;
  entryId?: string;
}

/** Every check that does not match, from the audit response only. */
function attentionItems(
  audit: AuditResponse,
  areas: AreaResult[],
  t: Messages,
  entries: LedgerEntryView[] | null,
): AttentionItem[] {
  const A = t.audit.page.attention;
  const out: AttentionItem[] = [];
  if (!audit.anchor.txHash)
    out.push({
      key: "anchor",
      area: "anchor",
      state: "unverifiable",
      text: A.notAnchored,
    });
  else if (anchorUnread(audit.anchor))
    out.push({
      key: "anchor",
      area: "anchor",
      state: "unverifiable",
      text: A.anchorUnread,
    });
  else if (!audit.anchor.matches)
    out.push({
      key: "anchor",
      area: "anchor",
      state: "mismatch",
      text: A.anchor,
    });
  for (const r of audit.replay) {
    if (!r.consistent)
      out.push({
        key: `${r.entryId}:decision`,
        area: "replay",
        state: "mismatch",
        text: A.decision,
        entryId: r.entryId,
      });
    if (!r.mandateHashMatches)
      out.push({
        key: `${r.entryId}:hash`,
        area: "replay",
        state: "mismatch",
        text: A.hash,
        entryId: r.entryId,
      });
  }
  for (const x of audit.transactions) {
    const read = txRead(x);
    if (!read)
      out.push({
        key: `${x.entryId}:unread`,
        area: "payments",
        state: "unverifiable",
        text: A.unread,
        entryId: x.entryId,
      });
    // Unread: recipient, amount and memo were never compared (one item above); the receipt hash
    // is recomputed from the records alone, so it stays its own check.
    const fields: ["recipient" | "amount" | "memo" | "receipt", boolean][] = read
      ? [
          ["recipient", x.recipientMatches],
          ["amount", x.amountMatches],
          ["memo", x.memoMatches],
          ["receipt", x.receiptHashMatches],
        ]
      : [["receipt", x.receiptHashMatches]];
    for (const [k, ok] of fields) {
      if (!ok)
        out.push({
          key: `${x.entryId}:${k}`,
          area: "payments",
          state: "mismatch",
          text: A[k],
          entryId: x.entryId,
        });
    }
  }
  const extra = areas.find((a) => a.key === "payerMined");
  if (extra && extra.state && extra.ok < extra.of) {
    // A payment not mined and succeeded fails "mined": name how many the ledger still shows as
    // pending or failed (a hint from the records, not an attribution the API makes).
    const unsettled = audit.transactions.filter((x) => {
      const s = entries?.find((e) => e.id === x.entryId)?.status;
      return s === "pending" || s === "failed";
    }).length;
    out.push({
      key: "payerMined",
      area: "payerMined",
      state: extra.state,
      text: unsettled > 0 ? `${A.payerMined(extra.of - extra.ok, extra.of)} ${A.payerMinedHint(unsettled)}` : A.payerMined(extra.of - extra.ok, extra.of),
    });
  }
  return out;
}

const sameCodes = (a: StopReason[], b: StopReason[]) => {
  const x = [...new Set(a.map((r) => r.code))].sort();
  const y = [...new Set(b.map((r) => r.code))].sort();
  return x.length === y.length && x.every((c, i) => c === y[i]);
};

/** True where the evidence column sits next to the list (Tailwind `lg`). Read at event time only. */
function isSideBySide(): boolean {
  try {
    return window.matchMedia("(min-width: 64rem)").matches;
  } catch {
    return true;
  }
}

function decodeId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/* ------------------------------------------------------------------------------------------------ */
/* Small pieces                                                                                      */
/* ------------------------------------------------------------------------------------------------ */

function SectionHeader({
  id,
  n,
  title,
  description,
  aside,
}: {
  id: string;
  n: string;
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h2 id={id} className="type-section flex items-baseline gap-2 text-ink">
          <span aria-hidden className="text-sm font-medium text-muted-ink tabular-nums">
            {n}
          </span>
          {title}
        </h2>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted-ink">{description}</p>}
      </div>
      {aside}
    </div>
  );
}

/** One labelled value in a check: Expected / Observed / Source, with an optional caption. */
function Field({ label, caption, children }: { label: string; caption?: ReactNode; children: ReactNode }) {
  return (
    <>
      <dt className="pt-0.5 text-xs text-muted-ink">{label}</dt>
      <dd className="min-w-0 text-sm text-ink">
        {children}
        {caption && <span className="mt-0.5 block text-xs text-muted-ink">{caption}</span>}
      </dd>
    </>
  );
}

/** A label above its value (the record set in the summary). */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-ink">{label}</dt>
      <dd className="mt-0.5 min-w-0 text-ink">{children}</dd>
    </div>
  );
}

function Codes({ reasons }: { reasons: StopReason[] }) {
  if (reasons.length === 0) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-x-1.5 gap-y-0.5">
      {reasons.map((r, i) => (
        <span key={`${r.code}-${i}`} className="type-id text-[11px] text-muted-ink">
          [{r.code}]
        </span>
      ))}
    </span>
  );
}

function Memo({ value }: { value: string }) {
  // A hash string, not prose: breaking anywhere is the only way it fits.
  return <code className="type-id block text-[11px] leading-4 break-all text-ink">{value}</code>;
}

function Note({ state, children, className }: { state: "mismatch" | "unverifiable"; children: ReactNode; className?: string }) {
  const look = {
    mismatch: {
      glyph: "triangle",
      cls: "border-danger-line bg-danger-soft",
      glyphCls: "text-danger",
    },
    unverifiable: {
      glyph: "dashed-slash",
      cls: "border-dashed border-unverified-line bg-unverified-soft",
      glyphCls: "text-unverified",
    },
  } as const;
  const l = look[state];
  return (
    <p role="status" className={cn("flex items-start gap-2 rounded-md border px-3 py-2 text-sm text-ink", l.cls, className)}>
      <StateGlyph glyph={l.glyph} className={cn("mt-1 size-3", l.glyphCls)} />
      <span>{children}</span>
    </p>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Verification result and the record set                                                            */
/* ------------------------------------------------------------------------------------------------ */

function Summary({
  mandateId,
  audit,
  running,
  checkedAt,
  now,
  areas,
}: {
  mandateId: string;
  audit: AuditResponse | null;
  running: boolean;
  checkedAt: number | null;
  now: number | null;
  areas: AreaResult[];
}) {
  const t = useT();
  const f = useFmt();
  const S = t.audit.page.summary;
  const overall = overallState(audit, running);
  const headline = running ? S.running : audit ? headlineOf(audit, t) : S.notRun;
  const sub = running && audit ? S.previous(headlineOf(audit, t)) : S.recomputes;
  const checkedIso = checkedAt !== null ? new Date(checkedAt).toISOString() : null;
  const pending = <Skeleton className="inline-block h-4 w-24 rounded-sm align-middle" />;
  const value = (v: ReactNode) => (audit && !running ? v : running ? pending : "—");

  return (
    <section aria-labelledby="audit-summary-h" className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="px-5 py-5 sm:px-6">
          <h2 id="audit-summary-h" className="type-label text-muted-ink">
            {S.title}
          </h2>
          <div className="mt-3">
            <StateBadge family="verification" state={overall} size="md" />
          </div>
          <p
            role="status"
            className={cn(
              "mt-2 text-2xl font-semibold tracking-tight tabular-nums md:text-[1.75rem] md:leading-9",
              overall === "mismatch" ? "text-danger" : "text-ink",
            )}
          >
            {headline}
          </p>
          <p className="mt-1 text-sm text-muted-ink">{sub}</p>
        </div>

        <div className="border-t border-line px-5 py-5 sm:px-6 lg:border-t-0 lg:border-l">
          <h3 className="type-label text-muted-ink">{S.records}</h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3.5 text-sm">
            <Fact label={S.checked}>
              {checkedIso && audit && !running ? (
                <span className="tabular-nums">
                  <time dateTime={checkedIso}>{f.date(checkedIso, true)}</time>
                  {/* A past event: never "in 30 s" when the clock tick lags the response. */}
                  <span className="text-muted-ink"> · {f.rel(checkedIso, now === null ? null : Math.max(now, checkedAt!))}</span>
                </span>
              ) : running ? (
                pending
              ) : (
                "—"
              )}
            </Fact>
            <Fact label={S.source}>
              {API_MODE === "live" ? (
                S.live
              ) : (
                <span className="inline-flex items-start gap-1.5 font-medium text-unverified">
                  <StateGlyph glyph="dashed-slash" className="mt-1 size-3" />
                  {S.mock}
                </span>
              )}
            </Fact>
            <Fact label={S.mandate}>
              <span className="type-id">{mandateId}</span>
            </Fact>
            <Fact label={S.recomputedHash}>
              {value(audit ? <HashChip value={audit.mandateHash} what={t.audit.page.anchor.hashWhat} /> : null)}
            </Fact>
            <Fact label={S.entries}>
              <span className="tabular-nums">{value(audit ? f.int(audit.replay.length) : null)}</span>
            </Fact>
            <Fact label={S.payments}>
              <span className="tabular-nums">{value(audit ? f.int(audit.transactions.length) : null)}</span>
            </Fact>
          </dl>
        </div>
      </div>

      <div className="border-t border-line">
        <h3 className="type-label px-5 pt-4 text-muted-ink sm:px-6">{S.areas}</h3>
        <ol className="mt-2 divide-y divide-line">
          {areas.map((a, i) => (
            <li key={a.key}>
              <AreaRow area={a} n={a.key === "payerMined" ? "+" : String(i + 1)} audit={audit} running={running} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function AreaRow({ area, n, audit, running }: { area: AreaResult; n: string; audit: AuditResponse | null; running: boolean }) {
  const t = useT();
  const copy = t.audit.areas[area.key];
  const count =
    running || !audit
      ? "—"
      : area.of === 0
        ? t.audit.count.none
        : area.ok === area.of
          ? t.audit.count.passed(area.ok, area.of)
          : t.audit.count.failed(area.of - area.ok, area.of);
  const note =
    audit && !running
      ? area.key === "anchor" && !audit.anchor.txHash
        ? t.audit.notAnchoredNote
        : area.key === "replay" && area.of === 0
          ? t.audit.empty.replay
          : area.key === "payments" && area.of === 0
            ? t.audit.empty.payments
            : null
      : null;
  return (
    <a
      href={`#${AREA_TARGET[area.key]}`}
      className="group grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 px-5 py-3.5 outline-none transition-colors duration-150 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:grid-cols-[1.5rem_minmax(0,1fr)_auto] sm:items-center sm:px-6"
    >
      <span aria-hidden className="text-sm font-medium text-muted-ink tabular-nums sm:self-start sm:pt-px">
        {n}
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-ink">{copy.title}</span>
        <span className="mt-0.5 block text-sm text-muted-ink">{copy.scope}</span>
        {note && <span className="mt-1 block text-sm text-ink">{note}</span>}
      </span>
      <span className="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-1 sm:col-start-auto sm:justify-end">
        <span className="text-sm text-ink tabular-nums">{count}</span>
        {area.state && <StateBadge family="verification" state={area.state} />}
        <ChevronRight
          aria-hidden
          className="hidden size-4 text-muted-ink transition-transform duration-150 group-hover:translate-x-0.5 sm:block"
        />
      </span>
    </a>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Needs attention (only when a check fails)                                                         */
/* ------------------------------------------------------------------------------------------------ */

function Attention({ items, onShow }: { items: AttentionItem[]; onShow: (entryId: string) => void }) {
  const t = useT();
  const A = t.audit.page.attention;
  // Red only when something did not match; records that could not be checked read as not established.
  const alarm = items.some((it) => it.state === "mismatch");
  return (
    <section
      aria-labelledby="audit-attention-h"
      className={cn(
        "overflow-hidden rounded-lg border bg-surface",
        alarm ? "border-danger-line" : "border-dashed border-unverified-line",
      )}
    >
      <div
        className={cn(
          "border-b px-5 py-3 sm:px-6",
          alarm ? "border-danger-line bg-danger-soft" : "border-dashed border-unverified-line bg-unverified-soft",
        )}
      >
        <h2
          id="audit-attention-h"
          className={cn("flex items-center gap-2 font-semibold", alarm ? "text-danger" : "text-unverified")}
        >
          <StateGlyph glyph={alarm ? "triangle" : "dashed-slash"} className="size-3.5" />
          {A.title}
        </h2>
        <p className="mt-0.5 text-sm text-ink">{alarm ? A.intro : A.introUnverified}</p>
      </div>
      <ul className="divide-y divide-line">
        {items.map((it) => (
          <li key={it.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 sm:px-6">
            <StateBadge family="verification" state={it.state} />
            <span className="min-w-0 flex-1 text-sm">
              <span className="block text-xs text-muted-ink">
                {t.audit.areas[it.area].title}
                {it.entryId && (
                  <>
                    {" · "}
                    <span className="type-id text-[11px]">{it.entryId}</span>
                  </>
                )}
              </span>
              <span className="text-ink">{it.text}</span>
            </span>
            {it.entryId && (
              <Button type="button" variant="outline" size="sm" onClick={() => onShow(it.entryId!)}>
                {A.show}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Area 1 · Mandate hash vs on-chain anchor                                                          */
/* ------------------------------------------------------------------------------------------------ */

function AnchorCheck({ audit, running, area }: { audit: AuditResponse | null; running: boolean; area: AreaResult }) {
  const t = useT();
  const X = t.audit.page.anchor;
  const [showTerms, setShowTerms] = useState(false);
  const pending = <Skeleton className="h-6 w-40 rounded-md" />;
  const ready = audit !== null && !running;
  const storedSame = audit ? audit.mandate.hash.toLowerCase() === audit.mandateHash.toLowerCase() : null;
  const m = audit?.mandate;
  const terms = m
    ? {
        id: m.id,
        principal: m.principal,
        traveler: m.traveler,
        agentWallet: m.agentWallet,
        budgetUsd: m.budgetUsd,
        perTxCapUsd: m.perTxCapUsd,
        allowedMerchantIds: m.allowedMerchantIds,
        allowedCategories: m.allowedCategories,
        blockedKeywords: m.blockedKeywords,
        startsAt: m.startsAt,
        expiresAt: m.expiresAt,
        catalog: m.catalog,
        status: m.status,
      }
    : null;
  const show = (v: ReactNode) => (ready ? v : running ? pending : "—");

  return (
    <section id="audit-anchor" aria-labelledby="audit-anchor-h">
      <SectionHeader id="audit-anchor-h" n="1" title={t.audit.areas.anchor.title} description={X.rule} />
      <div className="rounded-lg border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3 sm:px-6">
          <p className="text-sm font-medium text-ink">{X.check}</p>
          {area.state && <StateBadge family="verification" state={area.state} />}
        </div>
        <dl className="grid gap-x-5 gap-y-3 px-5 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:px-6">
          <Field label={X.expected} caption={X.expectedCaption}>
            {show(audit ? <HashChip value={audit.mandateHash} what={X.hashWhat} /> : null)}
          </Field>
          <Field label={X.observed} caption={X.observedCaption}>
            {show(
              audit ? (
                audit.anchor.memo ? (
                  <Memo value={audit.anchor.memo} />
                ) : (
                  <span className="text-muted-ink">
                    {!audit.anchor.txHash ? t.audit.notAnchored : anchorUnread(audit.anchor) ? X.unread : X.noMemo}
                  </span>
                )
              ) : null,
            )}
          </Field>
          <Field label={X.source} caption={X.sourceCaption}>
            {show(
              audit ? (
                <HashChip
                  value={audit.anchor.txHash}
                  href={audit.anchor.explorerUrl}
                  what={X.anchorWhat}
                  emptyText={t.audit.notAnchored}
                />
              ) : null,
            )}
          </Field>
          <Field
            label={X.storedHash}
            caption={
              ready && storedSame !== null ? (
                <span className={cn("inline-flex items-center gap-1.5", storedSame ? "text-muted-ink" : "text-danger")}>
                  <StateGlyph
                    glyph={storedSame ? "circle-check" : "triangle"}
                    className={cn("size-3", storedSame && "text-approve")}
                  />
                  {storedSame ? X.storedSame : X.storedDiffers}
                </span>
              ) : undefined
            }
          >
            {show(audit ? <HashChip value={audit.mandate.hash} what={X.storedWhat} /> : null)}
          </Field>
        </dl>
        {terms && (
          <div className="border-t border-line px-5 py-3 sm:px-6">
            <button
              type="button"
              aria-expanded={showTerms}
              onClick={() => setShowTerms((o) => !o)}
              className="-ml-2 inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-cobalt outline-none hover:bg-cobalt-soft focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight aria-hidden className={cn("size-4 transition-transform duration-150", showTerms && "rotate-90")} />
              {showTerms ? X.hideTerms : X.showTerms}
            </button>
            {showTerms && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-muted-ink">{X.termsNote}</p>
                <JsonView value={terms} collapsed={["catalog"]} note={{ status: X.statusNote }} className="max-h-[420px]" />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Areas 2 + 3 · the decision list                                                                   */
/* ------------------------------------------------------------------------------------------------ */

interface EntryAudit {
  replay: VerificationState;
  hash: VerificationState;
  /** null = no chain record to check (a stop, or an approval not broadcast yet). */
  chain: VerificationState | null;
}

function entryAudit(e: LedgerEntryView, audit: AuditResponse | null, running: boolean): EntryAudit {
  const r = audit?.replay.find((x) => x.entryId === e.id) ?? null;
  const x = audit?.transactions.find((y) => y.entryId === e.id) ?? null;
  const base: VerificationState = running ? "running" : "not_run";
  return {
    replay: running || !r ? base : verificationState(r.consistent),
    hash: running || !r ? base : verificationState(r.mandateHashMatches),
    chain:
      e.decision === "STOP" || !e.txHash
        ? null
        : running || !x
          ? base
          : !txRead(x)
            ? x.receiptHashMatches
              ? "unverifiable"
              : "mismatch"
            : verificationState(txFieldsMatch(x)),
  };
}

function DecisionRow({
  entry,
  n,
  checks,
  selected,
  tabbable,
  rowRef,
  onSelect,
  onKeyDown,
  onFocus,
}: {
  entry: LedgerEntryView;
  n: number;
  checks: EntryAudit;
  selected: boolean;
  tabbable: boolean;
  rowRef: (el: HTMLDivElement | null) => void;
  onSelect: () => void;
  onKeyDown: (ev: KeyboardEvent<HTMLDivElement>) => void;
  onFocus: () => void;
}) {
  const t = useT();
  const f = useFmt();
  const D = t.audit.page.decisions;
  const decision = decisionState(entry);
  const execution = executionState(entry);
  const category = entry.merchantCategory != null ? (t.common.category[entry.merchantCategory] ?? entry.merchantCategory) : "—";
  const time = (
    <time dateTime={entry.at} title={f.date(entry.at, true)}>
      {f.time(entry.at)}
    </time>
  );
  return (
    <div
      ref={rowRef}
      role="option"
      aria-selected={selected}
      tabIndex={tabbable ? 0 : -1}
      data-entry-id={entry.id}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      className={cn(
        "flex cursor-pointer gap-4 px-4 py-3 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        selected ? SELECTED_MARKER : "hover:bg-surface-2",
      )}
    >
      <div className="hidden w-[4.75rem] shrink-0 @xl:block">
        <p className="text-xs text-muted-ink tabular-nums">#{n}</p>
        <p className="text-sm text-ink tabular-nums">{time}</p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{entry.merchantName ?? entry.proposal.merchantId}</p>
            <p className="text-xs text-muted-ink">
              <span className="tabular-nums @xl:hidden">
                #{n} · {time} ·{" "}
              </span>
              {category} · <span className="font-mono">{entry.proposal.merchantId}</span> ·{" "}
              <span className="font-mono">{entry.id}</span>
            </p>
          </div>
          <p className="shrink-0 text-right text-sm font-medium text-ink tabular-nums">{fmtUsd(entry.proposal.amountUsd)}</p>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <StateBadge family="decision" state={decision} />
            {execution ? (
              <StateBadge family="execution" state={execution} />
            ) : (
              <span className="text-xs text-muted-ink">{t.ui.ledger.nothingSent}</span>
            )}
          </div>
          <dl className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs">
            <div className="flex items-center gap-1.5">
              <dt className="text-muted-ink">{D.replay}</dt>
              <dd>
                <StateBadge family="verification" state={checks.replay} variant="plain" />
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-muted-ink">{D.hash}</dt>
              <dd>
                <StateBadge family="verification" state={checks.hash} variant="plain" />
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-muted-ink">{D.chain}</dt>
              <dd>
                {checks.chain ? (
                  <StateBadge family="verification" state={checks.chain} variant="plain" />
                ) : (
                  <span className="text-muted-ink">{entry.decision === "STOP" ? D.noPayment : D.notBroadcast}</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

function DecisionList({
  entries,
  audit,
  running,
  selectedId,
  onSelect,
  rowRefs,
}: {
  entries: LedgerEntryView[];
  audit: AuditResponse | null;
  running: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  rowRefs: RefObject<Map<string, HTMLDivElement>>;
}) {
  const t = useT();
  const D = t.audit.page.decisions;
  const hintId = useId();
  const [focusId, setFocusId] = useState<string | null>(null);
  const tabId =
    (focusId && entries.some((e) => e.id === focusId) && focusId) ||
    (selectedId && entries.some((e) => e.id === selectedId) && selectedId) ||
    entries[0]?.id ||
    null;

  const focusRow = (id: string | undefined) => {
    if (!id) return;
    setFocusId(id);
    rowRefs.current.get(id)?.focus();
  };

  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>, index: number, id: string) => {
    switch (ev.key) {
      case "ArrowDown":
        ev.preventDefault();
        focusRow(entries[Math.min(entries.length - 1, index + 1)]?.id);
        break;
      case "ArrowUp":
        ev.preventDefault();
        focusRow(entries[Math.max(0, index - 1)]?.id);
        break;
      case "Home":
        ev.preventDefault();
        focusRow(entries[0]?.id);
        break;
      case "End":
        ev.preventDefault();
        focusRow(entries[entries.length - 1]?.id);
        break;
      case "Enter":
      case " ":
        ev.preventDefault();
        onSelect(id);
        break;
    }
  };

  return (
    <div className="@container overflow-hidden rounded-lg border border-line bg-surface">
      <p id={hintId} className="sr-only">
        {D.keyboard}
      </p>
      <div role="listbox" aria-label={D.listLabel} aria-describedby={hintId} className="divide-y divide-line">
        {entries.map((e, i) => (
          <DecisionRow
            key={e.id}
            entry={e}
            n={i + 1}
            checks={entryAudit(e, audit, running)}
            selected={e.id === selectedId}
            tabbable={e.id === tabId}
            rowRef={(el) => {
              if (el) rowRefs.current.set(e.id, el);
              else rowRefs.current.delete(e.id);
            }}
            onSelect={() => onSelect(e.id)}
            onKeyDown={(ev) => onKeyDown(ev, i, e.id)}
            onFocus={() => setFocusId(e.id)}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Areas 2 + 3 · the selected decision's audit (above its evidence)                                  */
/* ------------------------------------------------------------------------------------------------ */

function Block({ title, state, children }: { title: string; state: VerificationState | null; children: ReactNode }) {
  return (
    <div className="border-t border-line px-4 py-4 sm:px-5">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {state && <StateBadge family="verification" state={state} />}
      </div>
      {children}
    </div>
  );
}

function CheckLine({
  label,
  state,
  expected,
  expectedCaption,
  observed,
  observedCaption,
}: {
  label: string;
  state: VerificationState;
  expected: ReactNode;
  expectedCaption?: string;
  observed: ReactNode;
  observedCaption?: string;
}) {
  const C = useT().audit.page.card;
  return (
    <div className="border-t border-line py-2.5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">{label}</p>
        <StateBadge family="verification" state={state} variant="plain" />
      </div>
      <dl className="mt-1.5 grid gap-x-4 gap-y-2 text-sm @md:grid-cols-2">
        <Fact label={C.expected}>
          {expected}
          {expectedCaption && <span className="mt-0.5 block text-xs text-muted-ink">{expectedCaption}</span>}
        </Fact>
        <Fact label={C.observed}>
          {observed}
          {observedCaption && <span className="mt-0.5 block text-xs text-muted-ink">{observedCaption}</span>}
        </Fact>
      </dl>
    </div>
  );
}

function DecisionAudit({
  entry,
  audit,
  running,
  mandateId,
  headingRef,
}: {
  entry: LedgerEntryView;
  audit: AuditResponse | null;
  running: boolean;
  mandateId: string;
  headingRef: Ref<HTMLHeadingElement>;
}) {
  const t = useT();
  const C = t.audit.page.card;
  const headingId = useId();
  const r = audit?.replay.find((x) => x.entryId === entry.id) ?? null;
  const x = audit?.transactions.find((y) => y.entryId === entry.id) ?? null;
  const checks = entryAudit(entry, audit, running);
  const wallet = audit?.mandate.catalog.find((c) => c.id === entry.proposal.merchantId)?.wallet ?? null;
  const read = x ? txRead(x) : false;
  const unreadValue = <span className="text-muted-ink">—</span>;
  const principalHref = `/principal?m=${encodeURIComponent(mandateId)}&d=${encodeURIComponent(entry.id)}`;

  let verdict: ReactNode = null;
  if (!running && audit) {
    if (!r) verdict = <p className="text-sm text-muted-ink">{C.replay.notAudited}</p>;
    else if (!r.consistent)
      verdict = (
        <p className="flex items-start gap-2 text-sm font-medium text-danger">
          <StateGlyph glyph="triangle" className="mt-1 size-3" />
          {C.replay.differs}
        </p>
      );
    else if (entry.decision === "STOP")
      verdict = sameCodes(entry.reasons, r.recomputedReasons) ? (
        <p className="flex items-start gap-2 text-sm font-medium text-ink">
          <StateGlyph glyph="circle-check" className="mt-1 size-3 text-approve" />
          {C.replay.stopSame}
        </p>
      ) : (
        <p className="text-sm text-ink">{C.replay.stopCodesDiffer}</p>
      );
    else
      verdict = (
        <p className="flex items-start gap-2 text-sm font-medium text-ink">
          <StateGlyph glyph="circle-check" className="mt-1 size-3 text-approve" />
          {C.replay.approveSame}
        </p>
      );
  }

  return (
    <section aria-labelledby={headingId} className="@container overflow-hidden rounded-lg border border-line bg-surface">
      <header className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-5", SELECTED_MARKER)}>
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className="type-label text-muted-ink outline-none">
          {C.title}
        </h2>
        <span className="type-id text-cobalt">{entry.id}</span>
        <Link
          href={principalHref}
          className="ml-auto rounded-sm text-sm font-medium text-cobalt underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {C.openPrincipal}
        </Link>
      </header>

      <Block title={C.replay.title} state={checks.replay}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div className="min-w-0">
            <dt className="text-xs text-muted-ink">{C.replay.recorded}</dt>
            <dd className="mt-1">
              <StateBadge family="decision" state={decisionState(entry)} />
              <Codes reasons={entry.reasons} />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted-ink">{C.replay.recomputed}</dt>
            <dd className="mt-1">
              {r && !running ? (
                <>
                  <StateBadge family="decision" state={decisionState({ decision: r.recomputedDecision })} />
                  <Codes reasons={r.recomputedReasons} />
                </>
              ) : running ? (
                <Skeleton className="h-6 w-24 rounded-md" />
              ) : (
                <span className="text-sm text-muted-ink">—</span>
              )}
            </dd>
          </div>
        </dl>
        {verdict && <div className="mt-3">{verdict}</div>}
        <p className="mt-2 text-xs text-muted-ink">
          <span className="font-medium">{C.sourceLabel}</span>
          {C.replay.source}
        </p>
        {entry.decision === "APPROVE" && <p className="mt-1 text-xs text-muted-ink">{C.replay.pauseNote}</p>}
      </Block>

      <Block title={C.hash.title} state={checks.hash}>
        <dl className="grid gap-x-4 gap-y-2 text-sm @md:grid-cols-2">
          <Fact label={C.expected}>
            {audit && !running ? (
              <HashChip value={audit.mandateHash} what={t.audit.page.anchor.hashWhat} />
            ) : running ? (
              <Skeleton className="h-6 w-32 rounded-md" />
            ) : (
              "—"
            )}
            <span className="mt-0.5 block text-xs text-muted-ink">{C.hash.expected}</span>
          </Fact>
          <Fact label={C.observed}>
            <HashChip value={entry.mandateHash} what={t.ledger.mandateHashWhat} />
            <span className="mt-0.5 block text-xs text-muted-ink">{C.hash.observed}</span>
          </Fact>
        </dl>
      </Block>

      <Block title={C.chain.title} state={checks.chain}>
        {entry.decision === "STOP" ? (
          <p className="text-sm text-muted-ink">{C.chain.stopped}</p>
        ) : !entry.txHash ? (
          <p className="text-sm text-muted-ink">{C.chain.notBroadcast}</p>
        ) : (
          <>
            <dl className="mb-3 border-b border-line pb-3 text-sm">
              <Fact label={C.source}>
                <HashChip value={entry.txHash} href={x?.explorerUrl ?? entry.explorerUrl} what={C.chain.txWhat} />
                <span className="mt-0.5 block text-xs text-muted-ink">{C.chain.tx}</span>
              </Fact>
            </dl>
            {x && !running ? (
              <div>
                {!read && (
                  <Note state="unverifiable" className="mb-2.5">
                    {C.chain.unread}
                  </Note>
                )}
                <CheckLine
                  label={C.chain.recipient}
                  state={read ? verificationState(x.recipientMatches) : "unverifiable"}
                  expected={<HashChip value={wallet} what={C.chain.recipientWhat} />}
                  expectedCaption={C.chain.recipientExpected(entry.proposal.merchantId)}
                  observed={read ? <HashChip value={x.to} what={C.chain.recipientWhat} /> : unreadValue}
                />
                <CheckLine
                  label={C.chain.amount}
                  state={read ? verificationState(x.amountMatches) : "unverifiable"}
                  expected={<span className="tabular-nums">{fmtUsd(entry.proposal.amountUsd)}</span>}
                  expectedCaption={C.chain.amountExpected}
                  observed={read ? <span className="tabular-nums">{fmtUsd(x.valueUsd)}</span> : unreadValue}
                  observedCaption={read ? C.chain.amountObserved : undefined}
                />
                <CheckLine
                  label={C.chain.memo}
                  state={read ? verificationState(x.memoMatches) : "unverifiable"}
                  expected={<span className="text-sm text-ink">{C.chain.memoExpected}</span>}
                  observed={read ? <Memo value={x.memo} /> : unreadValue}
                />
                <CheckLine
                  label={C.chain.receipt}
                  state={verificationState(x.receiptHashMatches)}
                  expected={<HashChip value={entry.receiptHash} what={C.chain.receiptWhat} />}
                  expectedCaption={C.chain.receiptExpected}
                  observed={<span className="text-muted-ink">—</span>}
                  observedCaption={C.chain.receiptObserved}
                />
              </div>
            ) : !running && audit ? (
              <p className="text-sm text-muted-ink">{C.chain.notAudited}</p>
            ) : null}
            <p className="mt-2 text-xs text-muted-ink">{C.chain.payerMined}</p>
          </>
        )}
      </Block>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Area 3 at a glance · every payment read back from Sepolia                                         */
/* ------------------------------------------------------------------------------------------------ */

function PaymentsTable({
  audit,
  running,
  entries,
  selectedId,
  onOpen,
}: {
  audit: AuditResponse | null;
  running: boolean;
  entries: LedgerEntryView[] | null;
  selectedId: string | null;
  onOpen: (entryId: string) => void;
}) {
  const t = useT();
  const X = t.audit.page.payments;
  const area = t.audit.areas.payments;
  // A field of an unread transaction was never compared: "cannot verify", not a mismatch.
  const badge = (ok: boolean, read = true) => (
    <StateBadge
      family="verification"
      state={running ? "running" : read ? verificationState(ok) : "unverifiable"}
      variant="plain"
    />
  );
  const merchantOf = (entryId: string) => {
    const e = entries?.find((y) => y.id === entryId) ?? null;
    return e ? (e.merchantName ?? e.proposal.merchantId) : null;
  };
  const entryButton = (entryId: string) => (
    <button
      type="button"
      onClick={() => onOpen(entryId)}
      aria-label={X.open(entryId)}
      className="type-id rounded-sm text-cobalt underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
    >
      {entryId}
    </button>
  );
  const unread = <span className="text-sm text-muted-ink">{X.unread}</span>;
  return (
    <section id="audit-payments" aria-labelledby="audit-payments-h">
      <SectionHeader id="audit-payments-h" n="3" title={area.title} description={X.description} />
      {!audit ? (
        running ? (
          <div className="space-y-2.5" aria-busy="true" aria-label={X.loading}>
            {Array.from({ length: 2 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-ink">—</p>
        )
      ) : audit.transactions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong bg-surface px-5 py-4 text-sm text-muted-ink">
          {t.audit.empty.payments}
        </p>
      ) : (
        <>
          {/* Phones: one block per payment, every check visible without scrolling sideways. */}
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface md:hidden">
            {audit.transactions.map((x) => {
              const read = txRead(x);
              const name = merchantOf(x.entryId);
              return (
                <li key={x.entryId} className={cn("space-y-3 px-4 py-3.5", x.entryId === selectedId && SELECTED_MARKER)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {entryButton(x.entryId)}
                      {name && <span className="block text-xs text-muted-ink">{name}</span>}
                    </div>
                    <p className="shrink-0 text-right text-sm font-medium text-ink tabular-nums">
                      {read ? fmtUsd(x.valueUsd) : "—"}
                    </p>
                  </div>
                  <HashChip value={x.txHash} href={x.explorerUrl} what={t.audit.page.card.chain.txWhat} />
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div className="min-w-0">
                      <dt className="text-muted-ink">{X.recipient}</dt>
                      <dd>{badge(x.recipientMatches, read)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-muted-ink">{X.amount}</dt>
                      <dd>{badge(x.amountMatches, read)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-muted-ink">{X.memo}</dt>
                      <dd>{badge(x.memoMatches, read)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-muted-ink">{X.receipt}</dt>
                      <dd>{badge(x.receiptHashMatches)}</dd>
                    </div>
                  </dl>
                  {!read && unread}
                </li>
              );
            })}
          </ul>
          <TableShell className="max-md:hidden">
            <Tbl className="min-w-[56rem]">
              <THead>
                <tr>
                  <Th>{X.entry}</Th>
                  <Th>{X.tx}</Th>
                  <Th>{X.recipient}</Th>
                  <Th numeric>{X.amount}</Th>
                  <Th>{X.memo}</Th>
                  <Th>{X.receipt}</Th>
                  <Th>{X.decoded}</Th>
                </tr>
              </THead>
              <tbody>
                {audit.transactions.map((x) => {
                  const read = txRead(x);
                  const name = merchantOf(x.entryId);
                  return (
                    <Tr key={x.entryId} className={cn("align-top", x.entryId === selectedId && SELECTED_MARKER)}>
                      <Td className="whitespace-nowrap">
                        {entryButton(x.entryId)}
                        {name && <span className="block text-xs text-muted-ink">{name}</span>}
                      </Td>
                      <Td className="whitespace-nowrap">
                        <HashChip value={x.txHash} href={x.explorerUrl} what={t.audit.page.card.chain.txWhat} />
                      </Td>
                      <Td className="whitespace-nowrap">
                        {badge(x.recipientMatches, read)}
                        <span className="type-id block text-[11px] text-muted-ink">{x.to ? fmtHash(x.to) : "—"}</span>
                      </Td>
                      <Td numeric>
                        <span className="block">{read ? fmtUsd(x.valueUsd) : "—"}</span>
                        {badge(x.amountMatches, read)}
                      </Td>
                      <Td>{badge(x.memoMatches, read)}</Td>
                      <Td>{badge(x.receiptHashMatches)}</Td>
                      <Td className="max-w-[22rem] min-w-[16rem]">{read ? <Memo value={x.memo} /> : unread}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Tbl>
          </TableShell>
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Verify it yourself                                                                                */
/* ------------------------------------------------------------------------------------------------ */

function VerifyYourself({ id, records }: { id: string; records: Resource<MandateDetailResponse> }) {
  const V = useT().audit.page.verify;
  return (
    <section
      id="audit-verify"
      aria-labelledby="audit-verify-h"
      className="rounded-lg border border-line bg-surface px-5 py-5 sm:px-6"
    >
      <h2 id="audit-verify-h" className="type-section flex items-center gap-2 text-ink">
        <SquareTerminal aria-hidden className="size-4 text-muted-ink" />
        {V.title}
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-muted-ink">{V.body}</p>
      <EvidenceActions
        id={id}
        records={records.data}
        loading={records.loading || records.refreshing}
        error={records.error}
        onRetry={records.refresh}
        className="mt-4"
      />
      <ul className="mt-4 space-y-2 border-t border-line pt-4 text-sm text-muted-ink">
        <li>{V.byHand}</li>
        <li>{V.tamper}</li>
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Page                                                                                              */
/* ------------------------------------------------------------------------------------------------ */

function AuditSkeleton() {
  const t = useT();
  return (
    <div className="space-y-6" aria-busy="true" aria-label={t.audit.page.loading}>
      <Skeleton className="h-[260px] rounded-xl" />
      <Skeleton className="h-[220px] rounded-lg" />
      <Skeleton className="h-[420px] rounded-lg" />
    </div>
  );
}

function AuditInner() {
  const params = useParams<{ mandateId: string }>();
  const id = decodeId(params?.mandateId ?? "");
  const search = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const P = t.audit.page;
  const now = useNow(5000);

  const load = useCallback(() => api.audit(id), [id]);
  const audit = useResource(id ? load : null);
  const loadRecords = useCallback(() => api.mandate(id), [id]);
  const records = useResource(id ? loadRecords : null);
  const { refresh: refreshAudit } = audit;
  const { refresh: refreshRecords } = records;
  const rerun = useCallback(() => {
    refreshAudit();
    refreshRecords();
  }, [refreshAudit, refreshRecords]);

  const running = audit.loading || audit.refreshing;
  const data = audit.data;
  const areas = useMemo(() => computeAreas(data, running), [data, running]);
  const entries = useMemo(
    () => (records.data && records.data.mandate.id === id ? records.data.ledger : null),
    [records.data, id],
  );
  const attention = useMemo(
    () => (data && !running ? attentionItems(data, areas, t, entries) : []),
    [data, running, areas, t, entries],
  );

  // The selected decision lives in ?d= (shared with Principal, Traveler and the Evidence drawer).
  const d = search.get("d");
  const selected = (d && entries?.find((e) => e.id === d)) || null;
  const select = useCallback(
    (entryId: string) => {
      const sp = new URLSearchParams(search.toString());
      sp.set("d", entryId);
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [search, pathname, router],
  );

  // Below lg the evidence opens as a stacked view with a back control (a ?d= link opens it at once).
  const [detailOpen, setDetailOpen] = useState(() => d !== null);
  const stacked = detailOpen && selected !== null;
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const focusCard = useRef(false);

  useEffect(() => {
    if (focusCard.current && stacked) {
      focusCard.current = false;
      // Bring the Back control into view too (the sticky header would cover it), then focus the heading.
      stackRef.current?.scrollIntoView({ block: "start" });
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [stacked, selected?.id]);

  const open = useCallback(
    (entryId: string, scroll = false) => {
      select(entryId);
      setDetailOpen(true);
      if (!isSideBySide()) focusCard.current = true;
      else if (scroll) {
        document.getElementById("audit-decisions")?.scrollIntoView({ block: "start" });
        // Keyboard users land on the decision they asked for, not on a control now out of view.
        rowRefs.current.get(entryId)?.focus({ preventScroll: true });
      }
    },
    [select],
  );
  // Arriving with ?d= (the Evidence drawer's "Open this decision on the audit page", a link from
  // Principal): once the records and the checks are in (so nothing above still changes height),
  // bring that decision into view. Only for the ?d= the page opened with, as on Principal.
  const arrivedWith = useRef(d);
  useEffect(() => {
    const want = arrivedWith.current;
    if (!want || !entries || audit.loading) return;
    arrivedWith.current = null;
    if (!entries.some((e) => e.id === want)) return;
    requestAnimationFrame(() => {
      if (!isSideBySide()) {
        // Below lg the stacked "Audit of this decision" view is already open on it.
        stackRef.current?.scrollIntoView({ block: "start" });
        return;
      }
      // The section heading first (list and evidence in view), then the row if it is still below the fold.
      document.getElementById("audit-decisions")?.scrollIntoView({ block: "start" });
      const row = rowRefs.current.get(want);
      const r = row?.getBoundingClientRect();
      if (row && r && r.bottom > window.innerHeight) row.scrollIntoView({ block: "center" });
    });
  }, [entries, audit.loading]);

  const back = () => {
    setDetailOpen(false);
    const sel = selected?.id;
    requestAnimationFrame(() => {
      if (sel) rowRefs.current.get(sel)?.focus();
    });
  };

  const newer =
    data && entries && !running && entries.length !== data.replay.length
      ? { now: entries.length, audited: data.replay.length }
      : null;

  const header = (
    <PageHeader
      eyebrow={P.eyebrow}
      title={
        <>
          {P.titleBefore}
          <span className="font-mono">{id}</span>
          {P.titleAfter}
        </>
      }
      description={P.description}
      actions={
        <>
          <Button asChild variant="outline" size="sm">
            <Link href={`/audit/${encodeURIComponent(id)}/report`}>
              <Printer aria-hidden />
              {P.printable}
            </Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={rerun} disabled={running}>
            <RefreshCw aria-hidden />
            {running ? P.rerunning : P.rerun}
          </Button>
        </>
      }
    />
  );

  if (audit.error && !data && audit.error.status === 404) {
    return (
      <>
        {header}
        <ErrorState title={t.audit.notFound(id)} error={audit.error} onRetry={rerun} retrying={audit.refreshing} />
      </>
    );
  }

  return (
    <>
      {header}
      <div className="space-y-8">
        <div className="space-y-3">
          {audit.error && data && <Note state="mismatch">{P.stale(audit.error.message)}</Note>}
          {audit.error && !data && (
            <ErrorState title={P.runError} error={audit.error} onRetry={rerun} retrying={audit.refreshing} />
          )}
          <Summary mandateId={id} audit={data} running={running} checkedAt={audit.updatedAt} now={now} areas={areas} />
          {newer && <Note state="unverifiable">{P.summary.newer(newer.now, newer.audited)}</Note>}
        </div>

        {attention.length > 0 && <Attention items={attention} onShow={(entryId) => open(entryId, true)} />}

        <AnchorCheck audit={data} running={running} area={areas[0]!} />

        <section id="audit-decisions" aria-labelledby="audit-decisions-h">
          <SectionHeader id="audit-decisions-h" n="2" title={P.decisions.title} description={P.decisions.description} />
          {records.loading ? (
            <div className="space-y-2.5" aria-busy="true" aria-label={P.decisions.loading}>
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : records.error && !records.data ? (
            <ErrorState
              title={P.decisions.loadError}
              error={records.error}
              onRetry={records.refresh}
              retrying={records.refreshing}
            />
          ) : entries && entries.length === 0 ? (
            <EmptyState title={P.decisions.empty} description={P.decisions.emptyHint} />
          ) : entries ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
              <div className={cn("min-w-0", stacked && "max-lg:hidden")}>
                <DecisionList
                  entries={entries}
                  audit={data}
                  running={running}
                  selectedId={selected?.id ?? null}
                  onSelect={(entryId) => open(entryId)}
                  rowRefs={rowRefs}
                />
              </div>
              <div
                ref={stackRef}
                className={cn(
                  "min-w-0 space-y-4 lg:sticky lg:top-32 lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto lg:overscroll-contain lg:rounded-lg",
                  !stacked && "max-lg:hidden",
                )}
              >
                {selected && (
                  <>
                    <button
                      type="button"
                      onClick={back}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-sm font-medium text-ink outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
                    >
                      <ArrowLeft aria-hidden className="size-4" />
                      {P.card.back}
                    </button>
                    <DecisionAudit entry={selected} audit={data} running={running} mandateId={id} headingRef={headingRef} />
                  </>
                )}
                <EvidencePanel entry={selected} mandate={records.data?.mandate ?? null} />
              </div>
            </div>
          ) : null}
        </section>

        <PaymentsTable
          audit={data}
          running={running}
          entries={entries}
          selectedId={selected?.id ?? null}
          onOpen={(entryId) => open(entryId, true)}
        />

        <VerifyYourself id={id} records={records} />
      </div>
    </>
  );
}

export default function AuditPage() {
  return (
    <PageContainer>
      <Suspense fallback={<AuditSkeleton />}>
        <AuditInner />
      </Suspense>
    </PageContainer>
  );
}
