/**
 * GET /api/fx → FxRates (lib/fx/normalize.ts): today's exchange rates against USD, for converting a
 * bill total into the USD amount of a request and for display equivalents ("≈ ₩16,300").
 *
 *   200 { base: "USD", date, rates: { KRW: 1358.97, … }, source: { name, url, attribution? }, fetchedAt }
 *   503 { error: { code: "FX_UNAVAILABLE", message } }  both feeds failed and nothing usable is cached
 *
 * Primary feed ExchangeRate-API (open access), fallback Frankfurter (ECB reference rates); both are
 * validated by the pure normalisers, and a rate is never invented or defaulted. Rates are kept in
 * memory for an hour (and the upstream fetch uses the Data Cache with revalidate 3600 s). If a refresh
 * fails, the last good rates are served while they are less than 72 h old (their `date` is shown next
 * to every conversion). Settlement is unaffected: mandates, policy, ledger and payments stay in USD.
 *
 * Same origin as the app, so it sits behind the site's Basic auth (proxy.ts) like every other route.
 */
import { connection, NextResponse } from "next/server";
import type { ApiError } from "@/contracts/api";
import { ER_API_URL, FRANKFURTER_URL, normalizeErApi, normalizeFrankfurter, type FxRates } from "@/lib/fx/normalize";

export const runtime = "nodejs";

const TTL_MS = 60 * 60 * 1000;
/** After both feeds failed, wait this long before trying them again. */
const RETRY_MS = 60 * 1000;
/** Last good rates are served on a failed refresh while younger than this. */
const STALE_MAX_MS = 72 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

let cache: { expires: number; body: FxRates } | null = null;
let failedUntil = 0;
let lastError = "";
let inflight: Promise<FxRates> | null = null;

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function reason(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function load(): Promise<FxRates> {
  const fetchedAt = new Date().toISOString();
  const errors: string[] = [];
  try {
    return normalizeErApi(await fetchJson(ER_API_URL), fetchedAt);
  } catch (err) {
    errors.push(`ExchangeRate-API: ${reason(err)}`);
  }
  try {
    return normalizeFrankfurter(await fetchJson(FRANKFURTER_URL), fetchedAt);
  } catch (err) {
    errors.push(`Frankfurter: ${reason(err)}`);
  }
  throw new Error(errors.join("; "));
}

function ok(body: FxRates) {
  // Private: the response is behind the site login. Five minutes in the browser; the server keeps an hour.
  return NextResponse.json<FxRates>(body, { headers: { "Cache-Control": "private, max-age=300" } });
}

function unavailable(message: string) {
  return NextResponse.json<ApiError>(
    { error: { code: "FX_UNAVAILABLE", message: `Exchange rates are unavailable (${message}).` } },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() {
  // Request time, not build time; fetch keeps its revalidate (force-dynamic would turn it off).
  await connection();
  const now = Date.now();
  if (cache && cache.expires > now) return ok(cache.body);

  const stale = cache && now - new Date(cache.body.fetchedAt).getTime() < STALE_MAX_MS ? cache.body : null;
  if (now < failedUntil) return stale ? ok(stale) : unavailable(lastError);

  if (!inflight) {
    inflight = load().finally(() => {
      inflight = null;
    });
  }
  try {
    const body = await inflight;
    cache = { expires: Date.now() + TTL_MS, body };
    failedUntil = 0;
    return ok(body);
  } catch (err) {
    lastError = reason(err);
    failedUntil = Date.now() + RETRY_MS;
    console.error(JSON.stringify({ kind: "api_error", route: "GET /api/fx", code: "FX_UNAVAILABLE", message: lastError }));
    return stale ? ok(stale) : unavailable(lastError);
  }
}
