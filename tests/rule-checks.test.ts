/**
 * tests/rule-checks.test.ts — lib/rule-checks.ts derives the 12 checks of a recorded decision
 * (passed | failed | not_evaluated) from entry.reasons alone. This proves the derivation against
 * the real lib/policy.ts evaluate(): for thousands of generated requests, the derived result of
 * every check equals what that check's condition actually was when evaluate() decided.
 * Run: npx tsx tests/rule-checks.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Hex } from "viem";
import type { LedgerEntryView, MandateDetailResponse, StopCode } from "../contracts/api";
import { evaluate, findMerchant, type LedgerEntry, type Mandate, type Proposal } from "../lib/policy";
import { countRuleChecks, deriveRuleChecks, RULE_ORDER, type RuleResult } from "../lib/rule-checks";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

const W = (n: number) => `0x${String(n).padStart(40, "0")}` as Hex;
const mandate: Mandate = {
  id: "man_rule_test",
  principal: "Finance",
  traveler: "Traveler",
  agentWallet: W(1),
  budgetUsd: 100,
  perTxCapUsd: 40,
  allowedMerchantIds: ["m1", "m3"],
  allowedCategories: ["meal"],
  blockedKeywords: ["wine", "gift"],
  startsAt: "2026-09-28T00:00:00.000Z",
  expiresAt: "2026-09-30T00:00:00.000Z",
  catalog: [
    { id: "m1", name: "Kitchen", category: "meal", wallet: W(11) }, // allowed merchant, allowed category
    { id: "m2", name: "Diner", category: "meal", wallet: W(12) }, // merchant not allowed
    { id: "m3", name: "Gift Shop", category: "gift", wallet: W(13) }, // category not allowed
    { id: "m4", name: "Wine Bar", category: "alcohol", wallet: W(14) }, // both not allowed
  ],
  status: "active",
};

/** Deterministic PRNG (mulberry32) so a failure is reproducible. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260929);
const pick = <T,>(xs: ReadonlyArray<T>): T => xs[Math.floor(rand() * xs.length)]!;

/** Independent statement of each check's condition (the documented policy, not evaluate()'s code). */
function expected(
  m: Mandate,
  p: Proposal,
  fee: number | null,
  spent: number,
  now: Date,
  recent: LedgerEntry[],
): Record<StopCode, RuleResult> {
  const merchant = findMerchant(m, p.merchantId);
  const feeKnown = typeof fee === "number" && Number.isFinite(fee);
  const text = `${p.memo} ${p.sourceText ?? ""}`.toLowerCase();
  const r = (fails: boolean): RuleResult => (fails ? "failed" : "passed");
  return {
    MANDATE_NOT_ACTIVE: r(m.status !== "active"),
    BEFORE_START: r(now.getTime() < Date.parse(m.startsAt)),
    EXPIRED: r(now.getTime() > Date.parse(m.expiresAt)),
    UNKNOWN_MERCHANT: r(merchant === undefined),
    MERCHANT_NOT_ALLOWED: merchant ? r(!m.allowedMerchantIds.includes(merchant.id)) : "not_evaluated",
    CATEGORY_NOT_ALLOWED: merchant ? r(!m.allowedCategories.includes(merchant.category)) : "not_evaluated",
    BLOCKED_KEYWORD: r(m.blockedKeywords.some((k) => text.includes(k.toLowerCase()))),
    INVALID_AMOUNT: r(!(p.amountUsd > 0) || !Number.isFinite(p.amountUsd)),
    OVER_PER_TX_CAP: r(p.amountUsd > m.perTxCapUsd),
    FEE_UNAVAILABLE: r(!feeKnown),
    OVER_BUDGET_WITH_FEES: feeKnown ? r(p.amountUsd + (fee as number) > m.budgetUsd - spent) : "not_evaluated",
    DUPLICATE: r(
      recent.some(
        (e) =>
          (e.status === "approved" || e.status === "pending" || e.status === "settled") &&
          e.proposal.merchantId === p.merchantId &&
          e.proposal.amountUsd === p.amountUsd &&
          Math.abs(now.getTime() - Date.parse(e.at)) < 5 * 60 * 1000,
      ),
    ),
  };
}

