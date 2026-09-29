/**
 * lib/bills/parse.ts — read the merchant, total, date and items off a bill's text.
 *
 * Pure: no DOM, no network, no clock. The text comes from lib/bills/extract.ts (a .txt file, a
 * PDF's text layer or OCR of an image). Every field is either read from the text or null; nothing
 * is guessed, defaulted or converted:
 *   - merchant   one catalog merchant named on the bill (case- and punctuation-insensitive, with
 *                OCR look-alikes folded; a line that is the name with one or two characters off
 *                also counts, with a note); null when none or more than one is named.
 *   - totalUsd   the first amount after a TOTAL / Grand total / Amount due / Total due label, only
 *                when the bill states USD ($, US$, USD). Another currency (₩, 원, KRW, ¥, JPY, …)
 *                gives totalUsd null with `currency` set: PerDiem never converts. A negative total
 *                (-$12.00, ($12.00): a refund or credit) is not a total to pay, and neither is a
 *                total on a bill whose amount / balance due is 0 (a receipt already paid by card).
 *   - date       YYYY-MM-DD, only when the printed date is unambiguous.
 *   - items      item lines above the first subtotal / total (the first 3; the rest are in
 *                `moreItems`, uncut, so a request built from the bill names every line and the
 *                policy's blocked-keyword check sees all of them).
 *   - notes      why a field is missing or how it was read (codes, localized by the UI).
 */

export interface BillCatalogMerchant {
  id: string;
  name: string;
  category: string;
}

export type BillNoteCode =
  /** No catalog merchant is named on the bill. */
  | "merchant_not_found"
  /** Several catalog merchants are named; `detail` lists them ("A, B"). */
  | "merchant_ambiguous"
  /** The name matched with OCR look-alike tolerance (one or two characters off); `detail` = name. */
  | "merchant_approximate"
  /** No TOTAL / Amount due / Grand total / Total due line with an amount. */
  | "total_not_found"
  /** Only a subtotal is printed (no total): not used as the total. */
  | "subtotal_only"
  /** The total is in another currency; `detail` = ISO code. */
  | "total_not_usd"
  /** The bill states no currency for its total. */
  | "currency_unknown"
  /** The only total is negative or in parentheses (a refund or credit): nothing to pay. */
  | "total_negative"
  /** An amount / balance due line says $0.00: the bill is already paid, whatever its total. */
  | "nothing_due"
  /** Two total lines disagree; the strongest label (grand total > amount due > total) was used. */
  | "totals_disagree"
  /** A date like 03/04/2026 could be read two ways, so no date is given. */
  | "date_ambiguous"
  /** More than 3 item lines; `detail` = how many more. */
  | "more_items";

export interface BillNote {
  code: BillNoteCode;
  detail?: string;
}

export interface ParsedBill {
  merchant: BillCatalogMerchant | null;
  /** Every catalog merchant named on the bill (more than one = ambiguous, `merchant` is null). */
  merchantMatches: BillCatalogMerchant[];
  /** The total in USD, or null (not found, or not in USD). Unrounded, as printed. */
  totalUsd: number | null;
  /** The total as printed, in `currency` (null when no total line was found). */
  totalAmount: number | null;
  /** ISO 4217 code of the total ("USD", "KRW", "JPY", …), or null when the bill does not say. */
  currency: string | null;
  /** YYYY-MM-DD, or null. */
  date: string | null;
  /** The first 3 item lines, amounts stripped. */
  items: string[];
  /** Every item line after the first 3 (not cut: the request names them all). */
  moreItems: string[];
  notes: BillNote[];
}

export const MAX_ITEMS = 3;

// ---------------------------------------------------------------------------------------------
// Currency markers. Longest first, so "US$" wins over "$" and "HK$" is never read as USD.
// ---------------------------------------------------------------------------------------------

const MARKERS: { re: RegExp; code: string }[] = [
  { re: /(?<![A-Za-z])US\$|\bUSD\b|\bU\.S\.\s*dollars?\b/i, code: "USD" },
  { re: /(?<![A-Za-z])HK\$|\bHKD\b/i, code: "HKD" },
  { re: /(?<![A-Za-z])NT\$|\bTWD\b/i, code: "TWD" },
  { re: /(?<![A-Za-z])S\$|\bSGD\b/i, code: "SGD" },
  { re: /(?<![A-Za-z])CA?\$|\bCAD\b/i, code: "CAD" },
  { re: /(?<![A-Za-z])AU?\$|\bAUD\b/i, code: "AUD" },
  { re: /\bKRW\b|₩|원/i, code: "KRW" },
  { re: /\bJPY\b|円/i, code: "JPY" },
  { re: /\bCNY\b|\bRMB\b|元|人民币/i, code: "CNY" },
  { re: /\bEUR\b|€/i, code: "EUR" },
  { re: /\bGBP\b|£/i, code: "GBP" },
  { re: /¥/, code: "YEN" }, // JPY or CNY: resolved per document below
  { re: /\$|\bdollars?\b/i, code: "USD" },
];

