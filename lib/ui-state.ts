/**
 * lib/ui-state.ts — the four state families the UI keeps apart (pure, no React, no I/O).
 *
 *   AUTHORITY     what the principal granted right now   active | paused | revoked | expired | scheduled
 *   DECISION      what the policy engine decided         approve | stop
 *   EXECUTION     what happened on-chain (approvals)     approved | pending | settled | failed
 *   VERIFICATION  what an auditor's check found          not_run | running | match | mismatch | unverifiable
 *
 * A valid mandate does not mean a payment was approved, an approval does not mean it settled, and
 * a settled payment is not "verified" until a check actually ran. Each state maps to a label key
 * (lib/i18n/messages/ui.ts → t.ui.state[family][state]), a tone (a colour token in
 * app/globals.css) and a glyph shape, so colour is never the only signal.
 *
 * Tone rule: amber `stop` is ONLY for a rule-based stop. Errors, failed payments and verification
 * mismatches use `danger` (red) with the triangle glyph.
 */
import type { LedgerEntry, LedgerStatus, MandateStatus } from "@/contracts/api";
import { windowState } from "@/lib/format";

export type AuthorityState = "active" | "paused" | "revoked" | "expired" | "scheduled";
export type DecisionState = "approve" | "stop";
export type ExecutionState = "approved" | "pending" | "settled" | "failed";
export type VerificationState = "not_run" | "running" | "match" | "mismatch" | "unverifiable";

export type StateFamily = "authority" | "decision" | "execution" | "verification";

export type FamilyStates = {
  authority: AuthorityState;
  decision: DecisionState;
  execution: ExecutionState;
  verification: VerificationState;
};

/** Colour token family in app/globals.css (text-<tone>, bg-<tone>-soft, border-<tone>-line). */
export type Tone = "cobalt" | "approve" | "stop" | "pending" | "danger" | "unverified" | "ink";

/**
 * Glyph shapes drawn by components/perdiem/state-glyph.tsx (12×12, currentColor).
 *  circle        ●  approval
 *  circle-check  ✓● settled / match
 *  ring          ○  approved, not broadcast yet
 *  square        ■  rule-based stop
 *  clock         ◷  pending on-chain / not started yet
 *  half          ◐  verification running (static, no animation)
 *  triangle      ▲  failed / mismatch / error
 *  dashed        ◌  verification not run
 *  dashed-slash  ⊘  cannot be verified (dashed)
 *  dot-ring      ◉  authority active
 *  pause         ‖  authority paused
 *  slash         ⊘  authority revoked (final)
 *  minus         ⊖  authority expired
 */
export type Glyph =
  | "circle"
  | "circle-check"
  | "ring"
  | "square"
  | "clock"
  | "half"
  | "triangle"
  | "dashed"
  | "dashed-slash"
  | "dot-ring"
  | "pause"
  | "slash"
  | "minus";

export interface StateSpec {
  tone: Tone;
  glyph: Glyph;
}

export const STATE_SPECS: { [F in StateFamily]: Record<FamilyStates[F], StateSpec> } = {
  authority: {
    active: { tone: "cobalt", glyph: "dot-ring" },
    paused: { tone: "ink", glyph: "pause" },
    revoked: { tone: "ink", glyph: "slash" },
    expired: { tone: "unverified", glyph: "minus" },
    scheduled: { tone: "pending", glyph: "clock" },
  },
  decision: {
    approve: { tone: "approve", glyph: "circle" },
    stop: { tone: "stop", glyph: "square" },
  },
  execution: {
    approved: { tone: "approve", glyph: "ring" },
    pending: { tone: "pending", glyph: "clock" },
    settled: { tone: "approve", glyph: "circle-check" },
    failed: { tone: "danger", glyph: "triangle" },
  },
  verification: {
    not_run: { tone: "unverified", glyph: "dashed" },
    running: { tone: "pending", glyph: "half" },
    match: { tone: "approve", glyph: "circle-check" },
    mismatch: { tone: "danger", glyph: "triangle" },
    unverifiable: { tone: "unverified", glyph: "dashed-slash" },
  },
};

export const AUTHORITY_STATES: ReadonlyArray<AuthorityState> = ["active", "paused", "revoked", "expired", "scheduled"];
export const DECISION_STATES: ReadonlyArray<DecisionState> = ["approve", "stop"];
export const EXECUTION_STATES: ReadonlyArray<ExecutionState> = ["approved", "pending", "settled", "failed"];
export const VERIFICATION_STATES: ReadonlyArray<VerificationState> = [
  "not_run",
  "running",
  "match",
  "mismatch",
  "unverifiable",
];

export function stateSpec<F extends StateFamily>(family: F, state: FamilyStates[F]): StateSpec {
  return (STATE_SPECS[family] as Record<string, StateSpec>)[state as string]!;
}

/**
 * Authority right now: paused / revoked win (the principal's action), then the trip window.
 * Same rule as effectiveMandateStatus() in components/perdiem/status-pill.tsx. `now` null
 * (before mount) reads as inside the window, so server and client markup agree.
 */
export function authorityState(
  m: { status: MandateStatus; startsAt: string; expiresAt: string },
  now: number | null,
): AuthorityState {
  if (m.status !== "active") return m.status;
  const w = windowState(m.startsAt, m.expiresAt, now);
  if (w === "expired") return "expired";
  if (w === "before") return "scheduled";
  return "active";
}

export function decisionState(entry: Pick<LedgerEntry, "decision">): DecisionState {
  return entry.decision === "APPROVE" ? "approve" : "stop";
}

/**
 * Execution exists only for approvals: approved (decided, not broadcast) → pending (broadcast, not
 * mined) → settled | failed. A stop was never sent, so it has no execution state (null).
 */
export function executionState(entry: Pick<LedgerEntry, "decision" | "status">): ExecutionState | null {
  if (entry.decision !== "APPROVE") return null;
  const s: LedgerStatus = entry.status;
  return s === "approved" || s === "pending" || s === "settled" || s === "failed" ? s : null;
}

/**
 * Verification of one checked item. `result` undefined / null = no check has run: never a pass by
 * default. `verifiable: false` = the records lack what the check needs (e.g. no tx hash).
 */
export function verificationState(
  result: boolean | null | undefined,
  opts: { running?: boolean; verifiable?: boolean } = {},
): VerificationState {
  if (opts.running) return "running";
  if (opts.verifiable === false) return "unverifiable";
  if (result === true) return "match";
  if (result === false) return "mismatch";
  return "not_run";
}
