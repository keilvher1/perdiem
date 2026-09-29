/**
 * tests/fx.test.ts — lib/fx (rate feeds, conversion, rounding, currency metadata and formatting)
 * and the currency detection of lib/bills/parse.ts.
 * Run: npx tsx tests/fx.test.ts
 *
 * The feed fixtures are trimmed copies of real responses (open.er-api.com /v6/latest/USD of
 * 2026-09-29 and api.frankfurter.dev /v1/latest?base=USD of 2026-09-28), plus a few invalid
 * entries marked as such; no network is used.
 */
import assert from "node:assert/strict";
import { COMMON_CURRENCIES, currencyName, currencySymbol, isCurrencyCode, minorUnits, orderCurrencies } from "../lib/fx/currencies";
import { convert, fromUsd, rateOf, roundHalfUp, usdFromBill } from "../lib/fx/convert";
import { exactRate, formatMoney, formatRate, plainAmount } from "../lib/fx/format";
import {
  ER_API_SOURCE,
  FRANKFURTER_SOURCE,
  FxFeedError,
  normalizeErApi,
  normalizeFrankfurter,
  parseFxRates,
  type FxRates,
} from "../lib/fx/normalize";
import { parseBill, type BillNoteCode, type ParsedBill } from "../lib/bills/parse";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}
const codes = (b: ParsedBill): BillNoteCode[] => b.notes.map((n) => n.code);
const FETCHED = "2026-09-29T09:00:00.000Z";

const ER_API = {
  result: "success",
  provider: "https://www.exchangerate-api.com",
  time_last_update_unix: 1790640151, // Tue, 29 Sep 2026 00:02:31 +0000
  base_code: "USD",
  rates: {
    USD: 1,
    AED: 3.6725,
    AUD: 1.425042,
    BHD: 0.376,
    CAD: 1.416139,
    CHF: 0.831749,
    CNH: 6.709958, // offshore yuan: not ISO 4217
    CNY: 6.721579,
    EUR: 0.879241,
    GBP: 0.754467,
    HKD: 7.844766,
    INR: 96.069945,
    JPY: 157.315109,
    KRW: 1358.968392,
    SGD: 1.277664,
    THB: 33.590728,
    TWD: 31.811614,
    VND: 25917.425983,
    XDR: 0.73, // special drawing right: not a currency
    BAD: 1, // not a code
    ZZZ: -2,
  },
};

const FRANKFURTER = {
  amount: 1.0,
  base: "USD",
  date: "2026-09-28",
  rates: { AUD: 1.4237, CAD: 1.4166, CHF: 0.83178, CNY: 6.7105, EUR: 0.87889, GBP: 0.75396, JPY: 156.88, KRW: 1357.93, SGD: 1.2777, THB: 33.57 },
};

const RATES: FxRates = normalizeErApi(ER_API, FETCHED);

test("normaliser: ExchangeRate-API → base USD, date, ISO rates only, source + attribution", () => {
  assert.equal(RATES.base, "USD");
  assert.equal(RATES.date, "2026-09-29");
  assert.equal(RATES.fetchedAt, FETCHED);
  assert.deepEqual(RATES.source, ER_API_SOURCE);
  assert.equal(RATES.source.attribution, "Rates By Exchange Rate API");
  assert.equal(RATES.rates.USD, 1);
  assert.equal(RATES.rates.KRW, 1358.968392);
  for (const dropped of ["CNH", "XDR", "BAD", "ZZZ"]) assert.equal(dropped in RATES.rates, false, dropped);
  assert.deepEqual(Object.keys(RATES.rates), [...Object.keys(RATES.rates)].sort(), "A–Z");
  assert.ok(Object.values(RATES.rates).every((r) => Number.isFinite(r) && r > 0));
});

test("normaliser: Frankfurter → USD = 1 added, ECB date kept", () => {
  const r = normalizeFrankfurter(FRANKFURTER, FETCHED);
  assert.equal(r.rates.USD, 1);
  assert.equal(r.rates.KRW, 1357.93);
  assert.equal(r.date, "2026-09-28");
  assert.deepEqual(r.source, FRANKFURTER_SOURCE);
});

