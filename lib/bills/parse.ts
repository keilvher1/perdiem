/**
 * lib/bills/parse.ts — read the merchant, total, currency, date and items off a bill's text.
 *
 * Pure: no DOM, no network, no clock. The text comes from lib/bills/extract.ts (a .txt file, a
 * PDF's text layer or OCR of an image). Every field is either read from the text or null; nothing
 * is guessed or defaulted, and nothing is converted here (lib/bills/request.ts converts, with rates):
 *   - merchant   one catalog merchant named on the bill (case- and punctuation-insensitive, with
 *                OCR look-alikes folded; a line that is the name with one or two characters off
 *                also counts, with a note); null when none or more than one is named.
 *   - total      the first amount after a TOTAL / Grand total / Amount due / Total due label (합계,
 *                合計, 合计 …): `totalAmount` as printed and its `currency` (any ISO 4217 code, or a
 *                symbol / word: $ US$ ₩ 원 円 元 € £ ₫ ₹ ฿ ₱ ₺ R$ HK$ NT$ S$ A$ C$ CHF …). Number formats
 *                1,234.56 · 1.234,56 · 1 234,56 · 1'234.56 · 12,000원; "16.000" is 16,000 only for a
 *                zero-decimal currency and 16 only for a three-decimal one, otherwise no amount. A
 *                symbol several currencies share is resolved only by the rest of the bill: a bare ¥
 *                with nothing saying yen (円, JPY, Japanese text) or yuan (元, RMB, CNY, Simplified
 *                labels) gives currency null with `ambiguousWith` ["JPY", "CNY"]; "$" is USD unless the
 *                bill names exactly one other dollar currency (that one), or states its amounts are in
 *                a currency that is no dollar ("All amounts in KRW": null, ["KRW", "USD"]). `totalUsd` is set only for a USD total. A
 *                negative total (-$12.00, ($12.00): a refund or credit) is not a total to pay, and
 *                neither is a total on a bill whose amount / balance due is 0 (already paid by card).
 *   - date       YYYY-MM-DD, only when the printed date is unambiguous.
 *   - items      item lines above the first subtotal / total (the first 3; the rest are in
 *                `moreItems`, uncut, so a request built from the bill names every line and the
 *                policy's blocked-keyword check sees all of them).
 *   - notes      why a field is missing or how it was read (codes, localized by the UI).
 */
import { isCurrencyCode, minorUnits } from "@/lib/fx/currencies";

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
  /** The total is in another currency; `detail` = ISO code (converted to USD with a rate, never by the parser). */
  | "total_not_usd"
  /** The bill states no currency for its total. */
  | "currency_unknown"
  /** The total's currency could be several (a bare ¥: yen or yuan); `detail` = the codes ("JPY, CNY"). */
  | "currency_ambiguous"
  /** The currency was read from indirect evidence (Japanese text for ¥, "CAD" elsewhere for $); `detail` = ISO code. */
  | "currency_inferred"
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
  /** ISO 4217 code of the total ("USD", "KRW", "JPY", …), or null when the bill does not say or is ambiguous. */
  currency: string | null;
  /** When `currency` is null because the symbol is shared: the candidate codes (["JPY", "CNY"]); else []. */
  ambiguousWith: string[];
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
// Currency: what the bill says its amounts are in. Nothing is guessed: a symbol several currencies
// share is resolved only by what else the bill says, and stays unresolved (null + ambiguousWith)
// otherwise.
// ---------------------------------------------------------------------------------------------

/** "$": US dollars, unless the bill names exactly one other dollar (or peso) currency and not USD. */
const DOLLAR = "$?";
/** "¥": Japanese yen or Chinese yuan. */
const YEN = "¥?";
/** "kr": Danish, Icelandic, Norwegian or Swedish krone/króna. */
const KRONA = "kr?";
type Pseudo = typeof DOLLAR | typeof YEN | typeof KRONA;
const PSEUDOS: readonly string[] = [DOLLAR, YEN, KRONA];

const YEN_CODES = ["JPY", "CNY"];
const KRONA_CODES = ["DKK", "ISK", "NOK", "SEK"];
/** Currencies also written with a bare "$". */
const DOLLAR_CODES = new Set([
  "USD", "AUD", "BBD", "BMD", "BND", "BSD", "BZD", "CAD", "CLP", "COP", "CUP", "DOP", "FJD", "GYD", "HKD", "JMD",
  "KYD", "LRD", "MXN", "NAD", "NZD", "SBD", "SGD", "SRD", "TTD", "TWD", "UYU", "XCD", "ARS",
]);

