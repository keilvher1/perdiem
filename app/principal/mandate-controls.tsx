"use client";

import { useRef, useState } from "react";
import { Ban, CirclePause, Play } from "lucide-react";
import { toast } from "sonner";
import type { MandateDetail, MandateStatus } from "@/contracts/api";
import { api, toApiClientError } from "@/lib/api-client";
import { useFmt, useT } from "@/lib/i18n/provider";
import { authorityState } from "@/lib/ui-state";
import { cn } from "@/lib/utils";
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
import { StateGlyph } from "@/components/perdiem/state-glyph";

type Action = "pause" | "resume" | "revoke";
const TARGET: Record<Action, MandateStatus> = {
  pause: "paused",
  resume: "active",
  revoke: "revoked",
};

/** Danger outline (revoke trigger) and fill (confirm): the red tone is kept for this one destructive action. */
const DANGER_OUTLINE =
  "border-danger-line bg-surface text-danger hover:bg-danger-soft hover:text-danger dark:border-danger-line dark:bg-surface dark:hover:bg-danger-soft";
const DANGER_FILL =
  "bg-danger text-surface hover:bg-danger/90 focus-visible:ring-danger/40";

/**
 * Authority controls for the selected mandate: what the current state means for new requests, the
 * state-appropriate action (active → Pause, paused → Resume) and Revoke as a separate danger action
 * behind a confirmation. The copy promises only what PATCH /api/mandates/[id] does: new requests
 * only, nothing already broadcast is cancelled, revoke is final (409 afterwards).
 */
export function MandateControls({
  mandate,
  now,
  onChanged,
  className,
}: {
  mandate: MandateDetail;
  now: number | null;
  onChanged: () => void;
  className?: string;
}) {
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // After a revoke the trigger disappears; the state sentence takes the focus instead.
  const revokedRef = useRef(false);
  const stateRef = useRef<HTMLParagraphElement>(null);
  const t = useT();
  const f = useFmt();
  const tc = t.principal.controls;
  const state = authorityState(mandate, now);
  const revoked = mandate.status === "revoked";

  const stateText =
    state === "expired"
      ? tc.state.expired(f.date(mandate.expiresAt, true))
      : state === "scheduled"
        ? tc.state.scheduled(f.date(mandate.startsAt, true))
        : tc.state[state];

  const run = async (action: Action) => {
    if (busy !== null) return;
    setBusy(action);
    try {
      const res = await api.updateMandateStatus(mandate.id, TARGET[action]);
      const s = res.mandate.status;
      if (s === "paused")
        toast.success(tc.paused(mandate.id), { description: tc.pausedHint });
      else if (s === "active")
        toast.success(tc.resumed(mandate.id), { description: tc.resumedHint });
      else {
        revokedRef.current = true;
        toast.success(tc.revokedToast(mandate.id), {
          description: tc.revokedHint,
        });
      }
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

  // Busy buttons are aria-disabled, not disabled: a disabled button drops the keyboard focus
  // to <body> (focus fixup), and the pause / resume button keeps its place while it toggles.
  const busyProps = {
    "aria-disabled": busy !== null || undefined,
    className: "aria-disabled:cursor-not-allowed aria-disabled:opacity-60",
  };

  return (
    <section
      aria-labelledby="authority-controls-title"
      className={cn(
        "flex flex-col rounded-lg border border-line bg-surface px-4 py-4 sm:px-5",
        className,
      )}
    >
      <div className="flex-1">
        <h2 id="authority-controls-title" className="type-label text-muted-ink">
          {tc.title}
        </h2>
        <p ref={stateRef} tabIndex={-1} className="mt-1.5 text-sm leading-6 text-pretty text-ink outline-none">
          {stateText}
        </p>

        {!revoked && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {mandate.status === "paused" ? (
              <Button
                type="button"
                size="lg"
                {...busyProps}
                onClick={() => void run("resume")}
              >
                <Play aria-hidden />
                {busy === "resume" ? tc.resuming : tc.resume}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="lg"
                {...busyProps}
                onClick={() => void run("pause")}
              >
                <CirclePause aria-hidden />
                {busy === "pause" ? tc.pausing : tc.pause}
              </Button>
            )}
            {/* Revoke sits apart from pause / resume: a different, final action. */}
            <Button
              type="button"
              variant="outline"
              size="lg"
              aria-disabled={busyProps["aria-disabled"]}
              className={cn("sm:ml-auto", DANGER_OUTLINE, busyProps.className)}
              onClick={() => busy === null && setConfirmOpen(true)}
            >
              <Ban aria-hidden />
              {busy === "revoke" ? tc.revoking : tc.revoke}
            </Button>
          </div>
        )}
      </div>

      {/* Pinned to the bottom so it lines up with the budget figures beside it. */}
      <p className="mt-4 border-t border-line pt-3 text-xs leading-5 text-pretty text-muted-ink">
        {tc.note}
      </p>

      <Dialog
        open={confirmOpen}
        onOpenChange={(o) => busy === null && setConfirmOpen(o)}
      >
        <DialogContent
          closeLabel={t.common.close}
          onCloseAutoFocus={(e) => {
            if (!revokedRef.current) return;
            revokedRef.current = false;
            e.preventDefault();
            stateRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{tc.confirmTitle(mandate.id)}</DialogTitle>
            <DialogDescription asChild className="mt-1 space-y-2 text-sm text-ink">
              <ul>
                {tc.confirmPoints.map((p, i) => (
                  <li key={i} className="flex gap-2.5">
                    {i === tc.confirmPoints.length - 1 ? (
                      // The revoked glyph (⊘) marks the sentence that says it is final.
                      <StateGlyph
                        glyph="slash"
                        className="mt-1 size-3 shrink-0 text-ink"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="mt-2 mx-[3px] size-1.5 shrink-0 rounded-[1px] bg-muted-ink"
                      />
                    )}
                    <span
                      className={cn(
                        i === tc.confirmPoints.length - 1 && "font-medium",
                      )}
                    >
                      {p}
                    </span>
                  </li>
                ))}
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                size="lg"
                {...busyProps}
              >
                {tc.keep}
              </Button>
            </DialogClose>
            <Button
              type="button"
              size="lg"
              aria-disabled={busyProps["aria-disabled"]}
              className={cn(DANGER_FILL, busyProps.className)}
              onClick={() => void run("revoke")}
            >
              <Ban aria-hidden />
              {busy === "revoke" ? tc.revoking : tc.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** The terms' hash and its Sepolia anchor transaction, as one quiet line under the rules. */
export function MandateAnchor({
  mandate,
  className,
}: {
  mandate: MandateDetail;
  className?: string;
}) {
  const t = useT();
  const tc = t.principal.controls;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-6 gap-y-2 px-1 text-xs text-muted-ink",
        className,
      )}
    >
      <span className="font-medium">
        {mandate.anchorTx ? t.principal.page.anchored : t.principal.page.notAnchored}
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        {tc.mandateHash}
        <HashChip value={mandate.hash} what={tc.mandateHashWhat} />
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        {tc.anchorTx}
        <HashChip
          value={mandate.anchorTx}
          href={mandate.anchorUrl}
          what={tc.anchorTxWhat}
          emptyText={tc.notAnchored}
        />
      </span>
    </div>
  );
}
