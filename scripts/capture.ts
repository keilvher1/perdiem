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
 *   BASE_URL=http://localhost:3000 … --mandates man_A_x,man_B_x,man_C_x
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
 * 11-audit.png, plus capture-log.json (what was sent, response ids, tx hashes).
 *
 * Flags: --only chat|pages | --mandates A,B,C | --base-url <url> | --out-dir <dir> | --scale <n, default 2>
 *        --composer <css> --send <css> (if the chat UI differs) | --no-etherscan | --headed
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
  getByRole(role: "button" | "textbox" | "table", o?: { name?: RegExp | string }): PwLocator;
  waitForResponse(pred: (r: PwResponse) => boolean | Promise<boolean>, o?: { timeout?: number }): Promise<PwResponse>;
  waitForTimeout(ms: number): Promise<void>;
  screenshot(o?: { path?: string; fullPage?: boolean; type?: "png" }): Promise<Buffer>;
  setContent(html: string, o?: { waitUntil?: "load" }): Promise<void>;
  setViewportSize(s: { width: number; height: number }): Promise<void>;
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
const ONLY = arg("only") as "chat" | "pages" | undefined;
const SCALE = Number(arg("scale") ?? 2);
const COMPOSER = arg("composer") ?? "textarea";
const SEND = arg("send");
const ETHERSCAN = !process.argv.includes("--no-etherscan");
const HEADED = process.argv.includes("--headed");
const VIEWPORT = { width: 1280, height: 800 };

type Key = "A" | "B" | "C";
function loadMandates(): Record<Key, string> {
  const explicit = arg("mandates");
  if (explicit) {
    const [A, B, C] = explicit.split(",").map((s) => s.trim());
    if (!A || !B || !C) throw new Error("--mandates needs A,B,C");
    return { A, B, C };
  }
  const path = join(OUT_DIR, "seed-latest.json");
  if (!existsSync(path)) throw new Error(`${path} not found — run \`npm run seed\` or pass --mandates A,B,C`);
  const seed = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const id = (v: unknown) => (typeof v === "string" ? v : (v as { id?: string } | undefined)?.id);
  const A = id(seed.A);
  const B = id(seed.B);
  const C = id(seed.C);
  if (!A || !B || !C) throw new Error(`${path} must contain A, B, C`);
  return { A, B, C };
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
  await page.goto(`${BASE_URL}/traveler?m=${encodeURIComponent(mandateId)}`, { waitUntil: "networkidle", timeout: 60_000 });
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

async function chatPart(page: PwPage, ids: Record<Key, string>) {
  console.log("\n== chat (drives /traveler; #0 and #6 are real payments) ==");
  let paused = false;
  try {
    await openTraveler(page, ids.A);
    await send(page, 0, ids.A);
    await shot(page, "01-approve.png");
    await send(page, 1, ids.A);
    await send(page, 2, ids.A);
    await shot(page, "02-merchant-not-allowed.png");

    await openTraveler(page, ids.B);
    await send(page, 3, ids.B);
    await shot(page, "03-over-budget-with-fees.png");

    await patchStatus(ids.A, "paused");
    paused = true;
    await openTraveler(page, ids.A);
    await send(page, 4, ids.A);
    await shot(page, "10-paused.png");

    await openTraveler(page, ids.C);
    await send(page, 5, ids.C);
    await shot(page, "04-expired.png");

    await patchStatus(ids.A, "active");
    paused = false;
    await openTraveler(page, ids.A);
    await send(page, 6, ids.A);
    await send(page, 7, ids.A);
  } finally {
    if (paused) await patchStatus(ids.A, "active");
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

  await page.goto(`${BASE_URL}/principal?m=${encodeURIComponent(ids.A)}`, { waitUntil: "networkidle", timeout: 60_000 });
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
  await page.goto(`${BASE_URL}/audit/${encodeURIComponent(ids.A)}`, { waitUntil: "networkidle", timeout: 90_000 });
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

  await page.goto(`${BASE_URL}/metrics?m=${encodeURIComponent(ids.A)}`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(2000);
  await shot(page, "07-metrics.png", true);
}

async function main() {
  const ids = loadMandates();
  mkdirSync(OUT_DIR, { recursive: true });
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
  const page = await context.newPage();
  console.log(`capture → ${BASE_URL}  A=${ids.A} B=${ids.B} C=${ids.C}`);
  try {
    if (ONLY !== "pages") await chatPart(page, ids);
    if (ONLY !== "chat") await pagesPart(page, ids);
  } finally {
    writeFileSync(join(OUT_DIR, "capture-log.json"), JSON.stringify({ at: new Date().toISOString(), baseUrl: BASE_URL, mandates: ids, sent: log, saved, warnings }, null, 2) + "\n");
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
