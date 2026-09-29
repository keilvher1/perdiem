"use client";

import { useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import type { AuditResponse, LedgerEntryView, LedgerStatus, MandateDetail, StopCode } from "@/contracts/api";
import { API_MODE, api } from "@/lib/api-client";
import { fmtUsd } from "@/lib/format";
import type { Messages } from "@/lib/i18n/messages";
import { useFmt, useLocale, useT } from "@/lib/i18n/provider";
import { authorityState, decisionState, verificationState, type VerificationState } from "@/lib/ui-state";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ledgerFileName, mandateFileName, verifyCommand } from "@/components/perdiem/evidence-records";
import { PageContainer } from "@/components/perdiem/page";
import { StateBadge } from "@/components/perdiem/state-badge";
import { StateGlyph } from "@/components/perdiem/state-glyph";
import { ErrorState, LoadingRows } from "@/components/perdiem/states";
import { localizeReason } from "@/components/perdiem/stop-codes";
import { useNow } from "@/hooks/use-now";
import { useResource } from "@/hooks/use-resource";

/**
 * /audit/[mandateId]/report — a printable (A4, always light in print) trip statement built only
 * from API records: GET /api/mandates/[id] (terms + ledger) and GET /api/audit/[id] (the recomputed
 * checks). Every line is templated (no model call). Reading order: mandate terms → verification
 * scope and result → approved spend and stopped requests, kept apart → ledger annex (page 2) →
 * sign-off. Prints no server environment value: the demo rate comes from the public /api/health
 * field, everything else from the mandate and its ledger. On screen it follows the theme tokens.
 */

const SPEND: ReadonlySet<LedgerStatus> = new Set<LedgerStatus>(["approved", "pending", "settled"]);

function useMandateId(): string {
  const params = useParams<{ mandateId: string }>();
  const raw = params?.mandateId ?? "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function H2({ n, children }: { n: number; children: ReactNode }) {
  return (
    <h2 className="report-keep mb-2.5 flex items-baseline gap-2 border-b border-line-strong pb-1 text-[13px] font-semibold tracking-tight text-ink">
      <span className="text-muted-ink tabular-nums">{n}</span>
      {children}
    </h2>
  );
}

function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[10px] font-medium tracking-wide text-muted-ink uppercase", className)}>{children}</p>;
}

function Field({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0 px-3 py-2">
      <dt className="text-[10px] font-medium tracking-wide text-muted-ink uppercase">{label}</dt>
      {/* Hashes and wallet addresses are data, not prose: they may break anywhere. */}
      <dd className={cn("mt-0.5 text-[12px] text-ink", mono && "font-mono text-[10.5px] leading-4 break-all")}>{children}</dd>
    </div>
  );
}

