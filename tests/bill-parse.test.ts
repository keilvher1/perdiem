/**
 * tests/bill-parse.test.ts — lib/bills/parse.ts (merchant, total, currency, date, items off a bill's
 * text) and lib/bills/request.ts (the chat request "Pay this bill" sends).
 * Run: npx tsx tests/bill-parse.test.ts
 *
 * The sample bills are the exact text lib/bills/extract.ts reads from
 * public/samples/bill-yangjae-kitchen.pdf, bill-wine-and-co.pdf and bill-yangjae-kitchen-krw.pdf
 * (PDF text layer) and from the .png versions (tesseract.js, English, single-block mode).
 * Bills in other currencies are converted with FX below: a trimmed copy of the real
 * GET /api/fx body of 2026-09-29 (ExchangeRate-API).
 */
import assert from "node:assert/strict";
import { parseBill, type BillCatalogMerchant, type BillNoteCode, type ParsedBill } from "../lib/bills/parse";
import { billEditText, billHasNoItems, billPayText, billTooLong, billTotal, canPayBill, MAX_REQUEST_CHARS } from "../lib/bills/request";
import { runsToLines } from "../lib/bills/extract";
import type { FxRates } from "../lib/fx/normalize";

const catalog: BillCatalogMerchant[] = [
  { id: "m1", name: "Yangjae Kitchen", category: "meal" },
  { id: "m2", name: "Kakao T Taxi", category: "transport" },
  { id: "m3", name: "T-money Top-up", category: "transport" },
  { id: "m4", name: "Daiso Yangjae", category: "supplies" },
  { id: "m5", name: "Wine & Co", category: "alcohol" },
  { id: "m6", name: "Lotte Duty Free", category: "gift" },
  { id: "m7", name: "Starbucks aT Center", category: "meal" },
];

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}
const codes = (b: ParsedBill): BillNoteCode[] => b.notes.map((n) => n.code);

const YANGJAE_PDF = `Yangjae Kitchen
Korean home cooking
27 Yangjae-daero 12-gil, Seocho-gu
Seoul 06770, Republic of Korea
Tel +82 2-555-0142
R E C E I P T
Bill no. YK-0929-0412
Date 2026-09-29 12:18
Table 7
ITEM AMOUNT
1 x Bibimbap lunch $12.00
Subtotal $12.00
TOTAL $12.00
All amounts in USD. Thank you for dining with us.`;

const WINE_PDF = `Wine & Co
Wine shop
8 Maeheon-ro, Seocho-gu
Seoul 06771, Republic of Korea
Tel +82 2-555-0187
I N V O I C E
Invoice no. WC-20260929-031
Date 2026-09-29 18:40
ITEM AMOUNT
1 x Bottle of wine (client gift) $30.00
Subtotal $30.00
TOTAL $30.00
All amounts in USD. Thank you for your purchase.`;

/** tesseract.js output for public/samples/bill-yangjae-kitchen.png (blank lines and column gaps kept). */
const YANGJAE_OCR = `Yangjae Kitchen

Korean home cooking

27 Yangjae-daero 12-gil, Seocho-gu

Seoul 06770, Republic of Korea

Tel +82 2-555-0142

RECEIPT

Bill no.               YK-0929-0412

Date                        2026-09-29 12:18

Table                 7

ITEM                                                                   AMOUNT
1 x Bibimbap lunch                                       $12.00
Subtotal                                                                 $12.00
TOTAL                                                           $12.00
All amounts in USD. Thank you for dining with us.
`;

test("sample bill: Yangjae Kitchen (PDF text) → m1, $12.00, date, item; pay text", () => {
  const b = parseBill(YANGJAE_PDF, catalog);
  assert.deepEqual(b.merchant, { id: "m1", name: "Yangjae Kitchen", category: "meal" });
  assert.equal(b.totalUsd, 12);
  assert.equal(b.currency, "USD");
  assert.equal(b.date, "2026-09-29");
  assert.deepEqual(b.items, ["1 x Bibimbap lunch"]);
  assert.deepEqual(b.notes, []);
  assert.equal(canPayBill(b), true);
  assert.equal(billPayText(b), "Pay this bill from Yangjae Kitchen: 1 x Bibimbap lunch, total $12.00.");
});

