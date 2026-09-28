"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import type { MandateSummary } from "@/contracts/api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtUsd } from "@/lib/format";
import type { ApiClientError } from "@/lib/api-client";
import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/utils";
import { effectiveMandateStatus, StatusPill } from "./status-pill";

/** Global mandate picker: id, traveler, status pill, remaining / budget. */
export function MandateSelector({
  mandates,
  value,
  onChange,
  error,
  onRetry,
  className,
}: {
  mandates: MandateSummary[] | null;
  value: string | null;
  onChange: (id: string) => void;
  error: ApiClientError | null;
  onRetry: () => void;
  className?: string;
}) {
  const now = useNow(30_000);

  if (!mandates && error) {
    return (
      <div role="alert" className={cn("flex items-center gap-2 text-xs text-rose-700", className)}>
        Couldn’t load mandates ({error.code}).
        <Button type="button" variant="outline" size="xs" onClick={onRetry} className="bg-white">
          <RefreshCw aria-hidden />
          Retry
        </Button>
      </div>
    );
  }
  if (!mandates) return <Skeleton className={cn("h-8 w-full sm:w-[460px]", className)} aria-label="Loading mandates" />;
  if (mandates.length === 0) {
    return (
      <p className={cn("text-xs text-zinc-500", className)}>
        No mandates yet —{" "}
        <Link href="/principal" className="font-medium text-indigo-700 underline-offset-2 hover:underline">
          grant one on Principal
        </Link>
        .
      </p>
    );
  }

  const known = value !== null && mandates.some((m) => m.id === value);
  return (
    <Select value={known ? value : undefined} onValueChange={onChange}>
      <SelectTrigger
        aria-label="Selected mandate"
        className={cn("h-8 w-full bg-white sm:w-[460px] [&_[data-slot=select-value]]:min-w-0", className)}
      >
        <SelectValue placeholder={value ? `Unknown mandate ${value}` : "Choose a mandate"} />
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="w-[var(--radix-select-trigger-width)] min-w-[320px]">
        {mandates.map((m) => (
          <SelectItem key={m.id} value={m.id} className="py-1.5">
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate font-mono text-xs font-medium text-zinc-900">{m.id}</span>
              <span className="hidden truncate text-xs text-zinc-500 sm:inline">{m.traveler}</span>
              <StatusPill status={effectiveMandateStatus(m, now)} size="xs" />
              <span className="ml-auto pl-2 text-xs whitespace-nowrap text-zinc-600 tabular-nums">
                {fmtUsd(m.remainingUsd)} <span className="text-zinc-400">/ {fmtUsd(m.budgetUsd)}</span>
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
