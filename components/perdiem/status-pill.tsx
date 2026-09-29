import type { LedgerStatus, MandateStatus, MandateSummary } from "@/contracts/api";
import { windowState } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import { STATE_SPECS, type StateSpec } from "@/lib/ui-state";
import { cn } from "@/lib/utils";
import { TONE_SOFT } from "./state-badge";
import { StateGlyph } from "./state-glyph";

/** Ledger statuses, mandate statuses, and two derived window states for active mandates. */
export type PillStatus = LedgerStatus | MandateStatus | "expired" | "scheduled";

/**
 * Legacy single-status pill, drawn with the state model of lib/ui-state.ts (same tone + glyph as
 * <StateBadge>): a stop is the amber square, a failed payment the red triangle, pending a static
 * clock. New screens use <StateBadge family=… state=…>, which keeps decision and execution apart.
 */
const SPECS: Record<PillStatus, StateSpec> = {
  approved: STATE_SPECS.execution.approved,
  pending: STATE_SPECS.execution.pending,
  settled: STATE_SPECS.execution.settled,
  failed: STATE_SPECS.execution.failed,
  stopped: STATE_SPECS.decision.stop,
  active: STATE_SPECS.authority.active,
  paused: STATE_SPECS.authority.paused,
  revoked: STATE_SPECS.authority.revoked,
  expired: STATE_SPECS.authority.expired,
  scheduled: STATE_SPECS.authority.scheduled,
};

/** Labels live in lib/i18n/messages/common.ts (`t.common.status`). */
export function StatusPill({
  status,
  size = "sm",
  className,
}: {
  status: PillStatus;
  size?: "xs" | "sm";
  className?: string;
}) {
  const t = useT();
  const spec = SPECS[status];
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border font-medium whitespace-nowrap",
        size === "xs" ? "h-5 px-1.5 text-[11px]" : "h-6 px-1.5 text-xs",
        TONE_SOFT[spec.tone],
        className,
      )}
    >
      <StateGlyph glyph={spec.glyph} className="size-2.5" />
      {t.common.status[status]}
    </span>
  );
}

/** What a mandate effectively is right now: paused/revoked win, then the trip window. */
export function effectiveMandateStatus(
  m: Pick<MandateSummary, "status" | "startsAt" | "expiresAt">,
  now: number | null,
): PillStatus {
  if (m.status !== "active") return m.status;
  const w = windowState(m.startsAt, m.expiresAt, now);
  if (w === "expired") return "expired";
  if (w === "before") return "scheduled";
  return "active";
}