test("sample bill: Wine & Co (PDF text) → m5, $30.00; pay text names wine and gift", () => {
  const b = parseBill(WINE_PDF, catalog);
  assert.deepEqual(b.merchant, { id: "m5", name: "Wine & Co", category: "alcohol" });
  assert.equal(b.totalUsd, 30);
  assert.equal(b.date, "2026-09-29");
  assert.deepEqual(b.items, ["1 x Bottle of wine (client gift)"]);
  const text = billPayText(b)!;
  assert.equal(text, "Pay this bill from Wine & Co: 1 x Bottle of wine (client gift), total $30.00.");
  // The policy's BLOCKED_KEYWORD check reads this text: both keywords of man_A must be in it.
  assert.match(text, /wine/i);
  assert.match(text, /gift/i);
});

test("sample bill: Yangjae Kitchen (OCR of the PNG) reads the same", () => {
  const b = parseBill(YANGJAE_OCR, catalog);
  assert.equal(b.merchant?.id, "m1");
  assert.equal(b.totalUsd, 12);
  assert.equal(b.date, "2026-09-29");
  assert.deepEqual(b.items, ["1 x Bibimbap lunch"]);
});

test("OCR-like noise: look-alike letters, S for $, leader dots, spaced $", () => {
  const b = parseBill(
    `YANGJAE KlTCHEN
27 Yangjae-daero 12-gil
Date: Sep 29, 2026
1 x Bibimbap lunch ........ S12.00
Subtota1          $12.00
T0TAL             $ 12.00
Thank y0u`,
    catalog,
  );
  assert.equal(b.merchant?.id, "m1");
  assert.equal(b.totalUsd, 12);
  assert.equal(b.date, "2026-09-29");
  assert.deepEqual(b.items, ["1 x Bibimbap lunch"]);
  // One character off (OCR) still matches, and says so.
  const near = parseBill("Wlne & Cq\nTOTAL $30.00", catalog);
  assert.equal(near.merchant?.id, "m5");
  assert.ok(codes(near).includes("merchant_approximate"));
});

test("KRW receipt: totalUsd null, currency KRW, never converted", () => {
  const b = parseBill(
    `YANGJAE KITCHEN 양재 키친
서울 서초구 양재대로 27
2026년 9월 29일 12:18
비빔밥 1  15,000원
합계  15,000원`,
    catalog,
  );
  assert.equal(b.merchant?.id, "m1");
  assert.equal(b.totalUsd, null);
  assert.equal(b.totalAmount, 15000);
  assert.equal(b.currency, "KRW");
  assert.equal(b.date, "2026-09-29");
  assert.deepEqual(b.items, ["비빔밥 1"]);
  assert.ok(codes(b).includes("total_not_usd"));
  assert.equal(b.notes.find((n) => n.code === "total_not_usd")?.detail, "KRW");
  assert.equal(canPayBill(b), false);
  assert.equal(billPayText(b), null);
  assert.equal(billEditText(b), "Pay this bill from Yangjae Kitchen: 비빔밥 1, total $[amount in USD] (the bill says KRW 15,000).");
  // "TOTAL ₩15,000" and "Total KRW 15,000" too.
  assert.equal(parseBill("Yangjae Kitchen\nTOTAL ₩15,000", catalog).currency, "KRW");
  assert.equal(parseBill("Yangjae Kitchen\nTotal KRW 15,000", catalog).totalUsd, null);
  assert.equal(parseBill("Yangjae Kitchen\n合計 ¥1,200", catalog).currency, "JPY");
});

test("no catalog merchant → merchant null, not payable", () => {
  const b = parseBill(`Joe's Diner\n2 x Pancakes $9.50\nTOTAL $9.50`, catalog);
  assert.equal(b.merchant, null);
  assert.deepEqual(b.merchantMatches, []);
  assert.equal(b.totalUsd, 9.5);
  assert.deepEqual(codes(b), ["merchant_not_found"]);
  assert.equal(canPayBill(b), false);
  assert.equal(billEditText(b), "Pay this bill from [merchant]: 2 x Pancakes, total $9.50.");
});

test("two catalog merchants named → merchant null (ambiguous)", () => {
  const b = parseBill(
    `Lotte Duty Free
Pickup at Starbucks aT Center
1 x Perfume $20.00
TOTAL $20.00`,
    catalog,
  );
  assert.equal(b.merchant, null);
  assert.deepEqual(b.merchantMatches.map((m) => m.id).sort(), ["m6", "m7"]);
  assert.ok(codes(b).includes("merchant_ambiguous"));
  assert.equal(canPayBill(b), false);
  assert.match(billEditText(b), /^Pay this bill from (Lotte Duty Free or Starbucks aT Center|Starbucks aT Center or Lotte Duty Free): /);
});

