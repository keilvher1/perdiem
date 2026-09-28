/**
 * tests/ledger-write.test.ts — the ledger write that follows a broadcast in POST /api/chat
 * (app/api/_lib/ledger-write.ts). No DB, no chain: `save` is a fake that fails on demand.
 * Run: npx tsx --conditions=react-server tests/ledger-write.test.ts
 */
import assert from "node:assert/strict";
import type { Hex } from "viem";
import { DbError } from "../lib/db";
import type { LedgerEntry } from "../lib/policy";
import { HttpError, toErrorResponse } from "../app/api/_lib/http";
import { createLedgerWriter } from "../app/api/_lib/ledger-write";

const TX = `0x${"ab".repeat(32)}` as Hex;
let n = 0;
function entry(status: LedgerEntry["status"], txHash?: Hex, mandateId = "man_A"): LedgerEntry {
  n += 1;
  const e: LedgerEntry = {
    id: `led_${n}`,
    mandateId,
    mandateHash: `0x${"cd".repeat(32)}`,
    proposal: { merchantId: "m1", amountUsd: 12, memo: "lunch", requestedAt: "2026-09-28T03:00:00.000Z" },
    decision: status === "stopped" ? "STOP" : "APPROVE",
    reasons: [],
    feeUsd: 0.01,
    feeSource: "estimate",
    totalUsd: 12.01,
    status,
    receiptHash: `0x${"ef".repeat(32)}`,
    at: "2026-09-28T03:00:00.000Z",
  };
  if (txHash) e.txHash = txHash;
  return e;
}

const netDown = () => new DbError("saveEntry", null, "TypeError: fetch failed");
const dup = () => new DbError("saveEntry", "23505", 'duplicate key value violates unique constraint "ledger_entries_pkey"');

/** A fake DB: `plan` is consumed one outcome per save() call; afterwards every save succeeds. */
function fakeDb(plan: Array<"ok" | "down" | "dup">) {
  const rows = new Map<string, LedgerEntry>();
  const calls: string[] = [];
  const save = async (e: LedgerEntry) => {
    const next = plan.shift() ?? "ok";
    calls.push(`${e.id}:${next}`);
    if (next === "down") throw netDown();
    if (next === "dup" || rows.has(e.id)) throw dup();
    rows.set(e.id, e);
  };
  return { rows, calls, save };
}

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