test("derivation matches evaluate() for 5,000 generated requests", () => {
  const nows = ["2026-09-27T12:00:00.000Z", "2026-09-29T03:00:00.000Z", "2026-10-01T00:00:00.000Z"];
  const seen = new Map<string, number>();
  for (let i = 0; i < 5000; i++) {
    const m: Mandate = {
      ...mandate,
      status: pick(["active", "active", "paused", "revoked"] as const),
      // A reversed window lets BEFORE_START and EXPIRED fail together.
      ...(rand() < 0.1 ? { startsAt: "2026-10-02T00:00:00.000Z", expiresAt: "2026-09-26T00:00:00.000Z" } : {}),
    };
    const now = new Date(pick(nows));
    const merchantId = pick(["m1", "m1", "m2", "m3", "m4", "m99", "M1"]);
    const amountUsd = pick([12, 40, 40.01, 0, -5, Number.NaN, Number.POSITIVE_INFINITY, 95, 5]);
    const memo = pick(["lunch", "a bottle of WINE", "coffee"]);
    const sourceText = pick([undefined, "for the client, a gift", "taxi"]);
    const p: Proposal = { merchantId, amountUsd, memo, requestedAt: now.toISOString(), ...(sourceText ? { sourceText } : {}) };
    const fee = pick([null, 0, 0.1006, 0.000001, Number.NaN]);
    const spent = pick([0, 60, 99.95, 100]);
    const prior: LedgerEntry = {
      id: "led_prior",
      mandateId: m.id,
      mandateHash: W(99),
      proposal: { merchantId, amountUsd, memo: "earlier", requestedAt: now.toISOString() },
      decision: "APPROVE",
      reasons: [],
      feeUsd: 0.1,
      totalUsd: amountUsd + 0.1,
      status: pick(["settled", "pending", "approved", "failed", "stopped"] as const),
      at: new Date(now.getTime() - pick([60_000, 10 * 60_000])).toISOString(),
    };
    const recent = rand() < 0.5 ? [prior] : [];
    const decision = evaluate(p, {
      mandate: m,
      merchant: findMerchant(m, merchantId),
      spentUsd: spent,
      estimatedFeeUsd: fee,
      now,
      recent,
    });
    const entry = { decision: decision.decision, reasons: decision.decision === "STOP" ? decision.reasons : [] };
    const checks = deriveRuleChecks(entry);
    const want = expected(m, p, fee, spent, now, recent);
    assert.equal(checks.length, 12);
    for (const c of checks) {
      assert.equal(c.result, want[c.code], `#${i} ${c.code}: derived ${c.result}, condition says ${want[c.code]}`);
      seen.set(`${c.code}:${c.result}`, (seen.get(`${c.code}:${c.result}`) ?? 0) + 1);
    }
    if (decision.decision === "APPROVE") assert.ok(checks.every((c) => c.result === "passed"));
  }
  // Every reachable outcome was exercised at least once.
  for (const code of RULE_ORDER) {
    assert.ok(seen.get(`${code}:failed`), `${code} never failed`);
    assert.ok(seen.get(`${code}:passed`), `${code} never passed`);
  }
  for (const code of ["MERCHANT_NOT_ALLOWED", "CATEGORY_NOT_ALLOWED", "OVER_BUDGET_WITH_FEES"] as const) {
    assert.ok(seen.get(`${code}:not_evaluated`), `${code} never skipped`);
  }
});

const fixtureA = JSON.parse(
  readFileSync(resolve(__dirname, "../docs/fixtures/mandate-man_A.json"), "utf8"),
) as MandateDetailResponse;
const byId = (id: string): LedgerEntryView => fixtureA.ledger.find((e) => e.id === id)!;

