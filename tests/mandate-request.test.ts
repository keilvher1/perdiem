/**
 * tests/mandate-request.test.ts — POST /api/mandates body validation + Mandate construction
 * (the part of the route that runs before the anchor tx). Run: npx tsx tests/mandate-request.test.ts
 */
import assert from "node:assert/strict";
import { mandateHash, type Merchant } from "../lib/policy";
import { buildMandate, CreateMandateSchema, unknownMerchantIds } from "../app/api/_lib/mandate";

const catalog: Merchant[] = [
  { id: "m1", name: "Yangjae Kitchen", category: "meal", wallet: "0x1111111111111111111111111111111111111111" },
  { id: "m7", name: "Starbucks aT Center", category: "meal", wallet: "0x7777777777777777777777777777777777777777" },
];
const wallet = "0x9999999999999999999999999999999999999999" as const;
const valid = {
  principal: "MICEMore Finance",
  traveler: "Mingyu",
  budgetUsd: 150,
  perTxCapUsd: 40,
  allowedMerchantIds: ["m1", "m7"],
  allowedCategories: ["meal"],
  blockedKeywords: ["wine"],
  startsAt: "2026-09-28T17:00:00+09:00",
  expiresAt: "2026-09-30T18:00",
};

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}
const issues = (body: unknown) => {
  const r = CreateMandateSchema.safeParse(body);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

test("accepts +09:00 offsets and datetime-local strings, normalizes to ISO Z", () => {
  const r = CreateMandateSchema.parse(valid);
  assert.equal(r.startsAt, "2026-09-28T08:00:00.000Z");
  assert.equal(r.expiresAt, new Date("2026-09-30T18:00").toISOString());
  assert.match(r.expiresAt, /Z$/);
});

test("rejects expiresAt <= startsAt", () => {
  assert.deepEqual(issues({ ...valid, expiresAt: valid.startsAt }), ["expiresAt"]);
});

test("rejects unparseable dates, non-positive money, string numbers, empty names", () => {
  assert.ok(issues({ ...valid, startsAt: "next tuesday" }).includes("startsAt"));
  assert.ok(issues({ ...valid, budgetUsd: 0 }).includes("budgetUsd"));
  assert.ok(issues({ ...valid, perTxCapUsd: "40" }).includes("perTxCapUsd"));
  assert.ok(issues({ ...valid, traveler: "  " }).includes("traveler"));
  assert.ok(issues({ ...valid, id: "man A!" }).includes("id"));
  const { principal: _omit, ...missing } = valid;
  void _omit;
  assert.ok(issues(missing).includes("principal"));
});

test("unknown merchant ids are reported", () => {
  const r = CreateMandateSchema.parse({ ...valid, allowedMerchantIds: ["m1", "m5", "m5"] });
  assert.deepEqual(r.allowedMerchantIds, ["m1", "m5"], "duplicates removed");
  assert.deepEqual(unknownMerchantIds(r, catalog), ["m5"]);
});

test("buildMandate: catalog snapshot, env wallet, status active, generated id", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  const m = buildMandate(CreateMandateSchema.parse(valid), catalog, wallet, now);
  assert.equal(m.id, `man_${now.getTime()}`);
  assert.equal(m.agentWallet, wallet);
  assert.equal(m.status, "active");
  assert.deepEqual(m.catalog, catalog);
  assert.notEqual(m.catalog[0], catalog[0], "catalog is copied");
  assert.match(mandateHash(m), /^0x[0-9a-f]{64}$/);
  assert.equal(buildMandate(CreateMandateSchema.parse({ ...valid, id: "man_custom" }), catalog, wallet, now).id, "man_custom");
});

console.log(`\n${passed} mandate-request tests passed`);
