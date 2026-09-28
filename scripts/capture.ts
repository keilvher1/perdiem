/**
 * scripts/capture.ts — takes the checklist screenshots (docs/PLAN.md §4) from the RUNNING app.
 *
 * PLAYWRIGHT IS NOT A DEPENDENCY OF THIS REPO (package.json must not change during the event).
 * It lives in a separate tools folder and is loaded with createRequire:
 *   mkdir -p /Users/mac/perdiem-tools && cd /Users/mac/perdiem-tools && npm init -y
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright@1.63.0   # Chromium 1243 is already in ~/Library/Caches/ms-playwright
 *   (elsewhere: npx playwright@1.63.0 install chromium)
 * Override the folder with PERDIEM_TOOLS_DIR=/path/to/tools.
 *
 *   npx tsx scripts/capture.ts                       # both parts, ids from evidence/seed-latest.json
 *   npx tsx scripts/capture.ts --only pages          # no chat: 05, 07, 08, 09, 11 (spends nothing)
 *   npx tsx scripts/capture.ts --only chat           # drives /traveler: 01, 02, 03, 04, 10
 *   npx tsx scripts/capture.ts --only drawer         # 14-evidence-drawer.png: the Evidence drawer on /traveler?m=<A>
 *   npx tsx scripts/capture.ts --only report         # 13-trip-statement.pdf: /audit/<A>/report printed to A4 (if the route exists)
 *   npx tsx scripts/capture.ts --only drawer,report  # steps can be combined; no --only = chat,pages
 *   BASE_URL=http://localhost:3000 … --mandates man_A_x,man_B_x,man_C_x   (drawer/report/pages need only A)
 *
 * Part "chat" TYPES the DEMO_SCRIPT requests into /traveler?m=<id> (the chat lives in page state,
 * so receipt cards only exist for requests sent in that page). It pauses A through the API before
 * #4 and resumes it before #6. COST: #0 and #6 are real Sepolia payments. Use a fresh seed that
 * scripts/scenario.ts has NOT used in the last 5 minutes (DUPLICATE), e.g.
 *   npm run seed -- --window now && npm run scenario        # seed 1: API evidence
 *   npm run seed -- --window now && npx tsx scripts/capture.ts   # seed 2: screenshots
 *
 * Files (evidence/): 01-approve.png 02-merchant-not-allowed.png 03-over-budget-with-fees.png
 * 04-expired.png 05-health.json 07-metrics.png 08-tx-and-ledger.png 09-principal.png 10-paused.png
 * 11-audit.png, plus capture-log.json (what was sent, response ids, tx hashes; a run without the chat
 * step writes capture-log-<steps>.json instead, e.g. capture-log-pages.json, so it never overwrites it).
 * The floating Evidence button ([data-evidence-fab]) and the Next.js dev indicator are hidden in all
 * of these, so the nine checklist PNGs keep the layout they had before the button existed.
 *
 * Optional steps (only with --only; they spend nothing — GETs only):
 *   drawer  opens /traveler?m=<A> WITH the Evidence button, clicks it, waits for the drawer, clicks
 *           "Run checks now" when present (one GET /api/audit/<A>, read-only) and saves
 *           14-evidence-drawer.png (the viewport grows so the whole drawer is visible).
 *   report  if GET /audit/<A>/report is not a 404, opens it, waits for the data, and saves
 *           13-trip-statement.pdf via page.pdf (A4, no header/footer, backgrounds printed).
 *   Run both against the LIVE app after every entry has settled; never commit mock-mode output
 *   (placeholder hashes).
 *
 * Flags: --only chat|pages|drawer|report (comma-separated) | --mandates A,B,C | --base-url <url>
 *        --out-dir <dir> | --scale <n, default 2> | --composer <css> --send <css> (if the chat UI differs)
 *        --no-etherscan | --no-drawer-checks (do not click "Run checks now") | --headed
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEMO_SCRIPT, ENDPOINTS, type ChatResponse, type HealthResponse, type MandateStatus } from "../contracts/api";

// ---------- minimal Playwright surface (types only; the package is not installed in this repo) ----------

interface PwResponse {
  url(): string;
  status(): number;
  request(): { method(): string };
  json(): Promise<unknown>;
}
interface PwLocator {
  first(): PwLocator;
  last(): PwLocator;
  count(): Promise<number>;
  locator(selector: string): PwLocator;
  getByRole(role: "button" | "dialog", o?: { name?: RegExp | string }): PwLocator;
  getByText(t: RegExp | string): PwLocator;
  waitFor(o?: { state?: "attached" | "detached" | "visible" | "hidden"; timeout?: number }): Promise<void>;
  getAttribute(name: string): Promise<string | null>;
  fill(value: string): Promise<void>;
  click(o?: { timeout?: number }): Promise<void>;
  press(key: string): Promise<void>;
  isEnabled(): Promise<boolean>;
  scrollIntoViewIfNeeded(): Promise<void>;
  screenshot(o?: { type?: "png" }): Promise<Buffer>;
}
interface PwPage {
  goto(url: string, o?: { waitUntil?: "load" | "networkidle" | "domcontentloaded"; timeout?: number }): Promise<unknown>;
  title(): Promise<string>;
  locator(selector: string): PwLocator;
  getByRole(role: "button" | "textbox" | "table" | "dialog", o?: { name?: RegExp | string }): PwLocator;
  waitForResponse(pred: (r: PwResponse) => boolean | Promise<boolean>, o?: { timeout?: number }): Promise<PwResponse>;
  waitForTimeout(ms: number): Promise<void>;
  screenshot(o?: { path?: string; fullPage?: boolean; type?: "png" }): Promise<Buffer>;
  setContent(html: string, o?: { waitUntil?: "load" }): Promise<void>;
  setViewportSize(s: { width: number; height: number }): Promise<void>;
  addStyleTag(o: { content: string }): Promise<unknown>;
  evaluate<R>(fn: () => R | Promise<R>): Promise<R>;
  pdf(o: {
    path?: string;
    format?: "A4";
    printBackground?: boolean;
    displayHeaderFooter?: boolean;
    preferCSSPageSize?: boolean;
    margin?: { top?: string; right?: string; bottom?: string; left?: string };
  }): Promise<Buffer>;
  emulateMedia(o: { media: "print" | "screen" | null }): Promise<void>;
  close(): Promise<void>;
}
interface PwContext {
  newPage(): Promise<PwPage>;
  close(): Promise<void>;
}
interface PwBrowser {
  newContext(o: { viewport: { width: number; height: number }; deviceScaleFactor?: number }): Promise<PwContext>;
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
    throw new Error(`playwright not found in ${TOOLS_DIR} — see the setup lines at the top of scripts/capture.ts`);
  }
}

// ---------- args ----------

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const BASE_URL = (arg("base-url") ?? process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const OUT_DIR = arg("out-dir") ?? "evidence";
type Step = "chat" | "pages" | "drawer" | "report";
const STEPS_ALL: readonly Step[] = ["chat", "pages", "drawer", "report"];
const STEPS: readonly Step[] = (() => {
  const only = arg("only");
  if (!only) return ["chat", "pages"];
  const list = only.split(",").map((x) => x.trim()).filter(Boolean);
  const bad = list.filter((x) => !(STEPS_ALL as readonly string[]).includes(x));
  if (bad.length || list.length === 0) throw new Error(`--only takes ${STEPS_ALL.join("|")} (comma-separated), got "${only}"`);
  return list as Step[];
})();
const DRAWER_CHECKS = !process.argv.includes("--no-drawer-checks");
const SCALE = Number(arg("scale") ?? 2);
const COMPOSER = arg("composer") ?? "textarea";
const SEND = arg("send");
const ETHERSCAN = !process.argv.includes("--no-etherscan");
const HEADED = process.argv.includes("--headed");
const VIEWPORT = { width: 1280, height: 800 };

type Key = "A" | "B" | "C";
/** Only the chat step uses B and C; drawer, report and pages need A alone. */
const NEEDS_BC = STEPS.includes("chat");
function loadMandates(): Record<Key, string> {
  const explicit = arg("mandates");
  if (explicit) {
    const [A, B, C] = explicit.split(",").map((s) => s.trim());
    if (!A || (NEEDS_BC && (!B || !C))) throw new Error(NEEDS_BC ? "--mandates needs A,B,C" : "--mandates needs at least A");
    return { A, B: B ?? "", C: C ?? "" };
  }
  const path = join(OUT_DIR, "seed-latest.json");
  if (!existsSync(path)) throw new Error(`${path} not found — run \`npm run seed\` or pass --mandates A,B,C`);
  const seed = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const id = (v: unknown) => (typeof v === "string" ? v : (v as { id?: string } | undefined)?.id);
  const A = id(seed.A);
  const B = id(seed.B);
  const C = id(seed.C);
  if (!A || (NEEDS_BC && (!B || !C))) throw new Error(`${path} must contain A, B, C`);
  return { A, B: B ?? "", C: C ?? "" };
}