test("normaliser: refuses a feed it cannot trust (never invents a rate)", () => {
  const bad: [string, unknown, "er" | "fr"][] = [
    ["not success", { ...ER_API, result: "error" }, "er"],
    ["base not USD", { ...ER_API, base_code: "EUR" }, "er"],
    ["USD not 1", { ...ER_API, rates: { ...ER_API.rates, USD: 1.01 } }, "er"],
    ["USD missing", { ...ER_API, rates: Object.fromEntries(Object.entries(ER_API.rates).filter(([k]) => k !== "USD")) }, "er"],
    ["no update time", { ...ER_API, time_last_update_unix: null }, "er"],
    ["too few rates", { ...ER_API, rates: { USD: 1, KRW: 1358.97 } }, "er"],
    ["rates not an object", { ...ER_API, rates: [1, 2] }, "er"],
    ["frankfurter base EUR", { ...FRANKFURTER, base: "EUR" }, "fr"],
    ["frankfurter bad date", { ...FRANKFURTER, date: "2026-02-30" }, "fr"],
    ["frankfurter amount 100", { ...FRANKFURTER, amount: 100 }, "fr"],
    ["frankfurter USD 2", { ...FRANKFURTER, rates: { ...FRANKFURTER.rates, USD: 2 } }, "fr"],
    ["not JSON object", "oops", "er"],
  ];
  for (const [name, json, kind] of bad) {
    assert.throws(() => (kind === "er" ? normalizeErApi(json, FETCHED) : normalizeFrankfurter(json, FETCHED)), FxFeedError, name);
  }
  // A single unusable value is left out, not repaired (and the rest of the feed is kept).
  const partial = normalizeErApi({ ...ER_API, rates: { ...ER_API.rates, THB: "33.6", VND: 0, AED: Number.NaN } }, FETCHED);
  for (const c of ["THB", "VND", "AED"]) assert.equal(c in partial.rates, false, c);
  assert.equal(partial.rates.KRW, 1358.968392);
  // An implausible value (a damaged entry) is left out too: it would turn a bill into a
  // meaningless dollar amount ("$1.2e+304").
  const damaged = normalizeErApi({ ...ER_API, rates: { ...ER_API.rates, KRW: 1e-300, JPY: 1e12, IRR: 1570961.837783 } }, FETCHED);
  assert.equal("KRW" in damaged.rates, false);
  assert.equal("JPY" in damaged.rates, false);
  assert.equal(damaged.rates.IRR, 1570961.837783, "the cheapest real currency stays");
  assert.equal(parseFxRates({ ...RATES, rates: { ...RATES.rates, KRW: 1e-9 } })?.rates.KRW, undefined);
  // Hostile keys are ignored, never merged into the prototype.
  const hostile = normalizeErApi(JSON.parse(JSON.stringify(ER_API).replace('"USD":1,', '"USD":1,"__proto__":{"polluted":1},"constructor":5,')), FETCHED);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.equal("constructor" in hostile.rates && Object.prototype.hasOwnProperty.call(hostile.rates, "constructor"), false);
});

test("parseFxRates: the client accepts /api/fx bodies that pass the same checks", () => {
  const round = parseFxRates(JSON.parse(JSON.stringify(RATES)));
  assert.deepEqual(round, RATES);
  assert.equal(parseFxRates({ ...RATES, base: "EUR" }), null);
  assert.equal(parseFxRates({ ...RATES, source: { name: "x", url: "http://insecure.example" } }), null);
  assert.equal(parseFxRates({ ...RATES, rates: { ...RATES.rates, USD: 0.5 } }), null);
  assert.equal(parseFxRates({ error: { code: "FX_UNAVAILABLE", message: "down" } }), null);
  assert.equal(parseFxRates(null), null);
});

