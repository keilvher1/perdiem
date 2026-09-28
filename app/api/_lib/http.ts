import "server-only";
/**
 * app/api/_lib/http.ts — shared helpers for every Route Handler (not a route: `_lib` is a private folder).
 * Errors always leave as `ApiError` (contracts/api.ts) with a non-2xx status:
 *   400 validation | 404 not found | 409 state conflict | 502 upstream (Supabase, Kiln, Sepolia RPC).
 */
import { NextResponse } from "next/server";
import type { z } from "zod";
import type { ApiError } from "@/contracts/api";

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

/**
 * Maps anything thrown by a handler to an ApiError response. Upstream failures (db, Kiln, RPC)
 * are 502 — the request was fine, a dependency was not. Logged as one JSON line for the dev log.
 */
export function toErrorResponse(err: unknown, route: string, upstreamCode = "UPSTREAM_ERROR"): NextResponse<ApiError> {
  if (err instanceof HttpError) return apiError(err.status, err.code, err.message, err.details);
  const message = errorMessage(err);
  console.error(JSON.stringify({ kind: "api_error", route, code: upstreamCode, message }));
  return apiError(502, upstreamCode, message);
}

/** Reads and validates a JSON body. Throws HttpError(400) with zod issues as details. */
export async function readJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.output<S>> {
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
