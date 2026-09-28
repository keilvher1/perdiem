"use client";

import { ArrowUpRight, CircleX, OctagonX, ShieldCheck } from "lucide-react";
import type { LedgerEntryView } from "@/contracts/api";
import { Button } from "@/components/ui/button";
import { fmtTime, fmtUsd } from "@/lib/format";
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
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-zinc-900">{entry.merchantName ?? entry.proposal.merchantId}</p>
      <p className="truncate text-xs text-zinc-500">
        {entry.merchantCategory ?? "unknown category"} · <span className="font-mono">{entry.proposal.merchantId}</span>
        {entry.proposal.memo ? <> · “{entry.proposal.memo}”</> : null}
      </p>
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

function ApprovedCard({ entry, className }: { entry: LedgerEntryView; className?: string }) {
  const failed = entry.status === "failed";
  const settled = entry.status === "settled";
  return (
    <article
      aria-label={`Receipt ${entry.id}: ${failed ? "approved, broadcast failed" : `approved, ${entry.status}`}`}
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
            {failed ? "Approved — broadcast failed, nothing settled" : "Approved — inside the mandate"}
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
          <Row label="Amount" value={fmtUsd(entry.proposal.amountUsd)} />
          <Row label="Network fee" hint={entry.feeSource === "fallback" ? "fallback estimate" : "estimate"} value={fmtUsd(entry.feeUsd)} />
          {settled && entry.actualFeeUsd !== undefined && <Row label="Actual fee" hint="after mining" value={fmtUsd(entry.actualFeeUsd)} />}
          <Row label="Counted against budget" value={fmtUsd(entry.totalUsd)} strong />
        </dl>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-100 pt-3">
          <HashChip label="tx" what="transaction hash" value={entry.txHash} href={entry.explorerUrl} emptyText="not broadcast" />
          <HashChip label="receipt" what="receipt hash" value={entry.receiptHash} />
        </div>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/60 px-4 py-2">
        <p className="text-xs text-zinc-500">
          Recorded in ledger as <span className="font-mono text-zinc-700">{entry.id}</span> · {fmtTime(entry.at)}
          {settled && entry.settledAt ? <> · settled {fmtTime(entry.settledAt)}</> : null}
        </p>
        {entry.explorerUrl && (
          <Button asChild variant="outline" size="sm" className="bg-white">
            <a href={entry.explorerUrl} target="_blank" rel="noopener noreferrer">
              View on Etherscan
              <ArrowUpRight aria-hidden />
            </a>
          </Button>
        )}
      </footer>
    </article>
  );
}

function StoppedCard({ entry, className }: { entry: LedgerEntryView; className?: string }) {
  const n = entry.reasons.length;
  return (
    <article
      aria-label={`Receipt ${entry.id}: stopped, ${n} reason${n === 1 ? "" : "s"}`}
      className={cn("overflow-hidden rounded-xl border border-rose-200 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)]", className)}
    >
      <header className="flex items-center justify-between gap-3 bg-rose-50/70 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <OctagonX aria-hidden className="size-4.5 text-rose-600" />
          <span className="text-sm font-semibold text-rose-800">Stopped — nothing was sent</span>
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
            <p className="text-xs text-zinc-500">requested · $0.00 sent</p>
          </div>
        </div>
        <div className="border-t border-zinc-100 pt-3">
          <p className="mb-2 text-xs font-medium text-zinc-500">
            {n} of {STOP_CODES.length} boundary checks failed
          </p>
          <ReasonList reasons={entry.reasons} />
        </div>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/60 px-4 py-2">
        <p className="text-xs text-zinc-500">
          Recorded in ledger as <span className="font-mono text-zinc-700">{entry.id}</span> · {fmtTime(entry.at)} · no transaction broadcast
        </p>
        <HashChip label="receipt" what="receipt hash" value={entry.receiptHash} />
      </footer>
    </article>
  );
}
