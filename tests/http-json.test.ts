/**
 * tests/http-json.test.ts — JSON bodies are accepted only as `Content-Type: application/json` and
 * never from a cross-site page (app/api/_lib/http.ts readJson, used by POST /api/chat,
 * POST /api/mandates, PATCH /api/mandates/[id]). Offline, no env needed.
 * Run: npx tsx --conditions=react-server tests/http-json.test.ts
 */
import assert from "node:assert/strict";
import { z } from "zod";
import { HttpError, readJson } from "../app/api/_lib/http";

const Schema = z.object({ mandateId: z.string().min(1), text: z.string().min(1) });
const body = JSON.stringify({ mandateId: "man_A", text: "lunch $12" });

function req(headers: Record<string, string>, b: string = body): Request {
  return new Request("http://localhost:3001/api/chat", { method: "POST", headers, body: b });
}

async function code(r: Request): Promise<string> {
  try {
    await readJson(r, Schema);
    return "OK";
  } catch (err) {
    assert.ok(err instanceof HttpError);
    assert.equal(err.status, 400);
    return err.code;
  }
}

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

async function main() {
  await test("application/json (any case, with charset) is accepted", async () => {
    assert.equal(await code(req({ "content-type": "application/json" })), "OK");
    assert.equal(await code(req({ "content-type": "Application/JSON; charset=UTF-8" })), "OK");
    assert.equal(await code(req({ "content-type": "application/json", "sec-fetch-site": "same-origin" })), "OK");
    assert.equal(await code(req({ "content-type": "application/json", "sec-fetch-site": "none" })), "OK");
  });

  await test("CORS-safelisted types (no preflight) are refused before the body is parsed", async () => {
    assert.equal(await code(req({ "content-type": "text/plain;charset=UTF-8" })), "UNSUPPORTED_MEDIA_TYPE");
    // what <form enctype="text/plain"> sends: still valid JSON after zod strips the pad key
    const formBody = '{"mandateId":"man_A","text":"lunch $12","pad":"="}';
    assert.equal(await code(req({ "content-type": "text/plain" }, formBody)), "UNSUPPORTED_MEDIA_TYPE");
    assert.equal(await code(req({ "content-type": "application/x-www-form-urlencoded" })), "UNSUPPORTED_MEDIA_TYPE");
    assert.equal(await code(req({ "content-type": "multipart/form-data; boundary=x" })), "UNSUPPORTED_MEDIA_TYPE");
    assert.equal(await code(req({ "content-type": "application/jsonp" })), "UNSUPPORTED_MEDIA_TYPE");
    assert.equal(await code(new Request("http://localhost:3001/api/chat", { method: "POST", body: new Blob([body]) })), "UNSUPPORTED_MEDIA_TYPE");
  });

  await test("a request the browser marks cross-site is refused even with application/json", async () => {
    assert.equal(await code(req({ "content-type": "application/json", "sec-fetch-site": "cross-site", origin: "https://evil.example" })), "CROSS_SITE");
  });

  await test("existing behaviour kept: bad JSON → INVALID_JSON, bad shape → VALIDATION_FAILED", async () => {
    assert.equal(await code(req({ "content-type": "application/json" }, "{not json")), "INVALID_JSON");
    assert.equal(await code(req({ "content-type": "application/json" }, '{"mandateId":"","text":"x"}')), "VALIDATION_FAILED");
  });

  console.log(`\n${passed} http-json tests passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
