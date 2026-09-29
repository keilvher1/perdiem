"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CircleCheck, OctagonAlert, Printer, RefreshCw, ShieldCheck, SquareTerminal } from "lucide-react";
import type { AuditResponse, MandateDetailResponse } from "@/contracts/api";
import { api } from "@/lib/api-client";
import { fmtUsd } from "@/lib/format";
import { useFmt, useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckMark } from "@/components/perdiem/check-mark";
import { TableShell, Tbl, Td, Th, THead, Tr } from "@/components/perdiem/data-table";
import { HashChip } from "@/components/perdiem/hash-chip";
import { JsonView } from "@/components/perdiem/json-view";
import { PageContainer, PageHeader, Panel, PanelTitle } from "@/components/perdiem/page";
import { ReasonChips } from "@/components/perdiem/reason-chips";
import { EvidenceActions } from "@/components/perdiem/evidence-actions";
import { EmptyState, ErrorState } from "@/components/perdiem/states";
import { useNow } from "@/hooks/use-now";
import { useResource, type Resource } from "@/hooks/use-resource";
import { cn } from "@/lib/utils";

function Decision({ d }: { d: "APPROVE" | "STOP" }) {
  return <span className={cn("font-mono text-[11px] font-semibold", d === "APPROVE" ? "text-emerald-700" : "text-rose-700")}>{d}</span>;
}

