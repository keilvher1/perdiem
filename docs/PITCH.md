# PerDiem — pitch kit (English)

Format on stage: 5-minute talk + 3-minute Q&A, Innovation Stage, Sep 30 15:00 KST. Judges: ecosystem leads (FuriosaAI, Bricksum), VCs. Assume a mixed Korean and international panel; present in English, answer in English, switch to Korean only if a judge asks in Korean.

Rule of thumb: **show the STOP, not the feature list.** Everyone can make an agent that pays. Almost nobody shows an agent that refuses, records the refusal, and lets a stranger verify it.

---

## Slides (9) — rendered as `docs/deck.pdf` from `docs/deck/deck.html` (`npx tsx scripts/deck.ts`)

| # | Title | On the slide | Say (≈ seconds) |
|---|---|---|---|
| 1 | **PerDiem** — an AI agent that spends your per-diem and cannot cross the line | product name, one-sentence declared function, byline "Mingyu Lee · MICEMore", "Challenge B | Kiln qwen3-32b | Sepolia" | 20 |
| 2 | The moment after delegation | one line: "Payment rails record who paid whom, not who authorized it or under what conditions." Photo: a traveler, a finance manager, a receipt | 30 |
| 3 | Who it is for | finance manager at a small company sending staff to a 2-day conference; wants delegation without losing control. Strip: "I have settled government startup-grant expenses by hand" — rules in prose, boxes ticked by hand, refusals weeks later as free text → PerDiem: rules in code before money moves, each refusal with code / observed / limit, checks recomputed from the records | 30 |
| 4 | How it works | diagram: traveler → agent (Kiln) *proposes* → policy engine (code) *decides* → Sepolia *settles* → ledger + receipt → auditor *replays* | 45 |
| 5 | The boundary, in code | the 12 checks as a compact list; "enforced in `policy.ts` before any chain call; the model never holds keys" | 30 |
| 6 | Live evidence | 3 screenshots: APPROVED receipt with tx link; STOPPED card with 3 reasons; STOPPED "$10 + fee > $10 budget" | 60 |
| 7 | Verifiable by a stranger | audit screenshot: mandate hash = on-chain anchor ✅, N/N entries replayed ✅, calldata decoded, payer and mined counted in the 24 (Payer & mined group); "Evidence → Download records → `verify.ts`"; checks = 2 + 2/entry + 6/payment (24 for mandate A), `/audit` shows the same count | 40 |
| 8 | Efficient on the NPU | tokens by flow table; "status questions: 0 tokens; refusals: 0 tokens"; thinking off for proposals, 5/5 tool calls both ways: in-event run Sep 28 154 → 47 completion tokens (−69%), 3.0 s → 1.2 s, cost −48% (`docs/reasoning-comparison.json`); energy estimate with stated assumption | 35 |
| 9 | What's next | stablecoin settlement, multi-traveler mandates, a receipt format finance teams can import; repo URL + "Challenge B" | 10 |

Total ≈ 4:50 (slide 3 carries the grant-settlement story; if the clock is tight, drop the MICE sentence on slide 3 first). Leave slide 8 up during Q&A.

---

## Script (≈ 720 words, ≈ 4:50 at 150 words per minute)

**[Slide 1]**
Hi, I'm Mingyu Lee. I built PerDiem for Challenge B. In one sentence: PerDiem is a policy layer that holds a traveler's per-diem budget and permitted-merchant list for one business trip, stops any agent payment that falls outside it before it reaches the chain, and produces receipts an auditor can verify from records alone.

**[Slide 2]**
The brief says it well: payment rails record who paid whom, but not who authorized it, or under what conditions. So an agent that stays within budget does so only because someone built it that way. I wanted to build exactly that — and prove it.

**[Slide 3]**
My day job is in the MICE industry — conferences and exhibitions. Companies send staff to events like this one with a per-diem, and finance wants to delegate it to an agent — with rules set once, a stop button, and an audit.
I know the other side too: I have settled government startup-grant expenses by hand. The rules lived in prose, I ticked the boxes by hand, and a refusal came back weeks later as a free-text note. PerDiem does the opposite: the rules run in code before any money moves, every refusal is recorded with a code, the observed value and the limit, and the checks are recomputed from the records.

