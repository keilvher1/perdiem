/**
 * lib/fx/normalize.ts — turn an exchange-rate feed into PerDiem's FxRates, or refuse it (pure).
 *
 * Two public feeds, both quoted against USD (units of each currency per 1 USD):
 *   primary   ExchangeRate-API open access, https://open.er-api.com/v6/latest/USD (daily, ~166 codes;
 *             its terms require the attribution "Rates By Exchange Rate API" linking to
 *             https://www.exchangerate-api.com)
 *   fallback  Frankfurter, https://api.frankfurter.dev/v1/latest?base=USD (European Central Bank
 *             reference rates, ~30 codes, working days)
 *
 * A feed is accepted only when it says base USD, carries a date, and USD is exactly 1 (Frankfurter
 * omits the base, so USD = 1 is added there). Each rate must be a finite number inside a plausible
 * range (MIN_RATE–MAX_RATE); a code that is not a circulating ISO 4217 currency (CNH, GGP, XDR, …) or
 * has an unusable value is left out, never repaired or guessed. Fewer than MIN_RATES usable rates means the feed is refused as a whole.
 */
import { isCurrencyCode } from "./currencies";

export interface FxSource {
  /** Short name for the rate line ("ExchangeRate-API"). */
  name: string;
  /** Link for the attribution. */
  url: string;
  /** Attribution text the source's terms ask for, when they ask for one. */
  attribution?: string;
}

export interface FxRates {
  base: "USD";
  /** The day the source published these rates for (YYYY-MM-DD, UTC). */
  date: string;
  /** Units of each currency per 1 USD. USD is exactly 1. Only circulating ISO 4217 codes. */
  rates: Record<string, number>;
  source: FxSource;
  /** When PerDiem fetched them (ISO 8601). */
  fetchedAt: string;
}

export const ER_API_URL = "https://open.er-api.com/v6/latest/USD";
export const FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest?base=USD";

export const ER_API_SOURCE: FxSource = {
  name: "ExchangeRate-API",
  url: "https://www.exchangerate-api.com",
  attribution: "Rates By Exchange Rate API",
};
export const FRANKFURTER_SOURCE: FxSource = {
  name: "Frankfurter (ECB)",
  url: "https://frankfurter.dev",
};

/** A feed with fewer usable rates than this is refused (something is wrong with it). */
export const MIN_RATES = 10;

export class FxFeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FxFeedError";
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validDate(s: unknown): s is string {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * The plausible range of units per 1 USD: no circulating currency is worth more than 10,000 USD
 * (KWD, the dearest, is about 0.31 per USD) or less than a hundred-millionth of one (IRR, the
 * cheapest, is about 1.6 million per USD). A value outside it is a damaged feed entry.
 */
export const MIN_RATE = 1e-4;
export const MAX_RATE = 1e8;

/** A usable rate: a finite number inside the plausible range (so a converted amount stays a plain number). */
export function isUsableRate(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= MIN_RATE && v <= MAX_RATE;
}

/**
 * The usable ISO rates of a feed, with USD checked (`usd: "required"`: must be present and exactly
 * 1; `"implied"`: the base is not listed, so USD = 1 is added, and a listed USD must still be 1).
 */
export function normalizeRates(raw: unknown, usd: "required" | "implied"): Record<string, number> {
  if (!isRecord(raw)) throw new FxFeedError("rates is not an object");
  const out: Record<string, number> = {};
  for (const [code, value] of Object.entries(raw)) {
    if (!isCurrencyCode(code) || !isUsableRate(value)) continue;
    out[code] = value;
  }
  if ("USD" in raw && raw.USD !== 1) throw new FxFeedError(`USD rate is ${String(raw.USD)}, not 1`);
  if (usd === "required" && out.USD !== 1) throw new FxFeedError("USD = 1 is missing");
  out.USD = 1;
  if (Object.keys(out).length < MIN_RATES) throw new FxFeedError(`only ${Object.keys(out).length} usable rates`);
  // Stable key order (A–Z) so equal feeds serialize equally.
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** open.er-api.com /v6/latest/USD → FxRates. Throws FxFeedError. */
export function normalizeErApi(json: unknown, fetchedAt: string): FxRates {
  if (!isRecord(json)) throw new FxFeedError("not a JSON object");
  if (json.result !== "success") throw new FxFeedError(`result is ${String(json.result)}`);
  if (json.base_code !== "USD") throw new FxFeedError(`base is ${String(json.base_code)}`);
  const unix = json.time_last_update_unix;
  if (typeof unix !== "number" || !Number.isFinite(unix) || unix <= 0) throw new FxFeedError("no update time");
  const date = new Date(unix * 1000).toISOString().slice(0, 10);
  return { base: "USD", date, rates: normalizeRates(json.rates, "required"), source: ER_API_SOURCE, fetchedAt };
}

/** api.frankfurter.dev /v1/latest?base=USD → FxRates. Throws FxFeedError. */
export function normalizeFrankfurter(json: unknown, fetchedAt: string): FxRates {
  if (!isRecord(json)) throw new FxFeedError("not a JSON object");
  if (json.base !== "USD") throw new FxFeedError(`base is ${String(json.base)}`);
  if (json.amount !== undefined && json.amount !== 1) throw new FxFeedError(`amount is ${String(json.amount)}, not 1`);
  if (!validDate(json.date)) throw new FxFeedError("no valid date");
  return { base: "USD", date: json.date, rates: normalizeRates(json.rates, "implied"), source: FRANKFURTER_SOURCE, fetchedAt };
}

/**
 * Checks a body PerDiem's own GET /api/fx returned (the client side of the route): the same rules,
 * so a damaged or partial response is treated as "no rates" rather than used.
 */
export function parseFxRates(json: unknown): FxRates | null {
  try {
    if (!isRecord(json) || json.base !== "USD" || !validDate(json.date)) return null;
    const src = json.source;
    if (!isRecord(src) || typeof src.name !== "string" || typeof src.url !== "string" || !/^https:\/\//.test(src.url)) return null;
    if (typeof json.fetchedAt !== "string" || !Number.isFinite(new Date(json.fetchedAt).getTime())) return null;
    const source: FxSource = { name: src.name, url: src.url };
    if (typeof src.attribution === "string") source.attribution = src.attribution;
    return { base: "USD", date: json.date, rates: normalizeRates(json.rates, "required"), source, fetchedAt: json.fetchedAt };
  } catch {
    return null;
  }
}
