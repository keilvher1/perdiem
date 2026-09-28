"use client";

import { useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import type { AuditResponse, LedgerEntryView, LedgerStatus, MandateDetail } from "@/contracts/api";
import { API_MODE, api } from "@/lib/api-client";
import { fmtDate, fmtInt, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ledgerFileName, mandateFileName, verifyCommand } from "@/components/perdiem/evidence-records";
import { PageContainer } from "@/components/perdiem/page";
import { ErrorState, LoadingRows } from "@/components/perdiem/states";
import { reasonDetail } from "@/components/perdiem/stop-codes";
import { useResource } from "@/hooks/use-resource";

/**
 * /audit/[mandateId]/report — a printable (A4) trip statement built only from API records:
 * GET /api/mandates/[id] (terms + ledger) and GET /api/audit/[id] (the recomputed checks). Every
 * line is templated (no model call). Prints no server environment value: the demo rate comes
 * from the public /api/health field, everything else from the mandate and its ledger.
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
    <h2 className="report-keep mb-2 border-b border-zinc-300 pb-1 text-[13px] font-semibold tracking-tight text-zinc-900">
      <span className="mr-1.5 text-zinc-400 tabular-nums">{n}.</span>
      {children}
    </h2>
  );
}

function Field({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0 px-3 py-2">
      <dt className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">{label}</dt>
      <dd className={cn("mt-0.5 text-[12px] text-zinc-900", mono && "font-mono text-[10.5px] leading-4 break-all")}>{children}</dd>
    </div>
  );
}

/** Two fields side by side (principal ↔ traveler, budget ↔ cap, …). */
function Pair({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 divide-x divide-zinc-200 border-b border-zinc-200 last:border-b-0">{children}</div>;
}

function Box({ on }: { on: boolean }) {
  return (
    <span aria-hidden className="font-mono text-[12px] leading-none text-zinc-900">
      {on ? "■" : "□"}
    </span>
  );
}

function statusLabel(e: LedgerEntryView): string {
  if (e.decision === "STOP") return "stopped · nothing sent";
  switch (e.status) {
    case "settled":
      return "settled on-chain";
    case "pending":
      return e.txHash ? "pending · awaiting confirmation" : "pending";
    case "approved":
      return "approved · not broadcast yet";
    case "failed":
      return e.txHash ? "failed on-chain · not counted" : "broadcast did not confirm · not counted";
    default:
      return e.status;
  }
}

/** The audit Banner's math, plus the checks the server counts without a per-row contract field:
 *  the anchor's sender and each payment's sender and "mined and succeeded" (same as scripts/verify.ts). */
function checkBreakdown(audit: AuditResponse) {
  const anchor = { ok: Number(audit.anchor.matches), of: 1 };
  const replay = {
    ok: audit.replay.reduce((a, r) => a + Number(r.consistent) + Number(r.mandateHashMatches), 0),
    of: audit.replay.length * 2,
  };
  const tx = {
    ok: audit.transactions.reduce(
      (a, t) => a + Number(t.memoMatches) + Number(t.receiptHashMatches) + Number(t.recipientMatches) + Number(t.amountMatches),
      0,
    ),
    of: audit.transactions.length * 4,
  };
  const payerMined = {
    ok: audit.summary.passed - anchor.ok - replay.ok - tx.ok,
    of: audit.summary.total - anchor.of - replay.of - tx.of,
  };
  return { anchor, replay, tx, payerMined };
}

function Statement({
  mandate,
  ledger,
  audit,
  auditError,
  demoEthUsd,
  generatedAt,
}: {
  mandate: MandateDetail;
  ledger: LedgerEntryView[];
  audit: AuditResponse | null;
  auditError: string | null;
  demoEthUsd: number | null;
  generatedAt: string | null;
}) {
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
  const breakdown = audit ? checkBreakdown(audit) : null;

  return (
    <article className="report-sheet mx-auto w-full max-w-[210mm] bg-white px-[14mm] py-[12mm] text-zinc-900 shadow-[0_1px_3px_rgba(24,24,27,0.12)] ring-1 ring-zinc-200 print:max-w-none print:p-0 print:shadow-none print:ring-0">
      {/* 1 · Header */}
      <header className="flex items-start justify-between gap-6 border-b-2 border-zinc-900 pb-3">
        <div>
          <p className="text-[10px] font-medium tracking-[0.14em] text-zinc-500 uppercase">PerDiem</p>
          <h1 className="text-[20px] leading-tight font-semibold tracking-tight">Trip statement</h1>
          <p className="mt-0.5 font-mono text-[12px] text-zinc-700">{mandate.id}</p>
        </div>
        <dl className="text-right text-[11px] leading-5 text-zinc-600">
          <div>
            <dt className="inline text-zinc-500">Generated </dt>
            <dd className="inline tabular-nums">{generatedAt ? fmtDate(generatedAt, true) : "—"}</dd>
          </div>
          <div>
            <dt className="inline text-zinc-500">Records </dt>
            <dd className={cn("inline font-medium", API_MODE === "mock" ? "text-rose-700" : "text-zinc-900")}>
              {API_MODE === "live" ? "live · Sepolia testnet" : "MOCK DATA · placeholder hashes, not evidence"}
            </dd>
          </div>
          <div>
            <dt className="inline text-zinc-500">Mandate status </dt>
            <dd className="inline">{mandate.status}</dd>
          </div>
        </dl>
      </header>

      {/* 2 · Parties */}
      <section className="report-section mt-5">
        <H2 n={1}>Parties and terms</H2>
        <dl className="rounded-md border border-zinc-300">
          <Pair>
            <Field label="Principal (grants the budget)">{mandate.principal}</Field>
            <Field label="Traveler (acts under it)">{mandate.traveler}</Field>
          </Pair>
          <Pair>
            <Field label="Budget">{fmtUsd(mandate.budgetUsd)}</Field>
            <Field label="Per-payment cap">{fmtUsd(mandate.perTxCapUsd)}</Field>
          </Pair>
          <Pair>
            <Field label="Trip window opens">{fmtDate(mandate.startsAt, true)}</Field>
            <Field label="Trip window closes">{fmtDate(mandate.expiresAt, true)}</Field>
          </Pair>
          <div className="border-b border-zinc-200">
            <Field label="Agent wallet (the only payer)" mono>
              {mandate.agentWallet}
            </Field>
          </div>
          <Pair>
            <Field label="Mandate hash (keccak256 of the terms)" mono>
              {mandate.hash}
            </Field>
            <Field label="Anchor transaction (terms fixed on-chain)" mono>
              {mandate.anchorTx ?? "not anchored"}
            </Field>
          </Pair>
        </dl>
      </section>

      {/* 3 · Boundary */}
      <section className="report-section mt-5">
        <H2 n={2}>Boundary</H2>
        <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-5">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-zinc-300 text-left text-[10px] tracking-wide text-zinc-500 uppercase">
                <th className="py-1 pr-2 font-medium" colSpan={2}>
                  Catalog merchant
                </th>
                <th className="py-1 pr-2 font-medium">Category</th>
                <th className="py-1 font-medium">Payments</th>
              </tr>
            </thead>
            <tbody>
              {mandate.catalog.map((c) => {
                const merchantOk = allowedIds.has(c.id);
                const catOk = allowedCats.has(c.category);
                const ok = merchantOk && catOk;
                return (
                  <tr key={c.id} className="border-b border-zinc-100">
                    <td className="w-4 py-1 pr-1 align-top">
                      <Box on={ok} />
                    </td>
                    <td className="py-1 pr-2 align-top">
                      {c.name} <span className="font-mono text-[10px] text-zinc-500">{c.id}</span>
                    </td>
                    <td className="py-1 pr-2 align-top">{c.category}</td>
                    <td className={cn("py-1 align-top", ok ? "text-zinc-900" : "text-zinc-500")}>
                      {ok ? "permitted" : !merchantOk && !catOk ? "not permitted (merchant, category)" : !merchantOk ? "not permitted (merchant)" : "not permitted (category)"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="space-y-3 text-[11px]">
            <div>
              <p className="mb-1 text-[10px] font-medium tracking-wide text-zinc-500 uppercase">Categories</p>
              <ul className="space-y-0.5">
                {categories.map((cat) => (
                  <li key={cat} className="flex items-center gap-1.5">
                    <Box on={allowedCats.has(cat)} /> {cat}
                    <span className="text-zinc-500">{allowedCats.has(cat) ? "permitted" : "not permitted"}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-medium tracking-wide text-zinc-500 uppercase">Blocked words (request or memo)</p>
              <p className="font-mono text-[11px]">{mandate.blockedKeywords.length ? mandate.blockedKeywords.join(", ") : "none"}</p>
            </div>
            <p className="text-[10px] leading-4 text-zinc-500">
              ■ permitted · □ not permitted. A payment is also stopped outside the trip window, above the per-payment cap, over the
              remaining budget including the network fee, when the fee cannot be estimated, or as a duplicate within 5 minutes.
            </p>
          </div>
        </div>
      </section>

      {/* 4 · Check line */}
      <section className="report-section mt-5">
        <H2 n={3}>Checks recomputed from the records</H2>
        {audit && breakdown ? (
          <div className={cn("rounded-md border px-3 py-2", audit.summary.allVerified ? "border-zinc-300" : "border-rose-400 bg-rose-50")}>
            <p className="text-[14px] font-semibold tabular-nums">
              {audit.summary.passed} of {audit.summary.total} checks passed
              {!audit.summary.allVerified && <span className="ml-2 text-rose-700">({audit.summary.total - audit.summary.passed} failed)</span>}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-600 tabular-nums">
              Anchor {breakdown.anchor.ok} / {breakdown.anchor.of} · Replay {breakdown.replay.ok} / {breakdown.replay.of} · Transactions{" "}
              {breakdown.tx.ok} / {breakdown.tx.of}
              {breakdown.payerMined.of > 0 && (
                <>
                  {" "}
                  · Payer &amp; mined {breakdown.payerMined.ok} / {breakdown.payerMined.of}
                </>
              )}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-zinc-500">
              Anchor: the recomputed mandate hash equals the memo of the anchor transaction. Replay: every entry re-run through the
              policy with spend rebuilt from earlier entries (2 checks each). Transactions: memo, receipt hash, recipient and amount
              read back from Sepolia (4 each). Payer &amp; mined: the anchor and every payment were sent by the mandate&apos;s agent
              wallet, and each payment was mined and succeeded (1 + 2 per payment). Replay cannot show whether the mandate was paused
              when a payment was approved; pause and resume are in the server log.
            </p>
          </div>
        ) : (
          <p className={cn("text-[11px]", auditError ? "text-rose-700" : "text-zinc-500")}>
            {auditError ? `Checks could not run: ${auditError}` : "Running the checks…"}
          </p>
        )}
      </section>

      {/* 5 · Ledger annex (starts page 2 in print) */}
      <section className="report-section report-annex mt-5">
        <H2 n={4}>Ledger annex · oldest first</H2>
        <p className="mb-1.5 text-[10px] text-zinc-500 tabular-nums">
          {ledger.length} decision{ledger.length === 1 ? "" : "s"}: {count("settled")} settled · {count("pending")} pending ·{" "}
          {count("stopped")} stopped · {count("failed")} failed
          {count("approved") > 0 ? ` · ${count("approved")} approved, not broadcast` : ""}
        </p>
        <table className="w-full border-collapse text-[10.5px] leading-[1.35]">
          <thead className="report-thead">
            <tr className="border-y border-zinc-400 bg-zinc-100 text-left text-[9.5px] tracking-wide text-zinc-600 uppercase">
              <th className="px-1.5 py-1 font-medium">#</th>
              <th className="px-1.5 py-1 font-medium">When</th>
              <th className="px-1.5 py-1 font-medium">Merchant · request</th>
              <th className="px-1.5 py-1 font-medium">Outcome</th>
              <th className="px-1.5 py-1 text-right font-medium">Amount</th>
              <th className="px-1.5 py-1 text-right font-medium">Counted</th>
              <th className="px-1.5 py-1 text-right font-medium">Remaining</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-zinc-200 text-zinc-600">
              <td className="px-1.5 py-1" />
              <td className="px-1.5 py-1" colSpan={5}>
                Opening budget
              </td>
              <td className="px-1.5 py-1 text-right tabular-nums">{fmtUsd(mandate.budgetUsd)}</td>
            </tr>
            {rows.length === 0 && (
              <tr className="border-b border-zinc-200">
                <td className="px-1.5 py-2 text-zinc-500" colSpan={7}>
                  No decisions recorded yet.
                </td>
              </tr>
            )}
            {rows.map(({ e, n, counted, remaining }) => (
              <tr key={e.id} className={cn("report-row border-b border-zinc-200 align-top", e.decision === "STOP" && "bg-zinc-50")}>
                <td className="px-1.5 py-1 text-zinc-500 tabular-nums">{n}</td>
                <td className="px-1.5 py-1 whitespace-nowrap tabular-nums">{fmtDate(e.at)}</td>
                <td className="px-1.5 py-1">
                  <div>
                    {e.merchantName ?? e.proposal.merchantId} <span className="font-mono text-[9.5px] text-zinc-500">{e.proposal.merchantId}</span>
                  </div>
                  {e.proposal.sourceText && <div className="text-zinc-600">“{e.proposal.sourceText}”</div>}
                  {e.decision === "STOP" &&
                    e.reasons.map((r, i) => {
                      const d = reasonDetail(r);
                      return (
                        <div key={`${r.code}-${i}`} className="text-zinc-700">
                          <span className="font-mono text-[9.5px] font-semibold">[{r.code}]</span>
                          {d ? <span className="text-zinc-600"> {d}</span> : null}
                        </div>
                      );
                    })}
                  <div className="font-mono text-[9px] break-all text-zinc-400">
                    {e.id}
                    {e.txHash ? ` · tx ${e.txHash}` : ""}
                  </div>
                </td>
                <td className="px-1.5 py-1">
                  <div className="font-mono text-[9.5px] font-semibold">{e.decision}</div>
                  <div className="text-zinc-600">{statusLabel(e)}</div>
                </td>
                <td className="px-1.5 py-1 text-right whitespace-nowrap tabular-nums">
                  {e.decision === "STOP" ? (
                    <>
                      <div>requested {fmtUsd(e.proposal.amountUsd)}</div>
                      <div className="text-zinc-600">sent $0.00</div>
                    </>
                  ) : (
                    <>
                      <div>{fmtUsd(e.proposal.amountUsd)}</div>
                      <div className="text-zinc-600">+ fee {fmtUsd(e.feeUsd)}</div>
                    </>
                  )}
                </td>
                <td className="px-1.5 py-1 text-right tabular-nums">{counted ? fmtUsd(e.totalUsd) : "$0.00"}</td>
                <td className="px-1.5 py-1 text-right font-medium tabular-nums">{fmtUsd(remaining)}</td>
              </tr>
            ))}
            {/* A body row, not <tfoot>: Chrome repeats a tfoot at the bottom of every printed page. */}
            <tr className="report-row border-t-2 border-zinc-900 bg-zinc-100 font-semibold">
              <td className="px-1.5 py-1.5" colSpan={5}>
                Budget {fmtUsd(mandate.budgetUsd)} − Spent {fmtUsd(spent)} = Remaining
              </td>
              <td className="px-1.5 py-1.5 text-right tabular-nums">{fmtUsd(spent)}</td>
              <td className="px-1.5 py-1.5 text-right tabular-nums">{fmtUsd(mandate.budgetUsd - spent)}</td>
            </tr>
          </tbody>
        </table>
        <p className={cn("mt-1.5 text-[10px] leading-4", reconciled ? "text-zinc-500" : "font-semibold text-rose-700")}>
          {reconciled
            ? `Sum of counted lines equals the recorded spend (${fmtUsd(mandate.spentUsd)}) and remaining (${fmtUsd(mandate.remainingUsd)}).`
            : `MISMATCH: counted lines sum to ${fmtUsd(spent)}, the record says spent ${fmtUsd(mandate.spentUsd)} and remaining ${fmtUsd(mandate.remainingUsd)}.`}{" "}
          Counted = amount + estimated network fee, for approved, pending and settled payments; stopped and failed lines count $0.00.
          {mandate.pendingUsd > 0 ? ` ${fmtUsd(mandate.pendingUsd)} of the spend is still pending on-chain.` : ""}
        </p>
      </section>

      {/* 6 · Demo rate + 7 · Closing */}
      <section className="report-section mt-5 space-y-2 text-[11px]">
        <H2 n={5}>Verify and sign off</H2>
        <p className="text-zinc-700">
          Amounts are USD. On-chain values are Sepolia test ETH converted at the demo rate{" "}
          {demoEthUsd !== null ? <strong>1 ETH = ${fmtInt(demoEthUsd)}</strong> : "DEMO_ETH_USD"} — the same rate scripts/verify.ts uses. No
          real money moves.
        </p>
        <p className="text-zinc-700">
          Reconstruct from records alone: download <span className="font-mono">{mandateFileName(mandate.id)}</span> and{" "}
          <span className="font-mono">{ledgerFileName(mandate.id)}</span> from the audit page (Evidence → Download records), then run in a
          clone of the repository:
        </p>
        <p className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1.5 font-mono text-[10px] break-all">$ {verifyCommand(mandate.id)}</p>
        <div className="report-keep grid grid-cols-[3fr_2fr] gap-8 pt-8 text-[11px]">
          <p className="flex items-end gap-2">
            <span className="shrink-0 text-zinc-600">Reviewed by</span>
            <span className="h-5 flex-1 border-b border-zinc-900" />
          </p>
          <p className="flex items-end gap-2">
            <span className="shrink-0 text-zinc-600">Date</span>
            <span className="h-5 flex-1 border-b border-zinc-900" />
          </p>
        </div>
      </section>
    </article>
  );
}

export default function TripStatementPage() {
  const id = useMandateId();
  const loadRecords = useCallback(() => api.mandate(id), [id]);
  const loadAudit = useCallback(() => api.audit(id), [id]);
  const loadHealth = useCallback(() => api.health(), []);
  const records = useResource(id ? loadRecords : null);
  const audit = useResource(id ? loadAudit : null);
  const health = useResource(loadHealth);

  return (
    <PageContainer className="max-w-5xl print:max-w-none print:p-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm" className="text-zinc-600">
          <Link href={`/audit/${encodeURIComponent(id)}`}>
            <ArrowLeft aria-hidden /> Back to the audit
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-zinc-500">In the print dialog, turn off “Headers and footers”.</span>
          <Button type="button" size="sm" onClick={() => window.print()} disabled={!records.data}>
            <Printer aria-hidden /> Print / Save as PDF
          </Button>
        </div>
      </div>
      {records.loading ? (
        <LoadingRows rows={6} />
      ) : records.error && !records.data ? (
        <ErrorState
          title={records.error.status === 404 ? `Mandate ${id} was not found` : "The statement could not be built"}
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
          demoEthUsd={health.data?.demoEthUsd ?? null}
          generatedAt={records.updatedAt !== null ? new Date(records.updatedAt).toISOString() : null}
        />
      ) : null}
    </PageContainer>
  );
}
