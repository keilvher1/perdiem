"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api-client";
import { fmtHash } from "@/lib/format";
import { useFmt, useT } from "@/lib/i18n/provider";
import { useResource } from "@/hooks/use-resource";
import type { Glyph, Tone } from "@/lib/ui-state";
import { cn } from "@/lib/utils";
import { TONE_TEXT } from "./state-badge";
import { StateGlyph } from "./state-glyph";

const loadHealth = () => api.health();

/**
 * `Testnet | Sepolia | 1 ETH = $4,000 demo rate` with a status glyph; details in the tooltip.
 * Problems use the danger tone (never the rule-stop amber): ● nominal, ◌ checking, ▲ degraded /
 * unreachable — the glyph and the accessible name carry the state, not the colour alone.
 */
export function HealthBadge() {
  const t = useT();
  const f = useFmt();
  const h = t.shell.health;
  const { data, error, loading } = useResource(loadHealth, 60_000);
  const warn = data ? !data.ok || !data.modelAvailable || data.errors.length > 0 : false;
  const look: { glyph: Glyph; tone: Tone } = error
    ? { glyph: "triangle", tone: "danger" }
    : loading
      ? { glyph: "dashed", tone: "unverified" }
      : warn
        ? { glyph: "triangle", tone: "danger" }
        : { glyph: "circle", tone: "approve" };
  const state = error ? h.unreachable : loading ? h.checking : warn ? h.degraded : h.nominal;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={h.aria(state)}
          className="inline-flex h-7 items-center rounded-md border border-line bg-surface text-xs text-muted-ink outline-none transition-colors duration-150 hover:border-line-strong focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-1.5 px-2">
            <StateGlyph glyph={look.glyph} className={cn("size-2.5", TONE_TEXT[look.tone])} />
            <span className="font-medium text-ink">{h.testnet}</span>
          </span>
          <span aria-hidden className="hidden h-4 w-px bg-line lg:block" />
          <span className="hidden px-2 lg:block">Sepolia</span>
          <span aria-hidden className="hidden h-4 w-px bg-line xl:block" />
          <span className="hidden px-2 tabular-nums xl:block">
            {h.demoRate(data ? `$${f.int(data.demoEthUsd)}` : error ? "—" : "…")}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" className="max-w-xs flex-col items-start gap-1 py-2 text-left">
        <span className="font-medium">{state}</span>
        {error && <span className="opacity-80">{error.message}</span>}
        {data && (
          <>
            <span className="opacity-80">{h.model(data.model, data.modelAvailable)}</span>
            <span className="font-mono text-[11px] opacity-80">{h.wallet(fmtHash(data.agentAddress))}</span>
            <span className="opacity-80">
              {h.balance(data.balanceEth ?? "—", data.balanceUsd !== null ? f.int(data.balanceUsd) : null)}
            </span>
            <span className="opacity-80">{h.rpc(data.rpc === "publicnode")}</span>
            {data.errors.map((e) => (
              <span key={e} className="font-medium">
                ▲ {e}
              </span>
            ))}
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