test("subtotal vs total: the total wins; grand total over total; subtotal alone is not a total", () => {
  const b = parseBill(
    `Yangjae Kitchen
1 x Bibimbap lunch $10.00
Subtotal $10.00
Tax $1.00
Tip $2.00
Total $13.00`,
    catalog,
  );
  assert.equal(b.totalUsd, 13);
  assert.deepEqual(b.items, ["1 x Bibimbap lunch"]);
  const grand = parseBill(`Yangjae Kitchen\nTotal $12.00\nTip $2.00\nGrand total $14.00`, catalog);
  assert.equal(grand.totalUsd, 14);
  assert.ok(codes(grand).includes("totals_disagree"));
  const due = parseBill(`Yangjae Kitchen\nSubtotal $12.00\nAmount due\n$12.50`, catalog);
  assert.equal(due.totalUsd, 12.5, "amount on the line under its label");
  const sub = parseBill(`Yangjae Kitchen\n1 x Bibimbap lunch $12.00\nSubtotal $12.00`, catalog);
  assert.equal(sub.totalUsd, null);
  assert.deepEqual(codes(sub), ["subtotal_only"]);
  assert.equal(parseBill(`Yangjae Kitchen\nTotal items: 3`, catalog).totalAmount, null, "a count is not a total");
  assert.equal(parseBill(`Yangjae Kitchen\nTotal tax $1.00`, catalog).totalAmount, null, "a tax total is not the total");
});

test("never invents: no currency, ambiguous date, missing total", () => {
  const b = parseBill(`Yangjae Kitchen\nDate 03/04/2026\nTOTAL 12.00`, catalog);
  assert.equal(b.totalAmount, 12);
  assert.equal(b.currency, null);
  assert.equal(b.totalUsd, null);
  assert.equal(b.date, null);
  assert.deepEqual(codes(b).sort(), ["currency_unknown", "date_ambiguous"]);
  const none = parseBill(`Yangjae Kitchen\nThank you`, catalog);
  assert.equal(none.totalUsd, null);
  assert.equal(none.totalAmount, null);
  assert.deepEqual(codes(none), ["total_not_found"]);
  assert.equal(billEditText(none), "Pay this bill from Yangjae Kitchen: purchase, total $[amount].");
  // A currency stated elsewhere on the bill is the total's currency.
  assert.equal(parseBill(`Yangjae Kitchen\nAll amounts in USD\nTOTAL 12.00`, catalog).totalUsd, 12);
  // Other dollars are not USD.
  assert.equal(parseBill(`Yangjae Kitchen\nTOTAL HK$12.00`, catalog).currency, "HKD");
});

test("more than 3 items: 3 shown, every line still in the request", () => {
  const b = parseBill(
    `Daiso Yangjae
1 x Notebook $2.00
1 x Pens $1.50
1 x Tape $1.00
1 x Gift bag $1.00
TOTAL $5.50`,
    catalog,
  );
  assert.deepEqual(b.items, ["1 x Notebook", "1 x Pens", "1 x Tape"]);
  assert.deepEqual(b.moreItems, ["1 x Gift bag"]);
  assert.equal(b.notes.find((n) => n.code === "more_items")?.detail, "1");
  assert.equal(billPayText(b), "Pay this bill from Daiso Yangjae: 1 x Notebook, 1 x Pens, 1 x Tape, 1 x Gift bag, total $5.50.");
});

test("total line: the first money amount after the label, not a tax or tip printed after it", () => {
  assert.equal(parseBill("Yangjae Kitchen\nTotal $12.00 (incl. VAT $1.09)", catalog).totalUsd, 12);
  assert.equal(parseBill("Yangjae Kitchen\nTotal: $12.00  Tip: $2.00", catalog).totalUsd, 12);
  assert.equal(parseBill("Yangjae Kitchen\nTOTAL 2 $24.00", catalog).totalUsd, 24, "a count before the amount");
  assert.equal(parseBill("Yangjae Kitchen\nTOTAL 10% off $12.00", catalog).totalUsd, 12);
});

