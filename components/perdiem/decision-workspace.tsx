"use client";

import { useRef, useState, type ComponentProps } from "react";
import type { LedgerEntryView } from "@/contracts/api";
import { cn } from "@/lib/utils";
import { DecisionLedger, type DecisionLedgerHandle } from "./decision-ledger";
import { EvidencePanel, type EvidenceMandate } from "./evidence-panel";

/** True where the panel sits next to the ledger (Tailwind `lg`). Read at event time only. */
function isSideBySide(): boolean {
  try {
    return window.matchMedia("(min-width: 64rem)").matches;
  } catch {
    return true;
  }
}

/**
 * Ledger + evidence as one unit. Desktop (≥ lg): two columns, the panel sticky beside the list and
 * scrolling inside itself when it is taller than the viewport.
 * Mobile: the list; selecting a row opens the panel as a stacked detail view with "Back to
 * ledger" (focus moves to the panel heading, and back to the row on return). The selection is
 * the parent's (`selectedId` / `onSelect`), so a page can also drive it from elsewhere.
 */
export function DecisionWorkspace({
  entries,
  mandate = null,
  selectedId,
  onSelect,
  now = null,
  ledgerProps,
  stickyTopClass = "lg:top-32",
  panelMaxHeightClass = "lg:max-h-[calc(100dvh-9rem)]",
  className,
}: {
  entries: LedgerEntryView[];
  mandate?: EvidenceMandate | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  now?: number | null;
  /** Extra DecisionLedger props (filter, order, loading, label, maxHeightClass, className). */
  ledgerProps?: Omit<ComponentProps<typeof DecisionLedger>, "entries" | "selectedId" | "onSelect" | "now" | "ref">;
  /** Offset under the sticky app header (header + mandate bar ≈ 105 px). */
  stickyTopClass?: string;
  /** Height cap of the sticky panel; keep it ≈ 100dvh − the sticky offset − 1rem. */
  panelMaxHeightClass?: string;
  className?: string;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const ledgerRef = useRef<DecisionLedgerHandle>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const selected = entries.find((e) => e.id === selectedId) ?? null;
  const stacked = detailOpen && selected !== null;

  const select = (id: string) => {
    onSelect(id);
    setDetailOpen(true);
    if (!isSideBySide()) requestAnimationFrame(() => headingRef.current?.focus());
  };
  const back = () => {
    setDetailOpen(false);
    requestAnimationFrame(() => ledgerRef.current?.focusSelected());
  };

  return (
    <div className={cn("grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-start", className)}>
      <div className={cn("min-w-0", stacked && "max-lg:hidden")}>
        <DecisionLedger
          {...ledgerProps}
          ref={ledgerRef}
          entries={entries}
          selectedId={selectedId}
          onSelect={select}
          now={now}
        />
      </div>
      <div
        className={cn(
          "min-w-0 lg:sticky lg:overflow-y-auto lg:overscroll-contain lg:rounded-lg",
          stickyTopClass,
          panelMaxHeightClass,
          !stacked && "max-lg:hidden",
        )}
      >
        <EvidencePanel entry={selected} mandate={mandate} onBack={back} backClassName="lg:hidden" headingRef={headingRef} />
      </div>
    </div>
  );
}
