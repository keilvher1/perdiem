"use client";

import { ExternalLink } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fmtHash } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

/**
 * Truncated hash + copy + optional explorer link. Never validates hex: fixture hashes are
 * placeholders that contain "x".
 */
export function HashChip({
  value,
  href,
  label,
  what: whatProp,
  emptyText = "—",
  className,
}: {
  value: string | null | undefined;
  href?: string | null;
  /** Small caption rendered before the chip ("tx", "receipt"). */
  label?: string;
  /** Used in accessible names: "Copy <what>", "Open <what> on Etherscan". */
  what?: string;
  emptyText?: string;
  className?: string;
}) {
  const t = useT();
  const what = whatProp ?? t.common.hash.what;
  if (!value) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-ink", className)}>
        {label && <span className="text-muted-ink">{label}</span>}
        {emptyText}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5", className)}>
      {label && <span className="text-xs text-muted-ink">{label}</span>}
      <span className="inline-flex h-6 items-center gap-0.5 rounded-md border border-line bg-surface-2 pr-0.5 pl-2 font-mono text-xs text-ink">
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {fmtHash(value)}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-md font-mono text-[11px] break-all">{value}</TooltipContent>
        </Tooltip>
        <CopyButton value={value} label={t.common.hash.copy(what)} className="ml-1" />
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.common.hash.openOnEtherscan(what)}
            title={t.common.hash.openTitle}
            className="inline-flex size-5 items-center justify-center rounded-sm text-muted-ink outline-none transition-colors duration-150 hover:bg-line hover:text-cobalt focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
        )}
      </span>
    </span>
  );
}
