"use client";

import type { LedgerEntryView } from "@/contracts/api";
import { fmtUsd } from "@/lib/format";
import { useFmt, useT } from "@/lib/i18n/provider";
import { executionState, pastNow } from "@/lib/ui-state";
import { cn } from "@/lib/utils";
import { TableShell, Tbl, Td, Th, THead, Tr } from "./data-table";
import { HashChip } from "./hash-chip";
import { StateBadge } from "./state-badge";

/**
 * Payments register: every APPROVED entry (newest first) and what happened to it on-chain —
 * execution state, network fee as recorded (plus the actual fee once mined), total, transaction
 * and receipt hashes. Stops send nothing and have no row. Decisions and their evidence live in
 * the DecisionLedger / EvidencePanel; this table is the execution view of the same records.
 * A fee recorded with feeSource "none" is not a real fee and is shown as "—", never "$0.00".
 */
export function LedgerTable({
  entries,
  now,
  caption,
  selectedId = null,
  className,
  maxHeightClass,
}: {
  /** Oldest first, as the API returns them; stops are filtered out here. */
  entries: LedgerEntryView[];
  now: number | null;
  /** Accessible table caption (sr-only). */
  caption?: string;
  /** The decision selected in the ledger: its row carries the shared selected marker. */
  selectedId?: string | null;
  className?: string;
  maxHeightClass?: string;
}) {
  const t = useT();
  const f = useFmt();
  const tl = t.ledger;
  const tp = tl.payments;
  const rows = entries.filter((e) => e.decision === "APPROVE").reverse();

  return (
    <TableShell className={cn(maxHeightClass, className)}>
      {/* Phones: Time and Merchant only, with the total and the execution state under the merchant
          (their own columns from sm), so no payment reads as having no amount or status. */}
      <Tbl className="sm:min-w-[600px] md:min-w-[860px]">
        {caption && <caption className="sr-only">{caption}</caption>}
        <THead>
          <tr>
            <Th className="pl-4">{tp.col.time}</Th>
            <Th className="max-sm:pr-4">{tp.col.merchant}</Th>
            <Th numeric className="max-md:hidden">{tp.col.amount}</Th>
            <Th numeric className="max-md:hidden">{tp.col.fee}</Th>
            <Th numeric className="max-sm:hidden">{tp.col.total}</Th>
            <Th className="max-sm:hidden">{tp.col.execution}</Th>
            <Th className="max-sm:hidden">{tp.col.tx}</Th>
            <Th className="pr-4 max-md:hidden">{tp.col.receipt}</Th>
          </tr>
        </THead>
        <tbody>
          {rows.map((e) => {
            const exec = executionState(e);
            const noFee = e.feeSource === "none";
            const source = e.feeSource ? (tl.feeSourceValue[e.feeSource] ?? e.feeSource) : null;
            // Same rule as EvidencePanel: a feeSource "none" total holds no fee.
            const total = noFee ? t.ui.evidence.values.amountOnly(fmtUsd(e.totalUsd)) : fmtUsd(e.totalUsd);
            return (
              <Tr key={e.id} data-entry-id={e.id} className={cn(e.id === selectedId && "selected-marker hover:bg-cobalt-soft")}>
                <Td className="pl-4 whitespace-nowrap">
                  <time dateTime={e.at} title={f.date(e.at, true)} className="block text-ink tabular-nums">
                    {f.time(e.at)}
                  </time>
                  <span className="text-xs text-muted-ink">{f.rel(e.at, pastNow(e.at, now))}</span>
                </Td>
                <Td className="max-sm:pr-4">
                  <div className="max-w-[200px] truncate font-medium text-ink" title={e.merchantName ?? e.proposal.merchantId}>
                    {e.merchantName ?? e.proposal.merchantId}
                  </div>
                  <div className="text-xs text-muted-ink max-sm:hidden">
                    {e.merchantCategory != null ? (t.common.category[e.merchantCategory] ?? e.merchantCategory) : "—"}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 sm:hidden">
                    <span className="font-medium tabular-nums">
                      <span className="sr-only">{tp.col.total}: </span>
                      {total}
                    </span>
                    {exec && <StateBadge family="execution" state={exec} />}
                  </div>
                </Td>
                <Td numeric className="max-md:hidden">{fmtUsd(e.proposal.amountUsd)}</Td>
                <Td numeric className="max-md:hidden">
                  <div>{noFee ? "—" : fmtUsd(e.feeUsd)}</div>
                  <div className="text-xs text-muted-ink">
                    {e.actualFeeUsd !== undefined ? tl.actualFee(fmtUsd(e.actualFeeUsd)) : (source ?? "")}
                  </div>
                </Td>
                <Td numeric className="font-medium max-sm:hidden">
                  {total}
                </Td>
                <Td className="max-sm:hidden">{exec && <StateBadge family="execution" state={exec} />}</Td>
                <Td className="max-sm:hidden max-md:pr-4">
                  <HashChip value={e.txHash} href={e.explorerUrl} what={tl.txWhat} emptyText={tp.notBroadcast} />
                </Td>
                <Td className="pr-4 max-md:hidden">
                  <HashChip value={e.receiptHash} what={tl.receiptHashWhat} />
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Tbl>
    </TableShell>
  );
}

/** Number of rows LedgerTable would render (approved entries). */
export function countPayments(entries: Pick<LedgerEntryView, "decision">[]): number {
  return entries.filter((e) => e.decision === "APPROVE").length;
}