/** Two fields side by side (principal ↔ traveler, budget ↔ cap, …). */
function Pair({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 divide-x divide-line border-b border-line last:border-b-0">{children}</div>;
}

/**
 * Tick box for the boundary: ticked = permitted, empty = not permitted. Drawn as an outlined box
 * (SVG, so it prints the same everywhere), never the filled square that marks a rule stop.
 */
function Box({ on }: { on: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 12 12" className="inline-block size-3 shrink-0 align-[-1px] text-ink">
      <rect x="0.75" y="0.75" width="10.5" height="10.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      {on && (
        <path d="M3 6.2 5.1 8.2 9 3.9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function statusLabel(e: LedgerEntryView, L: Messages["audit"]["report"]["ledger"]["status"]): string {
  if (e.decision === "STOP") return L.stopped;
  switch (e.status) {
    case "settled":
      return L.settled;
    case "pending":
      return e.txHash ? L.pendingTx : L.pending;
    case "approved":
      return L.approved;
    case "failed":
      return e.txHash ? L.failedTx : L.failed;
    default:
      return e.status;
  }
}

type AreaKey = "anchor" | "replay" | "payments" | "payerMined";

/* Same reading of the audit response as /audit/[mandateId] (keep the two in step): a transaction
 * or anchor the server could not read failed without a comparison, so it is "cannot verify". */
const txRead = (x: AuditResponse["transactions"][number]) => x.to !== null || x.memo !== "";
const anchorUnread = (a: AuditResponse["anchor"]) => a.txHash !== null && a.memo === null;
const txFieldsMatch = (x: AuditResponse["transactions"][number]) =>
  x.memoMatches && x.receiptHashMatches && x.recipientMatches && x.amountMatches;

/**
 * The audit page's area split: anchor memo (1), replay (2 per entry), payment fields (4 per payment),
 * and the sender / mined checks the server counts without a per-row contract field (the rest of the
 * total), so the rows always add up to the headline.
 */
function areasOf(audit: AuditResponse): { key: AreaKey; ok: number; of: number; state: VerificationState | null }[] {
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
  const st = (ok: number, of: number) => (of === 0 ? null : verificationState(ok === of));
  const unreadTx = audit.transactions.filter((x) => !txRead(x)).length;
  const txFails = txOf - txOk;
  const extraFails = extraOf - extraOk;
  const senderUnread = Number(anchorUnread(audit.anchor)) + unreadTx;
  const rows: { key: AreaKey; ok: number; of: number; state: VerificationState | null }[] = [
    {
      key: "anchor",
      ok: anchorOk,
      of: 1,
      state: !audit.anchor.txHash || anchorUnread(audit.anchor) ? "unverifiable" : verificationState(audit.anchor.matches),
    },
    { key: "replay", ok: replayOk, of: replayOf, state: st(replayOk, replayOf) },
    {
      key: "payments",
      ok: txOk,
      of: txOf,
      state: txFails > 0 && txFails === unreadTx * 3 ? "unverifiable" : st(txOk, txOf),
    },
  ];
  if (extraOf > 0)
    rows.push({
      key: "payerMined",
      ok: Math.max(0, extraOk),
      of: extraOf,
      state: extraFails > 0 && extraFails === senderUnread ? "unverifiable" : st(extraOk, extraOf),
    });
  return rows;
}

/** "unverifiable" only when every failed check is a missing or unreadable record (see the audit page). */
function overallOf(audit: AuditResponse): VerificationState {
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

function Statement({
  mandate,
  ledger,
  audit,
  auditError,
  checkedAt,
  demoEthUsd,
  generatedAt,
  now,
}: {
  mandate: MandateDetail;
  ledger: LedgerEntryView[];
  audit: AuditResponse | null;
  auditError: string | null;
  checkedAt: string | null;
  demoEthUsd: number | null;
  generatedAt: string | null;
  now: number | null;
}) {
  const t = useT();
  const R = t.audit.report;
  const S = R.spend;
  const f = useFmt();
  const locale = useLocale();
  const cat = (c: string) => t.common.category[c] ?? c;
  const allowedIds = new Set(mandate.allowedMerchantIds);
  const allowedCats = new Set(mandate.allowedCategories);
  const categories = [...new Set([...mandate.allowedCategories, ...mandate.catalog.map((c) => c.category)])];

  // Running remaining budget, oldest first (API order). Summed unrounded in the same order as
  // lib/view.ts, so it must equal mandate.spentUsd exactly; the mock client tidies its sums to 1e-9.
  const rows: { e: LedgerEntryView; n: number; counted: boolean; remaining: number }[] = [];
  let spent = 0;
  for (const [i, e] of ledger.entries()) {
    const counted = SPEND.has(e.status);
    if (counted) spent += e.totalUsd;
    rows.push({ e, n: i + 1, counted, remaining: mandate.budgetUsd - spent });
  }
  const same = (a: number, b: number) => a === b || (API_MODE === "mock" && Math.abs(a - b) < 1e-9);
  const reconciled = same(spent, mandate.spentUsd) && same(mandate.budgetUsd - spent, mandate.remainingUsd);
  const count = (s: LedgerStatus) => ledger.filter((e) => e.status === s).length;

  // Approved spend and stopped requests, kept apart. Spent / pending / remaining are the API's
  // figures (pending is already inside spent); stopped amounts were requested, never sent.
  const approvedCounted = ledger.filter((e) => e.decision === "APPROVE" && SPEND.has(e.status));
  const failed = ledger.filter((e) => e.decision === "APPROVE" && e.status === "failed");
  const stopped = ledger.filter((e) => e.decision === "STOP");
  const stoppedRequested = stopped.reduce((a, e) => a + e.proposal.amountUsd, 0);
  const failedRequested = failed.reduce((a, e) => a + e.proposal.amountUsd, 0);
  const codeCounts = new Map<StopCode, number>();
  for (const e of stopped) for (const r of e.reasons) codeCounts.set(r.code, (codeCounts.get(r.code) ?? 0) + 1);

  const areas = audit ? areasOf(audit) : [];
  const overall: VerificationState = !audit ? (auditError ? "not_run" : "running") : overallOf(audit);

  return (
    <article className="report-sheet mx-auto w-full max-w-[210mm] rounded-lg border border-line bg-surface px-5 py-6 text-ink sm:px-[14mm] sm:py-[12mm] print:max-w-none print:rounded-none print:border-0 print:p-0">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b-2 border-ink pb-3">
        <div className="min-w-0">
          <p className="type-label text-muted-ink">PerDiem</p>
          <h1 className="text-[22px] leading-tight font-semibold tracking-tight">{R.heading}</h1>
          <p className="type-id mt-0.5 text-muted-ink">{mandate.id}</p>
        </div>
        <dl className="grid grid-cols-[auto_auto] items-center gap-x-3 gap-y-0.5 text-[11px] leading-5">
          <dt className="text-muted-ink">{R.generated}</dt>
          <dd className="tabular-nums">{generatedAt ? f.date(generatedAt, true) : "—"}</dd>
          <dt className="text-muted-ink">{R.records}</dt>
          <dd>
            {API_MODE === "live" ? (
              R.recordsLive
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-unverified">
                <StateGlyph glyph="dashed-slash" className="size-3" />
                {R.recordsMock}
              </span>
            )}
          </dd>
          <dt className="text-muted-ink">{R.authority}</dt>
          <dd>
            <StateBadge family="authority" state={authorityState(mandate, now)} variant="plain" className="h-5" />
          </dd>
        </dl>
      </header>

      {/* 1 · Mandate terms (parties, limits, window, hashes; then the boundary) */}
      <section className="report-section mt-6">
        <H2 n={1}>{R.terms.title}</H2>
        <dl className="rounded-md border border-line-strong">
          <Pair>
            <Field label={R.terms.principal}>{mandate.principal}</Field>
            <Field label={R.terms.traveler}>{mandate.traveler}</Field>
          </Pair>
          <Pair>
            <Field label={R.terms.budget}>
              <span className="tabular-nums">{fmtUsd(mandate.budgetUsd)}</span>
            </Field>
            <Field label={R.terms.perPaymentCap}>
              <span className="tabular-nums">{fmtUsd(mandate.perTxCapUsd)}</span>
            </Field>
          </Pair>
          <Pair>
            <Field label={R.terms.opens}>{f.date(mandate.startsAt, true)}</Field>
            <Field label={R.terms.closes}>{f.date(mandate.expiresAt, true)}</Field>
          </Pair>
          <div className="border-b border-line">
            <Field label={R.terms.agentWallet} mono>
              {mandate.agentWallet}
            </Field>
          </div>
          <Pair>
            <Field label={R.terms.mandateHash} mono>
              {mandate.hash}
            </Field>
            <Field label={R.terms.anchorTx} mono>
              {mandate.anchorTx ?? t.audit.notAnchored}
            </Field>
          </Pair>
        </dl>

        <h3 className="report-keep mt-4 mb-1.5 text-[12px] font-semibold text-ink">{R.boundary.title}</h3>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] print:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-line-strong text-left text-[10px] tracking-wide text-muted-ink uppercase">
                <th className="py-1 pr-2 font-medium" colSpan={2}>
                  {R.boundary.catalogMerchant}
                </th>
                <th className="py-1 pr-2 font-medium">{R.boundary.category}</th>
                <th className="py-1 font-medium">{R.boundary.payments}</th>
              </tr>
            </thead>
            <tbody>
              {mandate.catalog.map((c) => {
                const merchantOk = allowedIds.has(c.id);
                const catOk = allowedCats.has(c.category);
                const ok = merchantOk && catOk;
                return (
                  <tr key={c.id} className="border-b border-line">
                    <td className="w-4 py-1 pr-1 align-top">
                      <Box on={ok} />
                    </td>
                    <td className="py-1 pr-2 align-top">
                      {c.name} <span className="font-mono text-[10px] text-muted-ink">{c.id}</span>
                    </td>
                    <td className="py-1 pr-2 align-top">{cat(c.category)}</td>
                    <td className={cn("py-1 align-top", ok ? "text-ink" : "text-muted-ink")}>
                      {ok
                        ? R.boundary.permitted
                        : !merchantOk && !catOk
                          ? R.boundary.notPermittedBoth
                          : !merchantOk
                            ? R.boundary.notPermittedMerchant
                            : R.boundary.notPermittedCategory}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="space-y-3 text-[11px]">
            <div>
              <Label className="mb-1">{R.boundary.categories}</Label>
              <ul className="space-y-0.5">
                {categories.map((c) => (
                  <li key={c} className="flex items-center gap-1.5">
                    <Box on={allowedCats.has(c)} /> {cat(c)}
                    <span className="text-muted-ink">{allowedCats.has(c) ? R.boundary.permitted : R.boundary.notPermitted}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <Label className="mb-1">{R.boundary.blockedWords}</Label>
              <p>{mandate.blockedKeywords.length ? mandate.blockedKeywords.join(t.ui.listSep) : R.boundary.none}</p>
            </div>
            <p className="text-[10px] leading-4 text-muted-ink">
              <span className="mr-2 inline-flex items-center gap-1 whitespace-nowrap">
                <Box on /> {R.boundary.permitted}
              </span>
              <span className="mr-2 inline-flex items-center gap-1 whitespace-nowrap">
                <Box on={false} /> {R.boundary.notPermitted}
              </span>
              {R.boundary.legend}
            </p>
          </div>
        </div>
      </section>

      {/* 2 · Verification scope and result */}
      <section className="report-section mt-6">
        <H2 n={2}>{R.verification.title}</H2>
        {audit ? (
          <div className="report-keep">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <StateBadge family="verification" state={overall} size="md" />
              <p className={cn("text-[15px] font-semibold tabular-nums", overall === "mismatch" ? "text-danger" : "text-ink")}>
                {audit.summary.allVerified
                  ? t.audit.checksPassed(audit.summary.passed, audit.summary.total)
                  : t.audit.checksFailed(audit.summary.total - audit.summary.passed, audit.summary.total)}
              </p>
            </div>
            <p className="mt-1 text-[11px] text-muted-ink">
              {R.verification.scope(audit.replay.length, audit.transactions.length)}
              {checkedAt ? ` ${R.verification.checkedAt(f.date(checkedAt, true))}` : ""}
            </p>
            <table className="mt-2 w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-line-strong text-left text-[10px] tracking-wide text-muted-ink uppercase">
                  <th className="py-1 pr-2 font-medium">{R.verification.area}</th>
                  <th className="py-1 pr-3 text-right font-medium">{R.verification.checks}</th>
                  <th className="py-1 font-medium">{R.verification.result}</th>
                </tr>
              </thead>
              <tbody>
                {areas.map((a, i) => (
                  <tr key={a.key} className="border-b border-line">
                    <td className="py-1 pr-2">
                      <span className="mr-1.5 text-muted-ink tabular-nums">{a.key === "payerMined" ? "+" : `${i + 1}.`}</span>
                      {t.audit.areas[a.key].title}
                    </td>
                    <td className="py-1 pr-3 text-right whitespace-nowrap tabular-nums">
                      {a.of === 0
                        ? t.audit.count.none
                        : a.ok === a.of
                          ? t.audit.count.passed(a.ok, a.of)
                          : t.audit.count.failed(a.of - a.ok, a.of)}
                    </td>
                    <td className="py-1">
                      {a.state ? <StateBadge family="verification" state={a.state} variant="plain" className="h-5" /> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!audit.anchor.txHash && <p className="mt-1.5 text-[10.5px] text-ink">{t.audit.notAnchoredNote}</p>}
            {anchorUnread(audit.anchor) && (
              <p className="mt-1.5 text-[10.5px] text-ink">{t.audit.page.attention.anchorUnread}</p>
            )}
            {audit.transactions
              .filter((x) => !txRead(x))
              .map((x) => (
                <p key={x.entryId} className="mt-1.5 text-[10.5px] text-ink">
                  <span className="font-mono text-[10px]">{x.entryId}</span> · {t.audit.page.attention.unread}
                </p>
              ))}
            <p className="mt-1.5 text-[10px] leading-4 text-muted-ink">
              {R.verification.explanation} {R.verification.limitation}
            </p>
          </div>
        ) : auditError ? (
          <p className="flex items-start gap-2 text-[11px] text-danger">
            <StateGlyph glyph="triangle" className="mt-0.5 size-3" />
            {R.verification.couldNotRun(auditError)}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-[11px] text-muted-ink">
            <StateBadge family="verification" state="running" variant="plain" />
            {R.verification.running}
          </p>
        )}
      </section>

      {/* 3 · Approved spend and stopped requests, kept apart */}
      <section className="report-section mt-6">
        <H2 n={3}>{S.title}</H2>
        <p className="mb-2.5 text-[11px] text-muted-ink">{S.note}</p>
        <div className="report-keep grid gap-4 sm:grid-cols-2 print:grid-cols-2">
          <div className="rounded-md border border-line-strong px-3 py-2.5">
            <h3 className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
              <StateGlyph glyph="circle" className="size-2.5 text-approve" />
              {S.approved}
            </h3>
            <p className="text-[10.5px] text-muted-ink">{S.approvedCount(approvedCounted.length)}</p>
            <Label className="mt-2">{S.spent}</Label>
            <p className="type-amount-sm">{fmtUsd(mandate.spentUsd)}</p>
            <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-y-0.5 border-t border-line pt-1.5 text-[11px]">
              <dt className="text-muted-ink">{S.budget}</dt>
              <dd className="pl-3 text-right tabular-nums">{fmtUsd(mandate.budgetUsd)}</dd>
              <dt className="text-muted-ink">{S.spent}</dt>
              <dd className="pl-3 text-right tabular-nums">{fmtUsd(mandate.spentUsd)}</dd>
              <dt className="text-muted-ink">
                {S.pending} <span className="text-[10px]">({S.pendingHint})</span>
              </dt>
              <dd className="pl-3 text-right tabular-nums">{fmtUsd(mandate.pendingUsd)}</dd>
              <dt className="border-t border-line pt-0.5 font-semibold text-ink">{S.remaining}</dt>
              <dd className="border-t border-line pt-0.5 pl-3 text-right font-semibold tabular-nums">
                {fmtUsd(mandate.remainingUsd)}
              </dd>
            </dl>
            {failed.length > 0 && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[10.5px] text-ink">
                <StateGlyph glyph="triangle" className="mt-0.5 size-2.5 text-danger" />
                {S.failed(failed.length, fmtUsd(failedRequested))}
              </p>
            )}
          </div>
          <div className="rounded-md border border-line-strong px-3 py-2.5">
            <h3 className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
              <StateGlyph glyph="square" className="size-2.5 text-stop" />
              {S.stopped}
            </h3>
            <p className="text-[10.5px] text-muted-ink">{S.stoppedCount(stopped.length)}</p>
            <Label className="mt-2">{S.requested}</Label>
            <p className="type-amount-sm">{fmtUsd(stoppedRequested)}</p>
            <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-y-0.5 border-t border-line pt-1.5 text-[11px]">
              <dt className="text-muted-ink">{S.requested}</dt>
              <dd className="pl-3 text-right tabular-nums">{fmtUsd(stoppedRequested)}</dd>
              <dt className="text-muted-ink">{S.counted}</dt>
              <dd className="pl-3 text-right tabular-nums">{fmtUsd(0)}</dd>
            </dl>
            <Label className="mt-2">{S.codes}</Label>
            {codeCounts.size === 0 ? (
              <p className="text-[11px] text-muted-ink">{S.none}</p>
            ) : (
              <ul className="mt-0.5 space-y-0.5 text-[10.5px]">
                {[...codeCounts].map(([code, n]) => (
                  <li key={code} className="flex items-baseline justify-between gap-3">
                    <span>
                      <span className="font-mono text-[10px]">[{code}]</span>{" "}
                      <span className="text-muted-ink">{t.stop.codes[code]?.title ?? code}</span>
                    </span>
                    <span className="tabular-nums">× {f.int(n)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* 4 · Ledger annex: flows after the spend summary in print; a row never splits across pages. */}
      <section className="report-section mt-6">
        <H2 n={4}>{R.ledger.title}</H2>
        <p className="mb-1.5 text-[10px] text-muted-ink tabular-nums">
          {R.ledger.summary({
            total: ledger.length,
            settled: count("settled"),
            pending: count("pending"),
            stopped: count("stopped"),
            failed: count("failed"),
            approved: count("approved"),
          })}
        </p>
        <div className="relative overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[40rem] border-collapse text-[10.5px] leading-[1.35] print:min-w-0">
            <thead className="report-thead">
              <tr className="border-y border-line-strong bg-surface-2 text-left text-[9.5px] tracking-wide text-muted-ink uppercase">
                <th className="px-1.5 py-1 font-medium">#</th>
                <th className="px-1.5 py-1 font-medium">{R.ledger.when}</th>
                <th className="px-1.5 py-1 font-medium">{R.ledger.merchantRequest}</th>
                <th className="px-1.5 py-1 font-medium">{R.ledger.outcome}</th>
                <th className="px-1.5 py-1 text-right font-medium">{R.ledger.requested}</th>
                <th className="px-1.5 py-1 text-right font-medium">{R.ledger.counted}</th>
                <th className="px-1.5 py-1 text-right font-medium">{R.ledger.remaining}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line text-muted-ink">
                <td className="px-1.5 py-1" />
                <td className="px-1.5 py-1" colSpan={5}>
                  {R.ledger.openingBudget}
                </td>
                <td className="px-1.5 py-1 text-right tabular-nums">{fmtUsd(mandate.budgetUsd)}</td>
              </tr>
              {rows.length === 0 && (
                <tr className="border-b border-line">
                  <td className="px-1.5 py-2 text-muted-ink" colSpan={7}>
                    {R.ledger.empty}
                  </td>
                </tr>
              )}
              {rows.map(({ e, n, counted, remaining }) => {
                const noFee = e.feeSource === "none" || e.reasons.some((r) => r.code === "FEE_UNAVAILABLE");
                return (
                  <tr key={e.id} className="report-row border-b border-line align-top">
                    <td className="px-1.5 py-1 text-muted-ink tabular-nums">{n}</td>
                    <td className="px-1.5 py-1 whitespace-nowrap tabular-nums">{f.date(e.at)}</td>
                    <td className="px-1.5 py-1">
                      <div>
                        {e.merchantName ?? e.proposal.merchantId}{" "}
                        <span className="font-mono text-[9.5px] text-muted-ink">{e.proposal.merchantId}</span>
                      </div>
                      {e.proposal.sourceText && <div className="text-muted-ink">{R.ledger.quote(e.proposal.sourceText)}</div>}
                      {e.decision === "STOP" &&
                        e.reasons.map((r, i) => {
                          const loc = localizeReason(r, locale);
                          return (
                            <div key={`${r.code}-${i}`} className="text-ink">
                              <span className="font-mono text-[9.5px] font-semibold">[{r.code}]</span> {loc.title}
                              {loc.detail ? <span className="text-muted-ink tabular-nums"> · {loc.detail}</span> : null}
                            </div>
                          );
                        })}
                      <div className="text-[9px] text-muted-ink">
                        <span className="font-mono">{e.id}</span>
                        {e.txHash && (
                          <>
                            {" · "}
                            {t.audit.page.payments.tx} <span className="font-mono break-all">{e.txHash}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-1.5 py-1">
                      <StateBadge family="decision" state={decisionState(e)} variant="plain" className="h-5 text-[10.5px]" />
                      <div className="text-muted-ink">{statusLabel(e, R.ledger.status)}</div>
                    </td>
                    <td className="px-1.5 py-1 text-right whitespace-nowrap tabular-nums">{fmtUsd(e.proposal.amountUsd)}</td>
                    <td className="px-1.5 py-1 text-right whitespace-nowrap tabular-nums">
                      <div>{counted ? fmtUsd(e.totalUsd) : fmtUsd(0)}</div>
                      {counted && (
                        <div className="text-muted-ink">{noFee ? R.ledger.feeNone : R.ledger.fee(fmtUsd(e.feeUsd))}</div>
                      )}
                    </td>
                    <td className="px-1.5 py-1 text-right font-medium tabular-nums">{fmtUsd(remaining)}</td>
                  </tr>
                );
              })}
              {/* A body row, not <tfoot>: Chrome repeats a tfoot at the bottom of every printed page. */}
              <tr className="report-row border-t-2 border-ink bg-surface-2 font-semibold">
                <td className="px-1.5 py-1.5" colSpan={5}>
                  {R.ledger.total(fmtUsd(mandate.budgetUsd), fmtUsd(spent))}
                </td>
                <td className="px-1.5 py-1.5 text-right tabular-nums">{fmtUsd(spent)}</td>
                <td className="px-1.5 py-1.5 text-right tabular-nums">{fmtUsd(mandate.budgetUsd - spent)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className={cn("mt-1.5 text-[10px] leading-4", reconciled ? "text-muted-ink" : "font-semibold text-danger")}>
          {reconciled
            ? R.ledger.reconciled(fmtUsd(mandate.spentUsd), fmtUsd(mandate.remainingUsd))
            : R.ledger.mismatch(fmtUsd(spent), fmtUsd(mandate.spentUsd), fmtUsd(mandate.remainingUsd))}
          {R.ledger.countedNote}
          {mandate.pendingUsd > 0 ? R.ledger.pendingNote(fmtUsd(mandate.pendingUsd)) : ""}
        </p>
      </section>

      {/* 5 · Demo rate, reconstruction and sign-off */}
      {/* Kept on one page in print: a sign-off split from its heading and command reads as unsigned. */}
      <section className="report-section report-keep mt-6 space-y-2 text-[11px]">
        <H2 n={5}>{R.signOff.title}</H2>
        <p className="text-ink">
          {R.signOff.rateBefore}
          {demoEthUsd !== null ? <strong>1 ETH = ${f.int(demoEthUsd)}</strong> : "DEMO_ETH_USD"}
          {R.signOff.rateAfter}
        </p>
        <p className="text-ink">
          {R.signOff.reconstructBefore}
          <span className="font-mono">{mandateFileName(mandate.id)}</span>
          {R.signOff.reconstructMid}
          <span className="font-mono">{ledgerFileName(mandate.id)}</span>
          {R.signOff.reconstructAfter}
        </p>
        <p className="rounded-md border border-line-strong bg-surface-2 px-2 py-1.5 font-mono text-[10px] wrap-anywhere">
          $ {verifyCommand(mandate.id)}
        </p>
        <div className="grid grid-cols-[3fr_2fr] gap-8 pt-8 text-[11px]">
          <p className="flex items-end gap-2">
            <span className="shrink-0 text-muted-ink">{R.signOff.reviewedBy}</span>
            <span className="h-5 flex-1 border-b border-ink" />
          </p>
          <p className="flex items-end gap-2">
            <span className="shrink-0 text-muted-ink">{R.signOff.date}</span>
            <span className="h-5 flex-1 border-b border-ink" />
          </p>
        </div>
      </section>
    </article>
  );
}

export default function TripStatementPage() {
  const id = useMandateId();
  const t = useT();
  const R = t.audit.report;
  const now = useNow(30000);
  const loadRecords = useCallback(() => api.mandate(id), [id]);
  const loadAudit = useCallback(() => api.audit(id), [id]);
  const loadHealth = useCallback(() => api.health(), []);
  const records = useResource(id ? loadRecords : null);
  const audit = useResource(id ? loadAudit : null);
  const health = useResource(loadHealth);

  return (
    <PageContainer className="max-w-5xl print:max-w-none print:p-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm" className="text-muted-ink">
          <Link href={`/audit/${encodeURIComponent(id)}`}>
            <ArrowLeft aria-hidden /> {R.back}
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-ink">{R.printHint}</span>
          <Button type="button" size="sm" onClick={() => window.print()} disabled={!records.data}>
            <Printer aria-hidden /> {R.print}
          </Button>
        </div>
      </div>
      {records.loading ? (
        <LoadingRows rows={6} />
      ) : records.error && !records.data ? (
        <ErrorState
          title={records.error.status === 404 ? t.audit.notFound(id) : R.buildError}
          error={records.error}
          onRetry={records.refresh}
          retrying={records.refreshing}
        />
      ) : records.data ? (
        <Statement
          mandate={records.data.mandate}
          ledger={records.data.ledger}
          audit={audit.data}
          auditError={audit.error ? audit.error.message : null}
          checkedAt={audit.updatedAt !== null ? new Date(audit.updatedAt).toISOString() : null}
          demoEthUsd={health.data?.demoEthUsd ?? null}
          generatedAt={records.updatedAt !== null ? new Date(records.updatedAt).toISOString() : null}
          now={now}
        />
      ) : null}
    </PageContainer>
  );
}
