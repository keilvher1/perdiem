/**
 * tests/audit.test.ts — GET /api/audit/[mandateId] counts the same checks as scripts/verify.ts
 * (app/api/_lib/audit.ts). Offline: the chain reads are fakes built from the records themselves.
 * Run: npx tsx --conditions=react-server tests/audit.test.ts
 *
 *   summary.total = (anchorTx ? 2 : 1) + 2 × ledger entries + 6 × ledger entries with a txHash
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Hex } from "viem";
import { findMerchant, mandateHash, receiptHash, type LedgerEntry, type Mandate } from "../lib/policy";
import type { SettlementStatus } from "../lib/chain";
import { auditRecords, type AuditChain, type AuditCheckName } from "../app/api/_lib/audit";

const ROOT = resolve(__dirname, "..");
const OTHER = "0x000000000000000000000000000000000000dEaD" as Hex;

type Memo = Awaited<ReturnType<AuditChain["readMemo"]>>;

/** A chain that tells the truth about `records`, with per-tx overrides. */
function honestChain(
  mandate: Mandate,
  anchorTx: Hex | null,
  ledger: LedgerEntry[],
  over: { memo?: Record<string, Partial<Memo> | Error>; status?: Record<string, SettlementStatus | Error> } = {},
): AuditChain {
  const h = mandateHash(mandate);
  const memos = new Map<string, Memo>();
  // Lower-case sender: the route must compare addresses case-insensitively (viem returns checksummed).
  if (anchorTx) memos.set(anchorTx, { from: mandate.agentWallet.toLowerCase() as Hex, to: mandate.agentWallet, valueUsd: 0, memo: `PERDIEM-MANDATE|${h}` });
  for (const e of ledger) {
    if (!e.txHash) continue;
    const m = findMerchant(mandate, e.proposal.merchantId);
    memos.set(e.txHash, { from: mandate.agentWallet.toLowerCase() as Hex, to: (m?.wallet ?? null) as Hex | null, valueUsd: e.proposal.amountUsd, memo: `PERDIEM|${h}|${receiptHash(e)}` });
  }
  return {
    async readMemo(tx) {
      const o = over.memo?.[tx];
      if (o instanceof Error) throw o;
      const base = memos.get(tx);
      if (!base) throw new Error(`unknown tx ${tx}`);
      return { ...base, ...o };
    },
    async getSettlementStatus(tx) {
      const o = over.status?.[tx];
      if (o instanceof Error) throw o;
      return o ?? { state: "settled", blockNumber: "1", gasUsed: "21000", actualFeeUsd: 0.0001 };
    },
  };
}

/** The ✅/❌ lines scripts/verify.ts prints for these records, as check names in its order. */
function verifyLines(anchorTx: Hex | null, ledger: LedgerEntry[]): AuditCheckName[] {
  const byAt = [...ledger].sort((a, b) => a.at.localeCompare(b.at)); // replayLedger order
  return [
    ...(anchorTx ? (["anchor.memo", "anchor.sender"] as const) : (["anchor.memo"] as const)),
    ...byAt.flatMap(() => ["entry.mandateHash", "entry.decision"] as const),
    ...ledger.filter((e) => e.txHash).flatMap(() => ["tx.receiptHash", "tx.memo", "tx.recipient", "tx.amount", "tx.sender", "tx.mined"] as const),
  ];
}

const formula = (anchorTx: Hex | null, ledger: LedgerEntry[]) => (anchorTx ? 2 : 1) + 2 * ledger.length + 6 * ledger.filter((e) => e.txHash).length;

