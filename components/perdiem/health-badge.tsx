"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api-client";
import { fmtHash } from "@/lib/format";
import { useFmt, useT } from "@/lib/i18n/provider";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/utils";

const loadHealth = () => api.health();

/** `Testnet | Sepolia | 1 ETH = $4,000 demo rate` with a status dot; details in the tooltip. */
export function HealthBadge() {
  const t = useT();
  const f = useFmt();
  const h = t.shell.health;
  const { data, error, loading } = useResource(loadHealth, 60_000);
  const warn = data ? !data.ok || !data.modelAvailable || data.errors.length > 0 : false;
  const dot = error ? "bg-rose-500" : loading ? "bg-zinc-300" : warn ? "bg-amber-500" : "bg-emerald-500";
  const state = error ? h.unreachable : loading ? h.checking : warn ? h.degraded : h.nominal;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={h.aria(state)}
          className="inline-flex h-7 items-center rounded-full border border-zinc-200 bg-white text-xs text-zinc-600 outline-none hover:border-zinc-300 focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <span className="flex items-center gap-1.5 pr-2.5 pl-2.5">
            <span aria-hidden className={cn("size-2 rounded-full", dot, loading && "animate-pulse")} />
            <span className="font-medium text-zinc-800">{h.testnet}</span>
          </span>
          <span className="hidden h-4 w-px bg-zinc-200 sm:block" />
          <span className="hidden px-2.5 sm:block">Sepolia</span>
          <span className="hidden h-4 w-px bg-zinc-200 md:block" />
          <span className="hidden px-2.5 tabular-nums md:block">
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
              <span key={e} className="text-amber-300">
                {e}
              </span>
            ))}
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
