"use client";

import { useState } from "react";
import { Ban, CirclePause, LoaderCircle, Play } from "lucide-react";
import { toast } from "sonner";
import type { MandateDetail, MandateStatus } from "@/contracts/api";
import { api, toApiClientError } from "@/lib/api-client";
import { fmtUsd } from "@/lib/format";
import { useFmt, useT } from "@/lib/i18n/provider";
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
import {
  effectiveMandateStatus,
  StatusPill,
} from "@/components/perdiem/status-pill";

type Action = "pause" | "resume" | "revoke";
const TARGET: Record<Action, MandateStatus> = {
  pause: "paused",
  resume: "active",
  revoke: "revoked",
};

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
  const t = useT();
  const f = useFmt();
  const tc = t.principal.controls;
  const eff = effectiveMandateStatus(mandate, now);
  const revoked = mandate.status === "revoked";

  const run = async (action: Action) => {
    setBusy(action);
    try {
      const res = await api.updateMandateStatus(mandate.id, TARGET[action]);
      const s = res.mandate.status;
      if (s === "paused")
        toast.success(tc.paused(mandate.id), { description: tc.pausedHint });
      else if (s === "active")
        toast.success(tc.resumed(mandate.id), { description: tc.resumedHint });
      else
        toast.success(tc.revokedToast(mandate.id), {
          description: tc.revokedHint,
        });
      onChanged();
    } catch (e) {
      const err = toApiClientError(e);
      toast.error(tc.failed[action](mandate.id), {
        description: `${err.message} (${err.code})`,
      });
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
            <h2 className="font-mono text-base font-semibold text-zinc-900">
              {mandate.id}
            </h2>
            <StatusPill status={eff} />
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {tc.byline(
              <span key="traveler" className="font-medium text-zinc-700">
                {mandate.traveler}
              </span>,
              <span key="principal" className="font-medium text-zinc-700">
                {mandate.principal}
              </span>,
              fmtUsd(mandate.perTxCapUsd),
            )}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 tabular-nums">
            {f.date(mandate.startsAt)} → {f.date(mandate.expiresAt, true)} ·{" "}
            {mandate.allowedCategories
              .map((c) => t.common.category[c] ?? c)
              .join(t.principal.listSep)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mandate.status === "paused" ? (
            <Button
              type="button"
              onClick={() => void run("resume")}
              disabled={busy !== null || revoked}
            >
              {busy === "resume" ? (
                <LoaderCircle aria-hidden className="animate-spin" />
              ) : (
                <Play aria-hidden />
              )}
              {tc.resume}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => void run("pause")}
              disabled={busy !== null || revoked}
            >
              {busy === "pause" ? (
                <LoaderCircle aria-hidden className="animate-spin" />
              ) : (
                <CirclePause aria-hidden />
              )}
              {tc.pause}
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
            {revoked ? tc.revoked : tc.revoke}
          </Button>
        </div>
      </div>

      {revoked && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200 ring-inset">
          {tc.revokedNotice}
        </p>
      )}
      {eff === "expired" && !revoked && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200 ring-inset">
          {tc.expiredNotice(f.date(mandate.expiresAt, true))}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={tc.budget} value={fmtUsd(mandate.budgetUsd)} />
        <StatTile
          label={tc.spent}
          value={fmtUsd(mandate.spentUsd)}
          hint={tc.spentHint}
        />
        <StatTile
          label={tc.pending}
          value={fmtUsd(mandate.pendingUsd)}
          tone={mandate.pendingUsd > 0 ? "amber" : "default"}
          hint={tc.pendingHint}
        />
        <StatTile
          label={tc.remaining}
          value={fmtUsd(mandate.remainingUsd)}
          tone={mandate.remainingUsd <= 0 ? "rose" : "emerald"}
          hint={tc.remainingHint(
            Math.max(
              0,
              Math.round((mandate.remainingUsd / mandate.budgetUsd) * 100),
            ),
          )}
        />
      </div>

      <div className="grid gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-zinc-500">{tc.mandateHash}</p>
          <HashChip value={mandate.hash} what={tc.mandateHashWhat} />
        </div>
        <div>
          <p className="mb-1 text-xs text-zinc-500">{tc.anchorTx}</p>
          <HashChip
            value={mandate.anchorTx}
            href={mandate.anchorUrl}
            what={tc.anchorTxWhat}
            emptyText={tc.notAnchored}
          />
        </div>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(o) => busy === null && setConfirmOpen(o)}
      >
        <DialogContent closeLabel={t.common.close}>
          <DialogHeader>
            <DialogTitle>{tc.confirmTitle(mandate.id)}</DialogTitle>
            <DialogDescription>{tc.confirmBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={busy !== null}>
                {tc.keep}
              </Button>
            </DialogClose>
            <Button
              type="button"
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => void run("revoke")}
              disabled={busy !== null}
            >
              {busy === "revoke" ? (
                <LoaderCircle aria-hidden className="animate-spin" />
              ) : (
                <Ban aria-hidden />
              )}
              {tc.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