// Synthetic records from docs/seed.json (decisions need not replay: only counts and chain checks are asserted).
const seed = JSON.parse(readFileSync(resolve(ROOT, "docs/seed.json"), "utf8")) as { mandates: Mandate[] };
const mandate: Mandate = { ...seed.mandates[0]!, id: "man_A_audit_test" };
const hash = mandateHash(mandate);
const ANCHOR = `0x${"aa".repeat(32)}` as Hex;
const TX1 = `0x${"11".repeat(32)}` as Hex;
const TX2 = `0x${"22".repeat(32)}` as Hex;
let n = 0;
function entry(merchantId: string, amountUsd: number, status: LedgerEntry["status"], txHash?: Hex): LedgerEntry {
  n += 1;
  const at = new Date(Date.UTC(2026, 8, 28, 12, n)).toISOString();
  const e: LedgerEntry = {
    id: `led_${n}`,
    mandateId: mandate.id,
    mandateHash: hash,
    proposal: { merchantId, amountUsd, memo: `test ${n}`, sourceText: `test ${n}`, requestedAt: at },
    decision: status === "stopped" ? "STOP" : "APPROVE",
    reasons: [],
    feeUsd: 0.0001,
    feeSource: "estimate",
    totalUsd: amountUsd + 0.0001,
    status,
    at,
  };
  if (txHash) e.txHash = txHash;
  e.receiptHash = receiptHash(e);
  return e;
}
const ledger = [entry("m1", 12, "settled", TX1), entry("m2", 85, "stopped"), entry("m7", 5, "pending", TX2), entry("m1", 7, "failed")];

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