test("conversion both ways, through USD", () => {
  assert.equal(rateOf("USD", {}), 1);
  assert.equal(rateOf("KRW", RATES.rates), 1358.968392);
  assert.equal(rateOf("XXX", RATES.rates), null);
  assert.equal(rateOf("toString", RATES.rates), null, "no prototype keys");
  // KRW → USD (a bill) and USD → KRW (a display equivalent) are inverses.
  const usd = convert(16000, "KRW", "USD", RATES.rates)!;
  assert.ok(Math.abs(usd - 16000 / 1358.968392) < 1e-12);
  const back = fromUsd(usd, "KRW", RATES.rates)!;
  assert.ok(Math.abs(back - 16000) < 1e-9);
  assert.ok(Math.abs(fromUsd(150, "KRW", RATES.rates)! - 203845.2588) < 1e-3, "grant budget $150 ≈ ₩203,845");
  // Cross rate: JPY → KRW = amount / JPY × KRW.
  assert.ok(Math.abs(convert(1000, "JPY", "KRW", RATES.rates)! - (1000 / 157.315109) * 1358.968392) < 1e-9);
  assert.equal(convert(12, "EUR", "EUR", RATES.rates), 12);
  assert.equal(convert(12, "EUR", "MXN", RATES.rates), null, "no rate → null, never a guess");
  assert.equal(convert(Number.NaN, "EUR", "USD", RATES.rates), null);
});

test("rounding: half up (away from zero) to the cent, binary noise ignored", () => {
  assert.equal(roundHalfUp(1.005, 2), 1.01);
  assert.equal(roundHalfUp(2.675, 2), 2.68);
  assert.equal(roundHalfUp(-1.005, 2), -1.01);
  assert.equal(roundHalfUp(11.773620, 2), 11.77);
  assert.equal(roundHalfUp(0.004999, 2), 0);
  assert.equal(roundHalfUp(1234.5, 0), 1235);
  assert.equal(roundHalfUp(8.345, 2), 8.35);
  assert.equal(roundHalfUp(0.285, 2), 0.29);
  assert.equal(roundHalfUp(12345678901.234, 2), 12345678901.23, "cents stay exact for large totals");
  const bill = usdFromBill(16000, "KRW", RATES.rates)!;
  assert.equal(bill.usd, 11.77);
  assert.equal(bill.rate, 1358.968392);
  assert.equal(bill.currency, "KRW");
  assert.ok(Math.abs(bill.exactUsd - 11.7736) < 1e-4);
  // Exactly half a cent rounds up: 1 unit at 200 per USD = $0.005 → $0.01.
  assert.equal(usdFromBill(1, "AAA", { AAA: 200 })!.usd, 0.01);
  assert.equal(usdFromBill(1, "AAA", { AAA: 201 })!.usd, 0, "below half a cent → $0.00 (the request refuses it)");
  assert.equal(usdFromBill(0, "KRW", RATES.rates), null);
  assert.equal(usdFromBill(-5, "KRW", RATES.rates), null);
  assert.equal(usdFromBill(100, "MXN", RATES.rates), null);
});

test("currency metadata from Intl: minor units, symbols, names", () => {
  assert.equal(minorUnits("KRW"), 0);
  assert.equal(minorUnits("JPY"), 0);
  assert.equal(minorUnits("USD"), 2);
  assert.equal(minorUnits("EUR"), 2);
  assert.equal(minorUnits("BHD"), 3);
  assert.equal(minorUnits("KWD"), 3);
  assert.equal(currencySymbol("KRW", "en-US"), "₩");
  assert.equal(currencySymbol("USD", "en-US"), "$");
  assert.equal(currencySymbol("USD", "ko-KR"), "US$");
  assert.equal(currencyName("KRW", "en-US"), "South Korean Won");
  assert.equal(currencyName("KRW", "ko-KR"), "대한민국 원");
  assert.equal(isCurrencyCode("KRW"), true);
  assert.equal(isCurrencyCode("CNH"), false);
  assert.equal(isCurrencyCode("krw"), false);
  const { common, others } = orderCurrencies(["ZAR", "EUR", "KRW", "AED", "USD", "CNY"]);
  assert.deepEqual(common, ["USD", "KRW", "CNY", "EUR"]);
  assert.deepEqual(others, ["AED", "ZAR"]);
  assert.equal(COMMON_CURRENCIES[0], "USD");
});

