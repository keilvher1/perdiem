import type { ReactNode } from "react";
import type { Glyph } from "@/lib/ui-state";
import { cn } from "@/lib/utils";

/**
 * The shape half of a state (lib/ui-state.ts): 12×12, drawn in currentColor, always aria-hidden.
 * Shapes carry meaning without colour — approve ●, stop ■, pending ◷, failed / mismatch ▲,
 * not run ◌ — so the text label next to it is never the only other signal.
 */
export function StateGlyph({ glyph, className }: { glyph: Glyph; className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      focusable="false"
      className={cn("size-3 shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {SHAPES[glyph]}
    </svg>
  );
}

const SLASH = <path d="M3 9 9 3" />;

const SHAPES: Record<Glyph, ReactNode> = {
  circle: <circle cx="6" cy="6" r="5" fill="currentColor" stroke="none" />,
  // Filled circle with the check knocked out (evenodd), so it reads on any background.
  "circle-check": (
    <path
      fill="currentColor"
      stroke="none"
      fillRule="evenodd"
      d="M6 1a5 5 0 1 1 0 10A5 5 0 0 1 6 1Zm-2.9 5.15 1.05-1.05 1.3 1.3 2.5-2.5 1.05 1.05L5.45 8.5Z"
    />
  ),
  ring: <circle cx="6" cy="6" r="4.25" />,
  square: <rect x="1.5" y="1.5" width="9" height="9" rx="1" fill="currentColor" stroke="none" />,
  clock: (
    <>
      <circle cx="6" cy="6" r="4.5" />
      <path d="M6 3.6V6l1.6 1.1" strokeWidth={1.25} />
    </>
  ),
  half: (
    <>
      <circle cx="6" cy="6" r="4.5" />
      <path d="M6 1.5a4.5 4.5 0 0 1 0 9Z" fill="currentColor" stroke="none" />
    </>
  ),
  // Filled triangle with "!" knocked out.
  triangle: (
    <path
      fill="currentColor"
      stroke="none"
      fillRule="evenodd"
      d="M6 .9 11.4 10.6H.6Zm-.62 3.3h1.24v3.3H5.38Zm0 4.1h1.24v1.2H5.38Z"
    />
  ),
  dashed: <circle cx="6" cy="6" r="4.5" strokeDasharray="2.1 1.45" strokeLinecap="butt" />,
  "dashed-slash": (
    <>
      <circle cx="6" cy="6" r="4.5" strokeDasharray="2.1 1.45" strokeLinecap="butt" />
      {SLASH}
    </>
  ),
  "dot-ring": (
    <>
      <circle cx="6" cy="6" r="4.75" strokeWidth={1.25} />
      <circle cx="6" cy="6" r="2.25" fill="currentColor" stroke="none" />
    </>
  ),
  pause: (
    <>
      <rect x="2.5" y="2" width="2.25" height="8" rx=".5" fill="currentColor" stroke="none" />
      <rect x="7.25" y="2" width="2.25" height="8" rx=".5" fill="currentColor" stroke="none" />
    </>
  ),
  slash: (
    <>
      <circle cx="6" cy="6" r="4.5" />
      {SLASH}
    </>
  ),
  minus: (
    <>
      <circle cx="6" cy="6" r="4.5" />
      <path d="M3.6 6h4.8" />
    </>
  ),
};