test("never invents an amount: refunds, odd number formats", () => {
  for (const line of ["TOTAL -$12.00", "TOTAL $-12.00", "TOTAL ($12.00)", "TOTAL: -12.00 USD"]) {
    const b = parseBill(`Yangjae Kitchen\n1 x Bibimbap lunch $12.00\n${line}`, catalog);
    assert.equal(b.totalUsd, null, line);
    assert.deepEqual(codes(b), ["total_negative"], line);
    assert.equal(canPayBill(b), false, line);
  }
  // Leader dashes are not a minus sign.
  assert.equal(parseBill("Yangjae Kitchen\nTOTAL--------$12.00", catalog).totalUsd, 12);
  // "$12.000" could be 12 or 12,000 (USD has 2 decimals, and one dot group is not proof of
  // thousands): no amount rather than a wrong one. "$1.234,56" is unambiguous (dot thousands,
  // decimal comma) and reads 1,234.56.
  for (const line of ["TOTAL $12.000", "TOTAL $1.234.5"]) {
    const b = parseBill(`Yangjae Kitchen\n${line}`, catalog);
    assert.equal(b.totalAmount, null, line);
    assert.equal(canPayBill(b), false, line);
  }
  assert.equal(parseBill("Yangjae Kitchen\nTOTAL $1.234,56", catalog).totalUsd, 1234.56);
});

test("a receipt already paid (amount / balance due $0.00) is not paid again", () => {
  for (const t of ["TOTAL $12.00\nVISA $12.00\nBalance due $0.00", "Total $12.00\nAmount due: $0.00"]) {
    const b = parseBill(`Yangjae Kitchen\n1 x Bibimbap lunch $12.00\n${t}`, catalog);
    assert.equal(b.totalAmount, 12, t);
    assert.equal(b.totalUsd, null, t);
    assert.ok(codes(b).includes("nothing_due"), t);
    assert.equal(canPayBill(b), false, t);
  }
  // Something still due is a total to pay; a $0.00 total alone is just no total.
  assert.equal(parseBill("Yangjae Kitchen\nTotal $12.00\nPaid $5.00\nBalance due $7.00", catalog).totalUsd, 7);
  assert.deepEqual(codes(parseBill("Yangjae Kitchen\nTOTAL $0.00", catalog)), ["total_not_found"]);
});

test("items: every item line reaches the request (blocked keywords are never cut off)", () => {
  // An item above the line that names the catalog merchant.
  const above = parseBill(`Joe's Market\n1 x Bottle of wine $20.00\n1 x Yangjae Kitchen voucher $10.00\nTOTAL $30.00`, catalog);
  assert.equal(above.merchant?.id, "m1");
  assert.match(billPayText(above)!, /Bottle of wine/);
  // The merchant named only in the footer.
  assert.deepEqual(parseBill(`RECEIPT\n1 x Bottle of wine $20.00\nTOTAL $20.00\nThank you for visiting Yangjae Kitchen`, catalog).items, ["1 x Bottle of wine"]);
  // A long item line is not shortened.
  const long = parseBill(`Yangjae Kitchen\n1 x Premium assorted Korean snack box for the client with a bottle of wine $30.00\nTOTAL $30.00`, catalog);
  assert.match(billPayText(long)!, /with a bottle of wine, total \$30\.00\.$/);
  // Item 21 of 21.
  const many = parseBill(
    `Daiso Yangjae\n${Array.from({ length: 20 }, (_, i) => `1 x Item number ${i + 1} $1.00`).join("\n")}\n1 x Gift bag $1.00\nTOTAL $21.00`,
    catalog,
  );
  assert.equal(many.items.length + many.moreItems.length, 21);
  assert.match(billPayText(many)!, /1 x Gift bag, total \$21\.00\.$/);
});

test("a request longer than the chat accepts is not one click (items are never dropped to fit)", () => {
  const lines = Array.from({ length: 40 }, (_, i) => `1 x Conference supplies pack number ${i + 1} $1.00`).join("\n");
  const b = parseBill(`Daiso Yangjae\n${lines}\nTOTAL $40.00`, catalog);
  assert.equal(b.totalUsd, 40);
  assert.equal(b.merchant?.id, "m4");
  assert.equal(billPayText(b), null);
  assert.equal(canPayBill(b), false);
  assert.equal(billTooLong(b), true);
  assert.equal(billTooLong(parseBill(YANGJAE_PDF, catalog)), false);
  assert.ok(billPayText(parseBill(YANGJAE_PDF, catalog))!.length <= MAX_REQUEST_CHARS);
});

