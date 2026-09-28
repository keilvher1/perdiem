/**
 * tests/view.test.ts — lib/view.ts (domain → API view) is display-only and must never change what
 * gets hashed. Run: npx tsx --conditions=react-server tests/view.test.ts
 * (the react-server condition makes `import "server-only"` resolve to an empty module).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Hex } from "viem";
import { mandateHash, receiptHash, type LedgerEntry, type Mandate } from "../lib/policy";
import type { MandateRow } from "../lib/db";
import { toDetail, toEntryView, toSummary } from "../lib/view";

const seed = JSON.parse(readFileSync(resolve(__dirname, "../docs/seed.json"), "utf8")) as { mandates: Mandate[] };
const mandate: Mandate = { ...seed.mandates[0]!, id: "man_A_test", status: "paused" };
const anchorTx = `0x${"ab".repeat(32)}` as Hex;
const row: MandateRow = { mandate, hash: mandateHash(mandate), anchorTx, createdAt: "2026-09-28T11:05:00.000Z" };

const TX1 = `0x${"11".repeat(32)}` as Hex;
const TX2 = `0x${"22".repeat(32)}` as Hex;
let n = 0;
function entry(merchantId: string, amountUsd: number, feeUsd: number, status: LedgerEntry["status"], txHash?: Hex, mandateId = mandate.id): LedgerEntry {
  n += 1;
  const at = new Date(Date.UTC(2026, 8, 28, 12, n)).toISOString();
  const e: LedgerEntry = {
    id: `led_${n}`,
    mandateId,
    mandateHash: row.hash,
    proposal: { merchantId, amountUsd, memo: `test ${n}`, sourceText: `test ${n}`, requestedAt: at },
    merchantName: mandate.catalog.find((c) => c.id === merchantId)?.name,
    decision: status === "stopped" ? "STOP" : "APPROVE",
    reasons: [],
    feeUsd,
    feeSource: "estimate",
    totalUsd: amountUsd + feeUsd,
    status,
    at,
  };
  if (txHash) e.txHash = txHash;
  if (e.merchantName === undefined) delete e.merchantName; // lib/db.ts never returns undefined-valued keys
  e.receiptHash = receiptHash(e);
  return e;
}

const settled = entry("m1", 12, 0.000123, "settled", TX1);
const stopped = entry("m2", 85, 0.000101, "stopped");
const pending = entry("m7", 5, 0.000456, "pending", TX2);
const failed = entry("m1", 7, 0.0002, "failed");
const approved = entry("m4", 3, 0.0003, "approved");
const unknown = entry("m99", 1, 0, "stopped");
const otherMandate = entry("m1", 20, 0.1, "settled", TX1, "man_B_test");
const ledger = [settled, stopped, pending, failed, approved, unknown, otherMandate];
const ledgerSnapshot = structuredClone(ledger);
const rowSnapshot = structuredClone(row);

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

test("toEntryView adds merchantCategory and explorerUrl for a paid entry", () => {
  const v = toEntryView(settled, row);
  assert.equal(v.merchantCategory, "meal");
  assert.equal(v.explorerUrl, `https://sepolia.etherscan.io/tx/${TX1}`);
  assert.equal(v.status, "settled");
  assert.equal(v.txHash, TX1);
});

test("toEntryView leaves explorerUrl out when there is no tx (stopped)", () => {
  const v = toEntryView(stopped, row);
  assert.equal(v.merchantCategory, "transport");
  assert.ok(!("explorerUrl" in v));
});

test("toEntryView leaves merchantCategory out for a merchant outside the catalog", () => {
  const v = toEntryView(unknown, row);
  assert.ok(!("merchantCategory" in v));
  assert.ok(!Object.values(v).some((x) => x === undefined), "no undefined-valued keys");
});

test("a view hashes like its entry (receiptHash ignores view-only fields)", () => {
  for (const e of ledger) assert.equal(receiptHash(toEntryView(e, row)), e.receiptHash);
});

test("toSummary: spent = approved+pending+settled, pending = pending only, remaining = budget - spent", () => {
  const s = toSummary(row, ledger);
  const spent = settled.totalUsd + pending.totalUsd + approved.totalUsd;
  assert.equal(s.spentUsd, spent);
  assert.equal(s.pendingUsd, pending.totalUsd);
  assert.equal(s.remainingUsd, mandate.budgetUsd - spent);
  assert.equal(s.entryCount, 6, "entries of another mandate are ignored");
  assert.equal(s.status, "paused");
  assert.equal(s.hash, row.hash);
  assert.equal(s.anchorTx, anchorTx);
  assert.equal(s.anchorUrl, `https://sepolia.etherscan.io/tx/${anchorTx}`);
  assert.equal(s.createdAt, row.createdAt);
});

test("toSummary returns exactly the MandateSummary keys", () => {
  assert.deepEqual(Object.keys(toSummary(row, ledger)).sort(), [
    "anchorTx", "anchorUrl", "budgetUsd", "createdAt", "entryCount", "expiresAt", "hash", "id",
    "pendingUsd", "perTxCapUsd", "principal", "remainingUsd", "spentUsd", "startsAt", "status", "traveler",
  ]);
});

test("toSummary on an empty ledger: nothing spent, full budget remaining", () => {
  const s = toSummary(row, []);
  assert.equal(s.spentUsd, 0);
  assert.equal(s.pendingUsd, 0);
  assert.equal(s.remainingUsd, mandate.budgetUsd);
  assert.equal(s.entryCount, 0);
});

test("toDetail keeps every Mandate field and hashes to the stored hash", () => {
  const d = toDetail(row, ledger);
  for (const k of Object.keys(mandate) as (keyof Mandate)[]) assert.deepEqual(d[k], mandate[k], k);
  assert.equal(mandateHash(d), row.hash);
  assert.equal(d.spentUsd, toSummary(row, ledger).spentUsd);
  assert.equal(d.pendingUsd, pending.totalUsd);
  assert.equal(d.anchorUrl, `https://sepolia.etherscan.io/tx/${anchorTx}`);
});

test("toDetail without an anchor: anchorTx and anchorUrl are null", () => {
  const d = toDetail({ ...row, anchorTx: null }, []);
  assert.equal(d.anchorTx, null);
  assert.equal(d.anchorUrl, null);
  assert.equal(d.remainingUsd, mandate.budgetUsd);
});

test("views never mutate their inputs", () => {
  const d = toDetail(row, ledger);
  d.catalog[0]!.name = "changed";
  d.allowedMerchantIds.push("m5");
  const v = toEntryView(settled, row);
  v.proposal.memo = "changed-via-view";
  v.reasons.push({ code: "DUPLICATE", message: "changed-via-view" });
  assert.deepEqual(row, rowSnapshot);
  assert.deepEqual(ledger, ledgerSnapshot);
});

console.log(`\n${passed} view tests passed`);