function Banner({ audit }: { audit: AuditResponse }) {
  const t = useT();
  const { passed, total, allVerified } = audit.summary;
  const failed = total - passed;
  const replayChecks = audit.replay.length * 2;
  const replayOk = audit.replay.reduce((a, r) => a + Number(r.consistent) + Number(r.mandateHashMatches), 0);
  const txChecks = audit.transactions.length * 4;
  const txOk = audit.transactions.reduce(
    (a, t) => a + Number(t.memoMatches) + Number(t.receiptHashMatches) + Number(t.recipientMatches) + Number(t.amountMatches),
    0,
  );
  // The server also counts checks that have no per-row field in the contract: the anchor's sender,
  // and each payment's sender and "mined and succeeded" (same as scripts/verify.ts). Show them as
  // their own group so the groups always add up to the headline.
  const anchorOk = Number(audit.anchor.matches);
  const extraChecks = total - (1 + replayChecks + txChecks);
  const extraOk = passed - (anchorOk + replayOk + txOk);
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-4 rounded-xl border px-6 py-5 sm:flex-row sm:items-center sm:justify-between",
        allVerified ? "border-emerald-200 bg-emerald-50/70" : "border-rose-200 bg-rose-50/70",
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", allVerified ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
          {allVerified ? <ShieldCheck aria-hidden className="size-5" /> : <OctagonAlert aria-hidden className="size-5" />}
        </span>
        <div>
          <p className={cn("text-xl font-semibold tracking-tight tabular-nums", allVerified ? "text-emerald-900" : "text-rose-900")}>
            {allVerified ? t.audit.checksPassed(passed, total) : t.audit.checksFailed(failed, total)}
          </p>
          <p className={cn("mt-0.5 text-sm", allVerified ? "text-emerald-800/90" : "text-rose-800/90")}>
            {t.audit.page.recomputes}
          </p>
        </div>
      </div>
      <dl className="flex gap-6 text-sm tabular-nums">
        <div>
          <dt className="text-xs text-zinc-500">{t.audit.groups.anchor}</dt>
          <dd className="font-medium text-zinc-900">{audit.anchor.matches ? "1 / 1" : "0 / 1"}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">{t.audit.groups.replay}</dt>
          <dd className="font-medium text-zinc-900">
            {replayOk} / {replayChecks}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">{t.audit.groups.transactions}</dt>
          <dd className="font-medium text-zinc-900">
            {txOk} / {txChecks}
          </dd>
        </div>
        {extraChecks > 0 && (
          <div>
            <dt className="text-xs text-zinc-500">{t.audit.groups.payerMined}</dt>
            <dd className="font-medium text-zinc-900">
              {extraOk} / {extraChecks}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function TermsSection({ audit }: { audit: AuditResponse }) {
  const t = useT();
  const T = t.audit.page.terms;
  const m = audit.mandate;
  const terms = {
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
  };
  const hashMatches = audit.mandateHash.toLowerCase() === m.hash.toLowerCase();
  return (
    <Panel>
      <PanelTitle description={T.description}>{T.title}</PanelTitle>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <JsonView value={terms} collapsed={["catalog"]} note={{ status: T.statusNote }} className="max-h-[420px]" />
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="mb-1 text-xs text-zinc-500">{T.recomputedHash}</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <HashChip value={audit.mandateHash} what={T.recomputedHashWhat} />
              <CheckMark ok={hashMatches} yes={T.equalsStored} no={T.differsStored} />
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs text-zinc-500">{T.anchorTx}</dt>
            <dd>
              <HashChip value={audit.anchor.txHash} href={audit.anchor.explorerUrl} what={T.anchorTxWhat} emptyText={t.audit.notAnchored} />
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs text-zinc-500">{T.memo}</dt>
            <dd>
              {audit.anchor.memo ? (
                <code className="block rounded-md bg-zinc-50 px-2.5 py-2 font-mono text-[11px] leading-5 break-all text-zinc-700 ring-1 ring-zinc-200 ring-inset">
                  {audit.anchor.memo}
                </code>
              ) : (
                <span className="text-xs text-zinc-400">{T.noMemo}</span>
              )}
            </dd>
          </div>
          <div className="rounded-lg border border-zinc-200 px-3 py-2.5">
            <CheckMark ok={audit.anchor.matches} yes={T.anchorMatches} no={T.anchorMismatch} />
          </div>
        </dl>
      </div>
    </Panel>
  );
}

function ReplaySection({ audit }: { audit: AuditResponse }) {
  const R = useT().audit.page.replay;
  return (
    <Panel>
      <PanelTitle description={R.description}>{R.title}</PanelTitle>
      {audit.replay.length === 0 ? (
        <EmptyState title={R.emptyTitle} description={R.emptyDescription} />
      ) : (
        <TableShell className="max-h-[480px]">
          <Tbl className="min-w-[860px]">
            <THead>
              <tr>
                <Th>{R.entry}</Th>
                <Th>{R.stored}</Th>
                <Th>{R.recomputed}</Th>
                <Th>{R.consistent}</Th>
                <Th>{R.mandateHash}</Th>
                <Th>{R.reasons}</Th>
              </tr>
            </THead>
            <tbody>
              {audit.replay.map((r) => (
                <Tr key={r.entryId} className={cn(!(r.consistent && r.mandateHashMatches) && "bg-rose-50/40")}>
                  <Td className="font-mono text-xs text-zinc-800">{r.entryId}</Td>
                  <Td>
                    <Decision d={r.storedDecision} />
                  </Td>
                  <Td>
                    <Decision d={r.recomputedDecision} />
                  </Td>
                  <Td>
                    <CheckMark ok={r.consistent} yes={R.same} no={R.differs} />
                  </Td>
                  <Td>
                    <CheckMark ok={r.mandateHashMatches} />
                  </Td>
                  <Td className="max-w-[360px]">
                    <ReasonChips reasons={r.recomputedReasons} compact />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Tbl>
        </TableShell>
      )}
    </Panel>
  );
}

function TransactionsSection({ audit }: { audit: AuditResponse }) {
  const X = useT().audit.page.transactions;
  return (
    <Panel>
      <PanelTitle description={X.description}>{X.title}</PanelTitle>
      {audit.transactions.length === 0 ? (
        <EmptyState title={X.emptyTitle} description={X.emptyDescription} />
      ) : (
        <TableShell className="max-h-[520px]">
          <Tbl className="min-w-[1000px]">
            <THead>
              <tr>
                <Th>{X.entry}</Th>
                <Th>{X.tx}</Th>
                <Th>{X.recipient}</Th>
                <Th>{X.amount}</Th>
                <Th>{X.receiptHash}</Th>
                <Th>{X.memo}</Th>
                <Th>{X.decodedMemo}</Th>
              </tr>
            </THead>
            <tbody>
              {audit.transactions.map((t) => (
                <Tr key={t.entryId}>
                  <Td className="font-mono text-xs text-zinc-800">{t.entryId}</Td>
                  <Td>
                    <HashChip value={t.txHash} href={t.explorerUrl} what={X.txWhat} />
                  </Td>
                  <Td>
                    <CheckMark ok={t.recipientMatches} />
                    <div className="mt-0.5 font-mono text-[11px] text-zinc-400">{t.to ? `${t.to.slice(0, 8)}…${t.to.slice(-4)}` : "—"}</div>
                  </Td>
                  <Td>
                    <CheckMark ok={t.amountMatches} />
                    <div className="mt-0.5 text-[11px] text-zinc-400 tabular-nums">{fmtUsd(t.valueUsd)}</div>
                  </Td>
                  <Td>
                    <CheckMark ok={t.receiptHashMatches} />
                  </Td>
                  <Td>
                    <CheckMark ok={t.memoMatches} />
                  </Td>
                  <Td className="max-w-[340px]">
                    <code className="block font-mono text-[11px] leading-4 break-all text-zinc-600">{t.memo}</code>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Tbl>
        </TableShell>
      )}
    </Panel>
  );
}

function VerifyYourself({ id, records }: { id: string; records: Resource<MandateDetailResponse> }) {
  const V = useT().audit.page.verify;
  return (
    <Panel className="bg-zinc-900 text-zinc-100" as="section">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <SquareTerminal aria-hidden className="size-4 text-zinc-400" /> {V.title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">{V.body}</p>
        </div>
      </div>
      <EvidenceActions
        id={id}
        records={records.data}
        loading={records.loading || records.refreshing}
        error={records.error}
        onRetry={records.refresh}
        tone="dark"
        className="mt-4"
      />
      <p className="mt-3 flex items-start gap-2 text-xs text-zinc-400">
        <CircleCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
        {V.byHand}
      </p>
    </Panel>
  );
}

function AuditSkeleton() {
  const t = useT();
  return (
    <div className="space-y-6" aria-busy="true" aria-label={t.audit.page.loading}>
      <Skeleton className="h-[92px] rounded-xl" />
      <Skeleton className="h-[420px] rounded-xl" />
      <Skeleton className="h-[260px] rounded-xl" />
    </div>
  );
}

export default function AuditPage() {
  const params = useParams<{ mandateId: string }>();
  const raw = params?.mandateId ?? "";
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    // keep raw
  }
  const t = useT();
  const P = t.audit.page;
  const f = useFmt();
  const now = useNow(5000);
  const load = useCallback(() => api.audit(id), [id]);
  const audit = useResource(id ? load : null);
  // The raw records behind "Download records" (the audit response carries no ledger entries).
  const loadRecords = useCallback(() => api.mandate(id), [id]);
  const records = useResource(id ? loadRecords : null);
  const { refresh: refreshAudit } = audit;
  const { refresh: refreshRecords } = records;
  const rerun = useCallback(() => {
    refreshAudit();
    refreshRecords();
  }, [refreshAudit, refreshRecords]);

  return (
    <PageContainer>
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
            {audit.updatedAt !== null && (
              <span className="text-xs text-zinc-400 tabular-nums">{P.checked(f.rel(new Date(audit.updatedAt).toISOString(), now))}</span>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href={`/audit/${encodeURIComponent(id)}/report`}>
                <Printer aria-hidden />
                {P.printable}
              </Link>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={rerun} disabled={audit.refreshing || audit.loading}>
              <RefreshCw aria-hidden className={cn((audit.refreshing || audit.loading) && "animate-spin")} />
              {P.rerun}
            </Button>
          </>
        }
      />
      {audit.loading ? (
        <AuditSkeleton />
      ) : audit.error && !audit.data ? (
        <ErrorState
          title={audit.error.status === 404 ? t.audit.notFound(id) : P.runError}
          error={audit.error}
          onRetry={audit.refresh}
          retrying={audit.refreshing}
        />
      ) : audit.data ? (
        <div className={cn("space-y-6 transition-opacity", audit.refreshing && "opacity-60")}>
          {audit.error && (
            <p role="status" className="text-xs text-amber-700">
              {P.stale(audit.error.message)}
            </p>
          )}
          <Banner audit={audit.data} />
          <TermsSection audit={audit.data} />
          <ReplaySection audit={audit.data} />
          <TransactionsSection audit={audit.data} />
          <VerifyYourself id={audit.data.mandate.id} records={records} />
        </div>
      ) : null}
    </PageContainer>
  );
}
