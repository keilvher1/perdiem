/**
 * tests/db-error.test.ts — DbError text that reaches API error bodies carries no stack frames or
 * server paths (lib/db.ts cleanDetails). Offline: the inputs are the exact `details` strings
 * postgrest-js 2.117 builds for a network failure (dist/index.cjs, fetch catch).
 * Run: npx tsx --conditions=react-server tests/db-error.test.ts
 */
import assert from "node:assert/strict";
import { cleanDetails, DbError } from "../lib/db";
import { toErrorResponse } from "../app/api/_lib/http";

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

const refused =
  "TypeError: fetch failed\n\nCaused by: Error: connect ECONNREFUSED 127.0.0.1:59999 (ECONNREFUSED)\n" +
  "Error: connect ECONNREFUSED 127.0.0.1:59999\n    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1637:16)";
const badPort =
  "TypeError: fetch failed\n\nCaused by: Error: bad port\nError: bad port\n" +
  "    at makeNetworkError (node:internal/deps/undici/undici:9884:35)\n" +
  "    at fetch (/Users/someone/perdiem/lib/db.ts:82:39)\n" +
  "    at async fetchWithRetry (/Users/someone/perdiem/node_modules/@supabase/postgrest-js/src/fetchWithRetry.ts:93:13)";

async function main() {
  await test("network failure: one line, no frames, cause kept", () => {
    assert.equal(
      cleanDetails(refused),
      "TypeError: fetch failed | Caused by: Error: connect ECONNREFUSED 127.0.0.1:59999 (ECONNREFUSED) | Error: connect ECONNREFUSED 127.0.0.1:59999",
    );
  });

  await test("stack with absolute server paths: every `at` frame dropped", () => {
    const out = cleanDetails(badPort)!;
    assert.equal(out, "TypeError: fetch failed | Caused by: Error: bad port | Error: bad port");
    assert.ok(!out.includes("/Users/"));
  });

  await test("ordinary PostgREST details pass through; empty → null; capped at 300 chars", () => {
    assert.equal(cleanDetails('Key (id)=(led_1) already exists.'), 'Key (id)=(led_1) already exists.');
    assert.equal(cleanDetails(""), null);
    assert.equal(cleanDetails(null), null);
    assert.equal(cleanDetails(undefined), null);
    assert.equal(cleanDetails("x".repeat(1000))!.length, 300);
  });

  await test("the API error body built from such a DbError has no newline and no frame", async () => {
    const err = new DbError("listMandates", null, "TypeError: fetch failed", cleanDetails(badPort));
    const res = toErrorResponse(err, "test");
    assert.equal(res.status, 502);
    const body = (await res.json()) as { error: { code: string; message: string } };
    assert.equal(body.error.code, "DB_ERROR");
    assert.ok(!body.error.message.includes("\n"));
    assert.ok(!/\bat \S+ \(/.test(body.error.message));
    assert.ok(!body.error.message.includes("/Users/"));
  });

  console.log(`\n${passed} db-error tests passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