/**
 * ISO codes that are also everyday words or bill abbreviations (ALL, TOP, CUP, PEN, RUB, SHP, SVC …).
 * They count as a currency only right after an amount ("12.00 PEN") or in an explicit statement
 * ("in PEN", "Currency: PEN", "(PEN)"), never before an amount or loose in the text.
 */
const WORDY = new Set([
  "ALL", "AMD", "ANG", "AED", "BAM", "BOB", "BTN", "CAD", "CRC", "CUP", "CVE", "GEL", "KGS", "MAD", "MNT", "MOP",
  "NAD", "NPR", "PEN", "PHP", "RON", "RUB", "SCR", "SHP", "SOS", "STN", "SVC", "TOP", "TRY", "WST",
]);

/** Currencies customarily written with "." as the thousands separator (so "Rp 50.000" is 50,000). */
const DOT_THOUSANDS = new Set([
  "ARS", "BAM", "BOB", "BRL", "CLP", "COP", "DKK", "EUR", "IDR", "ISK", "MKD", "NOK", "PYG", "RON", "RSD", "TRY", "UYU",
  "VES", "VND",
]);

/** Symbols and abbreviations → ISO code (or a pseudo code resolved per bill). */
const SYMBOLS: Record<string, string> = {
  "US$": "USD", "U.S.$": "USD", "HK$": "HKD", "NT$": "TWD", "S$": "SGD", "SG$": "SGD", "C$": "CAD", "CA$": "CAD",
  "A$": "AUD", "AU$": "AUD", "NZ$": "NZD", "MX$": "MXN", "R$": "BRL", "CN¥": "CNY", "JP¥": "JPY", "RMB": "CNY",
  "VNĐ": "VND", "Rp": "IDR", "Rp.": "IDR", "RM": "MYR", "kr": KRONA, "kr.": KRONA,
  "₩": "KRW", "원": "KRW", "円": "JPY", "元": "CNY", "人民币": "CNY", "€": "EUR", "£": "GBP", "₫": "VND", "đ": "VND",
  "₹": "INR", "฿": "THB", "บาท": "THB", "₱": "PHP", "₺": "TRY", "TL": "TRY", "₽": "RUB", "₴": "UAH", "₪": "ILS",
  "₦": "NGN", "₵": "GHS", "₸": "KZT", "₮": "MNT", "₭": "LAK", "៛": "KHR", "৳": "BDT", "₾": "GEL", "₼": "AZN",
  "֏": "AMD", "zł": "PLN", "Kč": "CZK", "Ft": "HUF", $: DOLLAR, "¥": YEN,
};

const SIGNS = "$₩¥€£₫₹฿₱₺₽₴₪₦₵₸₮₭៛৳₾₼֏";
/** Before an amount. Longest first, so "US$" wins over "$" and "HK$" is never read as USD. */
const PREFIX = String.raw`US\$|U\.S\.\$|HK\$|NT\$|SG?\$|CA?\$|AU?\$|NZ\$|MX\$|R\$|CN¥|JP¥|RMB|VNĐ|Rp\.?|RM|kr\.?|[A-Z]{3}|[${SIGNS}]`;
/**
 * After an amount. A marker that also works as a prefix ("$", "₩", "USD", "kr") and is followed by
 * another number belongs to that number: "TOTAL 2 $24.00" is 2 and $24.00, not 2 dollars.
 */
const SUFFIX = String.raw`원|円|元|人民币|đ|บาท|zł|Kč|Ft|TL|[Dd]ollars?|[Ee]uros?|(?:VNĐ|[A-Z]{3}|kr\.?|[${SIGNS}])(?!\s?\d)`;
/**
 * The number: 1,234.56 · 1.234,56 · 1'234.56 · 1 234,56 · 12,000 · 12.50 · 12,50 · 12. Which of
 * "," and "." is the decimal point is decided in parseNumber (never by guessing: "$12.000" is no amount).
 */