test("approximate merchant: a whole line one character off, never part of another name", () => {
  const kakao = parseBill("Kakao Taxi\nTOTAL $8.00", catalog);
  assert.equal(kakao.merchant?.id, "m2");
  assert.ok(codes(kakao).includes("merchant_approximate"));
  const cheese = parseBill("Wine and Cheese Bar\n1 x Cheese plate $12.00\nTOTAL $12.00", catalog);
  assert.equal(cheese.merchant, null);
  assert.equal(canPayBill(cheese), false);
});

// ---------------------------------------------------------------------------------------------
// Bills in other currencies: converted to USD with the day's rate (settlement is always USD)
// ---------------------------------------------------------------------------------------------

const FX: FxRates = {
  base: "USD",
  date: "2026-09-29",
  rates: { AUD: 1.425042, CNY: 6.721579, EUR: 0.879241, GBP: 0.754467, JPY: 157.315109, KRW: 1358.968392, USD: 1 },
  source: { name: "ExchangeRate-API", url: "https://www.exchangerate-api.com", attribution: "Rates By Exchange Rate API" },
  fetchedAt: "2026-09-29T09:00:00.000Z",
};

/** public/samples/bill-yangjae-kitchen-krw.pdf, text layer. */
const YANGJAE_KRW_PDF = `Yangjae Kitchen
Korean home cooking
27 Yangjae-daero 12-gil, Seocho-gu
Seoul 06770, Republic of Korea
Tel +82 2-555-0142
R E C E I P T
Bill no. YK-0929-0415
Date 2026-09-29 12:24
Table 4
ITEM AMOUNT
1 x Bibimbap lunch ₩16,000
Subtotal ₩16,000
TOTAL ₩16,000
All amounts in KRW (Korean won). Thank you for dining with us.`;

/** tesseract.js (English) on public/samples/bill-yangjae-kitchen-krw.png: "₩" comes out as "¥" or not at all. */
const YANGJAE_KRW_OCR = `Yangjae Kitchen

Korean home cooking

Date                  2026-09-29 12:24

ITEM                                                                   AMOUNT
1 x Bibimbap lunch                                     16,000
Subtotal                                                              ¥¢16,000
TOTAL                                                       ¥16,000
All amounts in KRW (Korean won). Thank you for dining with us.
`;

const KRW_TEXT =
  "Pay this bill from Yangjae Kitchen: 1 x Bibimbap lunch, total $11.77. Bill total 16,000 KRW converted at 1 USD = 1,358.968392 KRW (ExchangeRate-API, 2026-09-29).";

test("KRW sample bill (PDF): ₩16,000 → $11.77 at the day's rate; the request states the conversion", () => {
  const b = parseBill(YANGJAE_KRW_PDF, catalog);
  assert.equal(b.merchant?.id, "m1");
  assert.equal(b.totalAmount, 16000);
  assert.equal(b.currency, "KRW");
  assert.equal(b.totalUsd, null, "the parser never converts");
  assert.equal(b.date, "2026-09-29");
  assert.deepEqual(b.items, ["1 x Bibimbap lunch"]);
  // Without rates: no one click, and nothing is converted by guess.
  assert.equal(canPayBill(b), false);
  assert.equal(billTotal(b).problem, "no_rate");
  assert.equal(billEditText(b), "Pay this bill from Yangjae Kitchen: 1 x Bibimbap lunch, total $[amount in USD] (the bill says KRW 16,000).");
  // With rates: 16,000 / 1,358.968392 = 11.7736… → $11.77 (half up to the cent).
  const t = billTotal(b, { fx: FX });
  assert.equal(t.conversion?.usd, 11.77);
  assert.equal(t.conversion?.rate, 1358.968392);
  assert.equal(billPayText(b, { fx: FX }), KRW_TEXT);
  assert.equal(billEditText(b, { fx: FX }), KRW_TEXT);
  assert.ok(KRW_TEXT.length <= MAX_REQUEST_CHARS);
});

test("KRW sample bill (English OCR of the PNG): the stated KRW settles the misread ¥, with a note", () => {
  const b = parseBill(YANGJAE_KRW_OCR, catalog);
  assert.equal(b.totalAmount, 16000);
  assert.equal(b.currency, "KRW");
  assert.ok(codes(b).includes("currency_inferred"));
  assert.deepEqual(b.items, ["1 x Bibimbap lunch"]);
  assert.equal(billPayText(b, { fx: FX }), KRW_TEXT);
});