/**
 * One token: optional currency before, the number, optional currency after. The number never
 * starts or ends inside a longer run of digits and separators ("$1.234,56", "2026.09.29",
 * "$12.000" give no amount rather than a wrong one).
 */
const AMOUNT_RE =
  /(?:(US\$|HK\$|NT\$|S\$|CA\$|C\$|AU\$|A\$|USD|KRW|JPY|CNY|RMB|EUR|GBP|[$₩¥€£])\s?)?(?<!\d[.,]?)(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?![.,]?\d)(?:\s?(USD|KRW|JPY|CNY|RMB|EUR|GBP|원|円|元|[Dd]ollars?))?/g;

interface AmountToken {
  value: number;
  /** Currency written next to the number (before or after), resolved to a code; null if bare. */
  marker: string | null;
  /** Has a decimal part, thousands separators or a currency marker: looks like money. */
  money: boolean;
  /** Written as negative: "-$12.00", "$-12.00", "-12.00" or "($12.00)" (a refund or credit). */
  negative: boolean;
  index: number;
  end: number;
}

/** A minus sign right before the amount (not a run of leader dashes): "-$12.00", "$-12.00", ": -12". */
const MINUS_BEFORE = /(^|[\s:=($])[-−]$/;

function isNegative(line: string, index: number, end: number): boolean {
  if (MINUS_BEFORE.test(line.slice(0, index))) return true;
  return line[index - 1] === "(" && line[end] === ")";
}

function markerCode(raw: string | undefined): string | null {
  if (!raw) return null;
  for (const m of MARKERS) if (m.re.test(raw)) return m.code;
  return null;
}

function parseNumber(raw: string): number {
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(raw)) return Number(raw.replace(/,/g, ""));
  // "12,00": a decimal comma (two digits after it, no other separator).
  if (/^\d+,\d{1,2}$/.test(raw)) return Number(raw.replace(",", "."));
  return Number(raw);
}

