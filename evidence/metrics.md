# PerDiem — metrics

Generated 2026-09-28T13:11:30.135Z by `scripts/metrics.ts` from `http://localhost:3000/api/usage` (all rows in `usage_records`).

Scope: every call ever recorded in this database (development, integration, evidence run, video takes), not one server session, so the call counts differ from `kiln-calls-by-flow.md` (built from the server log) by design. The `compare` flow appears here only if `npm run compare -- --save` was run.

## Tokens by flow

| Flow | What it is | Calls | Prompt | Completion | Total | Cost (USD) | Avg latency (ms) |
|---|---|---:|---:|---:|---:|---:|---:|
| `propose` | one model call per purchase request | 21 | 9,828 | 969 | 10,797 | $0.000685 | 1287 |
| `status_fastpath` | no model — answered from the ledger | 3 | 0 | 0 | 0 | $0.000000 | — |
| `stop_template` | no model — refusal templated from reasons | 15 | 0 | 0 | 0 | $0.000000 | — |
| **Total** | | **39** | **9,828** | **969** | **10,797** | **$0.000685** | |

Inference avoided: 3 status question(s) and 15 refusal explanation(s) were handled with 0 tokens.

## Thinking on vs off (propose step)

Measured 2026-09-28T09:12:29.986Z on `qwen3-32b`, same system prompt and tool as production; thinking off = user text + ` /no_think`.

| Prompt | Tool call on / off | Completion on | Completion off | Latency on (ms) | Latency off (ms) | Cost on | Cost off |
|---|---|---:|---:|---:|---:|---:|---:|
| Order a bibimbap lunch from Yangjae Kitchen, $12 | ✓ / ✓ | 154 | 47 | 3619 | 1279 | $0.000062 | $0.000032 |
| Taxi to Incheon airport, about $85 | ✓ / ✓ | 147 | 47 | 2704 | 1211 | $0.000060 | $0.000032 |
| Buy a bottle of wine as a gift for the client, $30 | ✓ / ✓ | 159 | 52 | 2908 | 1274 | $0.000063 | $0.000034 |
| Dinner from Yangjae Kitchen, $10 | ✓ / ✓ | 180 | 48 | 3201 | 1252 | $0.000069 | $0.000033 |
| Coffee at Starbucks, $5 | ✓ / ✓ | 130 | 43 | 2498 | 1147 | $0.000055 | $0.000031 |
| **Summary** | **5/5 / 5/5** | **154** | **47.4** | **2986** | **1233** | **$0.000309** | **$0.000162** |

Thinking off: completion tokens per proposal 154 → 47.4 (−69.2%), latency 3.0 s → 1.2 s, cost −47.5%, tool calls 5/5 → 5/5.

## Energy

Energy estimate: ≈ 1.29 Wh for 10,797 tokens. Assumption: 0.429 J/token (source: Estimate per processed (prompt+completion) token: one FuriosaAI RNGD card, TDP 180 W (furiosa.ai/renegade-spec), busy for the measured 1.233 s of a proposal / 517 tokens (docs/reasoning-comparison.json, thinking off, 2026-09-28). Multi-card serving or host power would raise it; batching and network time in the latency would lower it.). Formula: total_tokens × J_per_token ÷ 3600. Kiln does not report per-request energy; this is an estimate, not a measurement.
