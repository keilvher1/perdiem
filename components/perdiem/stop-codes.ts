import type { StopCode, StopReason } from "@/contracts/api";
import { fmtDate, fmtUsd } from "@/lib/format";
import { LOCALE_TAGS, type Locale } from "@/lib/i18n/config";
import { MESSAGES } from "@/lib/i18n/messages";

/** The 12 boundary checks in lib/policy.ts evaluate(), in evaluation order. */
const ORDER: ReadonlyArray<StopCode> = [
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

/** English titles and meanings (lib/i18n/messages/stop.ts holds every language). */
export const STOP_CODES: ReadonlyArray<{
  code: StopCode;
  title: string;
  meaning: string;
}> = ORDER.map((code) => ({
  code,
  ...MESSAGES.en.stop.codes[code],
}));

/** The same list in the viewer's language. */
export function stopCodesFor(
  locale: Locale,
): ReadonlyArray<{ code: StopCode; title: string; meaning: string }> {
  return ORDER.map((code) => ({ code, ...MESSAGES[locale].stop.codes[code] }));
}

const MONEY_CODES = new Set<StopCode>([
  "OVER_PER_TX_CAP",
  "OVER_BUDGET_WITH_FEES",
  "INVALID_AMOUNT",
]);
const DATE_CODES = new Set<StopCode>(["BEFORE_START", "EXPIRED"]);

/** observed / limit printed the way a person reads them ($85.00, Sep 25 09:00 GMT+9, m5). */
export function fmtReasonValue(
  code: StopCode,
  v: number | string | undefined,
  locale: Locale = "en",
): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (MONEY_CODES.has(code) && typeof v === "number") return fmtUsd(v);
  if (DATE_CODES.has(code) && typeof v === "string")
    return fmtDate(v, true, LOCALE_TAGS[locale]);
  if (code === "MANDATE_NOT_ACTIVE" && typeof v === "string")
    return MESSAGES[locale].stop.mandateStatus[v] ?? v;
  return String(v);
}

/** "observed $85.00 · limit $40.00" in the viewer's language (English unchanged). */
export function reasonDetail(
  r: StopReason,
  locale: Locale = "en",
): string | null {
  const labels = MESSAGES[locale].stop.detail;
  const observed = fmtReasonValue(r.code, r.observed, locale);
  const limit = fmtReasonValue(r.code, r.limit, locale);
  const parts = [
    observed !== null ? `${labels.observed} ${observed}` : null,
    limit !== null ? `${labels.limit} ${limit}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Everything a STOP reason shows, in the viewer's language. English returns the server's own
 * sentence (what the ledger stores); other languages rebuild it from code + observed / limit.
 */
export function localizeReason(
  r: StopReason,
  locale: Locale = "en",
): { title: string; meaning: string; message: string; detail: string | null } {
  const stop = MESSAGES[locale].stop;
  const copy = stop.codes[r.code] ?? { title: r.code, meaning: r.message };
  const values = {
    observed: fmtReasonValue(r.code, r.observed, locale),
    limit: fmtReasonValue(r.code, r.limit, locale),
  };
  return {
    title: copy.title,
    meaning: copy.meaning,
    message: stop.message(r, values),
    detail: reasonDetail(r, locale),
  };
}