**[Slide 4]**
The traveler chats with the agent. The agent runs on Kiln — Qwen3-32B on Furiosa NPUs — and it can do exactly one thing: propose a payment through a tool call. It never holds a key. The proposal goes to a policy engine written in plain TypeScript. If the engine approves, we send the payment on Sepolia with the mandate hash and the receipt hash in the calldata. If it refuses, we record why — and we do not call the model again.

**[Slide 5]**
This is the boundary. Twelve checks: is the mandate active, is the trip window open, is the merchant on the list, is the category permitted, any blocked keywords, per-transaction cap, and — the one I like most — does the amount plus the *real* network fee still fit the remaining budget. It's a pure function with unit tests. Stopping is a correct outcome here, and it is recorded, not silent.

**[Slide 6]**
Real runs. First, lunch for twelve dollars: approved, settled, here's the Etherscan link. Second, a taxi to the airport for eighty-five: stopped, over the per-transaction cap. Third, "a bottle of wine as a client gift": stopped with three reasons at once — merchant not on the list, category not permitted, blocked keyword. And fourth, on a ten-dollar budget, a ten-dollar dinner: stopped, because once the real network fee is added — even a fraction of a cent — it exceeds the budget. We never round the fee away. The finance manager can also pause the agent at any time — every request after that stops with "mandate not active".

**[Slide 7]**
Now the part for the auditor. This page does not trust my database. It takes the mandate, re-computes its hash, and compares it with the hash anchored on-chain when the budget was granted. Then it replays every ledger entry through the same policy function and compares the recomputed decision with the stored one. Finally it opens each transaction and decodes the calldata — you can see the same receipt hash there — and checks that it came from the agent wallet and was mined. Anyone can press Evidence, download the two record files, and run the same checks as a standalone script with only a public RPC — no access to my app. If I edit one decision by hand, it turns red.

**[Slide 8]**
And it's cheap on the NPU by design. Tokens are reported per flow. Status questions are answered from the ledger — zero tokens. Refusal explanations are templated — zero tokens. And the proposal step runs with thinking switched off: on the same five requests the model still made the right tool call every time, with roughly seventy percent fewer output tokens, less than half the latency, and about half the cost. Energy is estimated from tokens with a stated assumption of about 0.43 joules per token — one RNGD card's 180 watts over a proposal's measured 1.2 seconds. It could be off either way, so I'd love your real number.

**[Slide 9]**
Next: stablecoin settlement, multi-traveler mandates, and a receipt format finance teams can import. Thank you.

---

## Demo video storyboard (3:00, screen recording + captions, English)

