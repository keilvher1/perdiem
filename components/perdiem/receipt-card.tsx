"use client";

import { ArrowUpRight, CircleX, OctagonX, ShieldCheck } from "lucide-react";
import type { LedgerEntryView } from "@/contracts/api";
import { Button } from "@/components/ui/button";
import { fmtUsd } from "@/lib/format";
import type { Messages } from "@/lib/i18n/messages";
import { useFmt, useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { HashChip } from "./hash-chip";
import { ReasonList } from "./reason-chips";
import { StatusPill } from "./status-pill";
import { STOP_CODES } from "./stop-codes";

function Row({ label, value, strong = false, hint }: { label: string; value: string; strong?: boolean; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <dt className="text-zinc-500">
        {label}
        {hint && <span className="ml-1.5 text-xs text-zinc-400">{hint}</span>}
      </dt>
      <dd className={cn("tabular-nums", strong ? "font-semibold text-zinc-900" : "text-zinc-700")}>{value}</dd>
    </div>
  );
}

function MerchantLine({ entry }: { entry: LedgerEntryView }) {
  const t = useT();
  const said = entry.proposal.sourceText?.trim();
  const category = entry.merchantCategory;
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-zinc-900">{entry.merchantName ?? entry.proposal.merchantId}</p>
      <p className="truncate text-xs text-zinc-500">
        {category != null ? (t.common.category[category] ?? category) : t.receipt.unknownCategory} ·{" "}
        <span className="font-mono">{entry.proposal.merchantId}</span>
        {entry.proposal.memo ? <> · {t.receipt.quoted(entry.proposal.memo)}</> : null}
      </p>
      {/* Plain text only (React escapes it); the title carries the full request. */}
      {said ? (
        <p className="mt-0.5 truncate text-xs text-zinc-400" title={said}>
          {t.receipt.youSaid(said)}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The receipt under an agent reply. APPROVED and STOPPED get the same weight: a stop is a
 * recorded decision with reasons, not an error.
 */
export function ReceiptCard({ entry, className }: { entry: LedgerEntryView; className?: string }) {
  if (entry.decision === "STOP") return <StoppedCard entry={entry} className={className} />;
  return <ApprovedCard entry={entry} className={className} />;
}

/**
 * A failed approval never counts against the budget (lib/view.ts spends only approved|pending|
 * settled). Without a txHash the broadcast call itself errored; with one, the confirm route saw
 * the transaction revert on-chain.
 */
function failedHeadline(entry: LedgerEntryView, tr: Messages["receipt"]): string {
  return entry.txHash ? tr.failedOnChain : tr.broadcastUnconfirmed;
}

function ApprovedCard({ entry, className }: { entry: LedgerEntryView; className?: string }) {
  const t = useT();
  const f = useFmt();
  const tr = t.receipt;
  const failed = entry.status === "failed";
  const settled = entry.status === "settled";
  return (
    <article
      aria-label={
        failed
          ? tr.aria.approvedFailed(entry.id, failedHeadline(entry, tr))
          : tr.aria.approved(entry.id, tr.status[entry.status] ?? entry.status)
      }
      className={cn(
        "overflow-hidden rounded-xl border bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)]",
        failed ? "border-slate-300" : "border-emerald-200",
        className,
      )}
    >
      <header className={cn("flex items-center justify-between gap-3 px-4 py-2.5", failed ? "bg-slate-50" : "bg-emerald-50/70")}>
        <div className="flex items-center gap-2">
          {failed ? (
            <CircleX aria-hidden className="size-4.5 text-slate-600" />
          ) : (
            <ShieldCheck aria-hidden className="size-4.5 text-emerald-600" />
          )}
          <span className={cn("text-sm font-semibold", failed ? "text-slate-800" : "text-emerald-800")}>
            {failed ? failedHeadline(entry, tr) : tr.approvedHeadline}
          </span>
        </div>
        <StatusPill status={entry.status} />
      </header>
      <div className="space-y-3 px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <MerchantLine entry={entry} />
          <p className="shrink-0 text-xl font-semibold tracking-tight text-zinc-900 tabular-nums">{fmtUsd(entry.proposal.amountUsd)}</p>
        </div>
        <dl className="border-t border-zinc-100 pt-2 text-sm">
          <Row label={tr.rows.amount} value={fmtUsd(entry.proposal.amountUsd)} />
          <Row
            label={tr.rows.networkFee}
            hint={entry.feeSource === "fallback" ? tr.rows.fallbackEstimate : tr.rows.estimate}
            value={fmtUsd(entry.feeUsd)}
          />
          {settled && entry.actualFeeUsd !== undefined && (
            <Row label={tr.rows.actualFee} hint={tr.rows.afterMining} value={fmtUsd(entry.actualFeeUsd)} />
          )}
          {failed ? (
            <Row label={tr.rows.notCounted} hint={tr.rows.paymentFailed} value={fmtUsd(0)} strong />
          ) : (
            <Row label={tr.rows.counted} value={fmtUsd(entry.totalUsd)} strong />
          )}
        </dl>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-100 pt-3">
          <HashChip
            label={tr.hash.tx}
            what={tr.hash.txWhat}
            value={entry.txHash}
            href={entry.explorerUrl}
            emptyText={tr.hash.notBroadcast}
          />
          <HashChip label={tr.hash.receipt} what={tr.hash.receiptWhat} value={entry.receiptHash} />
          <HashChip label={tr.hash.mandate} what={tr.hash.mandateWhat} value={entry.mandateHash} />
        </div>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/60 px-4 py-2">
        <p className="text-xs text-zinc-500">
          {tr.recordedAs}
          <span className="font-mono text-zinc-700">{entry.id}</span> · {f.time(entry.at)}
          {settled && entry.settledAt ? <> · {tr.settledAt(f.time(entry.settledAt))}</> : null}
        </p>
        {entry.explorerUrl && (
          <Button asChild variant="outline" size="sm" className="bg-white">
            <a href={entry.explorerUrl} target="_blank" rel="noopener noreferrer">
              {tr.viewOnEtherscan}
              <ArrowUpRight aria-hidden />
            </a>
          </Button>
        )}
      </footer>
    </article>
  );
}

function StoppedCard({ entry, className }: { entry: LedgerEntryView; className?: string }) {
  const t = useT();
  const f = useFmt();
  const tr = t.receipt;
  const n = entry.reasons.length;
  return (
    <article
      aria-label={tr.aria.stopped(entry.id, n)}
      className={cn("overflow-hidden rounded-xl border border-rose-200 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)]", className)}
    >
      <header className="flex items-center justify-between gap-3 bg-rose-50/70 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <OctagonX aria-hidden className="size-4.5 text-rose-600" />
          <span className="text-sm font-semibold text-rose-800">{tr.stoppedHeadline}</span>
        </div>
        <StatusPill status="stopped" />
      </header>
      <div className="space-y-3 px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <MerchantLine entry={entry} />
          <div className="shrink-0 text-right">
            <p className="text-xl font-semibold tracking-tight text-zinc-400 tabular-nums line-through decoration-rose-300 decoration-2">
              {fmtUsd(entry.proposal.amountUsd)}
            </p>
            <p className="text-xs text-zinc-500">{tr.requestedNoneSent}</p>
          </div>
        </div>
        <div className="border-t border-zinc-100 pt-3">
          <p className="mb-2 text-xs font-medium text-zinc-500">{tr.checksFailed(n, STOP_CODES.length)}</p>
          <ReasonList reasons={entry.reasons} />
        </div>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/60 px-4 py-2">
        <p className="text-xs text-zinc-500">
          {tr.recordedAs}
          <span className="font-mono text-zinc-700">{entry.id}</span> · {f.time(entry.at)} · {tr.noBroadcast}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <HashChip label={tr.hash.receipt} what={tr.hash.receiptWhat} value={entry.receiptHash} />
          <HashChip label={tr.hash.mandate} what={tr.hash.mandateWhat} value={entry.mandateHash} />
        </div>
      </footer>
    </article>
  );
}
