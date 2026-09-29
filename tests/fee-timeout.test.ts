/** withTimeout (lib/agent.ts): the bound on the fee estimate inside a chat request. */
import assert from "node:assert/strict";
import { FEE_TIMEOUT_MS, withTimeout } from "../lib/agent";

(async () => {
  assert.equal(FEE_TIMEOUT_MS, 15_000);
  assert.equal(await withTimeout(Promise.resolve(42), 50), 42);
  await assert.rejects(withTimeout(new Promise(() => {}), 30), /timed out after 30 ms/);
  await assert.rejects(withTimeout(Promise.reject(new Error("rpc down")), 50), /rpc down/);
  const t0 = Date.now();
  await withTimeout(new Promise((r) => setTimeout(() => r("late-ok"), 20)), 200);
  assert.ok(Date.now() - t0 < 150, "resolves as soon as the promise does");
  console.log("ok - withTimeout: resolves, times out, passes rejections through");
  console.log("\n1 fee-timeout test passed");
})();