test("formatting: money in its currency, rates, plain amounts for request text", () => {
  assert.equal(formatMoney(16300, "KRW", "en-US"), "₩16,300");
  assert.equal(formatMoney(16300.4, "KRW", "ko-KR"), "₩16,300");
  assert.equal(formatMoney(11.77, "USD", "en-US"), "$11.77");
  assert.match(formatMoney(1.5, "BHD", "en-US"), /^BHD\s1\.500$/, "three decimals (Intl puts a no-break space after the code)");
  assert.equal(formatRate(1358.968392, "en-US"), "1,358.97");
  assert.equal(formatRate(156.93, "en-US"), "156.93");
  assert.equal(formatRate(0.879241, "en-US"), "0.879241");
  assert.equal(formatRate(1570961.837783, "en-US"), "1,570,962");
  assert.equal(plainAmount(16000, "KRW"), "16,000");
  assert.equal(plainAmount(12.5, "EUR"), "12.50");
  assert.equal(plainAmount(1.234, "BHD"), "1.234");
  assert.equal(exactRate(1358.968392), "1,358.968392");
});

const cat = [{ id: "m1", name: "Yangjae Kitchen", category: "meal" }];
const read = (line: string, extra = "") => parseBill(`Yangjae Kitchen\n${extra}${extra ? "\n" : ""}${line}`, cat);

test("detection: a bare ¥ is ambiguous (JPY or CNY) unless the bill says which", () => {
  const b = read("TOTAL ¥1,200");
  assert.equal(b.totalAmount, 1200);
  assert.equal(b.currency, null);
  assert.deepEqual(b.ambiguousWith, ["JPY", "CNY"]);
  assert.ok(codes(b).includes("currency_ambiguous"));
  assert.equal(b.notes.find((n) => n.code === "currency_ambiguous")?.detail, "JPY, CNY");
  assert.equal(read("TOTAL ¥1,200 JPY").currency, "JPY");
  assert.equal(read("TOTAL 1,200円").currency, "JPY");
  assert.equal(read("TOTAL JP¥1,200").currency, "JPY");
  assert.equal(read("TOTAL ¥88.00", "Paid in RMB").currency, "CNY");
  assert.equal(read("TOTAL 88.00元").currency, "CNY");
  assert.equal(read("TOTAL CN¥88.00").currency, "CNY");
  assert.equal(read("TOTAL ¥88.00", "人民币").currency, "CNY");
  assert.deepEqual(read("TOTAL ¥88.00", "CNY").ambiguousWith, []);
  // Indirect evidence (Japanese kana / Japanese-only labels, Simplified labels) resolves it with a note.
  const ja = read("合計 ¥1,800", "ビビンバ 1点 ¥1,800");
  assert.equal(ja.currency, "JPY");
  assert.ok(codes(ja).includes("currency_inferred"));
  assert.equal(read("合计 ¥88.00").currency, "CNY");
  // Both kinds of evidence: still ambiguous.
  assert.equal(read("TOTAL ¥1,200", "1,000円 / 50元").currency, null);
});

test("detection: symbols, codes and words for currencies worldwide", () => {
  const cases: [string, number, string][] = [
    ["TOTAL $12.00", 12, "USD"],
    ["TOTAL US$12.00", 12, "USD"],
    ["TOTAL 12.00 dollars", 12, "USD"],
    ["TOTAL ₩16,000", 16000, "KRW"],
    ["합계 16,000원", 16000, "KRW"],
    ["TOTAL KRW 16,000", 16000, "KRW"],
    ["Total €1.234,56", 1234.56, "EUR"],
    ["Total 1 234,56 €", 1234.56, "EUR"],
    ["Summe 12,50 €", 12.5, "EUR"],
    ["TOTAL £12.00", 12, "GBP"],
    ["TOTAL 50.000₫", 50000, "VND"],
    ["TOTAL ₹1,250.00", 1250, "INR"],
    ["TOTAL ฿350", 350, "THB"],
    ["TOTAL ₱1,250.00", 1250, "PHP"],
    ["TOTAL ₺120,00", 120, "TRY"],
    ["TOTAL R$ 45,90", 45.9, "BRL"],
    ["TOTAL HK$88.00", 88, "HKD"],
    ["TOTAL NT$350", 350, "TWD"],
    ["TOTAL S$12.50", 12.5, "SGD"],
    ["TOTAL A$12.50", 12.5, "AUD"],
    ["TOTAL C$12.50", 12.5, "CAD"],
    ["TOTAL CHF 1'234.50", 1234.5, "CHF"],
    ["TOTAL 1 234,56 zł", 1234.56, "PLN"],
    ["TOTAL Rp 50.000", 50000, "IDR"],
    ["TOTAL RM12.50", 12.5, "MYR"],
    ["TOTAL 12.345 BHD", 12.345, "BHD"],
    ["TOTAL BHD 16.000", 16, "BHD"],
    ["TOTAL 12.00 PEN", 12, "PEN"],
    ["Итого 1 250,00 ₽", 1250, "RUB"],
  ];
  for (const [line, amount, code] of cases) {
    const b = read(line);
    assert.equal(b.totalAmount, amount, line);
    assert.equal(b.currency, code, line);
    assert.equal(b.totalUsd, code === "USD" ? amount : null, line);
  }
});

