# Cross-team review — notes for the lead

Reviewer: planner + full-stack dev (FS), 2026-09-28 18:45 KST. Read-only review: nothing in `feat/backend` or `feat/frontend` was edited.

| Branch | Head reviewed | Commits since `main` (8bb7235) |
|---|---|---|
| `origin/feat/backend` | `ba8eb82` | 7 (health, db, view, seed, routes, export, Phase 3 evidence) |
| `origin/feat/frontend` | `0f93822` (first pass at `f7ef2ac`) | 7 (api-client, shell, traveler, principal, audit, metrics, polish) |
| `origin/feat/fullstack` | `3bc0528` | docs, README, scripts, deck |

Later pushes are not covered; re-run the checks in §1 after pulling.

---

## 1. Integration dry run (done, in a throwaway clone outside the repo)

`git clone` of this repo into `/Users/mac/perdiem-tools/merge-test`, branch from `origin/main`, then `git merge --no-ff` of **backend → frontend → fullstack** (the order in `docs/PLAN.md` §7):

| Step | Result |
|---|---|
| merge conflicts | **none** for all three merges |
| `npm run typecheck` (next typegen + tsc, includes `tests/contract.check.ts`) | pass |
| `npm run lint` | pass, 0 problems |
| `npm test` | pass — `policy tests: OK (17 blocks)`, seed scenario check OK |
| `npx tsx --conditions=react-server tests/view.test.ts` (backend's new test) | pass — 10 view tests |
| `npx tsx tests/mandate-request.test.ts` (backend's new test) | pass |
| `npm run build` | pass — 9 dynamic API routes + `/`, `/traveler`, `/principal`, `/audit`, `/audit/[mandateId]`, `/metrics` |
| live smoke, **read-only**, merged app on port 3200 (`NEXT_PUBLIC_API_MODE=live`) | `/api/health` ok (`modelAvailable: true`, balance 0.0455 ETH, `errors: []`); `/api/mandates` lists the backend's test set `man_*_mul19mde`; `/api/usage` returns byFlow + the committed `docs/reasoning-comparison.json`; `/audit/man_A_mul19mde` shows **19 of 19 checks passed**; `scripts/capture.ts --only pages` produced 05, 07, 08, 09, 11 from the real UI. No POST, no chat, no transaction was sent. |

Note for the build: `node_modules` must be a real directory (Turbopack rejects a symlinked `node_modules` that points outside the project: "Symlink [project]/node_modules is invalid").

---

## 2. Contract conformance

**Backend** — every route declares its body with the contract type and uses `NextResponse.json<T>`:

| Route | Contract type | Notes |
|---|---|---|
| `app/api/health/route.ts` | `HealthResponse` | 60 s cache (`TTL_OK_MS`, line 19); `ok = modelAvailable && balanceUsd !== null` (line 71); also probes the DB (line 45) |
| `app/api/mandates/route.ts` | `MandatesResponse`, `CreateMandateResponse` (201) | validation and unknown-merchant refusal happen **before** the anchor tx (lines 35–52); anchor hash kept in the error if the DB write fails (line 76) |
| `app/api/mandates/[id]/route.ts` | `MandateDetailResponse`, `UpdateMandateStatusResponse` | revoked → anything else = 409 (lines 45–47); same per-mandate lock as chat (line 41) |
| `app/api/chat/route.ts` | `ChatResponse` | prints `{"kind":"decision",…}` per decision (lines 61–75) — the exact shape `scripts/metrics.ts` parses (verified on the backend's own `evidence/be-decisions.txt`: 7 decisions, 5 STOP, 2 APPROVE) |
| `app/api/ledger/route.ts` | `LedgerResponse` | — |
| `app/api/ledger/[id]/confirm/route.ts` | `ConfirmResponse` | updates only `status`, `actualFeeUsd`, `settledAt` (lines 44–50); 400 without txHash (line 30); 502 on RPC error (line 40) — matches CLAUDE.md rules 7–8 |
| `app/api/usage/route.ts` | `UsageResponse` | comparison read from `docs/reasoning-comparison.json` with a shape check (lines 16–33); energy only with `ENERGY_J_PER_TOKEN` (lines 35–44) |
| `app/api/audit/[mandateId]/route.ts` | `AuditResponse` | hashes the pure Mandate (line 66); TxCheck only for `settled` entries (line 67); summary = 1 + 2/entry + 4/tx (lines 74–86) |

`lib/db.ts` and `lib/view.ts`: all Phase-0 signatures unchanged; additive exports only (`DbError`, `dbProbe`, `listLedgerForMandates`, `usageTotals`). `lib/{kiln,policy,chain,agent}.ts`, `contracts/`, `docs/fixtures/`, `package.json`, `package-lock.json`, `tests/policy.test.ts`, `tests/contract.check.ts`: **untouched** (`git diff --stat main origin/feat/backend -- …` empty).

**Frontend** — `lib/api-client.ts` live mode calls only `ENDPOINTS.*` (lines 139–151), parses `ApiError` and falls back to `HTTP_<status>` for non-JSON (lines 104–137); the only env var read anywhere in the branch is `NEXT_PUBLIC_API_MODE` (line 58). No imports of `lib/{kiln,chain,db,agent,policy,view}` from any frontend file. Types come from `@/contracts/api`.

## 3. Ownership

- Backend touched only: `app/api/**`, `lib/db.ts`, `lib/view.ts`, `scripts/{seed,export}.ts`, `docs/schema.sql`, `tests/{view,mandate-request}.test.ts` (new files), `evidence/*` (its own verification files). OK.
- Frontend touched only: `app/layout.tsx`, `app/globals.css`, `app/{traveler,principal,audit,metrics}/**`, `components/perdiem/**`, `hooks/**`, `lib/api-client.ts`, `lib/format.ts`. OK (`AGENTS.md` unchanged).
- Fullstack touched only: `docs/**` (not `schema.sql`/`fixtures`), `README.md`, `CLAUDE.md`, `scripts/{scenario,compare-reasoning,metrics,capture,deck}.ts`. OK.

## 4. Secrets

Scanned every file changed on the three branches (27 + 38 + 18 files) for the actual values of `KILN_API_KEY`, `AGENT_PRIVATE_KEY` (with and without `0x`) and `SUPABASE_SERVICE_ROLE_KEY` (compared in memory, never printed), plus key-shaped patterns (`sk-bk-…`, JWTs, PEM headers, `*_KEY=` assignments) and tracked `.env*` files: **0 hits**. `git log --all -- .env.local` is empty. The backend's evidence logs contain tx hashes, entry ids and Kiln response ids only.

---

## 5. Issues and actions (file:line)

Severity: **H** = fix before the evidence run · **M** = decide/act during integration · **L** = optional.

| # | Sev | Where | Issue | Action for the lead |
|---|---|---|---|---|
| 1 | **H** | `app/api/_lib/lock.ts:3-12` (in-process mutex) + `lib/chain.ts` nonce manager (per process) | Locks and nonces are per Node process, and all three worktrees share **one** Supabase database and **one** agent wallet. Two servers (e.g. BE on 3001 and the lead on 3000) serving chat for the same mandate could both approve against the same budget, and concurrent sends from two processes can collide on the nonce. | During the evidence run and the video, run exactly one server (port 3000). Ask FE/BE/FS to stop their dev servers (3100/3001/3200) first. |
| 2 | M | `docs/schema.sql:38,43-45` | New column `usage_records.response_id` + idempotent migration. The live DB works (`/api/health` DB probe resolves with `errors: []`; `dbProbe` at `lib/db.ts:171-180` detects whether the column exists and sets `usageHasResponseId` accordingly), but a fresh project (a judge running locally) needs the updated `schema.sql`. | Keep the backend's `schema.sql` on merge (README "Run locally" already points to it). No RLS/policy change — good. |
| 3 | M | `package.json` `"test"` | `npm test` runs only `tests/policy.test.ts`; the backend's `tests/view.test.ts` (needs `--conditions=react-server`) and `tests/mandate-request.test.ts` are not run by any script, and `package.json` is frozen. | Add both to the integration checklist: `npx tsx --conditions=react-server tests/view.test.ts && npx tsx tests/mandate-request.test.ts`. |
| 4 | M | `docs/reasoning-comparison.json`, `README.md` ("Thinking on vs off", "Flow `compare`") | `npm run compare` **overwrites** the committed measurement (2026-09-28 18:12 KST, 154 → 47.4, −69.2%) and its call log `docs/reasoning-comparison.kiln.jsonl`; the README tables and response ids are copied from that run. | Prefer **not** re-running compare in the evidence run (the `/metrics` comparison table already shows it). If you do run `npm run compare -- --save` (to get a `compare` row in byFlow), update the README comparison table + compare call table from the new files and re-render the deck. |
| 5 | M | `app/api/audit/[mandateId]/route.ts:67` | Transactions are checked only for `settled` entries, so a pending payment is missing from the audit until it mines. | Take `11-audit.png` and run `npm run export`/`verify` only after both payments show `settled`. |
| 6 | M | env `ENERGY_J_PER_TOKEN`, `ENERGY_SOURCE` | Not set yet: `/metrics`, `evidence/metrics.md`, README and deck show "assumption not set". Criterion C6 asks for an estimate with a stated assumption. | Set both from Bricksum/Furiosa's on-site figure (or the PRD §9 fallback formula with a cited card wattage) **before** the evidence run, then restart the server. |
| 7 | L | `app/api/_lib/mandate.ts:12-17` | Dates are normalized with `new Date(s)`, so a `datetime-local` string without offset is interpreted in the server's time zone. The UI already sends ISO (`app/principal/grant-form.tsx:110-111`), so this only affects hand-written curls. | None; mention "send ISO with Z or offset" if you demo with curl. |
| 8 | L | `app/audit/[mandateId]/page.tsx:245` | "Verify yourself" shows `npx tsx scripts/verify.ts …`; README/CLAUDE.md use `npm run verify -- …`. Both work (verify.ts needs only a public RPC). | Optional post-merge alignment (frontend-owned file). |
| 9 | L | `evidence/be-*.txt`, `evidence/be-seed-mul19mde.json`, `evidence/{mandate,ledger}-man_A_mul19mde.json` | Backend verification artifacts from its Phase 3 run (real txs, ALL RECORDS VERIFIED). They do not collide with the canonical names in `docs/PLAN.md` §4. | Keep as supplementary evidence or move under `evidence/dev/`; the README evidence index lists only the canonical files. |
| 10 | L | dev-mode screenshots | `next dev` shows the Next.js "N" indicator bottom-left. | Fixed in `scripts/capture.ts` (`3bc0528`, hides `nextjs-portal`); alternatively run the evidence server with `npm run build && npm start`. |
| 11 | L | `README.md` | 10 `<!-- FILL(lead) -->` markers: video URL, STOP-run ledger ids, scenario file name, announcement link, tokens-by-flow table + date, energy value, anchor/payment tx table, propose-flow Kiln log excerpt. | Fill after the evidence run (§6). `grep -n "FILL(lead)" README.md` must be empty before the repo goes public. |
| 12 | L | disclosure | The computed task text said the first commit was at 17:48 KST; git says `8bb7235` = 2026-09-28 **17:54:25** +0900. README uses the git time. | Correct the README if 17:48 is the right figure. |

Behaviours checked and found correct (no action): the traveler chat stays sendable while a mandate is paused/expired (`app/traveler/page.tsx:77`, `canSend = Boolean(summary)`) so runs #4/#5 are recorded as STOPs by the backend; the chat composer is a `<textarea>` with a "Send" submit button (`app/traveler/chat-panel.tsx:331-344`), which is what `scripts/capture.ts` drives; `?m=<id>` selects the mandate on every page (`hooks/use-selected-mandate.ts:41-45`).

---

## 6. Evidence run — suggested order (port 3000, one server only)

1. Stop all other dev servers (issue 1). Set `ENERGY_J_PER_TOKEN` / `ENERGY_SOURCE` (issue 6) and `NEXT_PUBLIC_API_MODE=live`.
2. `mkdir -p logs && npm run dev 2>&1 | tee logs/dev-server.log`
3. Seed 1 → API evidence: `npm run seed -- --window now` → `npm run scenario` (8/8, exit 0) → wait until both payments are settled → `npm run export -- <A>` → `npm run verify -- evidence/mandate-<A>.json evidence/ledger-<A>.json > evidence/12-verify.txt` → `npx tsx scripts/capture.ts --only pages` (05, 07, 08, 09, 11 for seed-1 A).
4. Seed 2 → UI screenshots: `npm run seed -- --window now` → `npx tsx scripts/capture.ts --only chat` (01, 02, 03, 04, 10). (Playwright setup: header of `scripts/capture.ts`.)
5. `npm run metrics` → `evidence/metrics.md`, `kiln-calls-by-flow.md`, `06-kiln-calls.txt`, `logs-stop.txt`.
6. Fill the README markers (issue 11), then `npx tsx scripts/deck.ts` to put the screenshots and numbers into `docs/deck.pdf` (it refuses to render more than 10 pages).
7. Commit `evidence/` (never `*.mp4`, never `.env.local`), then the video per `docs/VIDEO-SCRIPT.md` (fresh seed per take).

Test-ETH: 0.0455 ETH left at 18:40 KST; each seed + scenario/capture take costs ≈ 0.0045 ETH (two payments + three anchors), so steps 3–4 plus two video takes use ≈ 0.018 ETH.
