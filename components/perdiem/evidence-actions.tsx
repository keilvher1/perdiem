"use client";

import type { ReactNode } from "react";
import { Download, TriangleAlert } from "lucide-react";
import type { MandateDetailResponse } from "@/contracts/api";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { API_MODE, type ApiClientError } from "@/lib/api-client";
import { en as evidenceEn } from "@/lib/i18n/messages/evidence";
import { useT } from "@/lib/i18n/provider";
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

/** English copy; the component shows the viewer's language (lib/i18n/messages/evidence.ts). */
export const MOCK_DOWNLOAD_HINT = evidenceEn.actions.mockHint;

type Tone = "light" | "dark";

function Note({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <p role="status" className={cn("flex items-start gap-1.5 text-xs", tone === "dark" ? "text-amber-300" : "text-amber-800")}>
      <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/**
 * "Download records" + "Copy verify command": the two files scripts/verify.ts reads, rebuilt in the
 * browser from GET /api/mandates/[id] (byte-identical to scripts/export.ts). Shared by the Evidence
 * drawer and the audit page's "Verify it yourself" panel. Disabled in mock mode (placeholder hashes)
 * and while the records are loading or failed to load.
 */
export function EvidenceActions({
  id,
  records,
  loading = false,
  error = null,
  onRetry,
  tone = "light",
  className,
}: {
  id: string;
  records: MandateDetailResponse | null;
  loading?: boolean;
  error?: ApiClientError | null;
  onRetry?: () => void;
  tone?: Tone;
  className?: string;
}) {
  const t = useT().evidence.actions;
  const mock = API_MODE === "mock";
  const ready = records !== null && records.mandate.id === id;
  const disabled = mock || !ready;
  const pending = ready ? records.ledger.filter((e) => e.status === "pending" || e.status === "approved").length : 0;
  const dark = tone === "dark";

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

  const btn = cn(
    "min-w-0 font-mono text-xs",
    dark && "border-white/15 bg-white/5 text-zinc-100 hover:bg-white/10 hover:text-white disabled:opacity-40",
  );
  const buttons = (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" className={btn} disabled={disabled} onClick={saveMandate}>
        <Download aria-hidden />
        <span className="truncate">{mandateFileName(id)}</span>
      </Button>
      <Button type="button" variant="outline" size="sm" className={btn} disabled={disabled} onClick={saveLedger}>
        <Download aria-hidden />
        <span className="truncate">{ledgerFileName(id)}</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={saveBoth}
        className={cn(dark ? "text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-40" : "text-zinc-600")}
      >
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
            {/* Disabled buttons get no pointer events, so the wrapper carries the tooltip. */}
            <div tabIndex={0} aria-label={t.downloadsDisabled(t.mockHint)} className="w-fit rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
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

      {mock && <p className={cn("text-xs", dark ? "text-zinc-400" : "text-zinc-500")}>{t.mockOff}</p>}
      {!mock && loading && !ready && <p className={cn("text-xs", dark ? "text-zinc-400" : "text-zinc-500")}>{t.loading}</p>}
      {!mock && error && !ready && (
        <p role="alert" className={cn("flex flex-wrap items-center gap-2 text-xs", dark ? "text-rose-300" : "text-rose-700")}>
          {t.loadError(error.message)}
          {onRetry && (
            <button type="button" onClick={onRetry} className="underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              {t.retry}
            </button>
          )}
        </p>
      )}
      {ready && records.mandate.anchorTx === null && <Note tone={tone}>{t.notAnchored}</Note>}
      {ready && pending > 0 && <Note tone={tone}>{t.stillPending(pending)}</Note>}

      <div className={cn("flex items-start gap-2 rounded-lg px-3 py-2", dark ? "bg-black/40 ring-1 ring-white/10" : "bg-zinc-900")}>
        <span aria-hidden className="py-1 font-mono text-[11px] leading-5 text-zinc-500">
          $
        </span>
        <code className="min-w-0 flex-1 py-1 font-mono text-[11px] leading-5 break-all text-zinc-100">{cmd}</code>
        <CopyButton value={cmd} label={t.copyCommand} showText className="text-zinc-300 hover:bg-white/10 hover:text-white" />
      </div>
      <p className={cn("text-xs", dark ? "text-zinc-400" : "text-zinc-500")}>
        {t.runFrom.before}
        <code className="font-mono">npm ci</code>
        {t.runFrom.after}
      </p>
    </div>
  );
}