async function main() {
  const quiet = () => {};

  await test("first write ok → one insert, nothing kept", async () => {
    const db = fakeDb(["ok"]);
    const w = createLedgerWriter({ save: db.save, retryDelayMs: 0, log: quiet });
    const e = entry("pending", TX);
    await w.saveDecision(e);
    assert.equal(db.rows.size, 1);
    assert.deepEqual(w.unrecorded("man_A"), []);
  });

  await test("first write fails, retry ok → saved, nothing kept", async () => {
    const db = fakeDb(["down", "ok"]);
    const w = createLedgerWriter({ save: db.save, retryDelayMs: 0, log: quiet });
    const e = entry("pending", TX);
    await w.saveDecision(e);
    assert.ok(db.rows.has(e.id));
    assert.equal(db.calls.length, 2);
  });

  await test("first insert committed but its response was lost → 23505 on retry counts as saved", async () => {
    const db = fakeDb([]);
    let firstCall = true;
    const save = async (e: LedgerEntry) => {
      await db.save(e); // commits
      if (firstCall) {
        firstCall = false;
        throw netDown(); // …but the response never arrives
      }
    };
    const w = createLedgerWriter({ save, retryDelayMs: 0, log: quiet });
    const e = entry("pending", TX);
    await w.saveDecision(e); // must NOT throw
    assert.ok(db.rows.has(e.id));
    assert.deepEqual(w.unrecorded("man_A"), []);
  });

  await test("broadcast payment + both writes fail → 502 PAYMENT_NOT_RECORDED with txHash, entry kept, logged", async () => {
    const db = fakeDb(["down", "down"]);
    const lines: string[] = [];
    const w = createLedgerWriter({ save: db.save, retryDelayMs: 0, log: (l) => lines.push(l) });
    const e = entry("pending", TX);
    const err = await w.saveDecision(e).then(
      () => null,
      (x: unknown) => x,
    );
    assert.ok(err instanceof HttpError, "an HttpError, not a bare DbError");
    assert.equal(err.status, 502);
    assert.equal(err.code, "PAYMENT_NOT_RECORDED");
    assert.match(err.message, /Do not retry/);
    assert.deepEqual(err.details, { txHash: TX, entryId: e.id });
    assert.deepEqual(w.unrecorded("man_A").map((x) => x.id), [e.id]);
    const logged = JSON.parse(lines[0]!) as { kind: string; txHash: string; entry: LedgerEntry };
    assert.equal(logged.kind, "ledger_write_failed");
    assert.equal(logged.txHash, TX);
    assert.equal(logged.entry.id, e.id);

    // What the route answers (toErrorResponse passes HttpError through).
    const res = toErrorResponse(err, "POST /api/chat");
    assert.equal(res.status, 502);
    const body = (await res.json()) as { error: { code: string; details: { txHash: string } } };
    assert.equal(body.error.code, "PAYMENT_NOT_RECORDED");
    assert.equal(body.error.details.txHash, TX);
  });

  await test("STOP / failed broadcast (no txHash) + both writes fail → the DbError is rethrown, nothing kept", async () => {
    for (const status of ["stopped", "failed"] as const) {
      const db = fakeDb(["down", "down"]);
      const w = createLedgerWriter({ save: db.save, retryDelayMs: 0, log: quiet });
      const e = entry(status);
      await assert.rejects(w.saveDecision(e), (x: unknown) => x instanceof DbError && !x.isDuplicate);
      assert.deepEqual(w.unrecorded("man_A"), []);
    }
  });

  await test("unrecorded payment blocks the next request with 409 LEDGER_UNRECONCILED while the DB is down", async () => {
    const db = fakeDb(["down", "down", "down"]);
    const w = createLedgerWriter({ save: db.save, retryDelayMs: 0, log: quiet });
    const e = entry("pending", TX);
    await assert.rejects(w.saveDecision(e), (x: unknown) => x instanceof HttpError && x.code === "PAYMENT_NOT_RECORDED");
    await assert.rejects(w.reconcile("man_A"), (x: unknown) => {
      assert.ok(x instanceof HttpError);
      assert.equal(x.status, 409);
      assert.equal(x.code, "LEDGER_UNRECONCILED");
      assert.deepEqual(x.details, { txHash: TX, entryId: e.id });
      return true;
    });
    assert.equal(db.rows.size, 0);
    assert.equal(w.unrecorded("man_A").length, 1, "still kept");
    await w.reconcile("man_B"); // other mandates are not blocked
  });

  await test("DB back → reconcile writes the kept payment once, then new requests pass", async () => {
    const db = fakeDb(["down", "down"]);
    const w = createLedgerWriter({ save: db.save, retryDelayMs: 0, log: quiet });
    const e = entry("pending", TX);
    await assert.rejects(w.saveDecision(e));
    await w.reconcile("man_A"); // DB is back (plan exhausted → ok)
    assert.ok(db.rows.has(e.id));
    assert.equal(db.rows.get(e.id)!.txHash, TX);
    assert.deepEqual(w.unrecorded("man_A"), []);
    await w.reconcile("man_A"); // no-op
    assert.equal(db.calls.filter((c) => c.startsWith(e.id)).length, 3, "2 failed + 1 reconcile, no extra insert");
  });

  await test("reconcile tolerates a row that did get written (23505) and drops it from the backlog", async () => {
    const db = fakeDb(["down", "down", "dup"]);
    const w = createLedgerWriter({ save: db.save, retryDelayMs: 0, log: quiet });
    const e = entry("pending", TX);
    await assert.rejects(w.saveDecision(e));
    await w.reconcile("man_A");
    assert.deepEqual(w.unrecorded("man_A"), []);
  });

  console.log(`\n${passed} ledger-write tests passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
