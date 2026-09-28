"use client";

import { useState } from "react";
import { Ban, CirclePause, LoaderCircle, Play } from "lucide-react";
import { toast } from "sonner";
import type { MandateDetail, MandateStatus } from "@/contracts/api";
import { api, toApiClientError } from "@/lib/api-client";
import { fmtDate, fmtUsd } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HashChip } from "@/components/perdiem/hash-chip";
import { Panel, StatTile } from "@/components/perdiem/page";
import { effectiveMandateStatus, StatusPill } from "@/components/perdiem/status-pill";

type Action = "pause" | "resume" | "revoke";
const TARGET: Record<Action, MandateStatus> = { pause: "paused", resume: "active", revoke: "revoked" };

/** Selected mandate: tiles, Pause / Resume / Revoke (Revoke is confirmed and final), hashes. */
export function MandateControls({
  mandate,
  now,
  onChanged,
}: {
  mandate: MandateDetail;
  now: number | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const eff = effectiveMandateStatus(mandate, now);
  const revoked = mandate.status === "revoked";

  const run = async (action: Action) => {
    setBusy(action);
    try {
      const res = await api.updateMandateStatus(mandate.id, TARGET[action]);
      const s = res.mandate.status;
      if (s === "paused") toast.success(`${mandate.id} paused`, { description: "The kill switch is on: every agent request is stopped and recorded." });
      else if (s === "active") toast.success(`${mandate.id} resumed`, { description: "The agent can propose again, inside the same terms." });
      else toast.success(`${mandate.id} revoked`, { description: "Final. The mandate can no longer spend." });
      onChanged();
    } catch (e) {
      const err = toApiClientError(e);
      toast.error(`Could not ${action} ${mandate.id}`, { description: `${err.message} (${err.code})` });
    } finally {
      setBusy(null);
      setConfirmOpen(false);
    }
  };

  return (
    <Panel className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-base font-semibold text-zinc-900">{mandate.id}</h2>
            <StatusPill status={eff} />
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            <span className="font-medium text-zinc-700">{mandate.traveler}</span> on behalf of{" "}
            <span className="font-medium text-zinc-700">{mandate.principal}</span> · cap {fmtUsd(mandate.perTxCapUsd)} per payment
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 tabular-nums">
            {fmtDate(mandate.startsAt)} → {fmtDate(mandate.expiresAt, true)} · {mandate.allowedCategories.join(", ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mandate.status === "paused" ? (
            <Button type="button" onClick={() => void run("resume")} disabled={busy !== null || revoked}>
              {busy === "resume" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Play aria-hidden />}
              Resume
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => void run("pause")} disabled={busy !== null || revoked}>
              {busy === "pause" ? <LoaderCircle aria-hidden className="animate-spin" /> : <CirclePause aria-hidden />}
              Pause
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
            onClick={() => setConfirmOpen(true)}
            disabled={busy !== null || revoked}
          >
            <Ban aria-hidden />
            {revoked ? "Revoked" : "Revoke"}
          </Button>
        </div>
      </div>

      {revoked && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200 ring-inset">
          Revoked — this is final. Pause and resume are disabled; every request against this mandate is stopped and recorded.
        </p>
      )}
      {eff === "expired" && !revoked && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200 ring-inset">
          The trip window closed on {fmtDate(mandate.expiresAt, true)}. Requests are stopped with EXPIRED regardless of status.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Budget" value={fmtUsd(mandate.budgetUsd)} />
        <StatTile label="Spent" value={fmtUsd(mandate.spentUsd)} hint="approved + pending + settled" />
        <StatTile label="Pending" value={fmtUsd(mandate.pendingUsd)} tone={mandate.pendingUsd > 0 ? "amber" : "default"} hint="broadcast, not yet mined" />
        <StatTile
          label="Remaining"
          value={fmtUsd(mandate.remainingUsd)}
          tone={mandate.remainingUsd <= 0 ? "rose" : "emerald"}
          hint={`${Math.max(0, Math.round((mandate.remainingUsd / mandate.budgetUsd) * 100))}% of budget`}
        />
      </div>

      <div className="grid gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-zinc-500">Mandate hash (terms, excludes status)</p>
          <HashChip value={mandate.hash} what="mandate hash" />
        </div>
        <div>
          <p className="mb-1 text-xs text-zinc-500">Anchor transaction on Sepolia</p>
          <HashChip value={mandate.anchorTx} href={mandate.anchorUrl} what="anchor transaction" emptyText="not anchored" />
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(o) => busy === null && setConfirmOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke {mandate.id}?</DialogTitle>
            <DialogDescription>
              Revoking is final. The agent will be stopped on every request under this mandate, and it cannot be resumed. Past receipts
              and the on-chain anchor stay verifiable.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={busy !== null}>
                Keep it
              </Button>
            </DialogClose>
            <Button
              type="button"
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => void run("revoke")}
              disabled={busy !== null}
            >
              {busy === "revoke" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Ban aria-hidden />}
              Revoke mandate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
