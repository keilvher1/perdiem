# PRD — PerDiem

**Track:** GWDC 2026 Korea Hackathon | FuriosaAI x Bricksum | **Challenge B — Build the Controls and Records for an AI Agent That Spends**
**Builder:** solo, remote, working a day job in parallel | **Horizon:** Sep 28 20:00 → Sep 30 12:00 KST (~13 h of evening/early-morning building + ~5 h packaging; heavy prep on Sep 26–27)

## 1. Declared function (one sentence — goes verbatim into README line 1)
PerDiem is a policy layer that holds a traveler's per-diem budget and permitted-merchant list for one business trip, stops any agent payment that falls outside it before it reaches the chain, and produces receipts an auditor can verify from records alone.

## 2. Problem and user
**User:** the finance manager of a small company (e.g. a MICE-industry startup) who must send staff to a 2-day conference and wants to delegate spending to an AI agent without losing control.
**Problem:** payment rails record *who paid whom*, not *who authorized it or under what conditions*. An agent that "stays within budget" does so only because it was built to. When something goes wrong after money has been delegated, nobody can reconstruct whether the agent stayed inside the line.
**Outcome:** the manager grants a mandate once; the traveler talks to the agent; every payment is checked in code against the mandate before it is sent on-chain; refusals are recorded, not silent; a third party can verify every payment from the records alone.

## 3. Actors and screens
| Actor | Screen | Can do |
|---|---|---|
| Principal (finance) | `/principal` | create mandate (budget, per-tx cap, categories, merchants, blocked words, window), see live spend, **Pause / Resume / Revoke**, open anchor tx |
| Traveler | `/traveler` | chat ("order lunch…", "taxi…"), see receipt cards (APPROVED → pending → settled, or STOPPED with reasons), ask status (no LLM call) |
| Agent (PerDiem on Kiln qwen3-32b) | — | propose one payment per request via tool call; never holds keys |
| Auditor | `/audit/[mandateId]` | verify mandate hash vs on-chain anchor, replay every ledger entry through the policy, open each tx and decode the memo |
| Judge | `/metrics` | tokens and cost by flow, high-vs-low reasoning comparison, energy estimate with assumptions |

No auth: a role switcher in the header (demo simplification, stated in README).

## 4. Core workflow (one traveler request)
```
traveler text
  ├─ rule fast-path (status/balance question) → answer from ledger, 0 tokens
  └─ Kiln qwen3-32b (flow=propose, tools=[propose_payment], tool_choice=auto, reasoning_effort=low)
        ├─ no tool call → reply text, nothing spent
        └─ propose_payment{merchant_id, amount_usd, memo}
              → lookup merchant → estimateFeeUsd (real gas × demo rate)
              → policy.evaluate()  ← THE BOUNDARY (code, 11 checks)
                    ├─ STOP  → ledger(stopped, reasons[]) ; templated reply ; no chain call ; no LLM call
                    └─ APPROVE → sendPaymentNoWait (calldata = PERDIEM|mandateHash|receiptHash)
                                 → ledger(pending, txHash) → client polls → settled/failed
```

## 5. The boundary (what the agent must not cross) and where it is enforced
Enforced in `lib/policy.ts::evaluate()` — pure function, unit-tested, called in `lib/agent.ts` before any call into `lib/chain.ts`. The model never holds keys. Checks, all reported when failing:

| Code | Rule |
|---|---|
| MANDATE_NOT_ACTIVE | principal paused or revoked the mandate (kill switch) |
| BEFORE_START / EXPIRED | outside the trip window |
| UNKNOWN_MERCHANT | id not in catalog |
| MERCHANT_NOT_ALLOWED | not on the permitted list |
| CATEGORY_NOT_ALLOWED | category not permitted |
| BLOCKED_KEYWORD | memo mentions a blocked item (alcohol, wine, gift) |
| INVALID_AMOUNT | ≤ 0 or NaN |
| OVER_PER_TX_CAP | single payment cap |
| FEE_UNAVAILABLE | network fee could not be estimated → refuse rather than guess (fail closed) |
| OVER_BUDGET_WITH_FEES | amount + **real network fee** > remaining budget |
| DUPLICATE | same merchant + amount within 5 min |

