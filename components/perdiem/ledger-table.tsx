"use client";

import { Fragment, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { LedgerEntryView } from "@/contracts/api";
import { fmtDate, fmtRel, fmtTime, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TableShell, Tbl, Td, Th, THead, Tr } from "./data-table";
import { HashChip } from "./hash-chip";
import { ReasonChips } from "./reason-chips";
import { StatusPill } from "./status-pill";

function Decision({ decision }: { decision: LedgerEntryView["decision"] }) {
  return decision === "APPROVE" ? (
    <span className="font-mono text-[11px] font-semibold text-emerald-700">APPROVE</span>
  ) : (
    <span className="font-mono text-[11px] font-semibold text-rose-700">STOP</span>
  );
}

function Detail({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm break-words text-zinc-800">{children}</dd>
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
  const rows = [...entries].reverse();
  return (
    <TableShell className={cn(maxHeightClass, className)}>
      <Tbl className="min-w-[980px]">
        <THead>
          <tr>
            <Th className="w-8 pr-0">
              <span className="sr-only">Details</span>
            </Th>
            <Th>Time</Th>
            <Th>Merchant</Th>
            <Th numeric>Amount</Th>
            <Th numeric>Fee</Th>
            <Th numeric>Total</Th>
            <Th>Decision</Th>
            <Th>Reasons</Th>
            <Th>Status</Th>
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
                  className={cn("cursor-pointer", isOpen && "bg-zinc-50", e.decision === "STOP" && "bg-rose-50/20")}
                  onClick={toggle}
                >
                  <Td className="w-8 pr-0">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? "Hide" : "Show"} details for ${e.id}`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        toggle();
                      }}
                      className="grid size-6 place-items-center rounded text-zinc-400 outline-none hover:bg-zinc-200/70 hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      <ChevronRight aria-hidden className={cn("size-4 transition-transform", isOpen && "rotate-90")} />
                    </button>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <div className="text-zinc-800 tabular-nums" title={fmtDate(e.at, true)}>
                      {fmtTime(e.at)}
                    </div>
                    <div className="text-xs text-zinc-400">{fmtRel(e.at, now)}</div>
                  </Td>
                  <Td>
                    <div className="max-w-[180px] truncate font-medium text-zinc-900">{e.merchantName ?? e.proposal.merchantId}</div>
                    <div className="text-xs text-zinc-500">{e.merchantCategory ?? "—"}</div>
                  </Td>
                  <Td numeric>{fmtUsd(e.proposal.amountUsd)}</Td>
                  <Td numeric>
                    <div>{fmtUsd(e.feeUsd)}</div>
                    {e.actualFeeUsd !== undefined && <div className="text-xs text-zinc-400">actual {fmtUsd(e.actualFeeUsd)}</div>}
                  </Td>
                  <Td numeric className={cn("font-medium", e.decision === "STOP" ? "text-zinc-400" : "text-zinc-900")}>
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
                    <HashChip value={e.txHash} href={e.explorerUrl} what="transaction hash" emptyText="nothing sent" />
                  </Td>
                </Tr>
                {isOpen && (
                  <tr className="border-b border-zinc-100 bg-zinc-50/70">
                    <td colSpan={10} className="px-4 pt-3 pb-4 sm:pl-11">
                      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Detail label="Traveler said" wide>
                          {e.proposal.sourceText ? `“${e.proposal.sourceText}”` : "—"}
                        </Detail>
                        <Detail label="Agent memo">{e.proposal.memo || "—"}</Detail>
                        <Detail label="Entry">
                          <span className="font-mono text-xs">{e.id}</span>
                        </Detail>
                        <Detail label="Mandate hash">
                          <HashChip value={e.mandateHash} what="mandate hash" />
                        </Detail>
                        <Detail label="Receipt hash">
                          <HashChip value={e.receiptHash} what="receipt hash" />
                        </Detail>
                        <Detail label="Fee source">{e.feeSource ?? "—"}</Detail>
                        <Detail label="Settled at">{e.settledAt ? fmtDate(e.settledAt, true) : "—"}</Detail>
                        <Detail label="Kiln response id">
                          <span className="font-mono text-xs">{e.kilnResponseId ?? "—"}</span>
                        </Detail>
                        <Detail label="Tool call arguments (raw, from the model)" wide>
                          {e.toolArgsRaw ? (
                            <code className="block rounded-md bg-white px-2 py-1.5 font-mono text-xs break-all text-zinc-700 ring-1 ring-zinc-200">
                              {e.toolArgsRaw}
                            </code>
                          ) : (
                            "—"
                          )}
                        </Detail>
                      </dl>
                      {e.reasons.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-1.5 text-xs text-zinc-500">Stop reasons</p>
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
