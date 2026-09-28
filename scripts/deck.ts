/**
 * scripts/deck.ts — renders docs/deck/deck.html to docs/deck.pdf (9 pages, 16:9) with headless Chromium.
 *
 * Playwright comes from the tools folder, not from this repo (same setup as scripts/capture.ts):
 *   cd /Users/mac/perdiem-tools && npm init -y && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright@1.63.0
 *   (override the folder with PERDIEM_TOOLS_DIR)
 *
 *   npx tsx scripts/deck.ts                               # → docs/deck.pdf
 *   npx tsx scripts/deck.ts --preview /tmp/deck-pages     # also one PNG per slide, for review
 *
 * What gets filled in (everything else is static text in deck.html):
 *   {{cmp.*}}, {{chart}}          docs/reasoning-comparison.json (always present)
 *   <img data-evidence="X.png">   evidence/X.png when it exists, else a labeled placeholder stays
 *   <!--@runs--> <!--@runsnote-->  newest evidence/scenario-*.json (else the expected outcomes); the note also
 *                                 names the chat-screenshot set from evidence/capture-log.json when it differs
 *   <!--@flows--> <!--@energy-->   evidence/metrics.md (else placeholders); the compare row always comes from
 *                                 docs/reasoning-comparison.json unless metrics.md has a compare flow
 *   <!--@verify-->                evidence/12-verify.txt excerpt
 * Re-run after the evidence run so the PDF carries the real screenshots and numbers.
 * Flags: --html <path> | --out <path> | --evidence <dir> | --preview <dir> | --keep-html <path>
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import type { ReasoningComparison } from "../contracts/api";

// ---------- Playwright (tools folder) ----------

interface PwLocator {
  count(): Promise<number>;
  nth(i: number): PwLocator;
  screenshot(o?: { path?: string; type?: "png" }): Promise<Buffer>;
}
interface PwPage {
  goto(url: string, o?: { waitUntil?: "load" | "networkidle" }): Promise<unknown>;
  locator(selector: string): PwLocator;
  pdf(o: { path: string; width: string; height: string; printBackground: boolean; preferCSSPageSize?: boolean }): Promise<Buffer>;
}
interface PwBrowser {
  newContext(o: { viewport: { width: number; height: number }; deviceScaleFactor?: number }): Promise<{ newPage(): Promise<PwPage> }>;
  close(): Promise<void>;
}
interface PwModule {
  chromium: { launch(o: { headless: boolean }): Promise<PwBrowser> };
}
const TOOLS_DIR = process.env.PERDIEM_TOOLS_DIR ?? "/Users/mac/perdiem-tools";
function loadPlaywright(): PwModule {
  try {
    return createRequire(join(TOOLS_DIR, "package.json"))("playwright") as PwModule;
  } catch {
    throw new Error(`playwright not found in ${TOOLS_DIR} — see the setup lines at the top of scripts/deck.ts`);
  }
}

// ---------- args ----------

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const HTML = arg("html") ?? "docs/deck/deck.html";
const OUT = arg("out") ?? "docs/deck.pdf";
const EVIDENCE = arg("evidence") ?? "evidence";
const PREVIEW = arg("preview");
const KEEP_HTML = arg("keep-html");

// ---------- helpers ----------

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-4)}`;
function kst(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString();
  return `${d.slice(0, 10)} ${d.slice(11, 16)} KST`;
}
function block(html: string, name: string, content: string | null): string {
  if (content === null) return html;
  const re = new RegExp(`<!--@${name}-->[\\s\\S]*?<!--/@${name}-->`);
  if (!re.test(html)) throw new Error(`deck.html has no <!--@${name}--> block`);
  return html.replace(re, () => content);
}
const filled: string[] = [];
const missing: string[] = [];

// ---------- chart (thinking on vs off, grouped horizontal bars) ----------

const SHORT_LABEL: Record<string, string> = {
  "Order a bibimbap lunch from Yangjae Kitchen, $12": "Lunch $12",
  "Taxi to Incheon airport, about $85": "Taxi $85",
  "Buy a bottle of wine as a gift for the client, $30": "Wine gift $30",
  "Dinner from Yangjae Kitchen, $10": "Dinner $10",
  "Coffee at Starbucks, $5": "Coffee $5",
};

function barPath(x: number, y: number, w: number, h: number, r = 4): string {
  // square at the baseline (left), 4px rounded data-end (right)
  const rr = Math.min(r, h / 2, w);
  if (w <= 0) return "";
  return `M${x},${y} h${w - rr} a${rr},${rr} 0 0 1 ${rr},${rr} v${h - 2 * rr} a${rr},${rr} 0 0 1 ${-rr},${rr} h${-(w - rr)} z`;
}

function chartSvg(c: ReasoningComparison): string {
  const W = 548;
  const labelW = 92;
  const right = 36;
  const band = 36;
  const barH = 11;
  const top = 6;
  const n = c.rows.length;
  const max = Math.max(...c.rows.map((r) => Math.max(r.thinkingOn.completionTokens, r.thinkingOff.completionTokens)), 1);
  const step = max > 150 ? 50 : 25;
  const axisMax = Math.ceil(max / step) * step;
  const plotW = W - labelW - right;
  const x = (v: number) => labelW + (v / axisMax) * plotW;
  const H = top + n * band + 22;
  const parts: string[] = [];
  for (let t = 0; t <= axisMax; t += step) {
    parts.push(`<line x1="${x(t)}" x2="${x(t)}" y1="${top}" y2="${top + n * band}" stroke="#e4e4e7" stroke-width="1"/>`);
    parts.push(`<text x="${x(t)}" y="${top + n * band + 16}" text-anchor="middle" font-size="11" fill="#71717a">${t}</text>`);
  }
  c.rows.forEach((r, i) => {
    const y = top + i * band + (band - (2 * barH + 2)) / 2;
    const label = SHORT_LABEL[r.prompt] ?? r.prompt.split(",")[0]!.split(" ").slice(0, 3).join(" ");
    parts.push(`<text x="${labelW - 10}" y="${y + barH + 5}" text-anchor="end" font-size="12.5" fill="#52525b">${esc(label)}</text>`);
    parts.push(`<path d="${barPath(labelW, y, x(r.thinkingOn.completionTokens) - labelW, barH)}" fill="var(--s1)"/>`);
    parts.push(`<path d="${barPath(labelW, y + barH + 2, x(r.thinkingOff.completionTokens) - labelW, barH)}" fill="var(--s2)"/>`);
    // selective direct labels: the value at the tip of each "off" bar (the production setting)
    parts.push(`<text x="${x(r.thinkingOff.completionTokens) + 6}" y="${y + 2 * barH + 1}" font-size="11" fill="#52525b">${r.thinkingOff.completionTokens}</text>`);
  });
  parts.push(`<line x1="${labelW}" x2="${labelW}" y1="${top}" y2="${top + n * band}" stroke="#a1a1aa" stroke-width="1"/>`);
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Completion tokens per request, thinking on vs off" style="display:block;font-family:var(--sans)">${parts.join("")}</svg>`;
}

// ---------- evidence readers ----------

interface ScenarioStep {
  n: number;
  mandateKey: string;
  text: string;
  expect: string;
  match: boolean;
  actual: { decision: string; codes: string[]; txHash: string | null; settlement: string | null; tokens: number };
}
interface Scenario {
  startedAt: string;
  mandates?: Record<string, string>;
  summary: { total: number; matched: number };
  steps: ScenarioStep[];
}

/** "man_A_ev3" → "man_*_ev3" (the demo-set label used in the README). */
const setLabel = (mandateId: string | undefined) => (mandateId ? mandateId.replace(/^man_[A-Z]_/, "man_*_") : null);

