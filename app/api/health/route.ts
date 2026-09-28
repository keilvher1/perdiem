/**
 * GET /api/health → HealthResponse.
 * Calls Kiln GET /models directly (never assertModelAvailable, which throws) and reads the agent
 * wallet balance, and probes Supabase (no retries). Partial failures still answer 200 with the
 * reason in `errors[]` (`ok` = model available && balance known, per the contract).
 * The layout calls this on every page, so results are cached in module scope for 60 s
 * (15 s when something failed, so a transient outage does not stick for a whole minute).
 */
import { NextResponse } from "next/server";
import type { HealthResponse, Hex } from "@/contracts/api";
import { kiln, KILN_MODEL } from "@/lib/kiln";
import { agentAccount, agentBalanceUsd, DEMO_ETH_USD } from "@/lib/chain";
import { dbProbe } from "@/lib/db";
import { errorMessage } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_OK_MS = 60_000;
const TTL_DEGRADED_MS = 15_000;
/** Below this the demo cannot pay for the scripted runs; surfaced as a non-fatal error. */
const LOW_BALANCE_USD = 40;

let cache: { expires: number; body: HealthResponse } | null = null;
let inflight: Promise<HealthResponse> | null = null;

function describe(prefix: string, err: unknown): string {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" ? `${prefix}: ${status} ${errorMessage(err)}` : `${prefix}: ${errorMessage(err)}`;
}

async function compute(): Promise<HealthResponse> {
  const errors: string[] = [];

  let agentAddress: Hex | null = null;
  try {
    agentAddress = agentAccount().address;
  } catch (err) {
    errors.push(describe("wallet", err));
  }

  const [modelsRes, balanceRes, dbRes] = await Promise.allSettled([
    kiln.models.list(),
    agentAddress ? agentBalanceUsd() : Promise.reject(new Error("no agent wallet")),
    dbProbe(),
  ]);
  if (dbRes.status === "rejected") errors.push(describe("db", dbRes.reason));

  let models: string[] = [];
  if (modelsRes.status === "fulfilled") {
    models = modelsRes.value.data.map((m) => m.id);
  } else {
    errors.push(describe("kiln", modelsRes.reason));
  }
  const modelAvailable = models.includes(KILN_MODEL);
  if (modelsRes.status === "fulfilled" && !modelAvailable) {
    errors.push(`kiln: model ${KILN_MODEL} not in GET /models (${models.join(", ") || "empty"})`);
  }

  let balanceEth: string | null = null;
  let balanceUsd: number | null = null;
  if (balanceRes.status === "fulfilled") {
    balanceEth = balanceRes.value.eth;
    balanceUsd = balanceRes.value.usd;
    if (balanceUsd < LOW_BALANCE_USD) errors.push(`low balance: ${balanceEth} ETH`);
  } else if (agentAddress) {
    errors.push(describe("chain", balanceRes.reason));
  }

  return {
    ok: modelAvailable && balanceUsd !== null,
    model: KILN_MODEL,
    models,
    modelAvailable,
    agentAddress,
    balanceEth,
    balanceUsd,
    demoEthUsd: DEMO_ETH_USD,
    chain: "sepolia",
    rpc: process.env.SEPOLIA_RPC_URL ? "custom" : "publicnode",
    errors,
  };
}

export async function GET() {
  const now = Date.now();
  if (cache && cache.expires > now) return NextResponse.json<HealthResponse>(cache.body);
  // Collapse concurrent cold requests into one Kiln + RPC round trip.
  inflight ??= compute().finally(() => {
    inflight = null;
  });
  const body = await inflight;
  cache = { expires: Date.now() + (body.errors.length === 0 ? TTL_OK_MS : TTL_DEGRADED_MS), body };
  return NextResponse.json<HealthResponse>(body);
}