test("fixture APPROVE (led_001) passed all 12 checks, in evaluate() order", () => {
  const checks = deriveRuleChecks(byId("led_001"));
  assert.deepEqual(
    checks.map((c) => c.code),
    [...RULE_ORDER],
  );
  assert.deepEqual(countRuleChecks(checks), { passed: 12, failed: 0, not_evaluated: 0 });
  assert.ok(checks.every((c) => c.localized === null && c.skippedBecause === null && c.reasons.length === 0));
});

test("fixture STOP with 3 reasons (led_003): exactly those 3 failed, 9 passed", () => {
  const checks = deriveRuleChecks(byId("led_003"));
  const failed = checks.filter((c) => c.result === "failed").map((c) => c.code);
  assert.deepEqual(failed, ["MERCHANT_NOT_ALLOWED", "CATEGORY_NOT_ALLOWED", "BLOCKED_KEYWORD"]);
  assert.deepEqual(countRuleChecks(checks), { passed: 9, failed: 3, not_evaluated: 0 });
  const m = checks.find((c) => c.code === "MERCHANT_NOT_ALLOWED")!;
  assert.equal(m.localized?.message, "Wine & Co is not on the permitted list.");
  assert.equal(m.title, "Merchant not permitted");
});

test("unknown merchant skips the merchant and category checks; unknown fee skips the budget check", () => {
  const checks = deriveRuleChecks({
    decision: "STOP",
    reasons: [
      { code: "UNKNOWN_MERCHANT", message: 'Merchant "m99" is not in the catalog.', observed: "m99" },
      { code: "FEE_UNAVAILABLE", message: "Network fee could not be estimated; refusing rather than guessing." },
    ],
  });
  const r = Object.fromEntries(checks.map((c) => [c.code, c.result]));
  assert.equal(r.UNKNOWN_MERCHANT, "failed");
  assert.equal(r.MERCHANT_NOT_ALLOWED, "not_evaluated");
  assert.equal(r.CATEGORY_NOT_ALLOWED, "not_evaluated");
  assert.equal(r.FEE_UNAVAILABLE, "failed");
  assert.equal(r.OVER_BUDGET_WITH_FEES, "not_evaluated");
  assert.equal(checks.find((c) => c.code === "OVER_BUDGET_WITH_FEES")!.skippedBecause, "FEE_UNAVAILABLE");
  assert.equal(checks.find((c) => c.code === "CATEGORY_NOT_ALLOWED")!.skippedBecause, "UNKNOWN_MERCHANT");
  assert.deepEqual(countRuleChecks(checks), { passed: 7, failed: 2, not_evaluated: 3 });
});

test("failed checks carry the localized reason in every language", () => {
  const e = byId("led_002"); // OVER_PER_TX_CAP, observed 85, limit 40
  const en = deriveRuleChecks(e, "en").find((c) => c.code === "OVER_PER_TX_CAP")!;
  assert.equal(en.localized?.message, "Single payment cap is $40.");
  assert.equal(en.localized?.detail, "observed $85.00 · limit $40.00");
  for (const locale of ["ko", "ja", "zh"] as const) {
    const c = deriveRuleChecks(e, locale).find((x) => x.code === "OVER_PER_TX_CAP")!;
    assert.equal(c.result, "failed");
    assert.ok(c.localized && c.localized.message.length > 0 && c.localized.message !== en.localized?.message, locale);
    assert.ok(c.localized?.detail?.includes("$85.00") && c.localized.detail.includes("$40.00"), locale);
    assert.notEqual(c.title, en.title, locale);
  }
});

test("derivation does not mutate the entry", () => {
  const e = structuredClone(byId("led_003"));
  const snapshot = structuredClone(e);
  deriveRuleChecks(e, "ko");
  assert.deepEqual(e, snapshot);
});

console.log(`\n${passed} rule-check tests passed`);
