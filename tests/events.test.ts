/**
 * tests/events.test.ts — the JSON log lines the evidence tooling parses (app/api/_lib/events.ts):
 * one "decision" line per ledger entry even when the ledger write fails, and "mandate_status" lines
 * that scripts/metrics.ts can find by their `{"kind":"mandate_status"` prefix. Offline, no env.
 * Run: npx tsx --conditions=react-server tests/events.test.ts
 */
import assert from "node:assert/strict";
import type { Hex } from "viem";
import { DbError } from "../lib/db";
import type { LedgerEntry } from "../lib/policy";
import { decisionEvent, logEvent, trackDecision, type LogEvent } from "../app/api/_lib/events";
import { HttpError } from "../app/api/_lib/http";
import { createLedgerWriter } from "../app/api/_lib/ledger-write";

const TX = `0x${"ab".repeat(32)}` as Hex;
function entry(status: LedgerEntry["status"], txHash?: Hex): LedgerEntry {
  const e: LedgerEntry = {
    id: `led_${status}`,
    mandateId: "man_A",
    mandateHash: `0x${"cd".repeat(32)}`,
    proposal: { merchantId: "m1", amountUsd: 12, memo: "lunch", requestedAt: "2026-09-28T03:00:00.000Z" },
    decision: status === "stopped" ? "STOP" : "APPROVE",
    reasons: status === "stopped" ? [{ code: "OVER_PER_TX_CAP", message: "over cap" }] : [],
    feeUsd: 0.01,
    feeSource: "estimate",
    totalUsd: 12.01,
    status,
    receiptHash: `0x${"ef".repeat(32)}`,
    kilnResponseId: "chatcmpl-1",
    at: "2026-09-28T03:00:01.000Z",
  };
  if (txHash) e.txHash = txHash;
  return e;
}

/** What scripts/metrics.ts extractJson(line, kind) keys on. */
const startsKind = (line: string, kind: string) => line.includes(`{"kind":"${kind}"`);
const lineOf = (e: LogEvent) => {
  let out = "";
  logEvent(e, (l) => (out = l));
  return out;
};

let passed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

async function main() {
  await test("decision line: exact keys and order, APPROVE carries its txHash", () => {
    const line = lineOf(decisionEvent("man_A", entry("pending", TX), true));
    assert.equal(
      line,
      `{"kind":"decision","mandateId":"man_A","entryId":"led_pending","decision":"APPROVE","codes":[],"status":"pending","txHash":"${TX}","kilnResponseId":"chatcmpl-1","at":"2026-09-28T03:00:01.000Z","recorded":true}`,
    );
  });

  await test("decision line: STOP has codes and txHash null", () => {
    const o = decisionEvent("man_A", entry("stopped"), true);
    assert.deepEqual([o.decision, o.codes, o.txHash, o.status], ["STOP", ["OVER_PER_TX_CAP"], null, "stopped"]);
  });

  await test("trackDecision: no entry → null; saved → recorded true", async () => {
    const t = trackDecision(async () => {});
    assert.equal(t.decided(), null);
    const e = entry("stopped");
    await t.save(e);
    assert.deepEqual(t.decided(), { entry: e, recorded: true });
  });

  await test("broadcast payment whose ledger write fails: 502 PAYMENT_NOT_RECORDED, still one decision line (recorded:false)", async () => {
    const logs: string[] = [];
    const writer = createLedgerWriter({
      save: async () => {
        throw new DbError("saveEntry", null, "TypeError: fetch failed");
      },
      retryDelayMs: 0,
      log: (l) => logs.push(l),
    });
    const t = trackDecision(writer.saveDecision);
    const e = entry("pending", TX);
    // What app/api/chat/route.ts does: try { handleTravelerMessage(...saveEntry: t.save) } finally { log decision }
    const lines: string[] = [];
    await assert.rejects(
      (async () => {
        try {
          await t.save(e);
        } finally {
          const d = t.decided();
          if (d) logEvent(decisionEvent("man_A", d.entry, d.recorded), (l) => lines.push(l));
        }
      })(),
      (err: unknown) => err instanceof HttpError && err.status === 502 && err.code === "PAYMENT_NOT_RECORDED",
    );
    assert.equal(lines.length, 1);
    const o = JSON.parse(lines[0]!);
    assert.deepEqual([o.kind, o.decision, o.txHash, o.recorded], ["decision", "APPROVE", TX, false]);
    assert.ok(logs.some((l) => startsKind(l, "ledger_write_failed")));
  });

  await test("mandate_status lines (pause, resume, revoke, no-op) carry mandateId/from/to/changed/at", () => {
    const at = "2026-09-28T12:00:00.000Z";
    for (const [from, to] of [["active", "paused"], ["paused", "active"], ["active", "revoked"], ["revoked", "revoked"]] as const) {
      const line = lineOf({ kind: "mandate_status", mandateId: "man_A", from, to, changed: from !== to, at });
      assert.ok(startsKind(line, "mandate_status"));
      assert.deepEqual(Object.keys(JSON.parse(line)), ["kind", "mandateId", "from", "to", "changed", "at"]);
    }
  });

  await test("a refused PATCH is not picked up as a mandate_status line", () => {
    const line = lineOf({ kind: "mandate_status_refused", mandateId: "man_A", from: "revoked", to: "active", code: "MANDATE_REVOKED", at: "2026-09-28T12:00:00.000Z" });
    assert.ok(startsKind(line, "mandate_status_refused"));
    assert.equal(startsKind(line, "mandate_status"), false);
  });

  console.log(`${passed} events tests passed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