const NUMBER = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d{1,3})?|\d{1,3}(?:\.\d{3})+(?:,\d{1,3})?|\d{1,3}(?:['’]\d{3})+(?:\.\d{1,3})?|\d{1,3}(?: \d{3})+(?:,\d{1,3})?|\d+(?:[.,]\d{1,3})?`;

/**
 * One token: optional currency before, the number, optional currency after. The number never
 * starts or ends inside a longer run of digits and separators ("2026.09.29" gives no amount).
 */
const AMOUNT_RE = new RegExp(`(?:(${PREFIX})\\s?)?(?<!\\d[.,'’]?)(${NUMBER})(?![.,'’]?\\d)(?:\\s?(${SUFFIX}))?`, "dg");

/** The code a written marker stands for (ISO, or a pseudo code), or null. */
function markerCode(raw: string | undefined, position: "pre" | "post" | "loose"): string | null {
  if (!raw) return null;
  if (Object.prototype.hasOwnProperty.call(SYMBOLS, raw)) return SYMBOLS[raw];
  if (/^dollars?$/i.test(raw)) return DOLLAR;
  if (/^euros?$/i.test(raw)) return "EUR";
  if (/^[A-Z]{3}$/.test(raw) && isCurrencyCode(raw)) return WORDY.has(raw) && position !== "post" ? null : raw;
  return null;
}

interface AmountToken {
  value: number;
  /** Currency written next to the number (before or after): an ISO code, a pseudo code, or null. */
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

/**
 * The value of a written number, or null when it cannot be read without guessing. `minor` is the
 * number of decimals the currency uses (Intl), when the currency is known:
 *   "1,234.56" 1234.56 · "1.234,56" 1234.56 · "1 234,56" 1234.56 · "1'234.56" 1234.56 · "12,50" 12.5
 *   "1.234.567" 1234567 · "16.000" 16000 for a zero-decimal currency (₫, ₩, ¥) or one written with
 *   dot thousands (Rp, €, R$ …), 16 for a three-decimal one (BHD, KWD), otherwise no amount
 *   ("$12.000": 12 or 12,000?) · three decimals ("12.345", "1,234.567") only for a three-decimal currency.
 * `code` is the amount's currency when known (its minor units come from Intl).
 */
function parseNumber(raw: string, code: string | null): number | null {
  const minor = code !== null && isCurrencyCode(code) ? minorUnits(code) : null;
  const three = (int: string, dec: string) => (dec.length === 3 && minor !== 3 ? null : Number(`${int}.${dec}`));
  // "0.500" / "0,500": a leading 0 is never a thousands group; read it as a decimal (or nothing).
  if (/^0[.,'’ ]\d/.test(raw)) {
    const z = /^0[.,](\d{1,3})$/.exec(raw);
    return z ? three("0", z[1]) : null;
  }
  let m = /^(\d{1,3}(?:,\d{3})+)(?:\.(\d{1,3}))?$/.exec(raw);
  if (m) return m[2] === undefined ? Number(m[1].replace(/,/g, "")) : three(m[1].replace(/,/g, ""), m[2]);
  m = /^(\d{1,3}(?:['’]\d{3})+)(?:\.(\d{1,3}))?$/.exec(raw);
  if (m) return m[2] === undefined ? Number(m[1].replace(/['’]/g, "")) : three(m[1].replace(/['’]/g, ""), m[2]);
  m = /^(\d{1,3}(?: \d{3})+)(?:,(\d{1,3}))?$/.exec(raw);
  if (m) return m[2] === undefined ? Number(m[1].replace(/ /g, "")) : three(m[1].replace(/ /g, ""), m[2]);
  m = /^(\d{1,3}(?:\.\d{3})+)(?:,(\d{1,3}))?$/.exec(raw);
  if (m) {
    const int = m[1].replace(/\./g, "");
    if (m[2] !== undefined) return three(int, m[2]);
    // Two or more dot groups can only be thousands; one group ("16.000") depends on the currency.
    if ((m[1].match(/\./g) ?? []).length > 1 || minor === 0 || (code !== null && DOT_THOUSANDS.has(code))) return Number(int);
    if (minor === 3) return Number(m[1]);
    return null;
  }
  m = /^(\d+)[.,](\d{1,3})$/.exec(raw);
  if (m) return three(m[1], m[2]);
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

/** The largest number read as an amount (a trillion units: more than any bill, in any currency). */
const MAX_AMOUNT = 1e12;

/** Pushes each group of a space-grouped number as its own bare number ("1 234" → 1, 234). */
function pushParts(out: AmountToken[], num: string, start: number) {
  let at = start;
  for (const part of num.split(" ")) {
    out.push({ value: Number(part), marker: null, money: false, negative: false, index: at, end: at + part.length });
    at += part.length + 1;
  }
}

function amountsIn(line: string, ctx?: CurrencyContext): AmountToken[] {
  const out: AmountToken[] = [];
  for (const m of line.matchAll(AMOUNT_RE)) {
    const [, rawPre, num, rawPost] = m;
    const idx = m.indices!;
    const [numStart, numEnd] = idx[2];
    // A prefix glued to a word is not a currency: "ITEMS$12" is "$12" (not Singapore dollars) and
    // "TOTAL 12" is not "TAL 12".
    let pre: string | undefined = rawPre;
    let preStart = idx[1]?.[0] ?? numStart;
    if (pre && /^[A-Za-z]/.test(pre) && /[A-Za-z]/.test(line[preStart - 1] ?? "")) {
      const stripped = pre.replace(/^[A-Za-z]+/, "");
      preStart += pre.length - stripped.length;
      pre = stripped || undefined;
    }
    const preCode = markerCode(pre, "pre");
    // A Latin suffix must end the word: "12 USDT" is not USD.
    const postEnd = idx[3]?.[1] ?? numEnd;
    const postCode =
      rawPost && !(/[A-Za-z.]$/.test(rawPost) && /[A-Za-z]/.test(line[postEnd] ?? "")) ? markerCode(rawPost, "post") : null;
    let index = preCode !== null ? preStart : numStart;
    const end = postCode !== null ? postEnd : numEnd;
    let ocrPrefix = false;
    if (preCode === null && /[A-Za-z]/.test(line[numStart - 1] ?? "")) {
      // OCR often reads "$12.00" as "S12.00" and "₩16,000" as "W16,000": a money-shaped number
      // behind a lone S or W is an amount with no stated currency (the letter is not taken as one).
      if (/^[SsW]$/.test(line[numStart - 1]) && !/[A-Za-z]/.test(line[numStart - 2] ?? "") && /[.,'’]\d{2,3}$/.test(num)) {
        index = numStart - 1;
        ocrPrefix = true;
      } else {
        // Otherwise a number glued to letters ("A4", "B2", "3F") is a code, not an amount.
        continue;
      }
    }
    const marker = preCode ?? postCode;
    // Space-grouped with nothing to say it is one amount (no currency, no decimal comma): separate
    // numbers ("qty 1, 234"), never one guessed amount.
    if (num.includes(" ") && marker === null && !/,\d{1,3}$/.test(num)) {
      pushParts(out, num, numStart);
      continue;
    }
    const code = ctx ? (ctx.resolve(marker)?.code ?? (marker === null ? (ctx.document?.code ?? null) : null)) : marker;
    const value = parseNumber(num, code);
    // Beyond any bill (and beyond exact cents in a double): not an amount.
    if (value === null || !Number.isFinite(value) || value > MAX_AMOUNT) continue;
    const money = marker !== null || ocrPrefix || /[.,'’ ]/.test(num);
    out.push({ value, marker, money, negative: isNegative(line, index, end), index, end });
  }
  return out;
}

/**
 * Every currency a line names, amount or not: symbols ($, ₩, HK$ …), ISO codes ("All amounts in
 * USD"; the word-like ones only right after an amount or as "in PEN" / "(PEN)" / "Currency: PEN"),
 * a few currency words ("euros", "Korean won") and CJK units ("15,000원", "(단위: 원)").
 */
function mentionsIn(line: string): string[] {
  const out: string[] = [];
  const signs = new RegExp(String.raw`US\$|U\.S\.\$|HK\$|NT\$|SG?\$|CA?\$|AU?\$|NZ\$|MX\$|R\$|CN¥|JP¥|VNĐ|[${SIGNS}]`, "g");
  for (const m of line.matchAll(signs)) {
    let s = m[0];
    // "ITEMS$12": the letters before "$" belong to the word.
    if (/^[A-Za-z]/.test(s) && /[A-Za-z]/.test(line[(m.index ?? 0) - 1] ?? "")) s = s.replace(/^[A-Za-z]+/, "");
    const code = markerCode(s, "loose");
    if (code) out.push(code);
  }
  for (const m of line.matchAll(/(?<![A-Za-z])([A-Z]{3})(?![A-Za-z])/g)) {
    const raw = m[1];
    if (raw === "RMB") {
      out.push("CNY");
      continue;
    }
    if (!isCurrencyCode(raw)) continue;
    if (!WORDY.has(raw)) {
      out.push(raw);
      continue;
    }
    const before = line.slice(0, m.index);
    if (/(\d\s?|\b[Ii]n\s+|[Cc]urrency\s*[:：]?\s*|\(\s*)$/.test(before)) out.push(raw);
  }
  for (const m of line.matchAll(/\d\s?(원|円|元|zł|Kč|Ft|TL|kr\.?|บาท|đ)(?![A-Za-z])/g)) {
    const code = markerCode(m[1], "post");
    if (code) out.push(code);
  }
  if (/(?:단위|単位|单位)\s*[:：]?\s*원|\(\s*원\s*\)/.test(line)) out.push("KRW");
  if (/(?:単位|单位)\s*[:：]?\s*円|\(\s*円\s*\)/.test(line)) out.push("JPY");
  if (/(?:単位|单位)\s*[:：]?\s*元|\(\s*元\s*\)|人民币/.test(line)) out.push("CNY");
  const words: [RegExp, string][] = [
    [/\bU\.?\s?S\.?\s*dollars?\b/i, "USD"],
    [/\bdollars?\b/i, DOLLAR],
    [/\beuros?\b/i, "EUR"],
    [/\b(?:japanese\s+)?yen\b/i, "JPY"],
    [/\b(?:yuan|renminbi)\b/i, "CNY"],
    [/\bkorean\s+won\b/i, "KRW"],
    [/\bbaht\b/i, "THB"],
    [/\bringgit\b/i, "MYR"],
    [/\brupiah\b/i, "IDR"],
    [/\bswiss\s+francs?\b/i, "CHF"],
    [/\bpounds?\s+sterling\b/i, "GBP"],
    [/\bturkish\s+lira\b/i, "TRY"],
  ];
  for (const [re, code] of words) if (re.test(line)) out.push(code);
  return out;
}

/**
 * Indirect evidence for a bare "¥" when the bill states neither JPY nor CNY (no 円 / 元 after an
 * amount, no code, no JP¥ / CN¥): Japanese kana or Japanese-only labels, or Simplified-only labels.
 */
const JPY_TEXT = /[぀-ヿ]|合計|税込|小計/;
const CNY_TEXT = /合计|总计|小计|应付|实付|找零/;

/**
 * A statement of the bill's currency: "All amounts in KRW", "Prices in EUR", "Currency: JPY",
 * "(단위: 원)", "単位：円", "单位：元". It settles a shared symbol the text alone cannot (OCR often
 * reads "₩" as "¥"), with a note.
 */
function declaredIn(line: string): string[] {
  const out: string[] = [];
  const re = /\b(?:amounts?|prices?|figures?)\s+(?:are\s+)?(?:(?:shown|stated|quoted)\s+)?in\s+([A-Z]{3})\b|\bcurrency\s*[:：]\s*([A-Z]{3})\b/gi;
  for (const m of line.matchAll(re)) {
    const code = (m[1] ?? m[2]).toUpperCase();
    if (isCurrencyCode(code)) out.push(code);
  }
  if (/단위\s*[:：]?\s*원/.test(line)) out.push("KRW");
  if (/単位\s*[:：]?\s*円/.test(line)) out.push("JPY");
  if (/单位\s*[:：]?\s*元/.test(line)) out.push("CNY");
  return out;
}

interface Resolution {
  code: string | null;
  /** When `code` is null because a symbol is shared: the candidates (["JPY", "CNY"]). */
  ambiguousWith: string[];
  /** Read from indirect evidence (the bill's language, another code on the bill): worth a note. */
  inferred: boolean;
}

function resolvePseudo(p: Pseudo, explicit: Set<string>, declared: Set<string>, text: string): Resolution {
  const onlyDeclared = declared.size === 1 ? [...declared][0] : null;
  if (p === YEN) {
    const j = explicit.has("JPY");
    const c = explicit.has("CNY");
    if (j !== c) return { code: j ? "JPY" : "CNY", ambiguousWith: [], inferred: false };
    if (!j) {
      const jt = JPY_TEXT.test(text);
      const ct = CNY_TEXT.test(text);
      if (jt !== ct) return { code: jt ? "JPY" : "CNY", ambiguousWith: [], inferred: true };
      if (onlyDeclared) return { code: onlyDeclared, ambiguousWith: [], inferred: true };
    }
    return { code: null, ambiguousWith: [...YEN_CODES], inferred: false };
  }
  if (p === KRONA) {
    const named = KRONA_CODES.filter((c) => explicit.has(c));
    if (named.length === 1) return { code: named[0], ambiguousWith: [], inferred: true };
    if (named.length === 0 && onlyDeclared) return { code: onlyDeclared, ambiguousWith: [], inferred: true };
    return { code: null, ambiguousWith: [...KRONA_CODES], inferred: false };
  }
  // "$": USD when the bill says USD (or names no other dollar); another dollar when it names exactly that one.
  if (explicit.has("USD")) return { code: "USD", ambiguousWith: [], inferred: false };
  const others = [...explicit].filter((c) => DOLLAR_CODES.has(c));
  if (others.length === 1) return { code: others[0], ambiguousWith: [], inferred: true };
  // The bill states its amounts are in a currency that is no dollar ("All amounts in KRW"): a "$"
  // there is as likely a misread symbol (₩ read as $) as US dollars, so the traveler chooses.
  if (onlyDeclared && !DOLLAR_CODES.has(onlyDeclared)) return { code: null, ambiguousWith: [onlyDeclared, "USD"], inferred: false };
  return { code: "USD", ambiguousWith: [], inferred: false };
}

interface CurrencyContext {
  /** What `marker` stands for on this bill (pseudo codes resolved from the rest of it); null for no marker. */
  resolve(marker: string | null): Resolution | null;
  /** The one currency the whole bill names, the candidates when it names several, or null (none). */
  document: Resolution | null;
}

/** Resolves markers against everything the bill names. */
function currencyContext(lines: string[]): CurrencyContext {
  const text = lines.join("\n");
  const all = lines.flatMap(mentionsIn);
  const explicit = new Set(all.filter((c) => !PSEUDOS.includes(c)));
  const declared = new Set(lines.flatMap(declaredIn));
  const cache = new Map<string, Resolution>();
  const resolve = (marker: string | null): Resolution | null => {
    if (marker === null) return null;
    if (!PSEUDOS.includes(marker)) return { code: marker, ambiguousWith: [], inferred: false };
    let r = cache.get(marker);
    if (!r) {
      r = resolvePseudo(marker as Pseudo, explicit, declared, text);
      cache.set(marker, r);
    }
    return r;
  };
  const found = [...new Set(all)].map((c) => resolve(c)!);
  const codes = new Set(found.map((r) => r.code).filter((c): c is string => c !== null));
  const shared = found.filter((r) => r.code === null);
  let document: Resolution | null = null;
  if (codes.size === 1 && shared.length === 0) {
    const code = [...codes][0];
    document = { code, ambiguousWith: [], inferred: found.some((r) => r.code === code && r.inferred) && !explicit.has(code) };
  } else if (codes.size === 0 && shared.length === 1) document = shared[0];
  else if (codes.size + shared.length > 1) {
    const candidates = [...new Set([...codes, ...shared.flatMap((r) => r.ambiguousWith)])].sort();
    document = { code: null, ambiguousWith: candidates, inferred: false };
  }
  return { resolve, document };
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
  {
    re: new RegExp(
      `(^|[^a-z])${T}(?![a-z])|\\b(totale|totaal|summe|gesamt(betrag)?|importe\\s+total|montant\\s+total)\\b|итого|합계|총액|총\\s*금액|결제\\s*금액|받을\\s*금액|合計|総額|お会計|ご請求額|合计|总计|总额|应付|ยอดรวม|tổng\\s*(cộng|tiền)`,
      "i",
    ),
    tier: 1,
  },
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
function amountOnly(line: string, ctx?: CurrencyContext): AmountToken | null {
  const t = amountsIn(line, ctx);
  if (t.length !== 1) return null;
  const rest = (line.slice(0, t[0].index) + line.slice(t[0].end)).replace(/[\s:.\-=*]/g, "");
  return rest === "" ? t[0] : null;
}

/**
 * The amount belonging to a label line: the first money-looking amount after the label ("TOTAL 2
 * $24.00" → $24.00, "Total $12.00 (incl. VAT $1.09)" → $12.00, "Total $12.00 Tip $2.00" → $12.00),
 * else the last bare number after it, else the next line when it is only an amount.
 */
function labelledAmount(lines: string[], i: number, labelEnd: number, ctx: CurrencyContext): AmountToken | null {
  const after = amountsIn(lines[i], ctx).filter((a) => a.index >= labelEnd);
  const money = after.find((a) => a.money);
  if (money) return money;
  if (after.length > 0) return after[after.length - 1];
  const next = lines[i + 1];
  return next !== undefined ? amountOnly(next, ctx) : null;
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

/** Header, meta and column-title lines inside the item block (for lines with no price of their own). */
const META_RE =
  /\b(date|time|invoice|receipt|bill\s*(no|#|number)|order\s*(no|#|number)|table|server|cashier|guest|tel|phone|fax|www|https?|address|thank|welcome|tax|vat|gst|tip|service\s*charge|subtotal)\b|@\S+\.|:\d{2}\b/i;
/**
 * A priced line that is a charge or a payment, not something bought ("Tax $1.00", "Tip $2.00",
 * "VISA $12.00"), or a web / mail address. Only at the start of the line: an item that merely
 * contains such a word ("1 x Table wine $25.00", "Tax-free whisky gift set $35.00", "Wine tasting
 * (time slot 19:00) $30.00") is still an item, so its words reach the policy.
 */
const CHARGE_RE =
  /^\W*(?:(?:sales|state|city|service|consumption)\s+)?(?:tax(?![\s-]*free)|vat|gst|tips?|gratuity|service\s*charge|sub[\s-]*total|change|cash|paid|payment|card|visa|master\s*card|amex|balance|rounding)\b|https?:|www\.|@\S+\./i;
const COLUMN_WORDS =
  /^(qty|quantity|item|items|description|desc|price|unit|amount|total|each|no|품목|품명|메뉴|수량|단가|금액|상품|品名|品目|数量|単価|金額|商品|单价|金额|菜品|菜名)$/i;

function isColumnHeader(line: string): boolean {
  const words = line.toLowerCase().split(/[\s|/]+/).filter(Boolean);
  return words.length > 0 && words.every((w) => COLUMN_WORDS.test(w.replace(/[^\p{L}]/gu, "")));
}

const QTY_RE = /^\s*(\d{1,3}\s*[x×@](?![a-z])|[x×]\s*\d{1,3}\b|\d{1,3}\s+(pcs|ea)\b)/i;

/** Leader dots and separators out, spaces collapsed. */
function tidy(text: string): string {
  return text
    .replace(/[.·…_\-=:*]{2,}/g, " ")
    .replace(/[\s:\-–—=*@]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const hasLetters = (text: string) => (text.match(/\p{L}/gu) ?? []).length >= 2;

/**
 * An item-shaped line (it ends with money, or starts with a quantity): its description with the
 * trailing money stripped, or "" when it has none ("1 x $9.00  $9.00", the second line of an item
 * printed over two lines). Null when the line is not item-shaped.
 */
function itemText(line: string, ctx: CurrencyContext): string | null {
  if (CHARGE_RE.test(line) || isColumnHeader(line)) return null;
  const tokens = amountsIn(line, ctx);
  const last = tokens[tokens.length - 1];
  const endsWithMoney = last !== undefined && last.money && line.slice(last.end).trim() === "";
  if (!endsWithMoney && !QTY_RE.test(line)) return null;
  // Strip trailing money (a unit price and a line total), then leader dots and separators.
  let text = line;
  for (let t = amountsIn(text, ctx); t.length > 0; t = amountsIn(text, ctx)) {
    const tail = t[t.length - 1];
    if (!tail.money || text.slice(tail.end).trim() !== "") break;
    text = text.slice(0, tail.index);
  }
  text = tidy(text);
  // Not cut: the request names the whole line, so a blocked keyword at its end still reaches the policy.
  return hasLetters(text) ? text : "";
}

/**
 * A line of text inside the item block that is not item-shaped: the description line of an item
 * printed over two lines, a section heading ("WINE"), a modifier ("+ wine pairing"), or an item
 * priced with a bare number ("Wine 800" on a yen or won bill). Money inside the line and a trailing
 * bare price (3+ digits) come out, so the request's only amount stays its total.
 */
function blockText(line: string, ctx: CurrencyContext): string | null {
  if (META_RE.test(line) || isColumnHeader(line)) return null;
  const tokens = amountsIn(line, ctx);
  let text = line;
  for (let k = tokens.length - 1; k >= 0; k--) {
    const t = tokens[k];
    const trailingPrice = k === tokens.length - 1 && line.slice(t.end).trim() === "" && t.value >= 100 && !/^0/.test(line.slice(t.index, t.end));
    if (t.money || trailingPrice) text = `${text.slice(0, t.index)} ${text.slice(t.end)}`;
  }
  text = tidy(text.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").replace(/\(\)/g, " ").replace(/^[\s+\-–—•*·>]+/, ""));
  return hasLetters(text) ? text : null;
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

export function parseBill(text: string, catalog: BillCatalogMerchant[]): ParsedBill {
  const lines = splitLines(text);
  const notes: BillNote[] = [];
  const ctx = currencyContext(lines);

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
    const amount = labelledAmount(lines, i, label.labelEnd, ctx);
    if (amount && amount.negative) negativeSeen = true;
    else if (amount && amount.value === 0 && label.due) nothingDue = true;
    else if (amount && amount.value > 0) totals.push({ tier: label.tier, line: i, amount });
  });

  let totalAmount: number | null = null;
  let resolution: Resolution | null;
  if (totals.length > 0) {
    const top = Math.max(...totals.map((t) => t.tier));
    const chosen = totals.filter((t) => t.tier === top).at(-1)!;
    totalAmount = chosen.amount.value;
    if (totals.some((t) => t.amount.value !== chosen.amount.value)) notes.push({ code: "totals_disagree" });
    resolution = ctx.resolve(chosen.amount.marker);
    if (!resolution) {
      // A currency written elsewhere on the total line ("Total (USD)  12.00").
      const onLine = [...new Set(mentionsIn(lines[chosen.line]))];
      if (onLine.length === 1) resolution = ctx.resolve(onLine[0]);
    }
    // Otherwise what the whole bill says (one currency; several or a shared symbol → unresolved).
    resolution ??= ctx.document;
  } else {
    notes.push({ code: negativeSeen ? "total_negative" : subtotalSeen ? "subtotal_only" : "total_not_found" });
    resolution = ctx.document;
  }
  const currency = resolution?.code ?? null;
  const ambiguousWith = currency === null ? (resolution?.ambiguousWith ?? []) : [];

  let totalUsd: number | null = null;
  if (totalAmount !== null && nothingDue) notes.push({ code: "nothing_due" });
  else if (totalAmount !== null) {
    if (currency !== null && resolution?.inferred) notes.push({ code: "currency_inferred", detail: currency });
    if (currency === "USD") totalUsd = totalAmount;
    else if (currency !== null) notes.push({ code: "total_not_usd", detail: currency });
    else if (ambiguousWith.length > 0) notes.push({ code: "currency_ambiguous", detail: ambiguousWith.join(", ") });
    else notes.push({ code: "currency_unknown" });
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
  // printed above or on a line naming a catalog merchant must still reach the request. Inside the
  // item block (from the first item-shaped line, or from a column header, to the summary) every
  // other text line is an item line too: the description of a two-line item, a section heading or
  // a modifier ("+ wine pairing") may be the line with a blocked keyword. A first item with no
  // description of its own takes the text line above it (a two-line item).
  const summary = firstSummaryLine >= 0 ? firstSummaryLine : lines.length;
  const shaped = lines.slice(0, summary).map((l) => itemText(l, ctx));
  let start = shaped.findIndex((t) => t !== null);
  if (start < 0) start = summary;
  else if (shaped[start] === "" && start > 0 && blockText(lines[start - 1], ctx) !== null) start -= 1;
  for (let i = start - 1; i >= 0; i--) {
    if (isColumnHeader(lines[i])) {
      start = i + 1;
      break;
    }
  }
  const all: string[] = [];
  for (let i = 0; i < summary; i++) {
    const item = shaped[i] || (i >= start && shaped[i] === null ? blockText(lines[i], ctx) : null);
    if (item) all.push(item);
  }
  const items = all.slice(0, MAX_ITEMS);
  const moreItems = all.slice(MAX_ITEMS);
  if (all.length > MAX_ITEMS) notes.push({ code: "more_items", detail: String(all.length - MAX_ITEMS) });

  return { merchant, merchantMatches, totalUsd, totalAmount, currency, ambiguousWith, date, items, moreItems, notes };
}
