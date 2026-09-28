PerDiem is a policy layer that holds a traveler's per-diem budget and permitted-merchant list for one business trip, stops any agent payment that falls outside it before it reaches the chain, and produces receipts an auditor can verify from records alone.

# PerDiem

**GWDC 2026 Korea Hackathon · FuriosaAI x Bricksum · Challenge B — Build the Controls and Records for an AI Agent That Spends**

Video (≤ 3 min): <!-- FILL(lead): unlisted video URL --> `https://…` · Deck (PDF, 9 pages): [`docs/deck.pdf`](docs/deck.pdf) · Runs locally: [Run locally](#run-locally) · Proof of API usage: [on-chain txs + Kiln call logs per flow](#proof-of-api-usage)

Built by Mingyu Lee (MICEMore) with AI coding agents — see the [pre-hackathon disclosure](#pre-hackathon-preparation-disclosure).

## Problem & user

**User:** the finance manager of a small company (for example a MICE-industry startup) who sends staff to a two-day conference and wants to delegate their per-diem spending to an AI agent without losing control.

**Problem:** payment rails record *who paid whom*, not *who authorized it or under what conditions*. An agent that "stays within budget" does so only because it was built to, and when something goes wrong nobody can reconstruct whether it stayed inside the line.

**Outcome:** the manager grants a mandate once; the traveler talks to the agent; every payment is checked in code against the mandate before it is sent on-chain; refusals are recorded, not silent; a third party can verify every payment from the records alone.

**Why this problem:** the builder has settled government startup-grant expenses by hand. The spending rules lived in prose, compliance meant boxes ticked by hand, and a refusal came back weeks later as a free-text note. PerDiem does the opposite for one trip's per-diem: the rules are enforced in code before any money moves, every refusal is recorded with its code, the observed value and the limit, and the checks are recomputed from the records. (PerDiem is a per-diem demo, not a grant-settlement system.)

## What the model does vs. what stays in code

| AI agent (Kiln `qwen3-32b`) | Code |
|---|---|
| Understands the traveler's request, picks a merchant from the catalog, and **proposes** one payment through the `propose_payment` tool. It never holds a key and never decides. | Mandate storage and hashing; network-fee estimation; **policy evaluation (the boundary)**; wallet signing and broadcast; ledger and receipts; audit replay; token accounting; status answers and refusal texts (0 tokens). |

## Workflow

```mermaid
sequenceDiagram
  participant T as Traveler
  participant A as /api/chat
  participant K as Kiln (qwen3-32b)
  participant P as policy.evaluate()
  participant C as Sepolia
  participant L as Ledger
  T->>A: "Order a bibimbap lunch from Yangjae Kitchen, $12"
  alt status question ("How much do I have left?")
    A->>L: read spend so far
    A-->>T: answer from the ledger (flow status_fastpath, 0 tokens)
  else purchase request
    A->>K: chat (tools=[propose_payment], tool_choice=auto, reasoning_effort=low, "/no_think")
    K-->>A: tool_call propose_payment{merchant_id:"m1", amount_usd:12, memo:"bibimbap lunch"}
    A->>C: estimateGas × gasPrice → real fee
    A->>P: evaluate(proposal, mandate, spent, fee, now)
    alt APPROVE
      A->>C: sendTransaction(to=merchant, value, data="PERDIEM|mandateHash|receiptHash")
      A->>L: pending(txHash) → client polls /api/ledger/[id]/confirm → settled
    else STOP
      A->>L: stopped(reasons[]) — no chain call, no second model call (flow stop_template, 0 tokens)
    end
  end
  A-->>T: receipt card / stop card with reasons
```

The tool-call arguments become the `Proposal` that `evaluate()` checks; the ledger entry keeps the Kiln response id (`kilnResponseId`) and the raw tool arguments (`toolArgsRaw`), so every decision can be traced back to the model call that proposed it. Kiln applies `tool_choice: "auto"` only: no tool call means no proposal, and nothing is spent.

## The boundary and where it is enforced

Enforced in [`lib/policy.ts`](lib/policy.ts) `evaluate()` — a pure function called in [`lib/agent.ts`](lib/agent.ts) before any call into [`lib/chain.ts`](lib/chain.ts). The model never holds keys. Twelve checks (one per stop code); every failing check is reported, not just the first. Tests: `npm test` runs six suites — policy engine (17 blocks), view mapping (10), mandate-request validation (5), ledger write after broadcast (8), database errors (4), JSON-only requests (4).

| Code | Rule |
|---|---|
| `MANDATE_NOT_ACTIVE` | the principal paused or revoked the mandate (kill switch) |
| `BEFORE_START` | the trip window has not opened yet |
| `EXPIRED` | the deadline has already passed |
| `UNKNOWN_MERCHANT` | merchant id not in the catalog snapshot hashed with the mandate |
| `MERCHANT_NOT_ALLOWED` | merchant not on the permitted list |
| `CATEGORY_NOT_ALLOWED` | merchant category not permitted |
| `BLOCKED_KEYWORD` | the memo or the traveler's words mention a blocked item (alcohol, wine, gift) |
| `INVALID_AMOUNT` | amount ≤ 0 or not a number |
| `OVER_PER_TX_CAP` | above the single-payment cap |
| `FEE_UNAVAILABLE` | the network fee could not be estimated → refuse rather than guess (fail closed) |
| `OVER_BUDGET_WITH_FEES` | amount + **real** network fee > remaining budget (never rounded before comparing) |
| `DUPLICATE` | same merchant and amount within 5 minutes |

The mandate hash covers the terms (budget, caps, allowlists, window, catalog snapshot) and excludes the mutable status, so Pause/Resume never breaks the on-chain anchor, and editing the merchants table later cannot fool the replay.

## Runs pushed outside the permitted scope (recorded, not silent)

The eight scripted requests (`DEMO_SCRIPT` in [`contracts/api.ts`](contracts/api.ts)) are run by `npm run scenario` against the live app. Every STOP is a ledger row with `status: "stopped"`, its reasons and a receipt hash, and a `"kind":"decision"` server-log line.

**Recorded run:** backend verification run, 2026-09-28 18:16–18:18 KST, mandates `man_A_mul19mde`, `man_B_mul19mde`, `man_C_mul19mde` — the same eight requests sent with `curl` to the live app, every request and response captured verbatim in [`evidence/be-phase3-20260928T0916Z.txt`](evidence/be-phase3-20260928T0916Z.txt); decision log lines of the five STOPs in [`evidence/be-logs-stop.txt`](evidence/be-logs-stop.txt) (all decisions, with mandate status changes and settlements: [`evidence/be-decisions.txt`](evidence/be-decisions.txt)).
<!-- OPTIONAL(lead): replace with the evidence run (evidence/scenario-*.json → steps[n].chat.response.entry.id) and keep the run label in sync -->

| # | Request | Mandate | Decision | Reasons | Ledger id |
|---|---|---|---|---|---|
| 1 | Taxi to Incheon airport, about $85 | A ($150, cap $40) | STOP | `OVER_PER_TX_CAP` (85 > 40) | `led_1790587078158_8ra4` |
| 2 | Buy a bottle of wine as a gift for the client, $30 | A | STOP | `MERCHANT_NOT_ALLOWED`, `CATEGORY_NOT_ALLOWED`, `BLOCKED_KEYWORD` | `led_1790587081310_lqcc` |
| 3 | Dinner from Yangjae Kitchen, $10 | B ($10 budget) | STOP | `OVER_BUDGET_WITH_FEES` ($10 + fee $0.156829 = $10.156829 > $10.00; fees are never rounded before comparing) | `led_1790587083179_anyn` |
| 4 | Coffee at Starbucks, $5 — while paused | A | STOP | `MANDATE_NOT_ACTIVE` | `led_1790587094496_55dm` |
| 5 | Coffee at Starbucks, $5 | C (deadline passed) | STOP | `EXPIRED` | `led_1790587107865_z1kk` |

Runs 1, 2 and 4 are also in the exported ledger of mandate A ([`evidence/ledger-man_A_mul19mde.json`](evidence/ledger-man_A_mul19mde.json)) and replayed by the verifier ([`evidence/be-verify-man_A_mul19mde.txt`](evidence/be-verify-man_A_mul19mde.txt)). Only mandate A was exported in this run, so runs 3 (mandate B) and 5 (mandate C) are proven by their verbatim chat responses in `be-phase3-20260928T0916Z.txt` and their decision log lines in `be-logs-stop.txt`.

## Kiln integration & efficiency

- Endpoint `https://api.bricksum.com/v1` (OpenAI-compatible), model **`qwen3-32b`** (listed by `GET /models` at `/api/health` → [`evidence/05-health.json`](evidence/05-health.json)), `tool_choice: "auto"`, `reasoning_effort: "low"`, `max_tokens: 300`, `temperature: 0.2`, one tool.
- Every model call goes through `chatWithUsage({ flow })` in [`lib/kiln.ts`](lib/kiln.ts), which stores `usage` (+ the gateway's `cost`) per call in `usage_records` and prints one JSON log line per call. Work done **without** the model is recorded as 0-token rows (`zeroUsage()`), so avoided inference is visible, not just unmeasured.

**Model note.** The challenge brief text names `gpt-oss-120b`, but Kiln serves only `qwen3-32b` and `deepseek-v4.1-flash`; the track uses **`qwen3-32b`** (organizer announcement: <!-- FILL(lead): announcement link --> `<announcement link>`).

**Tokens by flow** (`/metrics`, `GET /api/usage`, `evidence/metrics.md`) counts every `usage_records` row in the project database — development, integration, the evidence run and video takes alike — not one run. The snapshot below is `GET /api/usage` at 2026-09-28 18:18 KST, at the end of the backend verification run (verbatim in [`evidence/be-phase3-20260928T0916Z.txt`](evidence/be-phase3-20260928T0916Z.txt), step 8a). The database then held that run's 13 rows (7 `propose`, 5 `stop_template`, 1 `status_fastpath`) plus 5 rows of an earlier backend development run at 18:13 KST (2 `propose`, 2 `stop_template`, 1 `status_fastpath`, mandates `man_*_devbe1`).
<!-- OPTIONAL(lead): replace with the "Tokens by flow" table from evidence/metrics.md after the evidence run, and update the time and the scope sentence above -->

| Flow | What it is | Calls | Prompt | Completion | Total | Cost (USD) | Avg latency |
|---|---|---|---|---|---|---|---|
| `propose` | one model call per purchase request | 9 | 4,209 | 413 | 4,622 | $0.000284 | 1,657 ms |
| `status_fastpath` | no model — answered from the ledger | 2 | 0 | 0 | 0 | 0 | — |
| `stop_template` | no model — refusal templated from reasons | 7 | 0 | 0 | 0 | 0 | — |
| **Total** | | **18** | **4,209** | **413** | **4,622** | **$0.000284** | |

The `compare` flow (thinking on vs off, `scripts/compare-reasoning.ts`) is **not** in `usage_records`: it runs outside the server and writes [`docs/reasoning-comparison.json`](docs/reasoning-comparison.json) (it adds database rows only with `npm run compare -- --save`). That run: 10 calls, 4,676 prompt + 1,007 completion = 5,683 tokens, $0.000471, 2,109 ms average latency (details below).

**Design choices that reduce inference** (fast-path and templated refusals show as 0-token rows in the table above; thinking off is measured below; the compact catalog and one tool call per turn are design choices, not separately measured): rule fast-path for status questions (0 tokens); templated refusals (0 tokens); compact `id | name | category` catalog lines instead of JSON; one tool call per turn, no parallel calls; **thinking switched off for the propose step** (Qwen3 `/no_think`, `KILN_NO_THINK=1`).

**Thinking on vs off** — [`docs/reasoning-comparison.json`](docs/reasoning-comparison.json), measured 2026-09-28 18:12 KST on Kiln `qwen3-32b` with the production system prompt and tool (`npm run compare`):

| Request | Tool call on / off | Completion tokens on → off | Latency on → off |
|---|---|---|---|
| Order a bibimbap lunch from Yangjae Kitchen, $12 | ✓ / ✓ | 154 → 47 | 3.6 s → 1.3 s |
| Taxi to Incheon airport, about $85 | ✓ / ✓ | 147 → 47 | 2.7 s → 1.2 s |
| Buy a bottle of wine as a gift for the client, $30 | ✓ / ✓ | 159 → 52 | 2.9 s → 1.3 s |
| Dinner from Yangjae Kitchen, $10 | ✓ / ✓ | 180 → 48 | 3.2 s → 1.3 s |
| Coffee at Starbucks, $5 | ✓ / ✓ | 130 → 43 | 2.5 s → 1.1 s |
| **Average** | **5/5 / 5/5** | **154 → 47.4 (−69.2%)** | **3.0 s → 1.2 s** |

Reasoning tokens (`usage.completion_tokens_details.reasoning_tokens`) drop from 108 to 1 per call and total cost from $0.000309 to $0.000162 (−47.5%). (A pre-event run on 2026-09-27 measured 180 → 47; its raw data is not in this repo, so only the run above is cited.)

**Energy estimate:** `energy_Wh = total_tokens × ENERGY_J_PER_TOKEN ÷ 3600`. For the 4,622 tokens of the snapshot above: 4,622 × 0.429 ÷ 3600 ≈ **0.55 Wh** for all recorded calls at that time; one thinking-off proposal (517 tokens) ≈ 222 J ≈ 0.06 Wh.
<!-- OPTIONAL(lead): after the evidence run, replace the total with the "Energy" line of evidence/metrics.md -->

**Assumption:** `ENERGY_J_PER_TOKEN = 0.429` J per processed (prompt + completion) token. It is an estimate that assumes one FuriosaAI RNGD card (TDP 180 W, [furiosa.ai/renegade-spec](https://furiosa.ai/renegade-spec)) is busy for the client-measured latency of one request: 180 W × 1.233 s (mean thinking-off proposal latency) ÷ 517 tokens (mean prompt + completion per thinking-off proposal) = 0.429 J/token, both inputs from [`docs/reasoning-comparison.json`](docs/reasoning-comparison.json). It can be off in either direction: multi-card serving (BF16 Qwen3-32B weights, about 65 GB, would not fit one 48 GB card) or host power would raise it; batching and the network time inside the client latency would lower it. Kiln does not expose per-request energy today; the assumption is always shown next to the number (`/metrics`, `evidence/metrics.md`), and the number is not shown at all while the assumption is unset.

## Blockchain integration (Ethereum Sepolia)

| The agent's workflow… | On-chain state |
|---|---|
| **reads** | the agent wallet balance (`/api/health`), gas estimate and gas price for the exact transfer (the fee in the budget check), transaction receipts for settlement, tx calldata for the audit |
| **writes** | the mandate anchor — a 0-value self-transaction with calldata `PERDIEM-MANDATE\|<mandateHash>` when the budget is granted |
| **settles** | a test-ETH transfer to the merchant's address with calldata `PERDIEM\|<mandateHash>\|<receiptHash>` for every approved payment |

Two-step settlement: broadcast → ledger `pending` with the tx hash → the client polls `/api/ledger/[id]/confirm` → `settled` (actual fee recorded) or `failed`. Demo economics: the mandate is in USD and settles in test ETH at a fixed, labeled rate `1 ETH = $4,000`; the fee is the real gas estimate converted at the same rate.

## Proof of API usage

> Organizer requirement (2026-09-28): on-chain transaction hashes and Kiln API call logs, per flow. Everything below links to public data (Sepolia Etherscan) or to log lines committed in this repository.

### On-chain transactions (Sepolia)

Backend verification run, 2026-09-28 18:16–18:18 KST, mandates `*_mul19mde`; all five transactions are sent by the agent wallet `0x8340daD34FD2BA3e15F3E68EF37360F1Ed8B29eF`. Anchors: [`evidence/be-seed-mul19mde.json`](evidence/be-seed-mul19mde.json); payments: [`evidence/be-decisions.txt`](evidence/be-decisions.txt) (decision + settlement lines) and [`evidence/ledger-man_A_mul19mde.json`](evidence/ledger-man_A_mul19mde.json).
<!-- OPTIONAL(lead): replace with the evidence run (evidence/seed-latest.json anchors, evidence/scenario-*.json steps 0 and 6) and keep the run label in sync -->

| What | Tx hash | Matching record |
|---|---|---|
| Mandate A anchor — 0-value self-tx, calldata `PERDIEM-MANDATE\|<mandateHash>` | [`0xbd2f3b3813d3b336727f0cf6e4840a4fc8f08a1f43f364c19423693deacb769c`](https://sepolia.etherscan.io/tx/0xbd2f3b3813d3b336727f0cf6e4840a4fc8f08a1f43f364c19423693deacb769c) | mandate `man_A_mul19mde`, hash `0x647fb7e4…a51a3c` ([`mandate-man_A_mul19mde.json`](evidence/mandate-man_A_mul19mde.json)); block 11799558 |
| Mandate B anchor ($10 budget) | [`0x8cf669e3979c92c6adc9ac15157a29a8c7a40de9d61d388c3251e02b7fbcabdc`](https://sepolia.etherscan.io/tx/0x8cf669e3979c92c6adc9ac15157a29a8c7a40de9d61d388c3251e02b7fbcabdc) | mandate `man_B_mul19mde`, hash `0xdd6e9f7c…c6cb56`; block 11799558 |
| Mandate C anchor (expired window) | [`0x0b6fc932f02cbbb0e2ff7b1a161e9528448c53295147268940d9eede22333223`](https://sepolia.etherscan.io/tx/0x0b6fc932f02cbbb0e2ff7b1a161e9528448c53295147268940d9eede22333223) | mandate `man_C_mul19mde`, hash `0x172bd5a2…d56796`; block 11799558 |
| Payment #0 — lunch $12 to Yangjae Kitchen, calldata `PERDIEM\|<mandateHash>\|<receiptHash>` | [`0x8d135fec45e8cc7aedb78f0ab826d46301323cacb56ecb8d5361e8136f221e0c`](https://sepolia.etherscan.io/tx/0x8d135fec45e8cc7aedb78f0ab826d46301323cacb56ecb8d5361e8136f221e0c) | ledger `led_1790587057888_ptkn` (settled, block 11799563), receipt hash `0x6e935e44…02262d` |
| Payment #6 — coffee $5 to Starbucks aT Center, after resume | [`0x85aafbb13e8d4abed36d958faf47db1bb8caf8c0967976ec7c83cd376be478a0`](https://sepolia.etherscan.io/tx/0x85aafbb13e8d4abed36d958faf47db1bb8caf8c0967976ec7c83cd376be478a0) | ledger `led_1790587097419_yn90` (settled, block 11799566), receipt hash `0x6859207f…1087dd` |

Check one yourself: open the tx on Etherscan → *Input Data* → *View Input As UTF-8* → the two hashes equal the ledger entry's `mandateHash` and `receiptHash`. The verifier does the same from the exported records of mandate A — anchor memo, both payments' calldata, recipient and amount, and a replay of all five entries: [`evidence/be-verify-man_A_mul19mde.txt`](evidence/be-verify-man_A_mul19mde.txt) (`ALL RECORDS VERIFIED`, 19 checks with the verifier of that time). The current `scripts/verify.ts` also checks that the anchor and each payment were sent by the mandate's agent wallet and that each payment was mined and succeeded; on the same two files it prints 24 ✅ and `ALL RECORDS VERIFIED` (re-run 2026-09-28, read-only).

### Kiln API call logs, per flow

Every call through `chatWithUsage()` prints one JSON line (`"kind":"kiln"`: Kiln response id, tool calls, finish reason, the `usage` block Kiln returned). `npm run metrics` collects them into [`evidence/kiln-calls-by-flow.md`](evidence/kiln-calls-by-flow.md) (per flow: calls, response ids, tool calls, prompt / cached / completion / reasoning tokens, cost); raw lines: [`evidence/06-kiln-calls.txt`](evidence/06-kiln-calls.txt).

Scope: these are the calls logged by one server session — here the backend verification run ([`evidence/be-kiln-calls.txt`](evidence/be-kiln-calls.txt)); after the evidence run, `logs/dev-server.log` of the evidence-run server — plus the compare run, which runs outside the server. The counts differ from the database totals under [Tokens by flow](#kiln-integration--efficiency) by design: the database keeps every call ever made against it, a log covers one server session.

| Flow | Kiln calls | What the calls did | Log |
|---|---|---|---|
| `propose` | 7 (backend verification run) | one `propose_payment` tool call per purchase request of the scripted runs | [`evidence/be-kiln-calls.txt`](evidence/be-kiln-calls.txt) |
| `compare` | 10 | thinking on vs off measurement (below) | [`docs/reasoning-comparison.kiln.jsonl`](docs/reasoning-comparison.kiln.jsonl) |
| `status_fastpath` | 0 (by design) | answered from the ledger; recorded as 0-token usage rows | `/metrics` |
| `stop_template` | 0 (by design) | refusal text templated from the stop reasons; 0-token usage rows | `/metrics` |

<!-- OPTIONAL(lead): replace with the "Flow `propose`" table from evidence/kiln-calls-by-flow.md after the evidence run -->
**Flow `propose`** — all 7 Kiln calls of the backend verification run (2026-09-28 18:17–18:18 KST), raw lines in [`evidence/be-kiln-calls.txt`](evidence/be-kiln-calls.txt). Each call's response id is stored on the ledger entry it produced (`kilnResponseId` in [`evidence/be-decisions.txt`](evidence/be-decisions.txt) and the exported ledger), so every decision traces back to the model call that proposed it. Rows are in time order; that run sent #6 before #5.

| Run | Kiln response id | Tool call (arguments) | Ledger id → decision | Prompt | Cached | Completion | Reasoning |
|---|---|---|---|---:|---:|---:|---:|
| #0 lunch (A) | `chat-094eb94e3bd846f0b2ca5b0bcb61bb0d` | `propose_payment` `{"amount_usd": 12, "memo": "Order a bibimbap lunch", "merchant_id": "m1"}` | `led_1790587057888_ptkn` → APPROVE, settled | 473 | 472 | 47 | 1 |
| #1 taxi (A) | `chat-6a8e5e60f8564db58d82461ffc3eadb7` | `propose_payment` `{"amount_usd": 85, "memo": "Taxi to Incheon airport", "merchant_id": "m2"}` | `led_1790587078158_8ra4` → STOP `OVER_PER_TX_CAP` | 469 | 468 | 47 | 1 |
| #2 wine gift (A) | `chat-663ad444e1eb46b58ca50120088fe985` | `propose_payment` `{"amount_usd": 30, "memo": "Buy a bottle of wine as a gift for the client", "merchant_id": "m5"}` | `led_1790587081310_lqcc` → STOP, 3 reasons | 473 | 472 | 52 | 1 |
| #3 dinner (B) | `chat-ca7729fa2bf141c8b05b6933dad21c29` | `propose_payment` `{"amount_usd": 10, "memo": "Dinner from Yangjae Kitchen", "merchant_id": "m1"}` | `led_1790587083179_anyn` → STOP `OVER_BUDGET_WITH_FEES` | 469 | 468 | 48 | 1 |
| #4 coffee, A paused | `chat-b534745823014a3ab13ae26947fc3043` | `propose_payment` `{"amount_usd": 5, "memo": "Coffee at Starbucks", "merchant_id": "m7"}` | `led_1790587094496_55dm` → STOP `MANDATE_NOT_ACTIVE` | 464 | 463 | 43 | 1 |
| #6 coffee, A resumed | `chat-7dc9d448a93a43fb8ec559a363a82dbb` | `propose_payment` `{"amount_usd": 5, "memo": "Coffee at Starbucks", "merchant_id": "m7"}` | `led_1790587097419_yn90` → APPROVE, settled | 464 | 463 | 43 | 1 |
| #5 coffee (C) | `chat-9bc12813a3f7463e976615358488c178` | `propose_payment` `{"amount_usd": 5, "memo": "Coffee at Starbucks", "merchant_id": "m7"}` | `led_1790587107865_z1kk` → STOP `EXPIRED` | 464 | 463 | 43 | 1 |
| **7 calls** | | | 2 APPROVE, 5 STOP | **3,276** | **3,269** | **323** | **7** |

Gateway cost of the seven calls: $0.00022176. Run #7 ("How much do I have left?") made no Kiln call (`status_fastpath`, 0 tokens), and none of the five STOPs made a second call (`stop_template`, 0 tokens).

**Flow `compare`** — all 10 calls of the run in `docs/reasoning-comparison.json` (2026-09-28 18:12 KST):

| # | Kiln response id | Thinking | Tool call (arguments) | Prompt | Cached | Completion | Reasoning |
|---:|---|---|---|---:|---:|---:|---:|
| 1 | `chat-bbb2cb0862664eebb625412a5fdede22` | on | `propose_payment` `{"amount_usd": 12, "memo": "bibimbap lunch", "merchant_id": "m1"}` | 469 | 468 | 154 | 110 |
| 2 | `chat-b2d07c39e53c4795ba915fc5dd2f6af5` | off | `propose_payment` `{"amount_usd": 12, "memo": "Order a bibimbap lunch", "merchant_id": "m1"}` | 473 | 464 | 47 | 1 |
| 3 | `chat-0b033e96ff4d4c1e91bb47aa5a89c2c2` | off | `propose_payment` `{"amount_usd": 85, "memo": "Taxi to Incheon airport", "merchant_id": "m2"}` | 469 | 460 | 47 | 1 |
| 4 | `chat-9a89541f1053478fa7d59c50fd65789f` | on | `propose_payment` `{"amount_usd": 85, "memo": "Taxi to Incheon airport", "merchant_id": "m2"}` | 465 | 464 | 147 | 101 |
| 5 | `chat-75530a26a62f4e349f18f7ad215792b0` | on | `propose_payment` `{"amount_usd": 30, "memo": "Buy a bottle of wine as a gift for the client", "merchant_id": "m5"}` | 469 | 468 | 159 | 108 |
| 6 | `chat-e19c3addb80e48b9b85bb0ba8bff13f4` | off | `propose_payment` `{"amount_usd": 30, "memo": "Buy a bottle of wine as a gift for the client", "merchant_id": "m5"}` | 473 | 464 | 52 | 1 |
| 7 | `chat-d309d000f31c4e3983c3452f996a3027` | off | `propose_payment` `{"amount_usd": 10, "memo": "Dinner from Yangjae Kitchen", "merchant_id": "m1"}` | 469 | 460 | 48 | 1 |
| 8 | `chat-eab6c4869b1e4a708c5c6d272db5718f` | on | `propose_payment` `{"amount_usd": 10, "memo": "Dinner from Yangjae Kitchen", "merchant_id": "m1"}` | 465 | 464 | 180 | 133 |
| 9 | `chat-a74b17d10de54229980cc4bfb2edba07` | on | `propose_payment` `{"amount_usd": 5, "memo": "Coffee at Starbucks", "merchant_id": "m7"}` | 460 | 459 | 130 | 88 |
| 10 | `chat-5f5481f5ea1d4ac7835f235d92cfe112` | off | `propose_payment` `{"amount_usd": 5, "memo": "Coffee at Starbucks", "merchant_id": "m7"}` | 464 | 455 | 43 | 1 |

Note how the model proposes the wine gift at `m5` (Wine & Co) even though it is not allowed: the system prompt tells it to always propose, because the policy engine — not the model — is the judge. That proposal is what run #2 stops with three reasons.

## Approval & evidence

- **Grant:** `/principal` creates the mandate and anchors its hash on Sepolia.
- **Follow:** live spend gauge and ledger on `/principal` (a pending payment counts as committed).
- **Stop:** Pause / Resume / Revoke; every request after Pause stops with `MANDATE_NOT_ACTIVE` ([`evidence/10-paused.png`](evidence/10-paused.png)). The order of events — paused, the stopped request, resumed, the next approval — is in [`evidence/logs-status.txt`](evidence/logs-status.txt): the server's `"kind":"mandate_status"` and `"kind":"decision"` log lines merged by time (`npm run metrics`).
- **Receipt:** the traveler's receipt card shows amount, fee, decision, the traveler's words, the tx / receipt / mandate hashes and the Etherscan link ([`evidence/01-approve.png`](evidence/01-approve.png)).
- **Evidence button:** on `/traveler`, `/principal` and `/audit/<mandateId>` a floating **Evidence** button opens a drawer for the selected mandate ([`evidence/14-evidence-drawer.png`](evidence/14-evidence-drawer.png)): status and money summary, the latest receipt, counts of settled / pending / stopped / failed entries, **Download records** (`mandate-<id>.json` and `ledger-<id>.json`, byte-identical to what `npm run export` writes), **Copy verify command**, and **Run checks now** (one `GET /api/audit/<id>` → "P of T checks passed"). The audit page's *Verify it yourself* panel has the same download buttons. In mock mode the downloads are disabled: placeholder hashes never verify.
- **Reconstruct from records alone:** get the two files — **Download records** in the Evidence drawer or on the audit page (no database access needed), or `npm run export -- <mandateId>` (needs the service-role key) — then `npx tsx scripts/verify.ts ~/Downloads/mandate-<id>.json ~/Downloads/ledger-<id>.json` (from a clone after `npm ci`; any Node 20+, no `.env.local` needed). It uses only those files and a public Sepolia RPC — no database, no API — to recompute the mandate hash and compare it with the on-chain anchor, check that the anchor was sent by the mandate's agent wallet, replay every entry through `evaluate()` rebuilding spend-so-far, and for every entry with a tx hash recompute the receipt hash and match it to the calldata, the recipient, the amount, the payer (the mandate's agent wallet) and the receipt status (mined and succeeded). It converts on-chain value at `DEMO_ETH_USD` (default 4000, the rate the app uses); an auditor who sets a different rate will see the amount checks fail. Number of checks = **2 + 2 × ledger entries + 6 × entries with a tx hash** (2 for the anchor; 2 per entry: carries the mandate hash, stored decision == recomputed; 6 per payment: receipt hash, calldata memo, recipient, amount, payer, mined) — without an anchor tx the anchor counts as one failed check. Mandate A of the scripted run has 5 entries and 2 payments: 2 + 10 + 12 = **24**. `/audit/<mandateId>` shows the same checks in the UI ([`evidence/11-audit.png`](evidence/11-audit.png)) and `GET /api/audit/<id>` counts them with the same formula, so its "P of T" equals the ✅ count of `verify.ts` on the same records. Neither trusts the stored decision. Download or export only after every payment has settled: an unmined payment fails "mined and succeeded" until it is mined.
- **Limitation — pause and resume are log evidence, not records:** the status is not part of the mandate hash and a pause is not written on-chain, so a pause or resume is visible only as server log lines ([`evidence/logs-status.txt`](evidence/logs-status.txt)) and as the `MANDATE_NOT_ACTIVE` entries it caused — not as hashed records. The records alone cannot prove when a mandate was paused, or that it was active when a payment was approved: replay treats every entry that is not a `MANDATE_NOT_ACTIVE` stop as made while active. A pause can only ever stop a payment, never allow one.
- **Limitation — stopped entries are not on-chain:** paid entries are bound to the chain by the receipt hash in their calldata. Stopped entries are not: the verifier replays them from their own fields (proposal, time, fee, and the `MANDATE_NOT_ACTIVE` reason for the pause state), so it catches a changed decision, but a consistent rewrite or the deletion of a stopped row is not detectable from the records alone. Next step: anchor a ledger root on-chain.

## Run locally

Prerequisites: Node.js 22 LTS or 24 (tested with 24.7; on Node 20 use ≥ 20.20 — older 20.x releases reject the `--env-file-if-exists` flag that `npm run verify` passes), a Supabase project, a Kiln API key, and a **Sepolia** dev wallet with a little test ETH (never a personal key).

```bash
git clone https://github.com/keilvher1/perdiem && cd perdiem
npm ci
cp .env.example .env.local        # fill KILN_API_KEY, AGENT_PRIVATE_KEY (Sepolia dev wallet),
                                  # NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY; set NEXT_PUBLIC_API_MODE=live
# Supabase → SQL editor: run docs/schema.sql once (tables, view usage_by_flow_v, RLS on)
npm run seed -- --window now      # merchants + fresh mandates A/B/C anchored on Sepolia → evidence/seed-latest.json
mkdir -p logs && npm run dev 2>&1 | tee logs/dev-server.log   # http://localhost:3000 → /traveler, /principal, /audit/<id>, /metrics
```

Then, in a second terminal:

```bash
npm test                          # six suites: policy engine, view mapping, mandate requests, ledger write, DB errors, JSON-only
npm run scenario                  # the 8 scripted runs → evidence/scenario-*.json (2 real test-ETH payments)
npm run export -- <mandate A id> && npx tsx scripts/verify.ts evidence/mandate-<id>.json evidence/ledger-<id>.json
                                  # or: Evidence button → Download records → verify.ts on the two downloaded files
npm run compare                   # thinking on vs off, 10 Kiln calls; OVERWRITES docs/reasoning-comparison.json
                                  # (the README tables are from the committed 2026-09-28 run)
npm run metrics                   # evidence/metrics.md, kiln-calls-by-flow.md, 06-kiln-calls.txt, logs-stop.txt, logs-status.txt
```

The `tee` keeps the server log that `npm run metrics` turns into the per-flow Kiln log (`evidence/kiln-calls-by-flow.md`); with a plain `npm run dev` that file lists only the compare calls. Without any keys, `NEXT_PUBLIC_API_MODE=mock npm run dev` shows the whole UI on the fixtures in `docs/fixtures/` (no model, no chain).

## Evidence index

Committed now — backend verification run, 2026-09-28 18:16–18:18 KST, mandates `*_mul19mde`:

| File | Shows |
|---|---|
| [`evidence/be-phase3-20260928T0916Z.txt`](evidence/be-phase3-20260928T0916Z.txt) | every request and response of the run, captured verbatim with `curl` (health, seed, the eight scripted runs, pause/resume, confirms, usage, audit) |
| [`evidence/be-seed-mul19mde.json`](evidence/be-seed-mul19mde.json) | mandate ids A/B/C, their hashes and anchor tx hashes, agent wallet |
| [`evidence/be-decisions.txt`](evidence/be-decisions.txt) | every `"kind":"decision"` line (2 APPROVE, 5 STOP) with its `kilnResponseId`, plus pause/resume and settlement lines |
| [`evidence/be-logs-stop.txt`](evidence/be-logs-stop.txt) | the five STOP decision lines (runs 1–5) |
| [`evidence/be-kiln-calls.txt`](evidence/be-kiln-calls.txt) | the seven `"kind":"kiln"` lines of the `propose` flow (response id, tool call, usage) |
| [`evidence/mandate-man_A_mul19mde.json`](evidence/mandate-man_A_mul19mde.json), [`evidence/ledger-man_A_mul19mde.json`](evidence/ledger-man_A_mul19mde.json) | exported records of mandate A (`npm run export`) |
| [`evidence/be-verify-man_A_mul19mde.txt`](evidence/be-verify-man_A_mul19mde.txt) | `npm run verify` on those two files → `ALL RECORDS VERIFIED` (19 checks with the verifier of that time; the current one prints 24 for the same files) |

Produced by the lead's evidence run (`docs/EVIDENCE-RUN.md`):

| File | Shows |
|---|---|
| `evidence/01-approve.png` | run #0 approved, settled, Etherscan link |
| `evidence/02-merchant-not-allowed.png` | run #2 stopped with three reasons |
| `evidence/03-over-budget-with-fees.png` | run #3 stopped: $10 + fee > $10.00 |
| `evidence/04-expired.png` | run #5 stopped: deadline passed |
| `evidence/05-health.json` | Kiln `GET /models` incl. `qwen3-32b`, agent wallet |
| `evidence/06-kiln-calls.txt` | every Kiln call log line |
| `evidence/07-metrics.png` | tokens by flow, 0-token rows, comparison, energy |
| `evidence/08-tx-and-ledger.png` | ledger row next to its transaction |
| `evidence/09-principal.png` | grant, spend gauge, ledger |
| `evidence/10-paused.png` | kill switch: `MANDATE_NOT_ACTIVE` |
| `evidence/11-audit.png` | audit page, all checks |
| `evidence/12-verify.txt` | `ALL RECORDS VERIFIED` from records alone (24 checks for mandate A) |
| `evidence/14-evidence-drawer.png` | the Evidence drawer on `/traveler`: latest receipt, Download records, Copy verify command, "P of T checks passed" |
| `evidence/13-trip-statement.pdf` | the printable trip statement `/audit/<A>/report` (only if that route shipped) |
| `evidence/logs-stop.txt` | decision log lines (STOP and APPROVE) |
| `evidence/logs-status.txt` | pause / resume timeline: `mandate_status` and `decision` server log lines merged by time — log lines, not hashed records |
| `evidence/scenario-*.json` | the 8 scripted runs, requests and full responses |
| `evidence/metrics.md` | tokens by flow, comparison, energy text |
| `evidence/kiln-calls-by-flow.md` | Kiln call log per flow (proof of API usage) |

Screenshots are taken with `scripts/capture.ts` (Playwright from a separate tools folder; see the header of the script). It hides the Evidence button in the nine checklist screenshots; `--only drawer` and `--only report` take `14-evidence-drawer.png` and `13-trip-statement.pdf`.

## Repository map

```
contracts/api.ts        the typed contract between UI and API (+ ENDPOINTS, DEMO_SCRIPT)
lib/policy.ts           evaluate() — the 12 checks; mandateHash, receiptHash, replayLedger
lib/kiln.ts             Kiln client, chatWithUsage({flow}), zeroUsage, propose_payment tool
lib/agent.ts            one traveler message → fast-path | propose → evaluate → send/record
lib/chain.ts            viem on Sepolia: fee estimate, broadcast, settlement, anchor, readMemo
lib/db.ts, lib/view.ts  Supabase persistence and API view mapping
app/api/**              route handlers (health, merchants, mandates, chat, ledger, confirm, usage, audit)
app/{traveler,principal,audit,metrics}/  the UI
scripts/                seed, scenario, export, verify, compare-reasoning, metrics, capture, deck, spike
tests/                  policy tests (npm test) and the contract type check
docs/                   PRD, plan, pitch, deck, video script, schema, seed data, fixtures
```

## Pre-hackathon preparation (disclosure)

The track allows existing code; this lists exactly what existed before the event so the judges can weigh it.

**Built before kickoff (2026-09-26 – 09-27):** the API contract `contracts/api.ts`; `docs/` design material (PRD, acceptance checklist, pitch kit, prompts guide, seed data `docs/seed.json`, frontend fixtures `docs/fixtures/`, `docs/schema.sql`, this README's template); the agent prompts in `prompts/`; the reference modules `lib/kiln.ts`, `lib/policy.ts`, `lib/chain.ts`, `lib/agent.ts`; `scripts/spike.ts` and `scripts/verify.ts`; `tests/policy.test.ts` and `tests/contract.check.ts`; `CLAUDE.md` and `AGENTS.md`. Accounts and infrastructure: a funded Sepolia dev wallet, a Kiln API key, and the Supabase project with its schema and row-level security (created 2026-09-27). The pre-built modules were typechecked, unit-tested and smoke-tested against Kiln and Sepolia on 2026-09-27.

**Built during the event:** the Next.js scaffold; `lib/db.ts` and `lib/view.ts`; everything in `app/` (API routes and UI); `scripts/seed.ts`, `export.ts`, `scenario.ts`, `compare-reasoning.ts`, `metrics.ts`, `capture.ts`, `deck.ts`; the delivery plan, the documentation updates, the measured comparison, the evidence, the deck and the video script.

**How the git history separates the two:** commit `8bb7235` (2026-09-28 17:54 KST) imports the pre-built files above together with the in-event Next.js scaffold (create-next-app, shadcn components, `package.json`, configs) and the `lib/db.ts` / `lib/view.ts` interface stubs; its commit message lists which is which. Everything after `8bb7235` was written during the event. The scaffold settings (tsconfig target, typecheck script, tsx conditions, fonts) were rehearsed in a throwaway dry run on 2026-09-27. Two pre-built files changed during the event: `lib/agent.ts` in `5e46c19` (the pending ledger entry is saved outside the broadcast try/catch) and in `d1c8c76` (reply wording: "$" in the approval reply, the expiry in KST, a broadcast error no longer claims "not paid"); and `scripts/verify.ts` in `d1c8c76` (new checks: the anchor and every payment were sent by the mandate's agent wallet, and every payment was mined and succeeded). `git diff --stat 8bb7235 HEAD -- lib/kiln.ts lib/policy.ts lib/chain.ts lib/agent.ts contracts/ scripts/verify.ts scripts/spike.ts tests/policy.test.ts tests/contract.check.ts` lists only those two files.

**Tools:** AI coding assistants — Claude Code, run as three parallel developer roles (frontend, backend, planner/full-stack) in separate git worktrees against the one typed contract, merged by the builder. Design decisions, the boundary rules and what counts as evidence are the builder's.

## Non-goals and demo simplifications

Real money, mainnet, KYC, multi-currency, merchant onboarding, mobile app, LLM-written explanations. No authentication — the header has role links (Traveler, Principal, Audit, Metrics). Settlement uses test ETH at a fixed demo rate, labeled wherever amounts are shown.