test("JPY bill (Japanese text, bare ¥): read as JPY from the kana, converted", () => {
  const b = parseBill(`ヤンジェ キッチン\nYangjae Kitchen\n2026年9月29日\nビビンバ 1点  ¥1,800\n合計  ¥1,800`, catalog);
  assert.equal(b.merchant?.id, "m1");
  assert.equal(b.totalAmount, 1800);
  assert.equal(b.currency, "JPY");
  assert.ok(codes(b).includes("currency_inferred"));
  assert.equal(b.date, "2026-09-29");
  assert.equal(
    billPayText(b, { fx: FX }),
    "Pay this bill from Yangjae Kitchen: ビビンバ 1点, total $11.44. Bill total 1,800 JPY converted at 1 USD = 157.315109 JPY (ExchangeRate-API, 2026-09-29).",
  );
});

test("CNY bill (Simplified labels, bare ¥): read as CNY, converted", () => {
  const b = parseBill(`良才厨房\nYangjae Kitchen\n2026年9月29日\n拌饭 1份  ¥88.00\n合计  ¥88.00`, catalog);
  assert.equal(b.totalAmount, 88);
  assert.equal(b.currency, "CNY");
  assert.equal(billTotal(b, { fx: FX }).conversion?.usd, 13.09);
  assert.match(billPayText(b, { fx: FX })!, /total \$13\.09\. Bill total 88\.00 CNY converted at 1 USD = 6\.721579 CNY \(ExchangeRate-API, 2026-09-29\)\.$/);
});

test("EUR bill (decimal comma, € after the amount): converted", () => {
  const b = parseBill(`Yangjae Kitchen\nRechnung\nDatum 29.09.2026\n1 x Bibimbap  12,50 €\nSumme  12,50 €`, catalog);
  assert.equal(b.totalAmount, 12.5);
  assert.equal(b.currency, "EUR");
  assert.deepEqual(b.items, ["1 x Bibimbap"]);
  assert.equal(
    billPayText(b, { fx: FX }),
    "Pay this bill from Yangjae Kitchen: 1 x Bibimbap, total $14.22. Bill total 12.50 EUR converted at 1 USD = 0.879241 EUR (ExchangeRate-API, 2026-09-29).",
  );
});

test("ambiguous ¥: not payable until the traveler chooses JPY or CNY; a chosen currency converts", () => {
  const b = parseBill(`Yangjae Kitchen\n1 x Bibimbap lunch ¥1,200\nTOTAL ¥1,200`, catalog);
  assert.equal(b.currency, null);
  assert.deepEqual(b.ambiguousWith, ["JPY", "CNY"]);
  assert.equal(billTotal(b, { fx: FX }).problem, "no_currency");
  assert.equal(canPayBill(b, { fx: FX }), false);
  assert.equal(billEditText(b, { fx: FX }), "Pay this bill from Yangjae Kitchen: 1 x Bibimbap lunch, total $[amount in USD] (the bill says 1,200 in JPY or CNY).");
  assert.match(billPayText(b, { fx: FX, currency: "JPY" })!, /total \$7\.63\. Bill total 1,200 JPY converted at 1 USD = 157\.315109 JPY/);
  // A misread currency can be corrected too (USD bill → CAD would need a CAD rate: none here).
  assert.equal(billTotal(parseBill(YANGJAE_PDF, catalog), { fx: FX, currency: "CAD" }).problem, "no_rate");
  assert.equal(billPayText(parseBill(YANGJAE_PDF, catalog), { fx: FX, currency: "USD" }), "Pay this bill from Yangjae Kitchen: 1 x Bibimbap lunch, total $12.00.");
});

test("a USD bill needs no rates, and its request is unchanged", () => {
  const b = parseBill(YANGJAE_PDF, catalog);
  assert.equal(billPayText(b), billPayText(b, { fx: FX }));
  assert.equal(billTotal(b).conversion?.rate, 1);
});

test("a long bill in KRW: one click refused (items never dropped); the edit text shortens items, never amounts", () => {
  const lines = Array.from({ length: 40 }, (_, i) => `1 x Conference supplies pack number ${i + 1} ₩1,000`).join("\n");
  const b = parseBill(`Daiso Yangjae\n${lines}\nTOTAL ₩40,000`, catalog);
  assert.equal(b.currency, "KRW");
  assert.equal(billPayText(b, { fx: FX }), null);
  assert.equal(billTooLong(b, { fx: FX }), true);
  const edit = billEditText(b, { fx: FX });
  assert.ok(edit.length <= MAX_REQUEST_CHARS, `${edit.length}`);
  assert.match(edit, /, … \(\+\d+ more lines on the bill\), total \$29\.43\. Bill total 40,000 KRW converted at 1 USD = 1,358\.968392 KRW \(ExchangeRate-API, 2026-09-29\)\.$/);
});

