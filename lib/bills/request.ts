/**
 * lib/bills/request.ts — the chat request a read bill turns into.
 *
 * "Pay this bill" sends one English sentence through the normal chat path (POST /api/chat), so the
 * agent proposes a payment and lib/policy.ts decides exactly as for a typed request. Every item
 * line read off the bill goes into the sentence: the policy's BLOCKED_KEYWORD check reads the
 * request text, so "wine" or "gift" on the bill is still caught. PerDiem pays the merchant named on
 * the bill, inside the mandate; it is not a reimbursement to the traveler.
 *
 * Settlement is always USD. A bill in another currency is converted with the day's rate from
 * GET /api/fx (lib/fx): the USD total is amount ÷ rate rounded half up to the cent, and the sentence
 * says what was converted, at which rate, from which source and date:
 *   Pay this bill from Yangjae Kitchen: 1 x Bibimbap lunch, total $11.77. Bill total 16,000 KRW
 *   converted at 1 USD = 1,358.968392 KRW (ExchangeRate-API, 2026-09-29).
 * Without a rate (or a currency) there is no one-click request; nothing is converted by guess.
 */
import { usdFromBill, type UsdConversion } from "@/lib/fx/convert";
import { exactRate, plainAmount } from "@/lib/fx/format";
import type { FxRates } from "@/lib/fx/normalize";
import { fmtUsd } from "@/lib/format";
import type { ParsedBill } from "./parse";

/** The longest request /api/chat accepts (app/api/chat/route.ts: text max 1000). */
export const MAX_REQUEST_CHARS = 1000;

export interface BillPayOptions {
  /** A currency the traveler chose over the one read off the bill (a misread, or an ambiguous ¥). */
  currency?: string | null;
  /** Exchange rates (GET /api/fx): needed for any total not in USD. */
  fx?: FxRates | null;
  /** The mandate's blocked keywords, and the bill's full text: see mentionClause. */
  blockedKeywords?: readonly string[];
  sourceText?: string;
}

/**
 * Safety net for item lines the parser did not keep (a two-line item, a line after the subtotal):
 * any blocked keyword that appears anywhere on the bill but not in the request is appended, so the
 * policy's keyword check (a substring match on the traveler's words) always sees it.
 */
export function mentionClause(composed: string, opts: BillPayOptions): string {
  const src = (opts.sourceText ?? "").toLowerCase();
  const have = composed.toLowerCase();
  const hits = [
    ...new Set((opts.blockedKeywords ?? []).map((k) => k.trim().toLowerCase()).filter((k) => k && src.includes(k) && !have.includes(k))),
  ];
  return hits.length > 0 ? ` The bill also mentions: ${hits.join(", ")}.` : "";
}

/** Why a bill has no USD total. */
export type BillTotalProblem =
  /** No total to pay (none found, negative, or nothing due). */
  | "no_total"
  /** The currency is unknown or ambiguous (and not chosen). */
  | "no_currency"
  /** No rate for the currency (rates unavailable, or they do not cover it). */
  | "no_rate"
  /** The converted total is below one cent. */
  | "below_cent";

export interface BillTotal {
  /** The currency used: the traveler's choice, else the one read off the bill. */
  currency: string | null;
  /** The total as printed (null when there is nothing to pay). */
  amount: number | null;
  /** The USD the request asks for (a USD bill: its own total, rate 1); null with `problem`. */
  conversion: UsdConversion | null;
  problem: BillTotalProblem | null;
  /** The rates used for a non-USD total. */
  fx: FxRates | null;
}

/** What the bill's total is in USD, with these options. */
export function billTotal(bill: ParsedBill, opts: BillPayOptions = {}): BillTotal {
  const currency = opts.currency ?? bill.currency;
  const fx = opts.fx ?? null;
  const due = bill.totalAmount !== null && bill.totalAmount > 0 && !bill.notes.some((n) => n.code === "nothing_due");
  const amount = due ? bill.totalAmount : null;
  const none = (problem: BillTotalProblem, usedFx: FxRates | null = null): BillTotal => ({ currency, amount, conversion: null, problem, fx: usedFx });
  if (amount === null) return none("no_total");
  if (currency === null) return none("no_currency");
  if (currency === "USD") {
    // Already USD: the printed total, unrounded (fmtUsd prints it as the policy does).
    return { currency, amount, conversion: { amount, currency, rate: 1, exactUsd: amount, usd: amount }, problem: null, fx: null };
  }
  if (!fx) return none("no_rate");
  const conversion = usdFromBill(amount, currency, fx.rates);
  if (!conversion) return none("no_rate", fx);
  if (!(conversion.usd > 0)) return { currency, amount, conversion: null, problem: "below_cent", fx };
  return { currency, amount, conversion, problem: null, fx };
}

function itemLines(bill: ParsedBill): string[] {
  return [...bill.items, ...bill.moreItems].map((s) => s.replace(/\s+/g, " ").replace(/[.,;:\s]+$/, "").trim()).filter(Boolean);
}