// ---------- helpers ----------

const log: Array<Record<string, unknown>> = [];
const saved: string[] = [];
const warnings: string[] = [];
const text = (n: number) => DEMO_SCRIPT.find((s) => s.n === n)!.text;

async function shot(page: PwPage, file: string, fullPage = false) {
  const path = join(OUT_DIR, file);
  await page.screenshot({ path, fullPage, type: "png" });
  saved.push(path);
  console.log(`  saved ${path}`);
}

/**
 * Opens an app page and hides the Next.js dev-mode indicator and the floating Evidence button
 * (`[data-evidence-fab]`) so the checklist screenshots stay clean and keep their pre-button layout.
 * `keepFab` leaves the button visible (the drawer step has to click it).
 */
async function openApp(page: PwPage, path: string, timeout = 60_000, keepFab = false) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle", timeout });
  await page.addStyleTag({ content: keepFab ? "nextjs-portal{display:none!important}" : "nextjs-portal,[data-evidence-fab]{display:none!important}" });
}

/** Waits until no shadcn skeleton is inside `scope` (a selector list; data still loading), up to `timeout` ms. */
async function waitForData(page: PwPage, scope: string, timeout = 60_000) {
  const skeletons = scope
    .split(",")
    .map((x) => `${x.trim()} [data-slot="skeleton"]`)
    .join(", ");
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if ((await page.locator(skeletons).count()) === 0) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

async function patchStatus(id: string, status: MandateStatus) {
  const res = await fetch(`${BASE_URL}${ENDPOINTS.mandate(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
  console.log(`  PATCH ${id} → ${status}: HTTP ${res.status}`);
  if (!res.ok) throw new Error(`PATCH ${id} ${status} failed: HTTP ${res.status}`);
}

async function openTraveler(page: PwPage, mandateId: string) {
  await openApp(page, `/traveler?m=${encodeURIComponent(mandateId)}`);
  await page.waitForTimeout(800);
}

/** Types one request into the chat, waits for POST /api/chat and (for approvals) for a settled confirm. */
async function send(page: PwPage, n: number, mandateId: string): Promise<ChatResponse | null> {
  const t = text(n);
  console.log(`#${n} [${mandateId}] ${t}`);
  const composer = page.locator(COMPOSER).last();
  if ((await composer.count()) === 0) throw new Error(`no composer matching "${COMPOSER}" on /traveler — pass --composer <css>`);
  await composer.fill(t);
  const chatDone = page.waitForResponse((r) => r.url().includes(ENDPOINTS.chat) && r.request().method() === "POST", { timeout: 120_000 });
  const button = SEND ? page.locator(SEND).first() : page.getByRole("button", { name: /^send/i }).first();
  if ((await button.count()) > 0 && (await button.isEnabled())) await button.click();
  else await composer.press("Enter");
  const res = await chatDone;
  let body: ChatResponse | null = null;
  try {
    body = (await res.json()) as ChatResponse;
  } catch {
    warnings.push(`#${n}: chat response was not JSON (HTTP ${res.status()})`);
  }
  const e = body?.entry ?? null;
  log.push({ n, mandateId, text: t, http: res.status(), decision: e?.decision ?? null, codes: e?.reasons.map((r) => r.code) ?? [], entryId: e?.id ?? null, txHash: e?.txHash ?? null, kilnResponseId: e?.kilnResponseId ?? null, usage: body?.usage ?? [] });
  console.log(`  → HTTP ${res.status()} ${e ? `${e.decision} ${e.reasons.map((r) => r.code).join(",")}` : "no entry"}`);
  if (e && e.decision === "APPROVE" && e.txHash) {
    try {
      await page.waitForResponse(
        async (r) => {
          if (!r.url().includes(`/api/ledger/${encodeURIComponent(e.id)}/confirm`)) return false;
          try {
            const j = (await r.json()) as { settlement?: { state?: string } };
            return j.settlement?.state === "settled" || j.settlement?.state === "failed";
          } catch {
            return false;
          }
        },
        { timeout: 150_000 },
      );
      console.log("  → settled (UI polled confirm)");
    } catch {
      warnings.push(`#${n}: no settled confirm seen within 150 s — screenshot shows the pending card`);
    }
  }
  await page.waitForTimeout(1200); // let the card/toast render
  return body;
}

async function composeSideBySide(page: PwPage, left: Buffer, right: Buffer, leftLabel: string, rightLabel: string, file: string) {
  const img = (b: Buffer, label: string) =>
    `<figure><figcaption>${label}</figcaption><img src="data:image/png;base64,${b.toString("base64")}"></figure>`;
  await page.setViewportSize({ width: 2400, height: 900 });
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>
      body{margin:0;padding:24px;background:#f4f4f5;font:14px system-ui,sans-serif;color:#18181b;display:flex;gap:24px;align-items:flex-start;width:max-content}
      figure{margin:0;background:#fff;border:1px solid #e4e4e7;border-radius:10px;padding:12px}
      figcaption{font-weight:600;margin:0 0 8px}
      img{display:block;max-width:1100px;height:auto}
    </style></head><body>${img(left, leftLabel)}${img(right, rightLabel)}</body></html>`,
    { waitUntil: "load" },
  );
  // crop to the two figures (body is width:max-content)
  const path = join(OUT_DIR, file);
  writeFileSync(path, await page.locator("body").screenshot({ type: "png" }));
  saved.push(path);
  console.log(`  saved ${path}`);
}

// ---------- parts ----------

/** Chat captures use a taller viewport so a whole receipt card (about 400 px) fits in the chat list. */
const CHAT_VIEWPORT = { width: 1280, height: 1000 };

/**
 * Scrolls the chat list so the newest receipt card starts at the top of the list, so the card's
 * headline ("Approved — inside the mandate" / "Stopped — nothing was sent") is in the screenshot.
 * Only the chat list scrolls; the page header stays in view.
 */
async function alignLatestCard(page: PwPage) {
  await page.evaluate(() => {
    const cards = document.querySelectorAll('article[aria-label^="Receipt "]');
    const card = cards[cards.length - 1] as HTMLElement | undefined;
    if (!card) return;
    let box: HTMLElement | null = card.parentElement;
    while (box && !(box.scrollHeight > box.clientHeight && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
    if (!box) return;
    box.scrollTop += card.getBoundingClientRect().top - box.getBoundingClientRect().top - 12;
  });
  await page.waitForTimeout(300);
}

async function chatPart(page: PwPage, ids: Record<Key, string>) {
  console.log("\n== chat (drives /traveler; #0 and #6 are real payments) ==");
  let paused = false;
  await page.setViewportSize(CHAT_VIEWPORT);
  try {
    await openTraveler(page, ids.A);
    await send(page, 0, ids.A);
    await alignLatestCard(page);
    await shot(page, "01-approve.png");
    await send(page, 1, ids.A);
    await send(page, 2, ids.A);
    await alignLatestCard(page);
    await shot(page, "02-merchant-not-allowed.png");

    await openTraveler(page, ids.B);
    await send(page, 3, ids.B);
    await alignLatestCard(page);
    await shot(page, "03-over-budget-with-fees.png");

    await patchStatus(ids.A, "paused");
    paused = true;
    await openTraveler(page, ids.A);
    await send(page, 4, ids.A);
    await alignLatestCard(page);
    await shot(page, "10-paused.png");

    await openTraveler(page, ids.C);
    await send(page, 5, ids.C);
    await alignLatestCard(page);
    await shot(page, "04-expired.png");

    await patchStatus(ids.A, "active");
    paused = false;
    await openTraveler(page, ids.A);
    await send(page, 6, ids.A);
    await send(page, 7, ids.A);
  } finally {
    if (paused) await patchStatus(ids.A, "active");
    await page.setViewportSize(VIEWPORT);
  }
}

async function pagesPart(page: PwPage, ids: Record<Key, string>) {
  console.log("\n== pages (no spending) ==");
  const health = await fetch(`${BASE_URL}${ENDPOINTS.health}`);
  const hj = (await health.json()) as HealthResponse;
  const hpath = join(OUT_DIR, "05-health.json");
  writeFileSync(hpath, JSON.stringify({ fetchedAt: new Date().toISOString(), url: `${BASE_URL}${ENDPOINTS.health}`, status: health.status, body: hj }, null, 2) + "\n");
  saved.push(hpath);
  console.log(`  saved ${hpath} (modelAvailable=${hj.modelAvailable}, models=${hj.models?.join(",")})`);

  await openApp(page, `/principal?m=${encodeURIComponent(ids.A)}`);
  await page.waitForTimeout(2500);
  await shot(page, "09-principal.png");

  // 08: the ledger row (tx hash + receipt hash) next to the transaction as the chain shows it.
  const tables = page.locator("table");
  const ledger = (await tables.count()) > 0 ? await tables.last().screenshot({ type: "png" }) : await page.screenshot({ type: "png" });
  const ledgerJson = (await (await fetch(`${BASE_URL}${ENDPOINTS.ledger(ids.A)}`)).json()) as { entries?: Array<{ txHash?: string; id: string }> };
  const tx = ledgerJson.entries?.find((e) => e.txHash)?.txHash;
  let right: Buffer | null = null;
  let rightLabel = "";
  if (tx && ETHERSCAN) {
    try {
      await page.goto(`https://sepolia.etherscan.io/tx/${tx}`, { waitUntil: "load", timeout: 30_000 });
      await page.waitForTimeout(2500);
      const title = await page.title();
      if (/just a moment|attention required|access denied/i.test(title)) throw new Error(`blocked: ${title}`);
      right = await page.screenshot({ type: "png" });
      rightLabel = `Sepolia Etherscan — tx ${tx.slice(0, 10)}…`;
    } catch (e) {
      warnings.push(`08: Etherscan not captured (${(e as Error).message}); using the audit page's decoded transaction instead`);
    }
  }
  await openApp(page, `/audit/${encodeURIComponent(ids.A)}`, 90_000);
  await page.waitForTimeout(3000);
  const auditFull = await page.screenshot({ type: "png", fullPage: true });
  saved.push(join(OUT_DIR, "11-audit.png"));
  writeFileSync(join(OUT_DIR, "11-audit.png"), auditFull);
  console.log(`  saved ${join(OUT_DIR, "11-audit.png")}`);
  if (!right) {
    const auditTables = page.locator("table");
    right = (await auditTables.count()) > 0 ? await auditTables.last().screenshot({ type: "png" }) : auditFull;
    rightLabel = "On-chain check — decoded calldata (/audit)";
  }
  if (!tx) warnings.push("08: no ledger entry with a txHash on mandate A yet");
  await composeSideBySide(page, ledger, right, `Ledger — mandate ${ids.A}`, rightLabel, "08-tx-and-ledger.png");
  await page.setViewportSize(VIEWPORT);

  await openApp(page, `/metrics?m=${encodeURIComponent(ids.A)}`);
  await page.waitForTimeout(2000);
  await shot(page, "07-metrics.png", true);
}

const DIALOG = '[data-slot="sheet-content"], [role="dialog"]';

async function drawerPart(page: PwPage, ids: Record<Key, string>) {
  console.log("\n== drawer (Evidence button on /traveler; GETs only) ==");
  await openApp(page, `/traveler?m=${encodeURIComponent(ids.A)}`, 60_000, true);
  await page.waitForTimeout(800);
  const fab = page.locator("[data-evidence-fab]").first();
  if ((await fab.count()) === 0) {
    warnings.push("drawer: no [data-evidence-fab] on /traveler — is the Evidence button merged? 14-evidence-drawer.png not saved");
    return;
  }
  // The attribute may sit on the button itself or on a wrapper around it.
  const inner = fab.locator("button").first();
  await ((await inner.count()) > 0 ? inner : fab).click({ timeout: 10_000 });
  const dialog = page.locator(DIALOG).last();
  await dialog.waitFor({ state: "visible", timeout: 15_000 });
  if (!(await waitForData(page, DIALOG, 30_000))) warnings.push("drawer: still loading after 30 s — screenshot shows skeleton rows");
  if (DRAWER_CHECKS) {
    const run = dialog.getByRole("button", { name: /run checks/i }).first();
    if ((await run.count()) > 0) {
      await run.click({ timeout: 10_000 });
      try {
        await dialog.getByText(/checks? passed|could not run/i).first().waitFor({ state: "visible", timeout: 120_000 });
        console.log("  → Run checks now: result shown");
      } catch {
        warnings.push("drawer: no check result within 120 s after \"Run checks now\"");
      }
    } else {
      warnings.push('drawer: no "Run checks now" button in the drawer — screenshot without the check result');
    }
  }
  await page.waitForTimeout(600); // slide-in animation + last paint
  // Grow the viewport by however much the drawer's scroll area overflows, so the PNG shows all of it.
  const overflow = await page.evaluate(() => {
    const d = document.querySelector('[data-slot="sheet-content"], [role="dialog"]');
    if (!d) return 0;
    return Math.max(0, ...[d, ...Array.from(d.querySelectorAll("*"))].map((e) => e.scrollHeight - e.clientHeight));
  });
  if (overflow > 0) {
    await page.setViewportSize({ width: VIEWPORT.width, height: Math.min(VIEWPORT.height + overflow + 16, 2400) });
    await page.waitForTimeout(400);
  }
  await shot(page, "14-evidence-drawer.png");
  await page.setViewportSize(VIEWPORT);
}

async function reportPart(page: PwPage, ids: Record<Key, string>) {
  console.log("\n== report (printable statement → PDF; GETs only) ==");
  const path = `/audit/${encodeURIComponent(ids.A)}/report`;
  const probe = await fetch(`${BASE_URL}${path}`);
  if (probe.status === 404) {
    warnings.push(`report: ${path} is a 404 (route not merged) — 13-trip-statement.pdf not saved`);
    return;
  }
  await openApp(page, path, 90_000);
  if (!(await waitForData(page, "body", 90_000))) warnings.push("report: still loading after 90 s — the PDF may show skeleton rows");
  await page.waitForTimeout(1500);
  await page.emulateMedia({ media: "print" });
  const out = join(OUT_DIR, "13-trip-statement.pdf");
  // A4; the page's own @page rule wins when it has one, else 14 mm margins. No header/footer, so no
  // localhost URL, date or file path is stamped on the pages.
  await page.pdf({ path: out, format: "A4", preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false, margin: { top: "14mm", right: "14mm", bottom: "14mm", left: "14mm" } });
  await page.emulateMedia({ media: null });
  saved.push(out);
  console.log(`  saved ${out}`);
}

async function main() {
  const ids = loadMandates();
  mkdirSync(OUT_DIR, { recursive: true });
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
  const page = await context.newPage();
  console.log(`capture → ${BASE_URL}  A=${ids.A}${NEEDS_BC ? ` B=${ids.B} C=${ids.C}` : ""}  steps: ${STEPS.join(", ")}`);
  try {
    if (STEPS.includes("chat")) await chatPart(page, ids);
    if (STEPS.includes("pages")) await pagesPart(page, ids);
    if (STEPS.includes("drawer")) await drawerPart(page, ids);
    if (STEPS.includes("report")) await reportPart(page, ids);
  } finally {
    // capture-log.json belongs to the chat step (what was sent, tx hashes); other runs get their own
    // file so a later --only drawer/report/pages run never overwrites it.
    const logFile = STEPS.includes("chat") ? "capture-log.json" : `capture-log-${STEPS.join("-")}.json`;
    writeFileSync(join(OUT_DIR, logFile), JSON.stringify({ at: new Date().toISOString(), baseUrl: BASE_URL, steps: STEPS, mandates: ids, sent: log, saved, warnings }, null, 2) + "\n");
    await context.close();
    await browser.close();
  }
  console.log(`\n${saved.length} file(s) saved to ${OUT_DIR}/`);
  for (const w of warnings) console.log(`! ${w}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
