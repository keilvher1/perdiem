/**
 * lib/fx/currencies.ts — currency codes and their metadata, from Intl (pure; no network, no clock).
 *
 * The codes are the circulating currencies of ISO 4217 (fund codes such as CLF / USN / UYI, precious
 * metals, XDR and test codes left out; ANG, SLL and ZWL kept while old bills still carry them). Minor
 * units, symbols and names come from the runtime's Intl data (ICU), not from a table of our own:
 *   minorUnits("KRW") → 0, minorUnits("JPY") → 0, minorUnits("USD") → 2, minorUnits("BHD") → 3
 * (Intl.NumberFormat resolvedOptions().maximumFractionDigits for style "currency").
 */

/** Circulating ISO 4217 currency codes (2026). */
export const ISO_CURRENCIES: readonly string[] = (
  "AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD " +
  "CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD " +
  "GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT " +
  "LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR " +
  "NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD " +
  "SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD " +
  "XCG XOF XPF YER ZAR ZMW ZWG ZWL"
).split(" ");

const ISO_SET = new Set(ISO_CURRENCIES);

/** A circulating ISO 4217 code (upper case, exactly as listed). */
export function isCurrencyCode(code: unknown): code is string {
  return typeof code === "string" && ISO_SET.has(code);
}

/**
 * The currencies listed first in every currency menu (the region PerDiem is demoed in, then the
 * most traded), in this order. Every other code follows alphabetically.
 */
export const COMMON_CURRENCIES: readonly string[] = [
  "USD",
  "KRW",
  "JPY",
  "CNY",
  "EUR",
  "GBP",
  "HKD",
  "TWD",
  "SGD",
  "THB",
  "VND",
  "PHP",
  "INR",
  "AUD",
  "CAD",
  "CHF",
];

/** `codes` with the common currencies first (in COMMON_CURRENCIES order), then the rest A–Z. */
export function orderCurrencies(codes: Iterable<string>): { common: string[]; others: string[] } {
  const all = new Set(codes);
  const common = COMMON_CURRENCIES.filter((c) => all.has(c));
  const others = [...all].filter((c) => !COMMON_CURRENCIES.includes(c)).sort();
  return { common, others };
}

const minorCache = new Map<string, number>();

/**
 * Digits after the decimal point the currency is written with, per Intl (KRW 0, JPY 0, USD 2,
 * BHD 3). 2 when the runtime does not know the code.
 */
export function minorUnits(code: string): number {
  const hit = minorCache.get(code);
  if (hit !== undefined) return hit;
  let digits = 2;
  try {
    digits = new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    // Not a well-formed code: keep 2.
  }
  minorCache.set(code, digits);
  return digits;
}

/** The currency's symbol in that language ("₩", "US$" in ko-KR, "￥" in ja-JP); the code if none. */
export function currencySymbol(code: string, localeTag = "en-US"): string {
  try {
    const part = new Intl.NumberFormat(localeTag, { style: "currency", currency: code })
      .formatToParts(0)
      .find((p) => p.type === "currency");
    return part?.value.trim() || code;
  } catch {
    return code;
  }
}

/** The currency's name in that language ("South Korean Won", "대한민국 원"); the code if unknown. */
export function currencyName(code: string, localeTag = "en-US"): string {
  try {
    return new Intl.DisplayNames([localeTag], { type: "currency", fallback: "code" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export interface CurrencyInfo {
  code: string;
  minorUnits: number;
  symbol: string;
  name: string;
}

export function currencyInfo(code: string, localeTag = "en-US"): CurrencyInfo {
  return { code, minorUnits: minorUnits(code), symbol: currencySymbol(code, localeTag), name: currencyName(code, localeTag) };
}
