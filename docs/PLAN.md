# PerDiem — delivery plan (Challenge B, GWDC 2026 Korea)

Owner of this file: planner + full-stack dev (FS). Last updated: 2026-09-28 (Mon) 22:35 KST (after the evidence run: set `man_*_ev1` = recorded API run, set `man_*_ev3` = chat screenshots; README markers filled, deck re-rendered from the evidence).
Deadline: **2026-09-30 (Wed) 12:00 KST, submission closes.** Everything below serves that one date.

Legend for status: ☐ todo · ◐ in progress · ✅ done (on a branch) · 🔒 needs the lead's live evidence run. Evidence sets of 2026-09-28: **ev1** (`evidence/seed-1.json`, 20:32–20:33 KST) is the recorded API run; **ev3** (`evidence/seed-3.json`, 22:10 KST) produced the chat screenshots; **ev2** (22:07 KST) was a screenshot take that was replaced.
Owners: **FE** = frontend dev (`feat/frontend`, `/Users/mac/perdiem-fe`, port 3100) · **BE** = backend dev (`feat/backend`, `/Users/mac/perdiem-be`, port 3001) · **FS** = planner + full-stack dev (`feat/fullstack`, `/Users/mac/perdiem-fs`, port 3200) · **lead** = integration on `main` (port 3000).

---

## 1. Team layout and ownership

