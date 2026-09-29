/**
 * lib/fx/convert.ts — currency conversion over USD-based rates (pure).
 *
 * `rates` are units of each currency per 1 USD (lib/fx/normalize.ts), so every conversion goes
 * through USD: amount / rates[from] × rates[to]. Nothing here changes what PerDiem settles: the
 * mandate, the policy, the ledger and the chain payment stay in USD. A converted bill total becomes
 * the USD amount of a request (usdFromBill); a USD amount shown in another currency is a display
 * equivalent only (fromUsd).
 */
export type Rates = Readonly<Record<string, number>>;

/** Units of `code` per 1 USD, or null when the rates do not cover it (USD is always 1). */
export function rateOf(code: string, rates: Rates): number | null {
  if (code === "USD") return 1;
  const r = Object.prototype.hasOwnProperty.call(rates, code) ? rates[code] : undefined;
  return typeof r === "number" && Number.isFinite(r) && r > 0 ? r : null;
}

/** `amount` in `from` expressed in `to`, unrounded; null when either rate is missing. */
export function convert(amount: number, from: string, to: string, rates: Rates): number | null {
  if (!Number.isFinite(amount)) return null;
  if (from === to) return amount;
  const f = rateOf(from, rates);
  const t = rateOf(to, rates);
  if (f === null || t === null) return null;
  return (amount / f) * t;
}

/** A USD amount in another currency (display equivalent), unrounded; null without a rate. */
export function fromUsd(usd: number, to: string, rates: Rates): number | null {
  return convert(usd, "USD", to, rates);
}

/**
 * Rounds half away from zero at `digits` decimals. The product is first cut to 15 significant
 * digits (what a double holds exactly), so binary floating-point noise does not decide a half
 * (1.005 → 1.01, not 1.00) and cents stay exact up to about $10^12 (12 digits cut them above $10^9).
 */
export function roundHalfUp(x: number, digits: number): number {
  if (!Number.isFinite(x)) return x;
  const f = 10 ** digits;
  const scaled = Number((Math.abs(x) * f).toPrecision(15));
  const r = Math.round(scaled) / f;
  return x < 0 ? -r : r;
}

export interface UsdConversion {
  /** The bill total as printed, in `currency`. */
  amount: number;
  currency: string;
  /** Units of `currency` per 1 USD, exactly as the source published it (1 for USD). */
  rate: number;
  /** amount / rate, unrounded. */
  exactUsd: number;
  /** exactUsd rounded half up (away from zero) to the cent: the amount the request asks for. */
  usd: number;
}

/**
 * The USD amount a bill total becomes: amount ÷ rate, **rounded half up to the cent** (USD has 2
 * minor units; 16,000 KRW at 1,358.97 KRW per USD = 11.77362… → $11.77). Null when the amount is
 * not a positive number or the rates do not cover the currency — never an invented rate.
 */
export function usdFromBill(amount: number, currency: string, rates: Rates): UsdConversion | null {
  if (!Number.isFinite(amount) || !(amount > 0)) return null;
  const rate = rateOf(currency, rates);
  if (rate === null) return null;
  const exactUsd = amount / rate;
  return { amount, currency, rate, exactUsd, usd: roundHalfUp(exactUsd, 2) };
}