function amountsIn(line: string): AmountToken[] {
  const out: AmountToken[] = [];
  for (const m of line.matchAll(AMOUNT_RE)) {
    const [whole, rawPre, num, post] = m;
    let index = m.index ?? 0;
    const before = line[index - 1] ?? "";
    if (!rawPre && /[A-Za-z]/.test(before)) {
      // OCR often reads "$12.00" as "S12.00": a money-shaped number behind a lone S is an amount
      // with no stated currency (the S is not taken as "$").
      if (/^[Ss]$/.test(before) && !/[A-Za-z]/.test(line[index - 2] ?? "") && /[.,]\d{2}$/.test(num)) {
        index -= 1;
        const value = parseNumber(num);
        const end = index + 1 + whole.length;
        if (Number.isFinite(value))
          out.push({ value, marker: markerCode(post), money: true, negative: isNegative(line, index, end), index, end });
      }
      // Otherwise a number glued to letters ("A4", "B2", "3F") is a code, not an amount.
      continue;
    }
    // "ITEMS$12" is "$12", not Singapore dollars: a letter prefix counts only after a non-letter.
    const pre = rawPre && /[A-Za-z]/.test(rawPre) && /[A-Za-z]/.test(before) ? rawPre.replace(/^[A-Za-z]+/, "") || undefined : rawPre;
    const value = parseNumber(num);
    if (!Number.isFinite(value)) continue;
    const marker = markerCode(pre) ?? markerCode(post);
    const money = marker !== null || /[.,]/.test(num);
    const end = index + whole.length;
    out.push({ value, marker, money, negative: isNegative(line, index, end), index, end });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------------------------

/** "total" with the usual OCR slips (T0TAL, TOTAl, TOTA1). */
const T = "t[o0]ta[l1i|]";
const SUBTOTAL_RE = new RegExp(`\\bsub[\\s-]*${T}\\b|소계|小計|小计`, "i");
const NOT_A_TOTAL_RE = new RegExp(
  `\\b${T}\\s+(tax|vat|gst|items?|qty|quantity|savings|discount|tips?|count)\\b|\\b(tax|vat|gst|tips?)\\s+${T}\\b`,
  "i",
);
/** Strongest first: 3 grand total, 2 amount / total / balance due, 1 total. */
const TOTAL_LABELS: { re: RegExp; tier: number }[] = [
  { re: new RegExp(`\\bgrand\\s*${T}\\b`, "i"), tier: 3 },
  {
    re: new RegExp(
      `\\b(amount|${T}|balance)\\s*(due|payable|to\\s+pay)\\b|\\bamount\\s+(charged|payable)\\b|\\b${T}\\s+(paid|charged|amount)\\b`,
      "i",
    ),
    tier: 2,
  },
  { re: new RegExp(`(^|[^a-z])${T}(?![a-z])|합계|총액|총\\s*금액|결제\\s*금액|받을\\s*금액|合計|総額|お会計|ご請求額|合计|总计|总额|应付`, "i"), tier: 1 },
];

/** An outstanding-amount label: what is still to be paid (not what was charged or paid). */
const DUE_RE = /\b(due|payable|to\s+pay|balance)\b|받을\s*금액|ご請求額|应付/i;

function totalTier(line: string): { tier: number; labelEnd: number; due: boolean } | null {
  if (SUBTOTAL_RE.test(line) || NOT_A_TOTAL_RE.test(line)) return null;
  for (const { re, tier } of TOTAL_LABELS) {
    const m = re.exec(line);
    if (m) return { tier, labelEnd: (m.index ?? 0) + m[0].length, due: DUE_RE.test(m[0]) };
  }
  return null;
}

/** The line is only an amount (a value printed on the line under its label). */
function amountOnly(line: string): AmountToken | null {
  const t = amountsIn(line);
  if (t.length !== 1) return null;
  const rest = (line.slice(0, t[0].index) + line.slice(t[0].end)).replace(/[\s:.\-=*]/g, "");
  return rest === "" ? t[0] : null;
}

/**
 * The amount belonging to a label line: the first money-looking amount after the label ("TOTAL 2
 * $24.00" → $24.00, "Total $12.00 (incl. VAT $1.09)" → $12.00, "Total $12.00 Tip $2.00" → $12.00),
 * else the last bare number after it, else the next line when it is only an amount.
 */
function labelledAmount(lines: string[], i: number, labelEnd: number): AmountToken | null {
  const after = amountsIn(lines[i]).filter((a) => a.index >= labelEnd);
  const money = after.find((a) => a.money);
  if (money) return money;
  if (after.length > 0) return after[after.length - 1];
  const next = lines[i + 1];
  return next !== undefined ? amountOnly(next) : null;
}

// ---------------------------------------------------------------------------------------------
// Merchant
// ---------------------------------------------------------------------------------------------

/** Lowercase, "&" → "and", OCR look-alikes folded (0→o, 1 | ! i → l, 5→s, rn→m), punctuation and spaces gone. */
export function foldName(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[|!]/g, "l")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .replace(/0/g, "o")
    .replace(/[1i]/g, "l")
    .replace(/5/g, "s")
    .replace(/rn/g, "m");
}

/** Edit distance (Levenshtein) between two folded strings. */
function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

function allowedEdits(len: number): number {
  if (len >= 16) return 2;
  if (len >= 8) return 1;
  return 0;
}

interface MerchantHit {
  merchant: BillCatalogMerchant;
  line: number;
  approximate: boolean;
}

function findMerchants(lines: string[], catalog: BillCatalogMerchant[]): MerchantHit[] {
  // Each line, and each pair of adjacent lines (a name wrapped over two lines).
  const windows: { text: string; line: number }[] = [];
  const folded = lines.map(foldName);
  folded.forEach((f, i) => {
    windows.push({ text: f, line: i });
    if (i + 1 < folded.length) windows.push({ text: f + folded[i + 1], line: i });
  });
  const hits: MerchantHit[] = [];
  for (const merchant of catalog) {
    const name = foldName(merchant.name);
    if (name.length < 3) continue;
    const exact = windows.find((w) => w.text.includes(name));
    if (exact) {
      hits.push({ merchant, line: exact.line, approximate: false });
      continue;
    }
    // Approximate only against a whole line (or two wrapped lines): a line that IS the name with one
    // or two characters misread. Never a name-like part of a longer line ("Wine and Cheese Bar" is
    // not "Wine & Co").
    const k = allowedEdits(name.length);
    if (k === 0) continue;
    const near = windows.find((w) => Math.abs(w.text.length - name.length) <= k && editDistance(name, w.text) <= k);
    if (near) hits.push({ merchant, line: near.line, approximate: true });
  }
  // A name inside another matched name ("Kitchen" inside "Yangjae Kitchen") is the same mention.
  return hits.filter(
    (h) => !hits.some((o) => o !== h && foldName(o.merchant.name).includes(foldName(h.merchant.name)) && o.merchant.name.length > h.merchant.name.length),
  );
}

// ---------------------------------------------------------------------------------------------
// Date
// ---------------------------------------------------------------------------------------------

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MON = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";

function isoDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

type DateRead = { date: string } | { ambiguous: true } | null;

function dateIn(line: string): DateRead {
  let m = /(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/.exec(line);
  if (m) {
    const d = isoDate(+m[1], +m[2], +m[3]);
    if (d) return { date: d };
  }
  m = /(20\d{2})\s*[년年]\s*(\d{1,2})\s*[월月]\s*(\d{1,2})\s*[일日]/.exec(line);
  if (m) {
    const d = isoDate(+m[1], +m[2], +m[3]);
    if (d) return { date: d };
  }
  m = new RegExp(`\\b${MON}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\b`, "i").exec(line);
  if (m) {
    const d = isoDate(+m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2]);
    if (d) return { date: d };
  }
  m = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MON},?\\s+(20\\d{2})\\b`, "i").exec(line);
  if (m) {
    const d = isoDate(+m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]);
    if (d) return { date: d };
  }
  m = /(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](20\d{2})(?!\d)/.exec(line);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const y = +m[3];
    if (a === b) return isoDate(y, a, b) ? { date: isoDate(y, a, b)! } : null;
    if (a > 12 && b <= 12) return isoDate(y, b, a) ? { date: isoDate(y, b, a)! } : null;
    if (b > 12 && a <= 12) return isoDate(y, a, b) ? { date: isoDate(y, a, b)! } : null;
    if (a <= 12 && b <= 12) return { ambiguous: true };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------------------------

/** Header, meta and column-title lines inside the item block. */
const META_RE =
  /\b(date|time|invoice|receipt|bill\s*(no|#|number)|order\s*(no|#|number)|table|server|cashier|guest|tel|phone|fax|www|https?|address|thank|welcome|tax|vat|gst|tip|service\s*charge|subtotal)\b|@\S+\.|:\d{2}\b/i;
const COLUMN_WORDS = /^(qty|quantity|item|items|description|desc|price|unit|amount|total|each|no)$/i;

function isColumnHeader(line: string): boolean {
  const words = line.toLowerCase().split(/[\s|/]+/).filter(Boolean);
  return words.length > 0 && words.every((w) => COLUMN_WORDS.test(w.replace(/[^a-z]/g, "")));
}

const QTY_RE = /^\s*(\d{1,3}\s*[x×@](?![a-z])|[x×]\s*\d{1,3}\b|\d{1,3}\s+(pcs|ea)\b)/i;

function itemText(line: string): string | null {
  if (META_RE.test(line) || isColumnHeader(line)) return null;
  const tokens = amountsIn(line);
  const last = tokens[tokens.length - 1];
  const endsWithMoney = last !== undefined && last.money && line.slice(last.end).trim() === "";
  if (!endsWithMoney && !QTY_RE.test(line)) return null;
  // Strip trailing money (a unit price and a line total), then leader dots and separators.
  let text = line;
  for (let t = amountsIn(text); t.length > 0; t = amountsIn(text)) {
    const tail = t[t.length - 1];
    if (!tail.money || text.slice(tail.end).trim() !== "") break;
    text = text.slice(0, tail.index);
  }
  text = text
    .replace(/[.·…_\-=:*]{2,}/g, " ")
    .replace(/[\s:\-–—=*@]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if ((text.match(/\p{L}/gu) ?? []).length < 2) return null;
  // Not cut: the request names the whole line, so a blocked keyword at its end still reaches the policy.
  return text;
}

// ---------------------------------------------------------------------------------------------
// parseBill
// ---------------------------------------------------------------------------------------------

function splitLines(text: string): string[] {
  return text
    .normalize("NFKC")
    .split(/\r?\n|\r/)
    .map((l) => l.replace(/[\t\u00a0]+/g, " ").replace(/ {2,}/g, "  ").trim())
    .filter((l) => l !== "");
}

function documentCurrency(lines: string[]): string | null {
  const found = new Set<string>();
  for (const line of lines) {
    for (const m of MARKERS) {
      if (m.re.test(line)) {
        found.add(m.code);
        break;
      }
    }
  }
  if (found.size !== 1) return null;
  return [...found][0];
}

/** "¥" alone: JPY, unless the bill says it is Chinese yuan. */
function resolveYen(code: string | null, lines: string[]): string | null {
  if (code !== "YEN") return code;
  return lines.some((l) => /CNY|RMB|元|人民币/i.test(l)) ? "CNY" : "JPY";
}

export function parseBill(text: string, catalog: BillCatalogMerchant[]): ParsedBill {
  const lines = splitLines(text);
  const notes: BillNote[] = [];

  // Merchant
  const hits = findMerchants(lines, catalog);
  const merchantMatches = hits.map((h) => ({ id: h.merchant.id, name: h.merchant.name, category: h.merchant.category }));
  let merchant: BillCatalogMerchant | null = null;
  if (hits.length === 1) {
    merchant = merchantMatches[0];
    if (hits[0].approximate) notes.push({ code: "merchant_approximate", detail: merchant.name });
  } else if (hits.length > 1) {
    notes.push({ code: "merchant_ambiguous", detail: merchantMatches.map((m) => m.name).join(", ") });
  } else {
    notes.push({ code: "merchant_not_found" });
  }

  // Total
  const totals: { tier: number; line: number; amount: AmountToken }[] = [];
  let firstSummaryLine = -1;
  let subtotalSeen = false;
  let negativeSeen = false;
  let nothingDue = false;
  lines.forEach((line, i) => {
    if (SUBTOTAL_RE.test(line)) {
      subtotalSeen = true;
      if (firstSummaryLine < 0) firstSummaryLine = i;
      return;
    }
    const label = totalTier(line);
    if (!label) return;
    if (firstSummaryLine < 0) firstSummaryLine = i;
    const amount = labelledAmount(lines, i, label.labelEnd);
    if (amount && amount.negative) negativeSeen = true;
    else if (amount && amount.value === 0 && label.due) nothingDue = true;
    else if (amount && amount.value > 0) totals.push({ tier: label.tier, line: i, amount });
  });

  let totalAmount: number | null = null;
  let currency: string | null = null;
  if (totals.length > 0) {
    const top = Math.max(...totals.map((t) => t.tier));
    const chosen = totals.filter((t) => t.tier === top).at(-1)!;
    totalAmount = chosen.amount.value;
    if (totals.some((t) => t.amount.value !== chosen.amount.value)) notes.push({ code: "totals_disagree" });
    currency =
      chosen.amount.marker ??
      // A currency written elsewhere on the total line ("Total (USD)  12.00").
      markerCode(lines[chosen.line]) ??
      // Otherwise the one currency the whole bill uses (none, or several → unknown).
      documentCurrency(lines);
    currency = resolveYen(currency, lines);
  } else {
    notes.push({ code: negativeSeen ? "total_negative" : subtotalSeen ? "subtotal_only" : "total_not_found" });
    currency = resolveYen(documentCurrency(lines), lines);
  }

  let totalUsd: number | null = null;
  if (totalAmount !== null && nothingDue) notes.push({ code: "nothing_due" });
  else if (totalAmount !== null) {
    if (currency === "USD") totalUsd = totalAmount;
    else if (currency === null) notes.push({ code: "currency_unknown" });
    else notes.push({ code: "total_not_usd", detail: currency });
  }

  // Date: a line that says "date" first, then the first date anywhere.
  let date: string | null = null;
  let ambiguous = false;
  const dated = [...lines.filter((l) => /date|issued|날짜|일자|日付|日期/i.test(l)), ...lines];
  for (const line of dated) {
    const d = dateIn(line);
    if (d && "date" in d) {
      date = d.date;
      break;
    }
    if (d && "ambiguous" in d) ambiguous = true;
  }
  if (!date && ambiguous) notes.push({ code: "date_ambiguous" });

  // Items: every item-shaped line above the first subtotal / total line. From the top, not from the
  // merchant line: header lines are not item-shaped (no trailing amount, no quantity), and an item
  // printed above or on a line naming a catalog merchant must still reach the request.
  const summary = firstSummaryLine >= 0 ? firstSummaryLine : lines.length;
  const all: string[] = [];
  for (let i = 0; i < summary; i++) {
    const item = itemText(lines[i]);
    if (item) all.push(item);
  }
  const items = all.slice(0, MAX_ITEMS);
  const moreItems = all.slice(MAX_ITEMS);
  if (all.length > MAX_ITEMS) notes.push({ code: "more_items", detail: String(all.length - MAX_ITEMS) });

  return { merchant, merchantMatches, totalUsd, totalAmount, currency, date, items, moreItems, notes };
}
