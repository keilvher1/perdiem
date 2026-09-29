"use client";

import type { ReactNode } from "react";
import { Download } from "lucide-react";
import type { MandateDetailResponse } from "@/contracts/api";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { API_MODE, type ApiClientError } from "@/lib/api-client";
import { en as evidenceEn } from "@/lib/i18n/messages/evidence";
import { useT } from "@/lib/i18n/provider";
import type { Glyph } from "@/lib/ui-state";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";
import {
  downloadJson,
  ledgerFileName,
  mandateFileName,
  toExportedLedger,
  toExportedMandate,
  verifyCommand,
} from "./evidence-records";
import { StateGlyph } from "./state-glyph";

/** English copy; the component shows the viewer's language (lib/i18n/messages/evidence.ts). */
export const MOCK_DOWNLOAD_HINT = evidenceEn.actions.mockHint;

type NoteKind = "pending" | "unverified" | "danger";

const NOTE_LOOK: Record<NoteKind, { glyph: Glyph; text: string }> = {
  // Payments still settling: the pending tone and its static clock (never the rule-stop amber).
  pending: { glyph: "clock", text: "text-pending" },
  // Something an auditor cannot check yet (no anchor): the unverified tone, dashed glyph.
  unverified: { glyph: "dashed-slash", text: "text-unverified" },
  // The records failed to load: an error, red with a triangle.
  danger: { glyph: "triangle", text: "text-danger" },
};

function Note({ kind, role = "status", children }: { kind: NoteKind; role?: "status" | "alert"; children: ReactNode }) {
  const look = NOTE_LOOK[kind];
  return (
    <p role={role} className={cn("flex items-start gap-1.5 text-xs", look.text)}>
      <StateGlyph glyph={look.glyph} className="mt-0.5 size-3" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/**
 * "Download records" + "Verify it yourself": the two files scripts/verify.ts reads, rebuilt in the
 * browser from GET /api/mandates/[id] (byte-identical to scripts/export.ts, see evidence-records.ts).
 * Shared by the Evidence drawer and the audit page. Disabled in mock mode (placeholder hashes) and
 * while the records are loading or failed to load.
 *
 * `tone` is kept for older callers and ignored: the block always draws on the theme tokens, so it
 * reads on any surface in light and dark.
 */
export function EvidenceActions({
  id,
  records,
  loading = false,
  error = null,
  onRetry,
  className,
}: {
  id: string;
  records: MandateDetailResponse | null;
  loading?: boolean;
  error?: ApiClientError | null;
  onRetry?: () => void;
  /** @deprecated Ignored: the block follows the theme tokens. */
  tone?: "light" | "dark";
  className?: string;
}) {
  const t = useT().evidence.actions;
  const mock = API_MODE === "mock";
  const ready = records !== null && records.mandate.id === id;
  const disabled = mock || !ready;
  const pending = ready ? records.ledger.filter((e) => e.status === "pending" || e.status === "approved").length : 0;

  const saveMandate = () => {
    if (!ready || mock) return;
    downloadJson(mandateFileName(records.mandate.id), toExportedMandate(records.mandate));
  };
  const saveLedger = () => {
    if (!ready || mock) return;
    downloadJson(ledgerFileName(records.mandate.id), toExportedLedger(records.ledger));
  };
  const saveBoth = () => {
    saveMandate();
    // A short gap: some browsers drop a second download started in the same tick.
    setTimeout(saveLedger, 400);
  };

  const buttons = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-w-0 bg-surface"
        disabled={disabled}
        onClick={saveMandate}
      >
        <Download aria-hidden />
        <span className="type-id truncate">{mandateFileName(id)}</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-w-0 bg-surface"
        disabled={disabled}
        onClick={saveLedger}
      >
        <Download aria-hidden />
        <span className="type-id truncate">{ledgerFileName(id)}</span>
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={saveBoth} className="text-cobalt">
        {t.both}
      </Button>
    </div>
  );

  const cmd = verifyCommand(id);
  return (
    <div className={cn("space-y-3", className)}>
      {mock ? (
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Disabled buttons get no pointer events, so the wrapper carries the tooltip (a labelled group:
                aria-label is not allowed on a plain div). */}
            <div
              role="group"
              tabIndex={0}
              aria-label={t.downloadsDisabled(t.mockHint)}
              className="w-fit max-w-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {buttons}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            {t.mockHint}
          </TooltipContent>
        </Tooltip>
      ) : (
        buttons
      )}

      {mock && <p className="text-xs text-muted-ink">{t.mockOff}</p>}
      {!mock && loading && !ready && <p className="text-xs text-muted-ink">{t.loading}</p>}
      {!mock && error && !ready && (
        <Note kind="danger" role="alert">
          {t.loadError(error.message)}
          {onRetry && (
            <>
              {" "}
              <button
                type="button"
                onClick={onRetry}
                className="rounded-sm font-medium underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t.retry}
              </button>
            </>
          )}
        </Note>
      )}
      {ready && records.mandate.anchorTx === null && <Note kind="unverified">{t.notAnchored}</Note>}
      {ready && pending > 0 && <Note kind="pending">{t.stillPending(pending)}</Note>}

      <div className="overflow-hidden rounded-lg border border-line bg-surface-2">
        <div className="flex items-center justify-between gap-2 border-b border-line py-1 pr-1 pl-3">
          <span className="type-label text-muted-ink">{t.command}</span>
          <CopyButton value={cmd} label={t.copyCommand} showText />
        </div>
        <p className="flex gap-2 px-3 py-2.5">
          <span aria-hidden className="type-id text-muted-ink select-none">
            $
          </span>
          {/* A shell command: breaks at spaces, and inside a path only when it does not fit. */}
          <code className="type-id min-w-0 flex-1 wrap-anywhere text-ink">{cmd}</code>
        </p>
      </div>
      <p className="text-xs text-muted-ink">
        {t.runFrom.before}
        <code className="type-id">npm ci</code>
        {t.runFrom.after}
      </p>
    </div>
  );
}