Hashing: `mandateHash` covers the **terms** (budget, caps, allowlists, window, **catalog snapshot**) and excludes the mutable `status`, so Pause/Resume never breaks the on-chain anchor and editing the merchants table later cannot fool the replay.

## 6. Demo mandates and seed data (`docs/seed.json`)
Common terms: principal "MICEMore Finance", traveler "Mingyu", per-tx cap **$40**, categories `meal, transport, supplies`, merchants `m1,m2,m3,m4,m7`, blocked `alcohol, wine, gift`, catalog snapshot = the 7 merchants below.

| Mandate | Budget | Window (KST) | Purpose |
|---|---|---|---|
| A | $150 | 9/28 17:00 → 9/30 18:00 | main demo (runs 0, 1, 2, 4, 6) |
| B | $10 | same | run 3 — "over budget once fees are added" |
| C | $150 | 9/20 → 9/25 (already past) | run 5 — "deadline already past", zero code |

| id | name | category | allowed |
|---|---|---|---|
| m1 | Yangjae Kitchen | meal | ✅ |
| m2 | Kakao T Taxi | transport | ✅ |
| m3 | T-money Top-up | transport | ✅ |
| m4 | Daiso Yangjae | supplies | ✅ |
| m5 | Wine & Co | alcohol | ❌ |
| m6 | Lotte Duty Free | gift | ❌ |
| m7 | Starbucks aT Center | meal | ✅ |

Each merchant gets a fresh Sepolia address (generated once, stored in `docs/seed.json`; keys discarded). Mandates in seed.json are complete `Mandate` objects (catalog snapshot included); `agentWallet` is the dev wallet address.

## 7. Scripted runs (these become README evidence + video)
| # | Traveler says | Expected | Evidence |
|---|---|---|---|
| 0 | "Order a bibimbap lunch from Yangjae Kitchen, $12" | APPROVE → tx | receipt card, Etherscan link, calldata decodes |
| 1 | "Taxi to Incheon airport, about $85" | STOP `OVER_PER_TX_CAP` | ledger row, reasons chip |
| 2 | "Buy a bottle of wine as a gift for the client, $30" | STOP `MERCHANT_NOT_ALLOWED` + `CATEGORY_NOT_ALLOWED` + `BLOCKED_KEYWORD` | 3 reasons on one card |
| 3 | mandate B ($10): "Dinner from Yangjae Kitchen, $10" | STOP `OVER_BUDGET_WITH_FEES` | card shows $10 + fee > $10.00 |
| 4 | Principal clicks Pause → "Coffee at Starbucks, $5" | STOP `MANDATE_NOT_ACTIVE` | kill switch |
| 5 | mandate C (expired): "Coffee at Starbucks, $5" | STOP `EXPIRED` | deadline already past |
| 6 | Resume A → "Coffee at Starbucks, $5" | APPROVE → tx | second on-chain payment |
| 7 | "How much do I have left?" | answered from ledger, **0 tokens** | `status_fastpath` row on /metrics |

Run 3 asks for exactly the remaining budget. Fees are compared **unrounded**, so any positive network fee — even a fraction of a cent on Sepolia — stops it (covered by tests). Use a fresh mandate per video take (DUPLICATE window is 5 min); `scripts/seed.ts --suffix` creates and anchors a new A/B/C set.

## 8. On-chain design (Sepolia)
- **Anchor:** on mandate creation, 0-value self-tx with calldata `PERDIEM-MANDATE|<keccak256(canonical mandate JSON)>`.
- **Payment:** transfer of `amountUsd / DEMO_ETH_USD` ETH to the merchant address with calldata `PERDIEM|<mandateHash>|<receiptHash>`; `receiptHash = keccak256(canonical ledger entry without tx fields)`.
- **Fee:** `estimateGas × gasPrice` (fallback: intrinsic gas × gasPrice), converted at the demo rate, included in the budget check; actual fee recorded after mining in a separate field so the receipt hash stays stable.
- **Two-step:** broadcast → `pending` → client polls → `settled | failed`. No waiting inside request handlers.
- **Verification path for an auditor:** `npx tsx scripts/verify.ts mandate.json ledger.json` (records + RPC only), or `/audit/[id]`; manually: open tx → Input Data → "View as UTF-8" → compare hashes.

Stretch: pay in Circle test USDC (ERC-20 `transfer`) instead of ETH.

