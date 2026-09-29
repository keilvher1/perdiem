/**
 * lib/bills/request.ts — the chat request a read bill turns into.
 *
 * "Pay this bill" sends one English sentence through the normal chat path (POST /api/chat), so the
 * agent proposes a payment and lib/policy.ts decides exactly as for a typed request. Every item
 * line read off the bill goes into the sentence: the policy's BLOCKED_KEYWORD check reads the
 * request text, so "wine" or "gift" on the bill is still caught. PerDiem pays the merchant named on
 * the bill, inside the mandate; it is not a reimbursement to the traveler.
 */
import { fmtUsd } from "@/lib/format";
import type { ParsedBill } from "./parse";

/** The longest request /api/chat accepts (app/api/chat/route.ts: text max 1000). */
export const MAX_REQUEST_CHARS = 1000;

function itemsPart(bill: ParsedBill): string {
  const all = [...bill.items, ...bill.moreItems].map((s) => s.replace(/\s+/g, " ").replace(/[.,;:\s]+$/, "").trim()).filter(Boolean);
  return all.length > 0 ? all.join(", ") : "purchase";
}

/** The sentence, whatever its length, when the bill names a catalog merchant and a USD total. */
function fullPayText(bill: ParsedBill): string | null {
  if (!bill.merchant || bill.totalUsd === null || !(bill.totalUsd > 0)) return null;
  return `Pay this bill from ${bill.merchant.name}: ${itemsPart(bill)}, total ${fmtUsd(bill.totalUsd)}.`;
}

/**
 * The request "Pay this bill" sends, or null when the bill is not payable in one click:
 * `Pay this bill from <merchant>: <every item line, or "purchase">, total $<amount>.`
 * Null too when that sentence is longer than the chat accepts: items are never dropped to make it
 * fit (a dropped line could be the one with a blocked keyword), so the traveler edits it instead.
 */
export function billPayText(bill: ParsedBill): string | null {
  const text = fullPayText(bill);
  return text !== null && text.length <= MAX_REQUEST_CHARS ? text : null;
}

/** One click needs a catalog merchant, a positive total in USD and a request the chat accepts. */
export function canPayBill(bill: ParsedBill): boolean {
  return billPayText(bill) !== null;
}

/** Merchant and total were read, but the bill has too many item lines for one request. */
export function billTooLong(bill: ParsedBill): boolean {
  const text = fullPayText(bill);
  return text !== null && text.length > MAX_REQUEST_CHARS;
}

/** "15,000" / "1,234.5": the printed amount, never converted. */
function plainAmount(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/**
 * A readable request for the composer ("Edit as request"): what was read, with any missing part
 * as a bracketed blank the traveler fills in. Sent unedited, a blank proposes nothing payable.
 */
export function billEditText(bill: ParsedBill): string {
  const merchant =
    bill.merchant?.name ??
    (bill.merchantMatches.length > 1 ? bill.merchantMatches.map((m) => m.name).join(" or ") : "[merchant]");
  let total: string;
  if (bill.totalUsd !== null && bill.totalUsd > 0) total = fmtUsd(bill.totalUsd);
  else if (bill.totalAmount !== null && bill.currency && bill.currency !== "USD")
    total = `$[amount in USD] (the bill says ${bill.currency} ${plainAmount(bill.totalAmount)})`;
  else if (bill.totalAmount !== null) total = `$[amount in USD] (the bill says ${plainAmount(bill.totalAmount)})`;
  else total = "$[amount]";
  return `Pay this bill from ${merchant}: ${itemsPart(bill)}, total ${total}.`;
}