| Time | Screen | Caption |
|---|---|---|
| 0:00–0:15 | Title + declared sentence | "PerDiem — an AI agent that spends your per-diem and cannot cross the line" |
| 0:15–0:25 | Deck slide 3, "Why" strip: grant expenses settled by hand → rules in code, refusals on record | "Rules in code. Refusals on record." |
| 0:25–0:45 | `/principal`: create mandate, toast with anchor tx, open Etherscan, Input Data → UTF-8 shows `PERDIEM-MANDATE|0x…` | "The budget and rules are hashed and anchored on Sepolia" |
| 0:45–1:03 | `/traveler`: lunch $12 → approved → pending → settled, open tx | "The model proposes. Code decides. Chain settles." |
| 1:03–1:35 | Runs 1, 2, 3 (taxi $85 / wine gift $30 / mandate B: dinner $10 on $10) | "Stopped: over per-tx cap" / "Stopped: 3 reasons" / "Stopped: $10 + fee > $10" |
| 1:35–1:50 | `/principal`: Pause → coffee $5 → stopped → Resume → approved; mandate C → "expired" | "The human can stop the agent at any time" |
| 1:50–2:00 | Evidence button → drawer → **Download records** (2 files) → terminal: `npx tsx scripts/verify.ts ~/Downloads/mandate-<A>.json ~/Downloads/ledger-<A>.json` all ✅ (≈ 10 s beat) | "Download the records. Verify them yourself." |
| 2:00–2:32 | `/audit/[id]`: hash match, replay table, decoded memo, "24 of 24 checks passed"; optional: tampered row ❌ (edit only the `decision` field, e.g. #1 taxi STOP → APPROVE) | "An auditor can verify from records alone — no app needed" |
| 2:32–2:55 | `/metrics`: tokens by flow, 0-token rows, thinking on vs off (`/no_think`) comparison, energy card with assumption | "Efficient on the NPU by design" |
| 2:55–3:00 | GitHub URL + Challenge B | — |

Record at 1080p, 1.25× speed on typing, no music needed. Rehearse once; record twice; keep the better take.

---

## Expected Q&A (answer in ≤ 30 seconds each)

1. **Why not let the model enforce the budget?** — Because a model can be persuaded and cannot be audited. The boundary must be deterministic, so it lives in a pure function with tests; the model only proposes.
2. **What if the model never calls the tool?** — Then nothing is spent. Kiln applies tool_choice "auto" only, so I designed for "no proposal = no payment". Safe by construction.
3. **Why Sepolia and not a TRON/Base testnet?** — Faucet reliability for a fresh wallet and Etherscan's UTF-8 calldata view make the auditor story easy. The chain module is ~150 lines of viem; switching to another EVM testnet is a one-line chain change.
4. **Is the fee check real?** — Yes. `estimateGas × gasPrice` for the exact transfer, converted at the displayed demo rate. The demo rate is the only mocked economic input, and it's labeled.
5. **How would this work with real money?** — Same architecture with a stablecoin transfer (ERC-20) and a real FX feed; the policy engine and audit replay don't change. I'd add a spending-policy signature from the principal so the agent wallet can be a smart account with session keys.
6. **What can an auditor verify without your app?** — Everything: the Evidence button downloads the mandate and ledger JSON (the same bytes as `npm run export`); `scripts/verify.ts` takes those two files plus a public RPC and checks the anchored hash and who sent the anchor, replays every decision, recomputes each receipt hash and matches it to the calldata, the recipient, the amount, the payer wallet, and that the tx was mined and succeeded — 2 + 2 per entry + 6 per payment checks, 24 for the demo mandate, the same count the audit page shows. Amounts are converted at the labeled demo rate (`DEMO_ETH_USD`, default 4000, the app's rate). The policy function is open source.
7. **How did you reduce tokens?** — Rule fast-path for status questions, templated refusals, compact catalog line, one tool per turn, and thinking switched off for the proposal step — that alone cut output tokens by roughly 70% (154 → 47 completion tokens in the in-event run on Sep 28, `docs/reasoning-comparison.json`) and more than halved latency, with the same tool-call accuracy (5/5). Measured: numbers on the metrics page.
8. **Where does the energy number come from?** — Tokens × an assumed J/token, shown next to the assumption. Kiln doesn't expose energy per request today; I'd wire the real meter if Bricksum exposes one.
9. **Did you use AI to write the code?** — Yes. Claude Code wrote most of it, run as three parallel developer roles (frontend, backend, planner/full-stack) against one typed contract, merged by me. The design, the boundary rules and what counts as evidence are my decisions, the pre-kickoff modules are disclosed in the README, and I can walk through any file.
10. **Team size / what took longest?** — Solo human builder with AI coding agents. Longest was making the audit page distrust the database properly — replaying spend-so-far from earlier entries so a tampered row is caught.
11. **Could someone delete a refusal from the records?** — Paid entries are bound to the chain: the receipt hash is in the payment's calldata. Stopped entries are not on-chain. The verifier replays each stopped row from its own fields, so a changed decision turns red, but deleting a stopped row, or rewriting it consistently, is not detectable from the records alone today. Next step: anchor a ledger root on-chain.
12. **Can you prove when the mandate was paused?** — Not from the records, and I say so in the README. Status is not part of the mandate hash and a pause is not written on-chain. What exists: the server's status log lines merged with the decisions (`evidence/logs-status.txt`), and the `MANDATE_NOT_ACTIVE` entries the pause caused. Pause fails safe — it can only stop a payment, never allow one — and the pause button and the chat share one lock, so no request in flight sees the old status.
13. **Is this a grant-settlement product?** — No. The grant-settlement experience is why I care about recorded refusals; PerDiem itself is a per-diem demo for one trip.

Fallback line if a question is unclear: *"Could you say that once more? I want to make sure I answer the right question."*

---

## Delivery notes
- Speak slower than feels natural; pause after each STOP screenshot.
- Point at the reasons on the STOPPED card — judges score "stopping is recorded, not silent".
- Keep the live app open in a second tab in case a judge asks to see something; otherwise use screenshots (no live network risk on stage).
- If time runs short, drop slide 3, never slides 6–7.