/** " Bill total 16,000 KRW converted at 1 USD = 1,358.968392 KRW (ExchangeRate-API, 2026-09-29)." — "" for USD. */
export function conversionClause(total: BillTotal): string {
  const c = total.conversion;
  if (!c || c.currency === "USD" || !total.fx) return "";
  return ` Bill total ${plainAmount(c.amount, c.currency)} ${c.currency} converted at 1 USD = ${exactRate(c.rate)} ${c.currency} (${total.fx.source.name}, ${total.fx.date}).`;
}

/**
 * The sentence, whatever its length, when the bill names a catalog merchant, has a USD total and at
 * least one item line was read. With no item line the policy's blocked-keyword check would see
 * nothing of what was bought (a layout the reader does not know), so that is not one click either.
 */
function fullPayText(bill: ParsedBill, total: BillTotal): string | null {
  if (!bill.merchant || !total.conversion || !(total.conversion.usd > 0)) return null;
  const items = itemLines(bill);
  if (items.length === 0) return null;
  return `Pay this bill from ${bill.merchant.name}: ${items.join(", ")}, total ${fmtUsd(total.conversion.usd)}.${conversionClause(total)}`;
}

/** No item line was read off the bill (one click needs at least one: see fullPayText). */
export function billHasNoItems(bill: ParsedBill): boolean {
  return itemLines(bill).length === 0;
}

/**
 * The request "Pay this bill" sends, or null when the bill is not payable in one click:
 * `Pay this bill from <merchant>: <every item line>, total $<usd>.` and, for a bill
 * in another currency, ` Bill total <amount> <ISO> converted at 1 USD = <rate> <ISO> (<source>, <date>).`
 * Null too when that sentence is longer than the chat accepts: items are never dropped from a
 * one-click request (a dropped line could be the one with a blocked keyword), so the traveler
 * edits it instead ("Edit as request" shortens the item list visibly).
 */
export function billPayText(bill: ParsedBill, opts: BillPayOptions = {}): string | null {
  const base = fullPayText(bill, billTotal(bill, opts));
  const text = base === null ? null : base + mentionClause(base, opts);
  return text !== null && text.length <= MAX_REQUEST_CHARS ? text : null;
}

/**
 * One click needs a catalog merchant, a positive total in USD (converted with a rate when needed),
 * at least one item line and a request the chat accepts.
 */
export function canPayBill(bill: ParsedBill, opts: BillPayOptions = {}): boolean {
  return billPayText(bill, opts) !== null;
}

/** Merchant and total were read, but the bill has too many item lines for one request. */
export function billTooLong(bill: ParsedBill, opts: BillPayOptions = {}): boolean {
  const base = fullPayText(bill, billTotal(bill, opts));
  const text = base === null ? null : base + mentionClause(base, opts);
  return text !== null && text.length > MAX_REQUEST_CHARS;
}

/** "1,200" / "12.5": an amount whose currency (and so its decimals) is not known. */
function asPrinted(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

/**
 * A readable request for the composer ("Edit as request"): what was read, with any missing part
 * as a bracketed blank the traveler fills in. Sent unedited, a blank proposes nothing payable.
 * The amounts and the conversion are never cut; when the whole text would be longer than the chat
 * accepts, the item list is shortened and says so ("… (+12 more lines on the bill)").
 */
export function billEditText(bill: ParsedBill, opts: BillPayOptions = {}): string {
  const merchant =
    bill.merchant?.name ??
    (bill.merchantMatches.length > 1 ? bill.merchantMatches.map((m) => m.name).join(" or ") : "[merchant]");
  const t = billTotal(bill, opts);
  let total: string;
  if (t.conversion && t.conversion.usd > 0) total = `${fmtUsd(t.conversion.usd)}.${conversionClause(t)}`;
  else if (bill.totalAmount !== null && t.currency && t.currency !== "USD")
    total = `$[amount in USD] (the bill says ${t.currency} ${plainAmount(bill.totalAmount, t.currency)}).`;
  else if (bill.totalAmount !== null && t.currency === null && bill.ambiguousWith.length > 0)
    total = `$[amount in USD] (the bill says ${asPrinted(bill.totalAmount)} in ${bill.ambiguousWith.join(" or ")}).`;
  else if (bill.totalAmount !== null && t.currency === null) total = `$[amount in USD] (the bill says ${asPrinted(bill.totalAmount)}).`;
  else total = "$[amount].";
  const build = (items: string[], more: number) =>
    `Pay this bill from ${merchant}: ${items.length > 0 ? items.join(", ") : "purchase"}${more > 0 ? `, … (+${more} more lines on the bill)` : ""}, total ${total}`;
  const items = itemLines(bill);
  // The keyword note is computed against the full item list and always kept, even when items are cut.
  const note = mentionClause(build(items, 0), opts);
  let text = build(items, 0) + note;
  for (let keep = items.length - 1; text.length > MAX_REQUEST_CHARS && keep >= 0; keep--) {
    const cut = build(items.slice(0, keep), items.length - keep);
    text = cut + mentionClause(cut, opts);
  }
  return text;
}
