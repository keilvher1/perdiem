"use client";

import { Fragment, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { LedgerEntryView } from "@/contracts/api";
import { fmtUsd } from "@/lib/format";
import { useFmt, useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { TableShell, Tbl, Td, Th, THead, Tr } from "./data-table";
import { HashChip } from "./hash-chip";
import { ReasonChips } from "./reason-chips";
import { StateBadge } from "./state-badge";
import { StatusPill } from "./status-pill";

/** Decision as glyph + label (approve ●, stop ■ amber — a stop is a recorded decision, not an error). */
function Decision({ decision }: { decision: LedgerEntryView["decision"] }) {
  return <StateBadge family="decision" state={decision === "APPROVE" ? "approve" : "stop"} variant="plain" />;
}

function Detail({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <dt className="text-xs text-muted-ink">{label}</dt>
      <dd className="mt-0.5 text-sm break-words text-ink">{children}</dd>
    </div>
  );
}

/**
 * Ledger rows oldest first (as the API returns them) — shown newest first. Click a row to see
 * the proposal, hashes and the Kiln evidence (response id + raw tool arguments).
 */
export function LedgerTable({
  entries,
  now,
  className,
  maxHeightClass = "max-h-[560px]",
}: {
  entries: LedgerEntryView[];
  now: number | null;
  className?: string;
  maxHeightClass?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const t = useT();
  const f = useFmt();
  const tl = t.ledger;
  const rows = [...entries].reverse();
  return (
    <TableShell className={cn(maxHeightClass, className)}>
      <Tbl className="min-w-[980px]">
        <THead>
          <tr>
            <Th className="w-8 pr-0">
              <span className="sr-only">{tl.details}</span>
            </Th>
            <Th>{tl.col.time}</Th>
            <Th>{tl.col.merchant}</Th>
            <Th numeric>{tl.col.amount}</Th>
            <Th numeric>{tl.col.fee}</Th>
            <Th numeric>{tl.col.total}</Th>
            <Th>{tl.col.decision}</Th>
            <Th>{tl.col.reasons}</Th>
            <Th>{tl.col.status}</Th>
            <Th>Tx</Th>
          </tr>
        </THead>
        <tbody>
          {rows.map((e) => {
            const isOpen = open === e.id;
            const toggle = () => setOpen(isOpen ? null : e.id);
            return (
              <Fragment key={e.id}>
                <Tr
                  className={cn("cursor-pointer", isOpen && "bg-surface-2")}
                  onClick={toggle}
                >
                  <Td className="w-8 pr-0">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-label={isOpen ? tl.hideDetails(e.id) : tl.showDetails(e.id)}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        toggle();
                      }}
                      className="grid size-6 place-items-center rounded-md text-muted-ink outline-none hover:bg-line hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ChevronRight aria-hidden className={cn("size-4 transition-transform duration-150", isOpen && "rotate-90")} />
                    </button>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <div className="text-ink tabular-nums" title={f.date(e.at, true)}>
                      {f.time(e.at)}
                    </div>
                    <div className="text-xs text-muted-ink">{f.rel(e.at, now)}</div>
                  </Td>
                  <Td>
                    <div className="max-w-[180px] truncate font-medium text-ink">{e.merchantName ?? e.proposal.merchantId}</div>
                    <div className="text-xs text-muted-ink">{e.merchantCategory != null ? (t.common.category[e.merchantCategory] ?? e.merchantCategory) : "—"}</div>
                  </Td>
                  <Td numeric>{fmtUsd(e.proposal.amountUsd)}</Td>
                  <Td numeric>
                    <div>{fmtUsd(e.feeUsd)}</div>
                    {e.actualFeeUsd !== undefined && <div className="text-xs text-muted-ink">{tl.actualFee(fmtUsd(e.actualFeeUsd))}</div>}
                  </Td>
                  <Td numeric className={cn("font-medium", e.decision === "STOP" ? "text-muted-ink" : "text-ink")}>
                    {fmtUsd(e.totalUsd)}
                  </Td>
                  <Td>
                    <Decision decision={e.decision} />
                  </Td>
                  <Td className="max-w-[260px]">
                    <ReasonChips reasons={e.reasons} compact />
                  </Td>
                  <Td>
                    <StatusPill status={e.status} size="xs" />
                  </Td>
                  <Td onClick={(ev) => ev.stopPropagation()}>
                    <HashChip value={e.txHash} href={e.explorerUrl} what={tl.txWhat} emptyText={tl.nothingSent} />
                  </Td>
                </Tr>
                {isOpen && (
                  <tr className="border-b border-line bg-surface-2">
                    <td colSpan={10} className="px-4 pt-3 pb-4 sm:pl-11">
                      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Detail label={tl.travelerSaid} wide>
                          {e.proposal.sourceText ? tl.quote(e.proposal.sourceText) : "—"}
                        </Detail>
                        <Detail label={tl.agentMemo}>{e.proposal.memo || "—"}</Detail>
                        <Detail label={tl.entry}>
                          <span className="font-mono text-xs">{e.id}</span>
                        </Detail>
                        <Detail label={tl.mandateHash}>
                          <HashChip value={e.mandateHash} what={tl.mandateHashWhat} />
                        </Detail>
                        <Detail label={tl.receiptHash}>
                          <HashChip value={e.receiptHash} what={tl.receiptHashWhat} />
                        </Detail>
                        <Detail label={tl.feeSource}>{e.feeSource != null ? (tl.feeSourceValue[e.feeSource] ?? e.feeSource) : "—"}</Detail>
                        <Detail label={tl.settledAt}>{e.settledAt ? f.date(e.settledAt, true) : "—"}</Detail>
                        <Detail label={tl.kilnResponseId}>
                          <span className="font-mono text-xs">{e.kilnResponseId ?? "—"}</span>
                        </Detail>
                        <Detail label={tl.toolArgs} wide>
                          {e.toolArgsRaw ? (
                            <code className="block rounded-md bg-surface px-2 py-1.5 font-mono text-xs break-all text-ink ring-1 ring-line">
                              {e.toolArgsRaw}
                            </code>
                          ) : (
                            "—"
                          )}
                        </Detail>
                      </dl>
                      {e.reasons.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-1.5 text-xs text-muted-ink">{tl.stopReasons}</p>
                          <ReasonChips reasons={e.reasons} />
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </Tbl>
    </TableShell>
  );
}