async function main() {
  const quiet = { warn: () => {} };

  await test("verify.ts still prints 2|1 anchor, 2 per entry and 6 per tx lines (else update _lib/audit.ts)", async () => {
    const src = readFileSync(resolve(ROOT, "scripts/verify.ts"), "utf8");
    const s1 = src.indexOf("// 1."), s2 = src.indexOf("// 2."), s3 = src.indexOf("// 3."), end = src.indexOf("ALL RECORDS VERIFIED", s3);
    assert.ok(s1 > 0 && s2 > s1 && s3 > s2 && end > s3, "scripts/verify.ts sections // 1. // 2. // 3. not found");
    const marks = (a: number, b: number) => (src.slice(a, b).match(/\bmark\(/g) ?? []).length;
    assert.deepEqual([marks(s1, s2), marks(s2, s3), marks(s3, end)], [3, 2, 6], "scripts/verify.ts changed its checks: update app/api/_lib/audit.ts and this test");
  });

  await test("honest chain: total = formula, every check passes, same order as verify.ts", async () => {
    const r = await auditRecords(mandate, ANCHOR, ledger, { chain: honestChain(mandate, ANCHOR, ledger), ...quiet });
    assert.equal(r.summary.total, formula(ANCHOR, ledger));
    assert.equal(r.summary.total, 2 + 2 * 4 + 6 * 2);
    assert.deepEqual(r.checks.map((c) => c.check), verifyLines(ANCHOR, ledger));
    const chainChecks = r.checks.filter((c) => !c.check.startsWith("entry."));
    assert.ok(chainChecks.every((c) => c.ok), JSON.stringify(chainChecks.filter((c) => !c.ok)));
    assert.equal(r.anchor.matches, true);
    assert.equal(r.transactions.length, 2);
    assert.deepEqual(r.transactions.map((t) => t.entryId), ["led_1", "led_3"]);
  });

  await test("no anchorTx: one failed anchor check, like verify.ts", async () => {
    const r = await auditRecords(mandate, null, ledger, { chain: honestChain(mandate, null, ledger), ...quiet });
    assert.equal(r.summary.total, formula(null, ledger));
    assert.deepEqual(r.checks.filter((c) => c.check.startsWith("anchor")), [{ check: "anchor.memo", ok: false }]);
    assert.equal(r.summary.allVerified, false);
  });

  await test("anchor from another wallet: memo still matches, anchor.sender fails and is logged", async () => {
    const lines: string[] = [];
    const chain = honestChain(mandate, ANCHOR, ledger, { memo: { [ANCHOR]: { from: OTHER } } });
    const r = await auditRecords(mandate, ANCHOR, ledger, { chain, warn: (l) => lines.push(l) });
    assert.equal(r.anchor.matches, true);
    assert.deepEqual(r.checks.filter((c) => !c.ok && !c.check.startsWith("entry.")), [{ check: "anchor.sender", ok: false }]);
    assert.ok(lines.some((l) => JSON.parse(l).check === "anchor.sender"));
  });

  await test("payment from another wallet: TxCheck fields pass, tx.sender fails", async () => {
    const chain = honestChain(mandate, ANCHOR, ledger, { memo: { [TX1]: { from: OTHER } } });
    const r = await auditRecords(mandate, ANCHOR, ledger, { chain, ...quiet });
    const t = r.transactions[0]!;
    assert.ok(t.memoMatches && t.receiptHashMatches && t.recipientMatches && t.amountMatches);
    assert.deepEqual(r.checks.filter((c) => !c.ok && !c.check.startsWith("entry.")), [{ check: "tx.sender", entryId: "led_1", ok: false }]);
  });

  await test("tx.mined: pending, reverted and RPC error all fail (settled only passes)", async () => {
    const chain = honestChain(mandate, ANCHOR, ledger, { status: { [TX1]: { state: "failed", reason: "reverted" }, [TX2]: { state: "pending" } } });
    const r = await auditRecords(mandate, ANCHOR, ledger, { chain, ...quiet });
    assert.deepEqual(r.checks.filter((c) => c.check === "tx.mined").map((c) => c.ok), [false, false]);
    const r2 = await auditRecords(mandate, ANCHOR, ledger, { chain: honestChain(mandate, ANCHOR, ledger, { status: { [TX2]: new Error("rpc down") } }), ...quiet });
    assert.deepEqual(r2.checks.filter((c) => c.check === "tx.mined").map((c) => c.ok), [true, false]);
    assert.equal(r2.summary.total, formula(ANCHOR, ledger));
  });

  await test("readMemo RPC error: still 6 checks for that tx; receiptHash checked from the records", async () => {
    const chain = honestChain(mandate, ANCHOR, ledger, { memo: { [TX2]: new Error("rpc down") } });
    const r = await auditRecords(mandate, ANCHOR, ledger, { chain, ...quiet });
    assert.equal(r.summary.total, formula(ANCHOR, ledger));
    const tx2 = r.checks.filter((c) => c.entryId === "led_3" && c.check.startsWith("tx."));
    assert.deepEqual(tx2.map((c) => [c.check, c.ok]), [
      ["tx.receiptHash", true], ["tx.memo", false], ["tx.recipient", false], ["tx.amount", false], ["tx.sender", false], ["tx.mined", true],
    ]);
  });

  await test("tampered amount: receiptHash fails from the records, memo fails against the chain", async () => {
    const tampered = ledger.map((e) => (e.id === "led_1" ? { ...e, proposal: { ...e.proposal, amountUsd: 1 } } : e));
    const r = await auditRecords(mandate, ANCHOR, tampered, { chain: honestChain(mandate, ANCHOR, ledger), ...quiet });
    const bad = r.checks.filter((c) => !c.ok && c.entryId === "led_1" && c.check.startsWith("tx.")).map((c) => c.check);
    assert.deepEqual(bad, ["tx.receiptHash", "tx.memo", "tx.amount"]);
  });

  // The committed backend verification run (real Sepolia records): `npm run verify` on this pair printed 24 ✅.
  const mPath = resolve(ROOT, "evidence/mandate-man_A_mul19mde.json");
  const lPath = resolve(ROOT, "evidence/ledger-man_A_mul19mde.json");
  if (existsSync(mPath) && existsSync(lPath)) {
    await test("evidence man_A_mul19mde: 24 of 24, the count verify.ts prints", async () => {
      const { mandate: m, anchorTx } = JSON.parse(readFileSync(mPath, "utf8")) as { mandate: Mandate; anchorTx: Hex | null };
      const l = JSON.parse(readFileSync(lPath, "utf8")) as LedgerEntry[];
      const r = await auditRecords(m, anchorTx, l, { chain: honestChain(m, anchorTx, l), ...quiet });
      assert.deepEqual(r.summary, { passed: 24, total: 24, allVerified: true });
      assert.deepEqual(r.checks.map((c) => c.check), verifyLines(anchorTx, l));
    });
  } else {
    console.log("skip - evidence/{mandate,ledger}-man_A_mul19mde.json not present");
  }

  console.log(`audit tests: OK (${passed})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
