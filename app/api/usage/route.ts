/**
 * GET /api/usage → UsageResponse: tokens and cost by flow (usage_by_flow_v), totals, 0-token call
 * counts, the energy estimate (only with a stated assumption) and the reasoning comparison
 * (docs/reasoning-comparison.json, written by scripts/compare-reasoning.ts, when present).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import type { EnergyEstimate, ReasoningComparison, UsageResponse } from "@/contracts/api";
import { usageByFlow, usageTotals } from "@/lib/db";
import { errorMessage, noStore, toErrorResponse } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readComparison(): Promise<ReasoningComparison | null> {
  let raw: string;
  try {
    raw = await readFile(join(process.cwd(), "docs", "reasoning-comparison.json"), "utf8");
  } catch {
    return null; // not measured yet
  }
  try {
    const parsed = JSON.parse(raw) as ReasoningComparison;
    if (!Array.isArray(parsed?.rows) || typeof parsed?.summary !== "object" || parsed.summary === null) {
      throw new Error("missing rows[] or summary");
    }
    return parsed;
  } catch (err) {
    console.warn(JSON.stringify({ kind: "usage_warning", message: `docs/reasoning-comparison.json ignored: ${errorMessage(err)}` }));
    return null;
  }
}

function energy(totalTokens: number): EnergyEstimate {
  const v = parseFloat(process.env.ENERGY_J_PER_TOKEN ?? "");
  const assumedJPerToken = v > 0 ? v : null;
  return {
    assumedJPerToken,
    source: process.env.ENERGY_SOURCE || null,
    totalTokens,
    totalWh: assumedJPerToken === null ? null : (totalTokens * assumedJPerToken) / 3600,
  };
}

export async function GET() {
  try {
    const [byFlow, comparison] = await Promise.all([usageByFlow(), readComparison()]);
    const totals = await usageTotals(byFlow);
    const calls = (flow: string) => byFlow.find((r) => r.flow === flow)?.calls ?? 0;
    const body: UsageResponse = {
      byFlow,
      totals,
      zeroTokenCalls: { statusFastpath: calls("status_fastpath"), stopTemplate: calls("stop_template") },
      energy: energy(totals.totalTokens),
      comparison,
    };
    return noStore(NextResponse.json<UsageResponse>(body));
  } catch (err) {
    return toErrorResponse(err, "GET /api/usage");
  }
}