test("items: two-line items, section headings, modifiers and bare prices reach the request", () => {
  // The description on one line, quantity and price on the next.
  const two = parseBill(
    `Yangjae Kitchen\nHouse red wine (glass)\n  1 x $9.00      $9.00\nBibimbap lunch\n  1 x $12.00     $12.00\nTOTAL $21.00`,
    catalog,
  );
  assert.deepEqual([...two.items, ...two.moreItems], ["House red wine (glass)", "Bibimbap lunch"]);
  assert.equal(billPayText(two), "Pay this bill from Yangjae Kitchen: House red wine (glass), Bibimbap lunch, total $21.00.");
  // A section heading and a modifier inside the item block; money inside such a line comes out.
  const section = parseBill(
    `Yangjae Kitchen\n1 x Bibimbap $12.00\nWINE\n1 x Glass of house red $9.00\n  + wine pairing ($5.00 value)\nTOTAL $21.00`,
    catalog,
  );
  assert.deepEqual([...section.items, ...section.moreItems], ["1 x Bibimbap", "WINE", "1 x Glass of house red", "wine pairing (value)"]);
  assert.match(billPayText(section)!, /WINE, 1 x Glass of house red, wine pairing \(value\), total \$21\.00\.$/);
  // Bare prices (a won bill) under a column header, Korean or English.
  const krw = parseBill(`Yangjae Kitchen\n품목 수량 금액\n비빔밥 1 9000\nHouse wine 1 7000\n합계 16,000원`, catalog);
  assert.deepEqual(krw.items, ["비빔밥 1", "House wine 1"]);
  // Header lines above the item block (address, phone) never become items.
  assert.deepEqual(parseBill(YANGJAE_PDF, catalog).items, ["1 x Bibimbap lunch"]);
  // An item that merely contains a header word (table, time, tax, guest) is still an item.
  const words = parseBill(
    `Yangjae Kitchen\nTable 7\n1 x Bibimbap lunch $12.00\n1 x Table wine (bottle) $25.00\n1 x Tax-free gift set $9.00\nTax $1.00\nTOTAL $47.00`,
    catalog,
  );
  assert.deepEqual([...words.items, ...words.moreItems], ["1 x Bibimbap lunch", "1 x Table wine (bottle)", "1 x Tax-free gift set"]);
  assert.match(billPayText(words)!, /Table wine \(bottle\), 1 x Tax-free gift set, total \$47\.00\.$/);
});

test("no item line read: not one click (the policy would see nothing of what was bought)", () => {
  const b = parseBill(`Yangjae Kitchen\nコーヒー 450\nWine 800\n合計 1,250円`, catalog);
  assert.equal(b.merchant?.id, "m1");
  assert.equal(b.totalAmount, 1250);
  assert.deepEqual([...b.items, ...b.moreItems], []);
  assert.equal(billPayText(b, { fx: FX }), null);
  assert.equal(billHasNoItems(b), true);
  assert.match(billEditText(b, { fx: FX }), /^Pay this bill from Yangjae Kitchen: purchase, total \$7\.95\. Bill total 1,250 JPY/);
  assert.equal(canPayBill(parseBill(`Yangjae Kitchen\nTOTAL $12.00`, catalog)), false);
  assert.equal(billHasNoItems(parseBill(YANGJAE_PDF, catalog)), false);
});

test("PDF runs → lines (same baseline joined, columns spaced)", () => {
  const lines = runsToLines([
    { str: "TOTAL", x: 44, y: 100, w: 60, h: 22 },
    { str: "$12.00", x: 400, y: 101, w: 70, h: 22 },
    { str: "1 x Bibimbap lunch", x: 44, y: 140, w: 150, h: 16 },
    { str: "$12.00", x: 420, y: 140, w: 50, h: 16 },
  ]);
  assert.deepEqual(lines, ["1 x Bibimbap lunch  $12.00", "TOTAL  $12.00"]);
});

console.log(`\n${passed} bill-parse tests passed`);