| Dev | Worktree | Branch | Dev port | Owns |
|---|---|---|---|---|
| FE | `/Users/mac/perdiem-fe` | `feat/frontend` | 3100 | `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `app/{traveler,principal,audit,metrics}/**`, `components/**`, `hooks/**`, `lib/api-client.ts`, `lib/format.ts`, `AGENTS.md` |
| BE | `/Users/mac/perdiem-be` | `feat/backend` | 3001 | `lib/db.ts`, `lib/view.ts` (bodies only; signatures fixed), `app/api/**`, `scripts/{seed,export}.ts`, `docs/schema.sql`, **the Sepolia test-ETH budget** |
| FS | `/Users/mac/perdiem-fs` | `feat/fullstack` | 3200 | `docs/**` (except `docs/schema.sql`, `docs/fixtures/**`), `README.md`, `CLAUDE.md` (doc fixes), `scripts/{scenario,compare-reasoning,metrics,capture,deck}.ts`, `evidence/` tooling |
| lead | `/Users/mac/perdiem` | `main` | 3000 | merges, `.env.local` switches (`NEXT_PUBLIC_API_MODE=live`), the evidence run, repo visibility, submission form |

Read-only for everyone: `contracts/api.ts`, `docs/fixtures/**`. Pre-built and tested, do not modify: `lib/{kiln,policy,chain,agent}.ts`. No package changes (`package.json`, `package-lock.json`).

Only one dev spends test ETH during the build phase: **BE**. FS sends no transactions. The lead spends during the evidence run.

---

## 2. Challenge B acceptance criteria → feature, owner, evidence, status

Brief lines are quoted from `docs/ACCEPTANCE-CHECKLIST.md` (left column) and `docs/PRD.md` §11.

### A. Declared Function & User Need
| # | Brief line (quoted) | Feature | Owner | Evidence artifact | Status |
|---|---|---|---|---|---|
| A1 | "Declare in one sentence, in your README, the function you built" | README line 1 = PRD §1 declared sentence | FS | `README.md` line 1 | ✅ (FS, README.md) |
| A2 | "Identify the intended user and the problem being solved" | README "Problem & user" | FS | `README.md` | ✅ (FS, README.md) |
| A3 | "Demonstrate the workflow from user input to a usable outcome" | `/traveler` chat → receipt card (approved → pending → settled, tx link) | FE (UI) + BE (`/api/chat`, confirm) | `evidence/01-approve.png`, video 0:30–0:55 | ✅ ev1 run #0 approved + settled (`evidence/scenario-20260928-2033.json`); `evidence/01-approve.png` (ev3); video pending |
| A4 | "Explain which task the AI agent performs and which parts you kept in code" | README table "model proposes / code decides" | FS | `README.md` | ✅ (FS, README.md) |

### B. Boundaries & Stopping
| # | Brief line (quoted) | Feature | Owner | Evidence artifact | Status |
|---|---|---|---|---|---|
| B1 | "State the boundary the agent must not cross and where in your system it is enforced" | `lib/policy.ts::evaluate()`, **12 stop checks**, called in `lib/agent.ts` before any `lib/chain.ts` call; `npm test` — policy engine (17 blocks) + view mapping (10) + mandate-request validation (5) | pre-built; FS documents | `README.md` boundary table, `tests/policy.test.ts` | ✅ |
| B2 | "Include at least two runs in which the agent is pushed outside the permitted scope — a budget exceeded once fees are added" | Run 3: mandate B ($10) asks for exactly $10 → `OVER_BUDGET_WITH_FEES` (fee never rounded) | BE (route) + FE (stop card) | `evidence/03-over-budget-with-fees.png`, `evidence/scenario-*.json` | ✅ ev1 run 3 `led_1790595213468_o37s`: $10 + fee $0.122199 > $10.00 (`scenario-20260928-2033.json`, `12-verify-B.txt` 4/4); `03-over-budget-with-fees.png` (ev3) |
| B3 | "— a merchant that is not on the list" | Run 2: wine gift → `MERCHANT_NOT_ALLOWED` + `CATEGORY_NOT_ALLOWED` + `BLOCKED_KEYWORD` | BE + FE | `evidence/02-merchant-not-allowed.png` | ✅ ev1 run 2 `led_1790595211709_t7b5`, 3 reasons (`scenario-20260928-2033.json`); `02-merchant-not-allowed.png` (ev3) |
| B4 | "— a deadline already past" | Run 5: mandate C (window 9/20–9/25) → `EXPIRED` | BE + FE | `evidence/04-expired.png` | ✅ ev1 run 5 `led_1790595221963_zreu` (`scenario-20260928-2033.json`, `12-verify-C.txt` 4/4); `04-expired.png` (ev3) |
| B5 | "show through logs or history that it stopped" | ledger rows `status=stopped` with `reasons[]`; server prints one `"kind":"decision"` JSON line per decision and one `"kind":"mandate_status"` line per pause/resume/revoke; `scripts/metrics.ts` extracts them | BE (log lines in `/api/chat`, `PATCH /api/mandates/[id]`), FS (extractor) | `evidence/logs-stop.txt`, `evidence/logs-status.txt` (status timeline; log lines, not hashed records) | ✅ `evidence/logs-stop.txt` (21 decisions: 15 STOP, 6 APPROVE), `evidence/logs-status.txt` (6 `mandate_status` + 21 `decision` lines) |
| B6 | "Stopping is a correct outcome, and it should be recorded rather than silent" | STOP entries carry a `receiptHash` and appear in `/audit` replay; 0-token `stop_template` usage row | BE + FE | `evidence/11-audit.png`, `evidence/metrics.md` | ✅ `evidence/11-audit.png` (24 of 24, the 3 STOPs of A replayed), `evidence/metrics.md` (15 `stop_template` rows, 0 tokens) |

### C. Kiln API Integration & Efficiency
| # | Brief line (quoted) | Feature | Owner | Evidence artifact | Status |
|---|---|---|---|---|---|
| C1 | "The resulting AI agent must operate using the NPU-based Kiln API with (Qwen3-32B)" | `lib/kiln.ts` (base URL `api.bricksum.com/v1`, `qwen3-32b`), `/api/health` lists `GET /models` | pre-built + BE (health route) | `evidence/05-health.json` | ✅ `evidence/05-health.json` (`qwen3-32b` listed, `modelAvailable: true`) |
| C2 | "Demonstrate actual API calls within the selected workflow" | `chatWithUsage` prints one `"kind":"kiln"` JSON line per call; ledger rows keep `kilnResponseId` + `toolArgsRaw` | pre-built; FS extractor | `evidence/06-kiln-calls.txt`, `evidence/kiln-calls-by-flow.md` | ✅ `evidence/06-kiln-calls.txt` + `evidence/kiln-calls-by-flow.md` (31 calls: `propose` 21, `compare` 10); README excerpt |
| C3 | "show how the responses inform the agent's decisions or actions" | tool-call args → `Proposal` → `evaluate()`; README sequence diagram | FS (README) | `README.md` workflow diagram | ✅ (FS, README.md) |
| C4 | "Report token usage broken down by flow rather than as a single total" | `/api/usage` + `/metrics` by flow: `propose`, `status_fastpath` (0), `stop_template` (0), `compare` | BE (route) + FE (page) + FS (`metrics.ts`) | `evidence/07-metrics.png`, `evidence/metrics.md` | ✅ `evidence/07-metrics.png` (after ev1: 13 calls), `evidence/metrics.md` (ev1–ev3: 39 rows, 10,797 tokens, 22:11 KST) |
| C5 | "explain how the design reduces unnecessary inference and energy consumption" | fast-path, templated STOP, compact catalog, one tool call, thinking off for `propose` (measured by `scripts/compare-reasoning.ts`) | FS | `docs/reasoning-comparison.json`, `README.md` | ✅ measured 2026-09-28 (5/5, −69.2%) |
| C6 | "supporting energy estimates with available measurements or clearly stated assumptions" | energy card: `total_tokens × ENERGY_J_PER_TOKEN / 3600`, assumption + source shown, or "assumption not set" | BE (usage route) + FE (card) + FS (`metrics.md` text) | `evidence/07-metrics.png`, `evidence/metrics.md` | ✅ 0.429 J/token with its source on `/metrics` (`07-metrics.png`) and in `evidence/metrics.md`: ≈ 1.29 Wh for 10,797 tokens; `ENERGY_SOURCE` now reads "Estimate …" (no "upper bound") |

### D. Blockchain Integration
| # | Brief line (quoted) | Feature | Owner | Evidence artifact | Status |
|---|---|---|---|---|---|
| D1 | "Demonstrate the selected functionality on a devnet or testnet" | Ethereum Sepolia only | pre-built (`lib/chain.ts`) | `README.md` | ✅ |
| D2 | "An end-to-end run of the workflow should produce at least one on-chain transaction — a payment, a settlement, or a record written on-chain" | mandate anchor tx (seed / POST mandates) + payment txs #0 and #6 | BE (seed, chat) | README "Proof of API usage" tx table | ✅ README tx table: 3 ev1 anchors (`evidence/seed-1.json`) + payments #0 and #6 (blocks 11800240, 11800242) |
| D3 | "provide its transaction hash with the matching log or history entry" | ledger row `txHash` + `receiptHash`; calldata `PERDIEM|mandateHash|receiptHash` | BE + FE | `evidence/08-tx-and-ledger.png` | ✅ `evidence/08-tx-and-ledger.png` (ledger next to the decoded calldata; Etherscan blocks headless Chrome); README tx table with ledger ids |
| D4 | "Show how the chain is used by the workflow: which state the agent reads, writes, or settles" | README reads / writes / settles table | FS | `README.md` | ✅ (FS, README.md) |

### E. Approval & Evidence
| # | Brief line (quoted) | Feature | Owner | Evidence artifact | Status |
|---|---|---|---|---|---|
| E1 | "how a person grants a budget" | `/principal` mandate form → anchor tx | FE + BE (`POST /api/mandates`) | video 0:15–0:30, `evidence/09-principal.png` | ✅ `evidence/09-principal.png` (grant form, mandate hash, anchor tx); anchors in `seed-1.json`; video pending |
| E2 | "follows what is being spent" | `/principal` spend gauge + live ledger | FE | `evidence/09-principal.png` | ✅ `evidence/09-principal.png` (budget / spent / pending / remaining) |
| E3 | "stops the agent" | Pause / Resume / Revoke → `MANDATE_NOT_ACTIVE`; the pause/resume order is log evidence only (status is not hashed or on-chain) | FE + BE (`PATCH /api/mandates/[id]`) + FS (timeline) | `evidence/10-paused.png`, `evidence/logs-status.txt` | ✅ `evidence/10-paused.png` (ev3), `evidence/logs-status.txt` (per set: active→paused, `MANDATE_NOT_ACTIVE` STOP, paused→active, APPROVE) |
| E4 | "receives a receipt" | receipt card (amount, fee, "You said", tx / receipt / mandate hashes, Etherscan link); floating **Evidence** button → drawer with the latest receipt | FE | `evidence/01-approve.png`, `evidence/14-evidence-drawer.png` | ✅ `evidence/01-approve.png` (ev3), `evidence/14-evidence-drawer.png` (ev1; Evidence button merged in round 2) |
| E5 | "another person, working from your records alone, can reconstruct whether a completed payment was inside what the user allowed" | Evidence drawer / audit page **Download records** (same bytes as `scripts/export.ts`) → `scripts/verify.ts` (records + public RPC only; anchor + payer + mined checks; 2 + 2/entry + 6/payment = 24 for mandate A); `/audit/[id]` shows the same checks with the same count (BE `5fbd6c7`) | BE (export, audit route) + FE (audit page, downloads) + verify (pre-built, hardened `d1c8c76`) | `evidence/12-verify.txt`, `evidence/11-audit.png`, `cmp` of the downloads (`docs/EVIDENCE-RUN.md`) | ✅ `evidence/12-verify.txt` 24 ✅ `ALL RECORDS VERIFIED`; `evidence/11-audit.png` 24 of 24; drawer download `cmp` byte-identical and 24/24 (lead, not committed) |

---

## 3. Organizer requirements (email 2026-09-28) → artifact, owner, status

| # | Requirement | Artifact | Owner | Status |
|---|---|---|---|---|
| R1 | Public GitHub repo | `github.com/keilvher1/perdiem` switched to Public after `git log --all -- .env.local` is empty | lead | ☐ |
| R2 | README with description + how to run | `README.md` (line 1 declared sentence; "Run locally": schema, `.env.example`, `npm run seed -- --window now`, `npm run dev`) | FS | ✅ (FS, README.md) |
| R3 | Demo video ≤ 3 min | `docs/VIDEO-SCRIPT.md` (2:55 narration + shot list) → recording, uploaded unlisted; link in README line 7 | FS (script), lead (recording) | ◐ script done; recording + unlisted upload pending (README line 7 keeps one video placeholder) |
| R4 | Presentation PDF ≤ 10 pages | `docs/deck/deck.html` → `docs/deck.pdf` via `scripts/deck.ts` (9 pages) | FS | ✅ 9 pages, re-rendered 22:29 KST from the evidence: screenshots 01–03 (ev3) and 11 (ev1), runs table from the ev1 scenario, flows + energy from `evidence/metrics.md` (+ compare row), verify excerpt from `evidence/12-verify.txt`; byline Mingyu Lee |
| R5 | **Proof of API usage in the README: on-chain tx hashes** | README "Proof of API usage" → tx table (anchors A/B/C, payment #0, payment #6) with Etherscan links + matching ledger ids | FS (placeholders + fill from evidence) | ✅ ev1: `seed-1.json` anchors, `scenario-20260928-2033.json` payments; backend run kept in a `<details>` block |
| R6 | **Proof of API usage in the README: Kiln API call logs, per flow** | README "Proof of API usage" → excerpt of `evidence/kiln-calls-by-flow.md` (per flow: calls, response ids, tool calls, tokens) + link to `evidence/06-kiln-calls.txt` | FS (tooling + fill from evidence) | ✅ `propose` rows of ev1 (7 calls → ledger id → decision) + `compare` (10) |
| R7 | Pre-built work clearly disclosed | README "Pre-hackathon preparation (disclosure)" | FS | ✅ (FS, README.md) |
| R8 | Challenge named | README line 3 "FuriosaAI x Bricksum — Challenge B" | FS | ✅ (FS, README.md) |
| R9 | Model note | README: brief text says gpt-oss-120b, Kiln serves only `qwen3-32b` and `deepseek-v4.1-flash`, the track uses `qwen3-32b` (+ announcement link) | FS (text), lead (link) | ◐ text done; organizer announcement link pending (one placeholder left in README) |
| R10 | Submitted before 2026-09-30 12:00 KST | submission form with repo, video, PDF links | lead | ☐ |

---

## 4. Evidence naming scheme (`evidence/`)

All evidence lives in `evidence/` on `main` after the lead's evidence run. `evidence/*.mp4` is git-ignored (upload the video instead).

| File | What it shows | Produced by | Criterion |
|---|---|---|---|
| `01-approve.png` | `/traveler`: run 0 lunch $12 → APPROVED receipt card, settled, Etherscan link | `scripts/capture.ts` (or manual) | A3, E4 |
| `02-merchant-not-allowed.png` | `/traveler`: run 2 wine gift → STOPPED card with 3 reason chips | `scripts/capture.ts` | B3 |
| `03-over-budget-with-fees.png` | `/traveler` on mandate B: run 3 dinner $10 → `OVER_BUDGET_WITH_FEES`, "$10 + fee > $10.00" | `scripts/capture.ts` | B2 |
| `04-expired.png` | `/traveler` on mandate C: run 5 → `EXPIRED` | `scripts/capture.ts` | B4 |
| `05-health.json` | `GET /api/health` (models list incl. `qwen3-32b`, agent balance) | `scripts/capture.ts` (fetch) | C1 |
| `06-kiln-calls.txt` | every `"kind":"kiln"` line from `logs/dev-server.log` | `scripts/metrics.ts` | C2, R6 |
| `07-metrics.png` | `/metrics`: tokens by flow incl. 0-token rows, comparison table, energy card | `scripts/capture.ts` | C4, C6 |
| `08-tx-and-ledger.png` | ledger row (tx hash, receipt hash) next to the tx page | `scripts/capture.ts` (ledger view) + manual Etherscan half | D3 |
| `09-principal.png` | `/principal`: mandate list, spend gauge, live ledger | `scripts/capture.ts` | E1, E2 |
| `10-paused.png` | `/principal` paused + `/traveler` run 4 → `MANDATE_NOT_ACTIVE` | `scripts/capture.ts` | E3 |
| `11-audit.png` | `/audit/<A>`: anchor match, replay table, decoded memos, all ✅ | `scripts/capture.ts` | E5, B6 |
| `12-verify.txt` | `npm run verify -- evidence/mandate-<id>.json evidence/ledger-<id>.json` → `ALL RECORDS VERIFIED` | lead (`npm run export` then `npm run verify`) | E5 |
| `12-verify-B.txt`, `12-verify-C.txt` | the same for mandates B and C (4 checks each: anchor memo + sender, one STOP entry) | lead | B2, B4, E5 |
| `logs-stop.txt` | every `"kind":"decision"` line (STOP and APPROVE) from `logs/dev-server.log` | `scripts/metrics.ts` | B5 |
| `logs-status.txt` | status timeline: every `"kind":"mandate_status"` and `"kind":"decision"` line, merged by `at`, with a count header; server log lines, not hashed records | `scripts/metrics.ts` | B5, E3 |
| `13-trip-statement.pdf` | printable statement `/audit/<A>/report`, A4 (shipped; 2 pages for `man_A_ev1`) | `scripts/capture.ts --only report` | E4, E5 |
| `14-evidence-drawer.png` | Evidence drawer on `/traveler?m=<A>`: latest receipt, Download records, Copy verify command, "P of T checks passed" | `scripts/capture.ts --only drawer` | E4, E5 |
| `scenario-<YYYYMMDD-HHmm>.json` | the 8 scripted runs: requests, full responses, confirms, expected vs actual | `scripts/scenario.ts` | B2–B4, D2 |
| `metrics.md` | by-flow table (0-token rows kept), comparison table, energy card text | `scripts/metrics.ts` | C4–C6 |
| `kiln-calls-by-flow.md` | per flow: calls, response ids, tool-call names, prompt/completion/cached/reasoning tokens | `scripts/metrics.ts` | C2, **R6** |
| `seed-latest.json` | `{ A, B, C, anchors, at }` of the current demo set (not committed; copied per set to `seed-N.json`) | `npm run seed` (BE) | D2 |
| `seed-1.json`, `seed-2.json`, `seed-3.json` | the three sets of 2026-09-28: ev1 recorded run, ev2 replaced screenshot take, ev3 chat screenshots | lead (`cp evidence/seed-latest.json …` after each seed) | D2 |
| `capture-log.json`, `capture-log-pages-drawer.json`, `capture-log-report.json` | what `scripts/capture.ts` sent and saved per step, with warnings (chat: ledger ids, tx hashes, Kiln response ids) | `scripts/capture.ts` | A3, B2–B4, E3 |
| `mandate-<id>.json`, `ledger-<id>.json` | exported records for the auditor | `npm run export` (BE) | E5 |

Nine checklist PNGs: 01, 02, 03, 04, 07, 08, 09, 10, 11 (the Evidence button is hidden in all nine by `scripts/capture.ts`). Plus 14 (drawer) and 13 (PDF). Non-image: 05, 06, 12 (+ B, C), logs-stop, logs-status, scenario, metrics, kiln-calls-by-flow, seed-1/2/3, capture logs. Sets: 01–04 and 10 from ev3 (chat); 05, 07–09, 11, 13, 14 and the exports from ev1; logs and `metrics.md` cover ev1 + ev2 + ev3. All 41 files are listed in the README evidence index.

---

## 5. Timeline to 2026-09-30 12:00 KST

| When (KST) | Who | What | Exit condition |
|---|---|---|---|
| Mon 9/28 18:00–00:30 | FE | api-client (mock + live), Traveler, Principal, Audit, Metrics on fixtures | `NEXT_PUBLIC_API_MODE=mock npm run build` green; DEMO_SCRIPT 0–7 walkable in mock |
| Mon 9/28 18:00–00:30 | BE | health, `lib/db.ts`, `lib/view.ts`, seed, all routes, export; one `"kind":"decision"` log line per chat decision | curls of Phase 3 green; `npm run build` green |
| Mon 9/28 18:00–00:30 | FS | P1–P10: plan, doc fixes, scenario/compare/metrics/capture/deck scripts, README, video script, cross-review | each task pushed; `docs/reasoning-comparison.json` measured live |
| ✅ done early: Mon 9/28 18:48 (round 1), 19:38 (QA), 20:28 (round 2) | lead | merge `feat/backend` → `feat/frontend` → `feat/fullstack` into `main` (see `docs/REVIEW-NOTES.md`), `NEXT_PUBLIC_API_MODE=live`, `npm run seed -- --window now`, `npm run scenario` | build green (`2669fe6`, 9-suite `npm test`); scenario 8/8 (ev1, 20:33) |
| before the evidence run | FE/BE/lead | **merge cutoff** for anything that changes pages in the screenshots (receipt card, Evidence button, AppShell, layout); if it is not merged and green when the run starts, run without it | build green in mock and live |
| ✅ done Mon 9/28 20:30–22:12 (commits `b162928`, `7590e5a`) | lead | **evidence run** on port 3000 — one server only, `ENERGY_J_PER_TOKEN` set — exact runbook with go/no-go checks: **`docs/EVIDENCE-RUN.md`** (DB backup + clean, seed, scenario, export + verify, download + `cmp`, capture pages/chat/drawer/report, metrics; keep the committed `docs/reasoning-comparison.json` unless README/deck are regenerated) | all files of §4 present |
| ✅ done early: Mon 9/28 22:15–22:35 | FS | fill README "Proof of API usage", re-render deck with screenshots (`npx tsx scripts/deck.ts`) | README keeps exactly two `FILL(lead)` markers: the video URL and the announcement link |
| Tue 9/29 22:00–00:30 | lead | video take 1 (fresh seed per take; DUPLICATE window 5 min) following `docs/VIDEO-SCRIPT.md` | ≤ 3:00 cut |
| Wed 9/30 07:00–10:00 | lead | video take 2 if needed, upload unlisted, README links, repo Public, incognito check of every link | checklist §F all ✅ |
| Wed 9/30 10:00–11:00 | lead | submit (repo, video, PDF) | confirmation email |
| **Wed 9/30 12:00** | — | **submission closes** | — |
| Wed 9/30 15:00 | lead | pitch (5 min + 3 min Q&A), `docs/PITCH.md` | — |

Buffer: one hour on Wednesday morning is unallocated on purpose.

---

## 6. Test-ETH budget (agent wallet ≈ 0.05 Sepolia ETH, `DEMO_ETH_USD=4000`)

| Action | ETH per action (value + gas, approx.) | Count planned | Total |
|---|---|---|---|
| mandate anchor (0-value self-tx) | gas only, ≈ 0.00005 | 3 per seed × 5 seeds | ≈ 0.001 |
| payment run 0 ($12) | 0.003 + gas | 1 per take × 5 | ≈ 0.0155 |
| payment run 6 ($5) | 0.00125 + gas | 1 per take × 5 | ≈ 0.0065 |
| **Total planned** | | BE smoke (1) + integration (1) + evidence (1) + video (2) | **≈ 0.023 ETH** |

Rule: do not seed more than five demo sets. Reuse the same set when retrying a single run (after the 5-minute DUPLICATE window). FS sends nothing.

Measured on 2026-09-28: 0.041151 ETH at 22:05 KST after ev1 (`evidence/05-health.json`); ev2 and ev3 then used ≈ 0.0044 ETH each (3 anchors + 2 payments per set, `docs/EVIDENCE-RUN.md` last section), so ≈ 0.032 ETH is left for the video takes (≈ 0.0045 ETH per take) — an estimate; read `balanceEth` in `/api/health` before each take.

---

## 7. Integration order for the lead (details in `docs/REVIEW-NOTES.md`)

Dry run done on 2026-09-28 18:45 KST (backend `ba8eb82`, frontend `0f93822`, fullstack `3bc0528`): no conflicts; typecheck, lint, test and build pass on the merged tree.

1. `feat/backend` first (it owns `lib/db.ts`, `lib/view.ts`, `app/api/**`, seed/export).
2. `feat/frontend` second (UI; only touches FE paths).
3. `feat/fullstack` last (docs, README, scripts, deck; no app code).
4. `npm run typecheck && npm run lint && npm test && npm run build`, then the evidence run of §5.

---

## 8. Risks and fallbacks

| Risk | Fallback |
|---|---|
| Kiln 402 / outage | evidence already captured (`docs/reasoning-comparison.json`, scenario JSON); do not switch models for the submission |
| Sepolia RPC slow | `SEPOLIA_RPC_URL` to another provider; confirm polling up to 2 min (20 × 6 s) |
| Frontend late | Audit → `evidence/12-verify.txt`; Metrics → `evidence/metrics.md`; screenshots of Traveler + Principal only |
| Screenshot tooling fails | take the 9 PNGs manually with the same names |
| Test ETH runs low | stop seeding; reuse the last set; faucet only as last resort |
| Clock: DUPLICATE (5 min) | fresh seed per video take (`npm run seed`) |