## 9. Kiln integration and token efficiency (report in README + `/metrics`)
- Model `qwen3-32b`, `reasoning_effort: "low"`, `max_tokens 300`, `temperature 0.2`, one tool.
- Usage record per call: `{flow, promptTokens, completionTokens, totalTokens, costUsd, latencyMs}` from `usage` (+ gateway `cost`).
- Flows: `propose` (1 call per purchase request); `status_fastpath` and `stop_template` are recorded as 0-token rows via `zeroUsage()` so avoided inference is visible; `compare` for the reasoning-effort script. `explain`/`audit` LLM flows are out of scope for the hackathon.
- Evidence of real calls: every `chatWithUsage` prints one JSON line (`"kind":"kiln"`, response id, tool_calls, usage) → `evidence/06-kiln-calls.txt`; each ledger entry stores `kilnResponseId` and `toolArgsRaw`.
- Design choices that cut inference, each measured: (a) rule fast-path for status questions → 0 tokens; (b) templated STOP explanations → 0 tokens; (c) compact catalog line instead of JSON → prompt tokens −X%; (d) **thinking off for the propose step** (Qwen3 `/no_think`, `KILN_NO_THINK=1`) — measured before kickoff on Kiln qwen3-32b with the same 5 purchase prompts: tool calls 5/5 both ways, completion tokens per proposal **160 → 47 (−71%)**, latency **2.9 s → 1.1 s**, cost −52%; re-measure on the final prompt with `scripts/compare-reasoning.ts` (thinking on vs off; optional `low` vs `high` with `max_tokens 2000` for `high`); (e) one tool call per turn, no parallel calls, early exit.
- **Energy estimate:** `energy_Wh = total_tokens × ENERGY_J_PER_TOKEN / 3600`. `ENERGY_J_PER_TOKEN` is an env-configured, clearly labeled assumption with a cited source. Fallback if Bricksum gives no figure: `J/token ≈ card_W × latency_s ÷ completion_tokens` using the NPU card's published power draw, labeled "conservative upper bound (assumes a dedicated card)". Never present the energy number without the assumption next to it.

## 10. Data model (`docs/schema.sql`)
`mandates` (id, json = terms incl. catalog, hash, **status column (mutable, merged over json on read)**, anchor_tx, created_at) | `merchants` (id, name, category, wallet) | `ledger_entries` (id, mandate_id, json, status, tx_hash, created_at) | `usage_records` (id, mandate_id, flow, prompt_tokens, completion_tokens, total_tokens, cost_usd, latency_ms, created_at). JSON columns keep the schema trivial; the app reads/writes typed objects from `lib/policy.ts`.

## 11. Acceptance-criteria mapping (Challenge B)
| Criterion (from the brief) | Where it is satisfied | Evidence to submit |
|---|---|---|
| Declared function & user need; workflow from input to outcome; which task the agent does vs code | README line 1; §2, §4; `/traveler` | README, video 0:00–0:40 |
| Boundaries & stopping — state the boundary, where enforced, ≥2 runs pushed outside scope (fees, merchant, deadline), stop recorded not silent | `lib/policy.ts`, `tests/policy.test.ts`, runs 1–5 | ledger screenshots, test output, video 0:40–1:50 |
| Kiln API integration & efficiency — qwen3-32b, real calls, responses drive actions, tokens **by flow**, reduced inference, energy with stated assumptions | `lib/kiln.ts`, `/metrics`, §9 | metrics screenshot, usage table, comparison table |
| Blockchain integration — devnet/testnet, ≥1 on-chain tx, hash + matching log entry, which state the agent reads/writes/settles | `lib/chain.ts`, anchor + payment | tx hashes in README, Etherscan links, ledger rows |
| Approval & evidence — grant budget, follow spend, stop the agent, receive receipt; a second person reconstructs from records alone | `/principal`, `/traveler` receipt cards, **`scripts/verify.ts`** (records + RPC only), `/audit` | verify.ts output, video 1:50–2:40, audit screenshot |

## 12. Non-goals
Real money, mainnet, KYC, multi-currency, merchant onboarding, mobile app, auth, LLM-written explanations. Say so in README.

## 13. Open questions (ask in Telegram topic 740 / on-site)
Kiln credits for builders | energy metric availability (J/token, W) | whether `usage.cost` is acceptable as cost figure | pitch language.