/** The chat-screenshot take recorded by scripts/capture.ts --only chat, if any. */
function chatCapture(): { set: string; at: string } | null {
  const p = join(EVIDENCE, "capture-log.json");
  if (!existsSync(p)) return null;
  const log = JSON.parse(readFileSync(p, "utf8")) as { at: string; steps?: string[]; mandates?: Record<string, string>; sent?: { usage?: { at?: string }[] }[] };
  if (!log.steps?.includes("chat")) return null;
  const set = setLabel(log.mandates?.A);
  const first = log.sent?.flatMap((x) => x.usage ?? []).find((u) => u.at)?.at ?? log.at;
  return set ? { set, at: first } : null;
}

function newestScenario(): { file: string; data: Scenario } | null {
  if (!existsSync(EVIDENCE)) return null;
  const files = readdirSync(EVIDENCE)
    .filter((f) => /^scenario-.*\.json$/.test(f))
    .map((f) => join(EVIDENCE, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return files[0] ? { file: files[0], data: JSON.parse(readFileSync(files[0], "utf8")) as Scenario } : null;
}

function runsRows(s: Scenario): string {
  return s.steps
    .map((st) => {
      const note = st.n === 4 ? " (while paused)" : st.n === 6 ? " (after resume)" : "";
      const a = st.actual;
      const tag =
        a.decision === "APPROVE" ? `<span class="tag ok">APPROVE</span>` : a.decision === "STOP" ? `<span class="tag stop">STOP</span>` : a.decision === "NONE" ? `<span class="tag neutral">${a.tokens} TOKENS</span>` : `<span class="tag neutral">${esc(a.decision)}</span>`;
      const detail =
        a.decision === "STOP"
          ? `<td class="mono">${esc(a.codes.join(", "))}</td>`
          : a.txHash
            ? `<td><span class="mono">${esc(short(a.txHash))}</span> · ${esc(a.settlement ?? "")}</td>`
            : `<td>${a.decision === "NONE" ? "answered from the ledger, no model call" : ""}</td>`;
      return `      <tr><td class="num">${st.n}</td><td class="req">${esc(st.text + note)}</td><td>${esc(st.mandateKey)}</td><td>${tag}</td>${detail}</tr>`;
    })
    .join("\n");
}

function metricsFlows(md: string): { rows: string; generated: string | null; hasCompare: boolean } | null {
  const sec = md.split("## Tokens by flow")[1]?.split("\n## ")[0];
  if (!sec) return null;
  const out: string[] = [];
  for (const line of sec.split("\n")) {
    const m = line.match(/^\| `(\w+)` \| [^|]* \| (\d+) \| ([\d,]+) \| ([\d,]+) \| ([\d,]+) \| (\$[\d.]+|—) \|/);
    if (!m) continue;
    const [, flow, calls, prompt, completion, total, cost] = m;
    out.push(`          <tr${total === "0" ? ' class="zero"' : ""}><td>${flow}</td><td>${calls}</td><td>${prompt}</td><td>${completion}</td><td>${cost}</td></tr>`);
  }
  const gen = md.match(/^Generated (\S+)/m)?.[1] ?? null;
  return out.length ? { rows: out.join("\n"), generated: gen, hasCompare: out.some((r) => r.includes("<td>compare</td>")) } : null;
}

function compareRow(c: ReasoningComparison): string {
  const sides = c.rows.flatMap((r) => [r.thinkingOn, r.thinkingOff]);
  const sum = (f: (s: (typeof sides)[number]) => number) => sides.reduce((t, s) => t + f(s), 0);
  const cost = sum((s) => s.costUsd ?? 0);
  return `          <tr><td>compare</td><td>${sides.length}</td><td>${sum((s) => s.promptTokens).toLocaleString("en-US")}</td><td>${sum((s) => s.completionTokens).toLocaleString("en-US")}</td><td>$${cost.toFixed(6)}</td></tr>`;
}

function verifyExcerpt(txt: string): string {
  const lines = txt.split(/\r?\n/).filter((l) => l.trim());
  const head = lines.slice(0, 1);
  const checks = lines.filter((l) => /^(✅|❌)/.test(l));
  const tail = lines.slice(-1);
  // Shorten 0x-hashes and addresses so each line fits the slide's terminal box (the full text is in 12-verify.txt).
  const pick = [...head, ...checks.slice(0, 4), ...(checks.length > 4 ? [`… ${checks.length - 4} more checks`] : []), ...tail].map((l) =>
    l.replace(/0x[0-9a-fA-F]{16,}/g, (h) => short(h)),
  );
  return [`<span class="dim">$ npm run verify -- evidence/mandate-&lt;id&gt;.json \\\n    evidence/ledger-&lt;id&gt;.json</span>`, ...pick.map((l) => (/^✅|ALL RECORDS VERIFIED/.test(l) ? `<span class="ok">${esc(l)}</span>` : esc(l)))].join("\n");
}

// ---------- main ----------

async function main() {
  let html = readFileSync(HTML, "utf8");
  const c = JSON.parse(readFileSync("docs/reasoning-comparison.json", "utf8")) as ReasoningComparison;
  const s = c.summary;
  const costOn = c.rows.reduce((t, r) => t + (r.thinkingOn.costUsd ?? 0), 0);
  const costOff = c.rows.reduce((t, r) => t + (r.thinkingOff.costUsd ?? 0), 0);
  const tokens: Record<string, string> = {
    "cmp.on": String(Math.round(s.avgCompletionOn)),
    "cmp.off": String(Math.round(s.avgCompletionOff)),
    "cmp.pct": String(Math.round(s.completionSavedPct)),
    "cmp.latOn": (s.avgLatencyOnMs / 1000).toFixed(1),
    "cmp.latOff": (s.avgLatencyOffMs / 1000).toFixed(1),
    "cmp.costPct": costOn > 0 ? String(Math.round(((costOn - costOff) / costOn) * 100)) : "0",
    "cmp.toolOn": `${s.toolCallsOn}/${c.rows.length}`,
    "cmp.toolOff": `${s.toolCallsOff}/${c.rows.length}`,
    "cmp.model": c.model,
    "cmp.measuredAt": kst(c.measuredAt),
    chart: chartSvg(c),
  };
  html = html.replace(/\{\{([\w.]+)\}\}/g, (m, k: string) => {
    if (!(k in tokens)) throw new Error(`unknown token ${m}`);
    return tokens[k]!;
  });

  // screenshots
  html = html.replace(/<img data-evidence="([^"]+)"/g, (m, file: string) => {
    const p = join(EVIDENCE, file);
    if (!existsSync(p)) {
      missing.push(p);
      return m;
    }
    filled.push(p);
    return `<img src="data:image/png;base64,${readFileSync(p).toString("base64")}" data-evidence="${file}"`;
  });

  // scripted runs
  const sc = newestScenario();
  if (sc) {
    filled.push(sc.file);
    html = block(html, "runs", runsRows(sc.data));
    const runSet = setLabel(sc.data.mandates?.A);
    const chat = chatCapture();
    const shots = chat && chat.set !== runSet ? ` · screenshots above: chat take ${esc(chat.set)}, ${esc(kst(chat.at).slice(11))}` : "";
    html = block(html, "runsnote", `Recorded run ${esc(kst(sc.data.startedAt))}${runSet ? ` (${esc(runSet)})` : ""} — ${sc.data.summary.matched}/${sc.data.summary.total} outcomes as expected · ${esc(sc.file)}${shots}`);
  } else missing.push(`${EVIDENCE}/scenario-*.json`);

  // tokens by flow + energy
  const mdPath = join(EVIDENCE, "metrics.md");
  const md = existsSync(mdPath) ? readFileSync(mdPath, "utf8") : null;
  const flows = md ? metricsFlows(md) : null;
  if (flows) {
    filled.push(mdPath);
    // compare runs outside the server, so it is in usage_records only after `npm run compare -- --save`.
    html = block(html, "flows", flows.hasCompare ? flows.rows : `${flows.rows}\n${compareRow(c)}`);
    html = block(
      html,
      "flowsnote",
      `/api/usage${flows.generated ? ` at ${esc(kst(flows.generated))}` : ""}${flows.hasCompare ? "" : "; compare = the thinking on/off run (docs/reasoning-comparison.json), outside the server"}. Green rows never call the model.`,
    );
  } else {
    missing.push(mdPath);
    html = block(
      html,
      "flows",
      [
        `          <tr><td>propose</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`,
        `          <tr class="zero"><td>status_fastpath</td><td>—</td><td>0</td><td>0</td><td>0</td></tr>`,
        `          <tr class="zero"><td>stop_template</td><td>—</td><td>0</td><td>0</td><td>0</td></tr>`,
        compareRow(c),
      ].join("\n"),
    );
    html = block(html, "flowsnote", "compare row measured on Kiln (docs/reasoning-comparison.json); the other rows are filled from /api/usage after the evidence run. Green rows never call the model.");
  }
  const energy = md?.match(/^Energy estimate: (.*)$/m)?.[1];
  if (energy) {
    // Short form when the assumption is the documented one (RNGD 180 W × 1.233 s ÷ 517 tokens); else the line verbatim.
    const m = energy.match(/^≈ ([\d.]+) Wh for ([\d,]+) tokens\. Assumption: 0\.429 J\/token \(source: .*180 W.*1\.233 s.*517 tokens/);
    html = block(
      html,
      "energy",
      m
        ? `<b>Energy: ≈ ${m[1]} Wh</b> for ${m[2]} tokens = tokens × 0.429 J/token ÷ 3600. <b>Assumption:</b> one RNGD card (180 W TDP) busy for a proposal's measured 1.233 s over its 517 tokens. Multi-card serving or host power would raise it; batching and network time would lower it. An estimate, not a measurement: Kiln does not report per-request energy.`
        : `<b>Energy:</b> ${esc(energy)}`,
    );
  }

  // verify excerpt
  const vPath = join(EVIDENCE, "12-verify.txt");
  if (existsSync(vPath)) {
    filled.push(vPath);
    html = block(html, "verify", verifyExcerpt(readFileSync(vPath, "utf8")));
  } else missing.push(vPath);

  html = block(html, "generated", `Rendered ${esc(kst(new Date().toISOString()))} from docs/deck/deck.html`);

  const tmp = KEEP_HTML ?? join(tmpdir(), `perdiem-deck-${Date.now()}.html`);
  writeFileSync(tmp, html);

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(pathToFileURL(resolve(tmp)).href, { waitUntil: "load" });
    await page.pdf({ path: OUT, width: "1280px", height: "720px", printBackground: true, preferCSSPageSize: true });
    const slides = page.locator(".slide");
    const count = await slides.count();
    if (PREVIEW) {
      mkdirSync(PREVIEW, { recursive: true });
      for (let i = 0; i < count; i++) await slides.nth(i).screenshot({ path: join(PREVIEW, `slide-${String(i + 1).padStart(2, "0")}.png`), type: "png" });
    }
    const pdf = readFileSync(OUT).toString("latin1");
    const pages = (pdf.match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
    console.log(`wrote ${OUT}: ${pages} page(s) from ${count} slide(s)${PREVIEW ? `; previews in ${PREVIEW}` : ""}`);
    console.log(`filled from: ${filled.length ? filled.join(", ") : "(docs/reasoning-comparison.json only)"}`);
    if (missing.length) console.log(`placeholders kept for: ${missing.join(", ")}`);
    if (pages > 10) throw new Error(`deck has ${pages} pages — the organizers allow at most 10`);
    if (pages !== count) throw new Error(`page count ${pages} != slide count ${count} — a slide overflows its page`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
