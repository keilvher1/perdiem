import "server-only";
/**
 * app/api/_lib/http.ts — shared helpers for every Route Handler (not a route: `_lib` is a private folder).
 * Errors always leave as `ApiError` (contracts/api.ts) with a non-2xx status:
 *   400 validation | 404 not found | 409 state conflict | 502 upstream (Supabase, Kiln, Sepolia RPC).
 */
import { NextResponse } from "next/server";
import { OpenAIError } from "openai";
import { BaseError as ViemError } from "viem";
import type { z } from "zod";
import type { ApiError } from "@/contracts/api";
import { DbError } from "@/lib/db";

export type ApiErrorStatus = 400 | 404 | 409 | 500 | 502;

export function apiError(status: ApiErrorStatus, code: string, message: string, details?: unknown): NextResponse<ApiError> {
  const body: ApiError = { error: details === undefined ? { code, message } : { code, message, details } };
  return NextResponse.json<ApiError>(body, { status });
}

/** Thrown inside handlers to leave early with a typed ApiError response. */
export class HttpError extends Error {
  constructor(
    readonly status: ApiErrorStatus,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Which dependency failed: Supabase, Kiln (OpenAI SDK) or the Sepolia RPC (viem). */
export function upstreamCode(err: unknown): "DB_ERROR" | "KILN_ERROR" | "RPC_ERROR" | null {
  if (err instanceof DbError) return "DB_ERROR";
  if (err instanceof OpenAIError) return "KILN_ERROR";
  if (err instanceof ViemError) return "RPC_ERROR";
  return null;
}

/**
 * Maps anything thrown by a handler to an ApiError response. Upstream failures (db, Kiln, RPC)
 * are 502 — the request was fine, a dependency was not; anything else is a 500.
 * Logged as one JSON line for the dev log.
 */
export function toErrorResponse(err: unknown, route: string): NextResponse<ApiError> {
  if (err instanceof HttpError) return apiError(err.status, err.code, err.message, err.details);
  const code = upstreamCode(err);
  const message = err instanceof ViemError ? err.shortMessage : errorMessage(err);
  console.error(JSON.stringify({ kind: "api_error", route, code: code ?? "INTERNAL_ERROR", message }));
  return code ? apiError(502, code, message) : apiError(500, "INTERNAL_ERROR", message);
}

/** Every route answers fresh JSON and runs on Node (viem, supabase-js, secrets). */
export function noStore<T>(res: NextResponse<T>): NextResponse<T> {
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/**
 * Reads and validates a JSON body. Throws HttpError(400) with zod issues as details.
 *
 * Only `Content-Type: application/json` is accepted: a cross-site page can send text/plain or a
 * form without a CORS preflight, but not application/json (the preflight gets no CORS headers
 * here), so a page open in the operator's browser cannot trigger Kiln calls, payments or anchor
 * txs. A request the browser labels `Sec-Fetch-Site: cross-site` is refused too (defense in
 * depth). Every caller (lib/api-client.ts, scripts/scenario.ts, scripts/capture.ts) sends JSON.
 */
export async function readJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.output<S>> {
  const type = (req.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (type !== "application/json") {
    throw new HttpError(400, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
  }
  if ((req.headers.get("sec-fetch-site") ?? "").toLowerCase() === "cross-site") {
    throw new HttpError(400, "CROSS_SITE", "Cross-site requests are not accepted.");
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first && first.path.length > 0 ? `${first.path.join(".")}: ` : "";
    throw new HttpError(400, "VALIDATION_FAILED", `${where}${first?.message ?? "invalid body"}`, parsed.error.issues);
  }
  return parsed.data;
}
