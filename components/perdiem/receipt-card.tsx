"use client";

import { ArrowUpRight } from "lucide-react";
import type { LedgerEntryView } from "@/contracts/api";
import { Button } from "@/components/ui/button";
import { fmtUsd } from "@/lib/format";
import type { Messages } from "@/lib/i18n/messages";
import { useFmt, useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { HashChip } from "./hash-chip";
import { ReasonList } from "./reason-chips";
import { StateGlyph } from "./state-glyph";
import { StatusPill } from "./status-pill";
import { STOP_CODES } from "./stop-codes";

function Row({ label, value, strong = false, hint }: { label: string; value: string; strong?: boolean; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <dt className="text-muted-ink">
        {label}
        {hint && <span className="ml-1.5 text-xs text-muted-ink">{hint}</span>}
      </dt>
      <dd className={cn("text-right tabular-nums", strong ? "font-semibold text-ink" : "text-ink")}>{value}</dd>
    </div>
  );
}

function MerchantLine({ entry }: { entry: LedgerEntryView }) {
  const t = useT();
  const said = entry.proposal.sourceText?.trim();
  const category = entry.merchantCategory;
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-ink">{entry.merchantName ?? entry.proposal.merchantId}</p>
      <p className="truncate text-xs text-muted-ink">
        {category != null ? (t.common.category[category] ?? category) : t.receipt.unknownCategory} ·{" "}
        <span className="font-mono">{entry.proposal.merchantId}</span>
        {entry.proposal.memo ? <> · {t.receipt.quoted(entry.proposal.memo)}</> : null}
      </p>
      {/* Plain text only (React escapes it); the title carries the full request. */}
      {said ? (
        <p className="mt-0.5 truncate text-xs text-muted-ink" title={said}>
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
        "overflow-hidden rounded-lg border bg-surface",
        failed ? "border-danger-line" : "border-approve-line",
        className,
      )}
    >
      <header className={cn("flex items-center justify-between gap-3 px-4 py-2.5", failed ? "bg-danger-soft" : "bg-approve-soft")}>
        <div className="flex items-center gap-2">
          <StateGlyph
            glyph={failed ? "triangle" : "circle"}
            className={cn("size-3.5", failed ? "text-danger" : "text-approve")}
          />
          <span className={cn("text-sm font-semibold", failed ? "text-danger" : "text-approve")}>
            {failed ? failedHeadline(entry, tr) : tr.approvedHeadline}
          </span>
        </div>
        <StatusPill status={entry.status} />
      </header>
      <div className="space-y-3 px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <MerchantLine entry={entry} />
          <p className="shrink-0 text-right text-xl font-semibold tracking-tight text-ink tabular-nums">{fmtUsd(entry.proposal.amountUsd)}</p>
        </div>
        <dl className="border-t border-line pt-2 text-sm">
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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3">
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
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-2 px-4 py-2">
        <p className="text-xs text-muted-ink">
          {tr.recordedAs}
          <span className="font-mono text-ink">{entry.id}</span> · {f.time(entry.at)}
          {settled && entry.settledAt ? <> · {tr.settledAt(f.time(entry.settledAt))}</> : null}
        </p>
        {entry.explorerUrl && (
          <Button asChild variant="outline" size="sm" className="bg-surface">
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
      className={cn("overflow-hidden rounded-lg border border-stop-line bg-surface", className)}
    >
      <header className="flex items-center justify-between gap-3 bg-stop-soft px-4 py-2.5">
        <div className="flex items-center gap-2">
          <StateGlyph glyph="square" className="size-3.5 text-stop" />
          <span className="text-sm font-semibold text-stop">{tr.stoppedHeadline}</span>
        </div>
        <StatusPill status="stopped" />
      </header>
      <div className="space-y-3 px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <MerchantLine entry={entry} />
          <div className="shrink-0 text-right">
            <p className="text-xl font-semibold tracking-tight text-muted-ink tabular-nums line-through decoration-stop-line decoration-2">
              {fmtUsd(entry.proposal.amountUsd)}
            </p>
            <p className="text-xs text-muted-ink">{tr.requestedNoneSent}</p>
          </div>
        </div>
        <div className="border-t border-line pt-3">
          <p className="mb-2 text-xs font-medium text-muted-ink">{tr.checksFailed(n, STOP_CODES.length)}</p>
          <ReasonList reasons={entry.reasons} />
        </div>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-2 px-4 py-2">
        <p className="text-xs text-muted-ink">
          {tr.recordedAs}
          <span className="font-mono text-ink">{entry.id}</span> · {f.time(entry.at)} · {tr.noBroadcast}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <HashChip label={tr.hash.receipt} what={tr.hash.receiptWhat} value={entry.receiptHash} />
          <HashChip label={tr.hash.mandate} what={tr.hash.mandateWhat} value={entry.mandateHash} />
        </div>
      </footer>
    </article>
  );
}
