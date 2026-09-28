/**
 * tests/policy.test.ts — the "pushed outside the scope" runs the challenge asks
 * for, plus hash stability and the audit replay. Run: npx tsx tests/policy.test.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluate, findMerchant, mandateHash, receiptHash, replayLedger, type LedgerEntry, type Mandate, type Merchant } from "../lib/policy";

// Catalog matches docs/PRD.md §6 (addresses are placeholders; seed.json has real ones)
const catalog: Merchant[] = [
  { id: "m1", name: "Yangjae Kitchen", category: "meal", wallet: "0x1111111111111111111111111111111111111111" },
  { id: "m2", name: "Kakao T Taxi", category: "transport", wallet: "0x2222222222222222222222222222222222222222" },
  { id: "m3", name: "T-money Top-up", category: "transport", wallet: "0x3333333333333333333333333333333333333333" },
  { id: "m4", name: "Daiso Yangjae", category: "supplies", wallet: "0x4444444444444444444444444444444444444444" },
  { id: "m5", name: "Wine & Co", category: "alcohol", wallet: "0x5555555555555555555555555555555555555555" },
  { id: "m6", name: "Lotte Duty Free", category: "gift", wallet: "0x6666666666666666666666666666666666666666" },
  { id: "m7", name: "Starbucks aT Center", category: "meal", wallet: "0x7777777777777777777777777777777777777777" },
];

const mandate: Mandate = {
  id: "man_A",
  principal: "MICEMore Finance",
  traveler: "Mingyu",
  agentWallet: "0x9999999999999999999999999999999999999999",
  budgetUsd: 150,
  perTxCapUsd: 40,
  allowedMerchantIds: ["m1", "m2", "m3", "m4", "m7"],
  allowedCategories: ["meal", "transport", "supplies"],
  blockedKeywords: ["alcohol", "wine", "gift"],
  startsAt: "2026-09-28T08:00:00Z",
  expiresAt: "2026-09-30T09:00:00Z",
  catalog,
  status: "active",
};

const now = new Date("2026-09-29T03:00:00Z");
const at = now.toISOString();
const base = { mandate, spentUsd: 0, estimatedFeeUsd: 0.5 as number | null, now, recent: [] as LedgerEntry[] };
const M = (id: string) => findMerchant(mandate, id);

// Run 0 — happy path
{
  const d = evaluate({ merchantId: "m1", amountUsd: 12, memo: "lunch", requestedAt: at }, { ...base, merchant: M("m1") });
  assert.equal(d.decision, "APPROVE");
  assert.equal(d.totalUsd, 12.5);
}

// Run 1 — per-transaction cap
{
  const d = evaluate({ merchantId: "m2", amountUsd: 85, memo: "taxi to Incheon airport", requestedAt: at }, { ...base, merchant: M("m2") });
  assert.ok(d.decision === "STOP" && d.reasons.some((r) => r.code === "OVER_PER_TX_CAP"));
}

// Run 2 — merchant not on the list + category + blocked keyword (all three reported)
{
  const d = evaluate({ merchantId: "m5", amountUsd: 30, memo: "wine as a client gift", requestedAt: at }, { ...base, merchant: M("m5") });
  assert.equal(d.decision, "STOP");
  const codes = d.decision === "STOP" ? d.reasons.map((r) => r.code).sort() : [];
  assert.deepEqual(codes, ["BLOCKED_KEYWORD", "CATEGORY_NOT_ALLOWED", "MERCHANT_NOT_ALLOWED"]);
}

// Run 2b — blocked keyword laundered out of the memo but present in the traveler's words
{
  const d = evaluate(
    { merchantId: "m1", amountUsd: 20, memo: "client dinner", sourceText: "get a bottle of wine for the client dinner", requestedAt: at },
    { ...base, merchant: M("m1") },
  );
  assert.ok(d.decision === "STOP" && d.reasons.some((r) => r.code === "BLOCKED_KEYWORD"));
}

// Run 3 — budget exceeded once fees are added: exactly $10 on a $10 budget.
// Must STOP for ANY positive fee, including sub-cent Sepolia fees (no rounding).
{
  for (const fee of [0.5, 0.0123, 0.000004, 1e-9]) {
    const d = evaluate({ merchantId: "m1", amountUsd: 10, memo: "dinner", requestedAt: at }, { ...base, merchant: M("m1"), mandate: { ...mandate, budgetUsd: 10 }, estimatedFeeUsd: fee });
    assert.ok(d.decision === "STOP" && d.reasons.some((r) => r.code === "OVER_BUDGET_WITH_FEES"), `fee ${fee} should stop`);
  }
  // …and the same request with zero fee fits — proving the fee is what stopped it
  const d2 = evaluate({ merchantId: "m1", amountUsd: 10, memo: "dinner", requestedAt: at }, { ...base, merchant: M("m1"), mandate: { ...mandate, budgetUsd: 10 }, estimatedFeeUsd: 0 });
  assert.equal(d2.decision, "APPROVE");
}

// Run 4 — kill switch
{
  const d = evaluate({ merchantId: "m7", amountUsd: 5, memo: "coffee", requestedAt: at }, { ...base, merchant: M("m7"), mandate: { ...mandate, status: "paused" } });
  assert.ok(d.decision === "STOP" && d.reasons.some((r) => r.code === "MANDATE_NOT_ACTIVE"));
}

// Run 5 — deadline already past (mandate C in seed.json)
{
  const d = evaluate({ merchantId: "m2", amountUsd: 20, memo: "taxi", requestedAt: at }, { ...base, merchant: M("m2"), now: new Date("2026-10-01T00:00:00Z") });
  assert.ok(d.decision === "STOP" && d.reasons.some((r) => r.code === "EXPIRED"));
}

// Before start
{
  const d = evaluate({ merchantId: "m2", amountUsd: 20, memo: "taxi", requestedAt: at }, { ...base, merchant: M("m2"), now: new Date("2026-09-27T00:00:00Z") });
  assert.ok(d.decision === "STOP" && d.reasons.some((r) => r.code === "BEFORE_START"));
}

// Fee unavailable → fail closed
{
  const d = evaluate({ merchantId: "m1", amountUsd: 12, memo: "lunch", requestedAt: at }, { ...base, merchant: M("m1"), estimatedFeeUsd: null });
  assert.ok(d.decision === "STOP" && d.reasons.some((r) => r.code === "FEE_UNAVAILABLE"));
}

// Duplicate within 5 minutes
{
  const prior: LedgerEntry = {
    id: "e0", mandateId: "man_A", mandateHash: mandateHash(mandate),
    proposal: { merchantId: "m1", amountUsd: 12, memo: "lunch", requestedAt: at },
    decision: "APPROVE", reasons: [], feeUsd: 0.5, totalUsd: 12.5, status: "settled", at: new Date(now.getTime() - 3 * 60_000).toISOString(),
  };
  const d = evaluate({ merchantId: "m1", amountUsd: 12, memo: "lunch again", requestedAt: at }, { ...base, merchant: M("m1"), recent: [prior], spentUsd: 12.5 });
  assert.ok(d.decision === "STOP" && d.reasons.some((r) => r.code === "DUPLICATE"));
}

// Many reasons at once (gift shop, after deadline, over cap)
{
  const d = evaluate({ merchantId: "m6", amountUsd: 60, memo: "gift for client", requestedAt: at }, { ...base, merchant: M("m6"), now: new Date("2026-10-01T00:00:00Z") });
  assert.ok(d.decision === "STOP" && d.reasons.length >= 4);
}

// Hash stability: Pause/Resume must NOT change the anchored hash; changing terms must
{
  const h = mandateHash(mandate);
  assert.equal(mandateHash({ ...mandate, status: "paused" }), h);
  assert.notEqual(mandateHash({ ...mandate, budgetUsd: 151 }), h);
  assert.notEqual(mandateHash({ ...mandate, catalog: catalog.map((c) => (c.id === "m5" ? { ...c, category: "meal" } : c)) }), h);
}

// Audit replay: a tampered entry (stored APPROVE that should have been STOP) is caught,
// and a legitimate paused-stop replays consistently.
{
  const mh = mandateHash(mandate);
  const entries: LedgerEntry[] = [
    { id: "e1", mandateId: "man_A", mandateHash: mh, proposal: { merchantId: "m1", amountUsd: 12, memo: "lunch", requestedAt: "2026-09-29T03:00:00Z" }, decision: "APPROVE", reasons: [], feeUsd: 0.5, feeSource: "estimate", totalUsd: 12.5, status: "settled", at: "2026-09-29T03:00:00Z" },
    { id: "e2", mandateId: "man_A", mandateHash: mh, proposal: { merchantId: "m5", amountUsd: 30, memo: "wine", requestedAt: "2026-09-29T04:00:00Z" }, decision: "APPROVE", reasons: [], feeUsd: 0.5, feeSource: "estimate", totalUsd: 30.5, status: "settled", at: "2026-09-29T04:00:00Z" },
    { id: "e3", mandateId: "man_A", mandateHash: mh, proposal: { merchantId: "m7", amountUsd: 5, memo: "coffee", requestedAt: "2026-09-29T05:00:00Z" }, decision: "STOP", reasons: [{ code: "MANDATE_NOT_ACTIVE", message: "paused" }], feeUsd: 0.5, feeSource: "estimate", totalUsd: 5.5, status: "stopped", at: "2026-09-29T05:00:00Z" },
  ];
  const r = replayLedger(mandate, entries);
  assert.equal(r[0]!.consistent, true);
  assert.equal(r[1]!.consistent, false);
  assert.equal(r[1]!.recomputedDecision, "STOP");
  assert.equal(r[2]!.consistent, true);
  assert.ok(r.every((x) => x.mandateHashMatches));
}

// Receipt hash is stable across post-decision updates (status, txHash, actual fee)
{
  const e: LedgerEntry = {
    id: "e9", mandateId: "man_A", mandateHash: mandateHash(mandate),
    proposal: { merchantId: "m1", amountUsd: 12, memo: "lunch", requestedAt: at },
    decision: "APPROVE", reasons: [], feeUsd: 0.5, feeSource: "estimate", totalUsd: 12.5, status: "pending", at,
  };
  const h = receiptHash(e);
  assert.equal(receiptHash({ ...e, status: "settled", txHash: "0xabc", receiptHash: h, actualFeeUsd: 0.47, settledAt: at }), h);
  assert.notEqual(receiptHash({ ...e, totalUsd: 13 }), h);
}

// Seed data (docs/seed.json) produces the scripted outcomes of PRD §7
{
  // run from the repo root: docs/seed.json (falls back to ./seed.json)
  const seedPath = ["docs/seed.json", "seed.json"].map((p) => resolve(process.cwd(), p)).find((p) => existsSync(p));
  const seed: { mandates: Mandate[] } | null = seedPath ? JSON.parse(readFileSync(seedPath, "utf8")) : null;
  if (!seed) console.log("seed.json not found — skipping scenario check");
  if (seed) {
    const [A, B, C] = seed.mandates as [Mandate, Mandate, Mandate];
    const fee = 0.0003; // a realistic sub-cent Sepolia fee at the demo rate
    const ctx = (m: Mandate, id: string) => ({ mandate: m, merchant: findMerchant(m, id), spentUsd: 0, estimatedFeeUsd: fee, now, recent: [] as LedgerEntry[] });
    const run = (m: Mandate, id: string, amt: number, memo: string, src?: string) => evaluate({ merchantId: id, amountUsd: amt, memo, sourceText: src, requestedAt: at }, ctx(m, id));
    assert.equal(run(A, "m1", 12, "bibimbap lunch").decision, "APPROVE"); // run 0
    const r1 = run(A, "m2", 85, "taxi to Incheon airport");
    assert.ok(r1.decision === "STOP" && r1.reasons.map((r) => r.code).join() === "OVER_PER_TX_CAP"); // run 1
    const r2 = run(A, "m5", 30, "bottle of wine as a client gift");
    assert.ok(r2.decision === "STOP" && r2.reasons.length === 3); // run 2
    const r3 = run(B, "m1", 10, "dinner");
    assert.ok(r3.decision === "STOP" && r3.reasons.map((r) => r.code).join() === "OVER_BUDGET_WITH_FEES"); // run 3
    const r4 = evaluate({ merchantId: "m7", amountUsd: 5, memo: "coffee", requestedAt: at }, { ...ctx(A, "m7"), mandate: { ...A, status: "paused" } });
    assert.ok(r4.decision === "STOP" && r4.reasons.map((r) => r.code).join() === "MANDATE_NOT_ACTIVE"); // run 4
    const r5 = run(C, "m7", 5, "coffee");
    assert.ok(r5.decision === "STOP" && r5.reasons.map((r) => r.code).join() === "EXPIRED"); // run 5
    assert.equal(run(A, "m7", 5, "coffee").decision, "APPROVE"); // run 6 after resume
    assert.equal(mandateHash(A) === mandateHash(B), false);
    console.log("seed.json scenario check: OK");
  }
}

// Hashes ignore extra fields (DB rows, API views) — the bug that would break audit
{
  const dbRow = { ...mandate, hash: "0xdead", anchorTx: "0xbeef", createdAt: "2026-09-28T11:05:00Z" } as unknown as Mandate;
  assert.equal(mandateHash(dbRow), mandateHash(mandate));
  const e: LedgerEntry = {
    id: "e10", mandateId: "man_A", mandateHash: mandateHash(mandate),
    proposal: { merchantId: "m1", amountUsd: 12, memo: "lunch", requestedAt: at },
    decision: "APPROVE", reasons: [], feeUsd: 0.5, feeSource: "estimate", totalUsd: 12.5, status: "pending", at,
  };
  const view = { ...e, merchantCategory: "meal", explorerUrl: "https://sepolia.etherscan.io/tx/0x1" } as unknown as LedgerEntry;
  assert.equal(receiptHash(view), receiptHash(e));
}

console.log("policy tests: OK (16 blocks)");
