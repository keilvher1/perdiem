"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import type { LedgerEntryView } from "@/contracts/api";
import { api } from "@/lib/api-client";
import { fmtUsd } from "@/lib/format";

/**
 * Polls GET confirm every `intervalMs` ONLY while the entry is pending with a tx hash
 * (live returns 400 otherwise), until it is settled or failed. Calls onUpdate once with the
 * final entry and optionally toasts "Settled on Sepolia, fee $0.0989".
 */
export function useConfirmPolling(
  entry: LedgerEntryView,
  onUpdate: (e: LedgerEntryView) => void,
  { intervalMs = 5000, notify = true }: { intervalMs?: number; notify?: boolean } = {},
): void {
  const active = entry.status === "pending" && Boolean(entry.txHash);
  const id = entry.id;
  useEffect(() => {
    if (!active) return;
    let alive = true;
    let inFlight = false;
    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const r = await api.confirm(id);
        if (!alive || r.entry.status === "pending") return;
        onUpdate(r.entry);
        if (!notify) return;
        if (r.entry.status === "settled") {
          const fee = r.entry.actualFeeUsd ?? (r.settlement.state === "settled" ? r.settlement.actualFeeUsd : r.entry.feeUsd);
          toast.success(`Settled on Sepolia, fee ${fmtUsd(fee)}`, {
            description: `${r.entry.merchantName ?? r.entry.proposal.merchantId} · ${fmtUsd(r.entry.proposal.amountUsd)} · ${r.entry.id}`,
          });
        } else if (r.entry.status === "failed") {
          toast.error("Transaction failed on Sepolia", {
            description: r.settlement.state === "failed" ? r.settlement.reason : r.entry.id,
          });
        }
      } catch {
        // Transient (network / RPC): keep polling.
      } finally {
        inFlight = false;
      }
    };
    const timer = setInterval(() => void tick(), intervalMs);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [active, id, intervalMs, notify, onUpdate]);
}
