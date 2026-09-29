/**
 * lib/fx/format.ts — money in any currency, for display (pure; Intl only).
 *
 * USD amounts PerDiem settles keep lib/format.ts fmtUsd (the policy's exact format); these helpers
 * print bill totals in their own currency and display equivalents ("≈ ₩16,300").
 */
import { minorUnits } from "./currencies";

/**
 * `amount` in `currency`, localized: formatMoney(16300, "KRW", "en-US") → "₩16,300",
 * formatMoney(12.5, "EUR", "de-DE") → "12,50 €". Uses the currency's minor units (Intl).
 */
export function formatMoney(amount: number, currency: string, localeTag = "en-US"): string {
  if (!Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat(localeTag, { style: "currency", currency }).format(amount);
  } catch {
    return `${plainAmount(amount, currency)} ${currency}`;
  }
}

/** Decimals actually written in `n` (at most 6): 16000 → 0, 12.5 → 1, 0.879241 → 6. */
function writtenDecimals(n: number): number {
  const s = String(Math.abs(n));
  if (s.includes("e")) return 6;
  const dot = s.indexOf(".");
  return dot < 0 ? 0 : Math.min(6, s.length - dot - 1);
}

/**
 * An amount for English request text, without a symbol: plainAmount(16000, "KRW") → "16,000",
 * plainAmount(12.5, "EUR") → "12.50" (the currency's minor units, more only when the bill printed more).
 */
export function plainAmount(amount: number, currency: string): string {
  const minor = minorUnits(currency);
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: minor,
    maximumFractionDigits: Math.max(minor, writtenDecimals(amount)),
  });
}

/**
 * A rate for the rate line: six significant digits (1,358.97 · 156.88 · 0.879241), whole units when
 * the integer part alone is longer (1,570,962).
 */
export function formatRate(rate: number, localeTag = "en-US"): string {
  if (!Number.isFinite(rate)) return "—";
  const intDigits = rate >= 1 ? Math.floor(Math.log10(rate)) + 1 : 0;
  const opts: Intl.NumberFormatOptions = intDigits >= 6 ? { maximumFractionDigits: 0 } : { maximumSignificantDigits: 6 };
  return new Intl.NumberFormat(localeTag, opts).format(rate);
}

/** A rate exactly as the source published it, en-US grouping, for request text ("1,358.965432"). */
export function exactRate(rate: number): string {
  return rate.toLocaleString("en-US", { maximumFractionDigits: 12 });
}
