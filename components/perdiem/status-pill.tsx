import type { ComponentType, SVGProps } from "react";
import { Ban, CalendarClock, CalendarX, CircleCheck, CircleDot, CirclePause, CircleX, LoaderCircle, OctagonX } from "lucide-react";
import type { LedgerStatus, MandateStatus, MandateSummary } from "@/contracts/api";
import { windowState } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Ledger statuses, mandate statuses, and two derived window states for active mandates. */
export type PillStatus = LedgerStatus | MandateStatus | "expired" | "scheduled";

type Tone = "emerald" | "amber" | "rose" | "slate";

const TONES: Record<Tone, string> = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/25",
  rose: "bg-rose-50 text-rose-700 ring-rose-600/20",
  slate: "bg-slate-100 text-slate-700 ring-slate-500/20",
};

const PILLS: Record<PillStatus, { label: string; tone: Tone; Icon: ComponentType<SVGProps<SVGSVGElement>>; spin?: boolean }> = {
  approved: { label: "Approved", tone: "emerald", Icon: CircleCheck },
  settled: { label: "Settled", tone: "emerald", Icon: CircleCheck },
  pending: { label: "Pending", tone: "amber", Icon: LoaderCircle, spin: true },
  stopped: { label: "Stopped", tone: "rose", Icon: OctagonX },
  failed: { label: "Failed", tone: "slate", Icon: CircleX },
  active: { label: "Active", tone: "emerald", Icon: CircleDot },
  paused: { label: "Paused", tone: "amber", Icon: CirclePause },
  revoked: { label: "Revoked", tone: "slate", Icon: Ban },
  expired: { label: "Expired", tone: "slate", Icon: CalendarX },
  scheduled: { label: "Not started", tone: "slate", Icon: CalendarClock },
};

export function StatusPill({
  status,
  size = "sm",
  className,
}: {
  status: PillStatus;
  size?: "xs" | "sm";
  className?: string;
}) {
  const p = PILLS[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full font-medium whitespace-nowrap ring-1 ring-inset",
        size === "xs" ? "h-5 px-1.5 text-[11px]" : "h-6 px-2 text-xs",
        TONES[p.tone],
        className,
      )}
    >
      <p.Icon
        aria-hidden
        className={cn(size === "xs" ? "size-3" : "size-3.5", p.spin && "animate-spin [animation-duration:1.8s]")}
      />
      {p.label}
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