test("detection: never guessed — shared or unstated currencies stay unresolved", () => {
  // "$" with the bill naming another dollar: that dollar, with a note.
  const cad = read("TOTAL $12.00", "All amounts in CAD");
  assert.equal(cad.currency, "CAD");
  assert.ok(codes(cad).includes("currency_inferred"));
  // "$" on a bill that states another, non-dollar currency: a misread is as likely as USD.
  const conflict = read("TOTAL $16,000", "All amounts in KRW");
  assert.equal(conflict.currency, null);
  assert.deepEqual(conflict.ambiguousWith, ["KRW", "USD"]);
  assert.equal(read("TOTAL $12.00", "KRW accepted").currency, "USD", "a mention is not a statement");
  // "kr" is four currencies.
  assert.deepEqual(read("TOTAL 123,45 kr").ambiguousWith, ["DKK", "ISK", "NOK", "SEK"]);
  assert.equal(read("TOTAL 123,45 kr", "SEK").currency, "SEK");
  // Word-like codes count only after an amount or in an explicit statement.
  assert.equal(read("TOTAL PEN 12.00").currency, null);
  assert.equal(read("TOTAL 3.50", "COFFEE CUP 3.50").currency, null);
  assert.equal(read("TOTAL 3.50", "Currency: PEN").currency, "PEN");
  // Korean words that end in 원 are not the currency.
  assert.equal(read("TOTAL 16,000", "회원 할인").currency, null);
  assert.equal(read("합계 16,000", "(단위: 원)").currency, "KRW");
  // Two currencies named, total bare: both are candidates.
  const two = read("TOTAL 16,000", "KRW and USD accepted");
  assert.equal(two.currency, null);
  assert.deepEqual(two.ambiguousWith, ["KRW", "USD"]);
  // One dot group is thousands only where that is the custom (or zero decimals); otherwise no amount.
  assert.equal(read("TOTAL $12.000").totalAmount, null);
  assert.equal(read("TOTAL €1.234").totalAmount, 1234);
  // OCR read "₩" as "¥", the bill states KRW: KRW, with a note (the traveler can change it).
  const ocr = parseBill("Yangjae Kitchen\n1 x Bibimbap lunch   16,000\nTOTAL   ¥16,000\nAll amounts in KRW (Korean won).", cat);
  assert.equal(ocr.currency, "KRW");
  assert.ok(codes(ocr).includes("currency_inferred"));
  // A space-grouped number with nothing to make it one amount is two numbers.
  assert.equal(read("TOTAL 2 150").totalAmount, 150);
  // "RUB" as a word (a dry rub) does not make a bare total roubles.
  assert.equal(read("TOTAL 12.00", "1 x DRY RUB WINGS $12.00").currency, "USD");
  assert.equal(read("TOTAL 12.00", "DRY RUB WINGS").currency, null);
  assert.equal(read("TOTAL 1 250,00 RUB").currency, "RUB");
  // A number longer than any bill is no amount (never a meaningless dollar figure).
  assert.equal(read("TOTAL ₩1600000000000000000000000").totalAmount, null);
  assert.equal(read("TOTAL ₩1,600,000,000").totalAmount, 1600000000);
});

console.log(`\n${passed} fx tests passed`);
