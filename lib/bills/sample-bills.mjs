#!/usr/bin/env node
/**
 * lib/bills/sample-bills.mjs — renders the two sample bills used to film the bill drop:
 *
 *   public/samples/bill-yangjae-kitchen.{pdf,png}  Yangjae Kitchen, 1 x Bibimbap lunch, TOTAL $12.00
 *                                                  → APPROVE on a man_A set (meal, allowed merchant)
 *   public/samples/bill-wine-and-co.{pdf,png}      Wine & Co, 1 x Bottle of wine (client gift), TOTAL $30.00
 *                                                  → STOP: MERCHANT_NOT_ALLOWED, CATEGORY_NOT_ALLOWED,
 *                                                    BLOCKED_KEYWORD
 *
 * The PDFs are Chromium print output (page.pdf), so they carry a real text layer; the PNGs are
 * 2x screenshots of the same HTML (read by OCR). Needs Playwright with Chromium:
 *   PLAYWRIGHT_FROM=/path/to/a/package.json node lib/bills/sample-bills.mjs
 * (PLAYWRIGHT_FROM is any package.json whose node_modules has `playwright`; default: this repo.)
 */
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(process.env.PLAYWRIGHT_FROM || join(root, "package.json"));
const { chromium } = require("playwright");
const out = join(root, "public", "samples");

const BILLS = [
  {
    file: "bill-yangjae-kitchen",
    merchant: "Yangjae Kitchen",
    tagline: "Korean home cooking",
    address: ["27 Yangjae-daero 12-gil, Seocho-gu", "Seoul 06770, Republic of Korea", "Tel +82 2-555-0142"],
    kind: "Receipt",
    meta: [
      ["Bill no.", "YK-0929-0412"],
      ["Date", "2026-09-29 12:18"],
      ["Table", "7"],
    ],
    items: [["1 x Bibimbap lunch", "$12.00"]],
    subtotal: "$12.00",
    total: "$12.00",
    footer: "All amounts in USD. Thank you for dining with us.",
  },
  {
    file: "bill-wine-and-co",
    merchant: "Wine & Co",
    tagline: "Wine shop",
    address: ["8 Maeheon-ro, Seocho-gu", "Seoul 06771, Republic of Korea", "Tel +82 2-555-0187"],
    kind: "Invoice",
    meta: [
      ["Invoice no.", "WC-20260929-031"],
      ["Date", "2026-09-29 18:40"],
    ],
    items: [["1 x Bottle of wine (client gift)", "$30.00"]],
    subtotal: "$30.00",
    total: "$30.00",
    footer: "All amounts in USD. Thank you for your purchase.",
  },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function html(b) {
  const rows = b.items.map(([item, amount]) => `<tr><td>${esc(item)}</td><td class="amt">${amount}</td></tr>`).join("");
  const meta = b.meta.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(b.merchant)} ${b.kind}</title>
<style>
  @page { size: 148mm 210mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; }
  body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #111; }
  .bill { width: 520px; padding: 40px 44px 36px; margin: 0 auto; }
  h1 { font-size: 30px; font-weight: 700; letter-spacing: 0.01em; }
  .tag { margin-top: 4px; font-size: 15px; color: #333; }
  .addr { margin-top: 12px; font-size: 14px; line-height: 1.5; color: #333; }
  .kind { margin-top: 26px; font-size: 13px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; }
  .meta { margin-top: 10px; font-size: 15px; }
  .meta th { width: 120px; text-align: left; font-weight: 400; color: #444; padding: 3px 0; }
  .meta td { padding: 3px 0; }
  .items { margin-top: 24px; font-size: 16px; }
  .items thead th { text-align: left; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    border-bottom: 2px solid #111; padding: 0 0 8px; }
  .items thead th.amt { text-align: right; }
  .items td { padding: 12px 0; border-bottom: 1px solid #bbb; }
  .amt { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .sum { margin-top: 14px; font-size: 16px; }
  .sum td { padding: 5px 0; }
  .sum tr.total td { padding-top: 12px; font-size: 22px; font-weight: 700; border-top: 2px solid #111; }
  .foot { margin-top: 30px; font-size: 13px; color: #444; }
</style></head><body><div class="bill">
  <h1>${esc(b.merchant)}</h1>
  <p class="tag">${esc(b.tagline)}</p>
  <p class="addr">${b.address.map(esc).join("<br>")}</p>
  <p class="kind">${b.kind}</p>
  <table class="meta">${meta}</table>
  <table class="items"><thead><tr><th>Item</th><th class="amt">Amount</th></tr></thead><tbody>${rows}</tbody></table>
  <table class="sum">
    <tr><td>Subtotal</td><td class="amt">${b.subtotal}</td></tr>
    <tr class="total"><td>TOTAL</td><td class="amt">${b.total}</td></tr>
  </table>
  <p class="foot">${esc(b.footer)}</p>
</div></body></html>`;
}

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 560, height: 800 }, deviceScaleFactor: 2 });
  for (const b of BILLS) {
    await page.setContent(html(b), { waitUntil: "load" });
    await page.pdf({ path: join(out, `${b.file}.pdf`), width: "148mm", height: "210mm", printBackground: true });
    await page.locator(".bill").screenshot({ path: join(out, `${b.file}.png`) });
    console.log(`public/samples/${b.file}.pdf, .png`);
  }
} finally {
  await browser.close();
}
