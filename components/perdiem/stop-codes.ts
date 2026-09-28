import type { StopCode, StopReason } from "@/contracts/api";
import { fmtDate, fmtUsd } from "@/lib/format";

/** The 12 boundary checks in lib/policy.ts evaluate(), in evaluation order. */
export const STOP_CODES: ReadonlyArray<{ code: StopCode; title: string; meaning: string }> = [
  { code: "MANDATE_NOT_ACTIVE", title: "Kill switch", meaning: "The principal paused or revoked the mandate." },
  { code: "BEFORE_START", title: "Too early", meaning: "The trip window has not opened yet." },
  { code: "EXPIRED", title: "Deadline passed", meaning: "The trip window has already closed." },
  { code: "UNKNOWN_MERCHANT", title: "Unknown merchant", meaning: "The merchant is not in the catalog snapshot hashed into the mandate." },
  { code: "MERCHANT_NOT_ALLOWED", title: "Merchant not permitted", meaning: "The merchant is not on the principal's permitted list." },
  { code: "CATEGORY_NOT_ALLOWED", title: "Category not permitted", meaning: "The merchant's category (e.g. alcohol, gift) is not allowed." },
  { code: "BLOCKED_KEYWORD", title: "Blocked item", meaning: "The request or memo mentions a blocked word such as wine or gift." },
  { code: "INVALID_AMOUNT", title: "Invalid amount", meaning: "The amount is zero, negative or not a number." },
  { code: "OVER_PER_TX_CAP", title: "Over per-payment cap", meaning: "A single payment above the per-transaction cap." },
  { code: "FEE_UNAVAILABLE", title: "Fee unknown", meaning: "The network fee could not be estimated, so it refuses instead of guessing (fail closed)." },
  { code: "OVER_BUDGET_WITH_FEES", title: "Over budget with fees", meaning: "Amount plus the real network fee exceeds the remaining budget, compared unrounded." },
  { code: "DUPLICATE", title: "Duplicate", meaning: "Same merchant and amount within 5 minutes of an earlier payment." },
];

const MONEY_CODES = new Set<StopCode>(["OVER_PER_TX_CAP", "OVER_BUDGET_WITH_FEES", "INVALID_AMOUNT"]);
const DATE_CODES = new Set<StopCode>(["BEFORE_START", "EXPIRED"]);

/** observed / limit printed the way a person reads them ($85.00, Sep 25 09:00 GMT+9, m5). */
export function fmtReasonValue(code: StopCode, v: number | string | undefined): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (MONEY_CODES.has(code) && typeof v === "number") return fmtUsd(v);
  if (DATE_CODES.has(code) && typeof v === "string") return fmtDate(v, true);
  return String(v);
}

export function reasonDetail(r: StopReason): string | null {
  const observed = fmtReasonValue(r.code, r.observed);
  const limit = fmtReasonValue(r.code, r.limit);
  const parts = [observed !== null ? `observed ${observed}` : null, limit !== null ? `limit ${limit}` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
