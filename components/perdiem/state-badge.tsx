"use client";

import { useT } from "@/lib/i18n/provider";
import { stateSpec, type FamilyStates, type StateFamily, type Tone } from "@/lib/ui-state";
import { cn } from "@/lib/utils";
import { StateGlyph } from "./state-glyph";

/** Text, soft background and hairline per tone (tokens in app/globals.css). */
export const TONE_TEXT: Record<Tone, string> = {
  cobalt: "text-cobalt",
  approve: "text-approve",
  stop: "text-stop",
  pending: "text-pending",
  danger: "text-danger",
  unverified: "text-unverified",
  ink: "text-ink",
};

export const TONE_SOFT: Record<Tone, string> = {
  cobalt: "bg-cobalt-soft text-cobalt border-cobalt-line",
  approve: "bg-approve-soft text-approve border-approve-line",
  stop: "bg-stop-soft text-stop border-stop-line",
  pending: "bg-pending-soft text-pending border-pending-line",
  danger: "bg-danger-soft text-danger border-danger-line",
  // Unverified reads as "not established": dashed edge, never a filled tone.
  unverified: "bg-unverified-soft text-unverified border-unverified-line border-dashed",
  ink: "bg-surface-2 text-ink border-line-strong",
};

/**
 * One state of one family: glyph + visible label + screen-reader family name
 * ("Decision: Stopped"). `soft` (default) is a small tinted tag; `plain` drops the background for
 * dense rows. The hint (what the state means) is the native tooltip.
 */
export function StateBadge<F extends StateFamily>({
  family,
  state,
  size = "sm",
  variant = "soft",
  className,
}: {
  family: F;
  state: FamilyStates[F];
  size?: "sm" | "md";
  variant?: "soft" | "plain";
  className?: string;
}) {
  const t = useT();
  const spec = stateSpec(family, state);
  const label = (t.ui.state[family] as Record<string, string>)[state as string] ?? String(state);
  const hint = (t.ui.hint[family] as Record<string, string>)[state as string];
  return (
    <span
      data-family={family}
      data-state={state}
      title={hint}
      className={cn(
        "inline-flex shrink-0 items-center font-medium whitespace-nowrap",
        size === "sm" ? "h-6 gap-1 text-xs" : "h-7 gap-1.5 text-[13px]",
        variant === "soft"
          ? cn("rounded-md border", size === "sm" ? "px-1.5" : "px-2", TONE_SOFT[spec.tone])
          : TONE_TEXT[spec.tone],
        className,
      )}
    >
      <StateGlyph glyph={spec.glyph} className={size === "sm" ? "size-2.5" : "size-3"} />
      <span className="sr-only">{t.ui.family[family]}: </span>
      {label}
    </span>
  );
}
