/**
 * lib/rule-checks.ts — the 12 boundary checks of one recorded decision (pure, no React, no I/O).
 *
 * Derived from the ledger entry alone, following how lib/policy.ts evaluate() records a decision:
 *  - evaluate() runs every check and records EVERY failing one as a StopReason, so a code listed
 *    in entry.reasons FAILED;
 *  - two checks are skipped by design: with an unknown merchant (UNKNOWN_MERCHANT) the
 *    MERCHANT_NOT_ALLOWED and CATEGORY_NOT_ALLOWED checks have no merchant to look at, and with
 *    an unknown fee (FEE_UNAVAILABLE) OVER_BUDGET_WITH_FEES has no total to compare — those are
 *    NOT EVALUATED;
 *  - every other check PASSED at decision time (an APPROVE entry passed all 12).
 * This is what the record says about the decision, not a re-verification: the auditor's replay
 * (/api/audit) is what re-runs the policy.
 */
import type { LedgerEntry, StopCode, StopReason } from "@/contracts/api";
import { localizeReason } from "@/components/perdiem/stop-codes";
import type { Locale } from "@/lib/i18n/config";
import { MESSAGES } from "@/lib/i18n/messages";

/** The 12 checks in lib/policy.ts evaluate() order. */
export const RULE_ORDER: ReadonlyArray<StopCode> = [
  "MANDATE_NOT_ACTIVE",
  "BEFORE_START",
  "EXPIRED",
  "UNKNOWN_MERCHANT",
  "MERCHANT_NOT_ALLOWED",
  "CATEGORY_NOT_ALLOWED",
  "BLOCKED_KEYWORD",
  "INVALID_AMOUNT",
  "OVER_PER_TX_CAP",
  "FEE_UNAVAILABLE",
  "OVER_BUDGET_WITH_FEES",
  "DUPLICATE",
];

/** Checks evaluate() does not run when the key check failed. */
export const SKIPPED_WHEN: Readonly<Partial<Record<StopCode, StopCode>>> = {
  MERCHANT_NOT_ALLOWED: "UNKNOWN_MERCHANT",
  CATEGORY_NOT_ALLOWED: "UNKNOWN_MERCHANT",
  OVER_BUDGET_WITH_FEES: "FEE_UNAVAILABLE",
};

export type RuleResult = "passed" | "failed" | "not_evaluated";

export interface RuleCheck {
  code: StopCode;
  result: RuleResult;
  /** Localized check title ("Over per-payment cap"). */
  title: string;
  /** Localized one-line meaning of the check. */
  meaning: string;
  /** The recorded reason(s) for a failed check (evaluate() records one per code). */
  reasons: StopReason[];
  /** Localized message + "observed · limit" detail of the first reason, for failed checks. */
  localized: { message: string; detail: string | null } | null;
  /** For not_evaluated: the failed check that made evaluate() skip this one. */
  skippedBecause: StopCode | null;
}

export function deriveRuleChecks(
  entry: Pick<LedgerEntry, "decision" | "reasons">,
  locale: Locale = "en",
): RuleCheck[] {
  const failed = new Map<StopCode, StopReason[]>();
  for (const r of entry.reasons) failed.set(r.code, [...(failed.get(r.code) ?? []), r]);
  const codes = MESSAGES[locale].stop.codes;
  return RULE_ORDER.map((code) => {
    const reasons = failed.get(code) ?? [];
    const skipKey = SKIPPED_WHEN[code];
    const result: RuleResult =
      reasons.length > 0 ? "failed" : skipKey && failed.has(skipKey) ? "not_evaluated" : "passed";
    const first = reasons[0];
    const loc = first ? localizeReason(first, locale) : null;
    return {
      code,
      result,
      title: codes[code]?.title ?? code,
      meaning: codes[code]?.meaning ?? "",
      reasons,
      localized: loc ? { message: loc.message, detail: loc.detail } : null,
      skippedBecause: result === "not_evaluated" ? (skipKey ?? null) : null,
    };
  });
}

export function countRuleChecks(checks: ReadonlyArray<Pick<RuleCheck, "result">>): Record<RuleResult, number> {
  const out: Record<RuleResult, number> = { passed: 0, failed: 0, not_evaluated: 0 };
  for (const c of checks) out[c.result] += 1;
  return out;
}
