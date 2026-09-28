# CLAUDE.md — PerDiem (GWDC 2026 Korea Hackathon, FuriosaAI x Bricksum Challenge B)

You are helping a solo builder who also has a full day job ship a working prototype in ~13 hours of evening and early-morning sessions (Mon 20:00–00:30, Tue 06:00–08:30 and 19:00–00:30). Each session must end with a commit and a working state. Read `docs/PRD.md` first. Optimize for a demo that runs end-to-end, not for architecture purity. `lib/{kiln,policy,chain,agent}.ts`, `scripts/{spike,verify}.ts` and `tests/*.ts` were prepared before kickoff and are typechecked + tested; build `app/`, `lib/db.ts` and `lib/view.ts` around them. Do not modify the four pre-built `lib/` modules; if one looks wrong, report it instead of patching it.

## Declared function (do not drift from this)
PerDiem is a **policy layer** that holds a traveler's per-diem budget and permitted-merchant list for one business trip, **stops any agent payment that falls outside it before it reaches the chain**, and produces **receipts an auditor can verify from records alone**.

## Three developers, one contract
The build runs as three parallel developer roles, each in its own git worktree of the same repo; the lead merges the branches into `main` (plan: `docs/PLAN.md`). The only shared surface is **`contracts/api.ts`** (read-only for everyone) and **`docs/fixtures/*.json`** (read-only mock data for the frontend, generated from the real `lib/policy.ts`). The exported signatures of `lib/db.ts` and `lib/view.ts` are a fixed interface: only the backend dev implements the bodies; additive exports are fine, changed signatures are not. Every Route Handler declares its response with a contract type; `tests/contract.check.ts` fails typecheck if `lib/*` and the contract drift. The original master prompts live in `prompts/` (00 workflow, 01 backend, 02 frontend, 03 integration).

| Role | Worktree | Branch | Dev port | Owns |
|---|---|---|---|---|
| Frontend (FE) | `/Users/mac/perdiem-fe` | `feat/frontend` | 3100 | `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `app/{traveler,principal,audit,metrics}/**`, `components/**`, `hooks/**`, `lib/api-client.ts`, `lib/format.ts`, `AGENTS.md` |
| Backend (BE) | `/Users/mac/perdiem-be` | `feat/backend` | 3001 | `lib/db.ts`, `lib/view.ts` (bodies), `app/api/**`, `scripts/{seed,export}.ts`, `docs/schema.sql`, the Sepolia test-ETH budget |
| Planner + full-stack (FS) | `/Users/mac/perdiem-fs` | `feat/fullstack` | 3200 | `docs/**` (except `docs/schema.sql`, `docs/fixtures/**`), `README.md`, `CLAUDE.md` (doc fixes), `scripts/{scenario,compare-reasoning,metrics,capture,deck}.ts`, `evidence/` tooling |
| Lead (integration) | `/Users/mac/perdiem` | `main` | **3000** (reserved) | merges, `NEXT_PUBLIC_API_MODE=live`, evidence run, submission |

Start your own dev server on your port: `npm run dev -- -p 3100` (FE), `-p 3001` (BE), `-p 3200` (FS). Nobody changes `package.json`/`package-lock.json` or runs `npm install` / `npx shadcn add`. Pre-built and tested, do not modify: `lib/{kiln,policy,chain,agent}.ts`.

## Non-negotiable rules
1. **The model never pays.** Kiln `qwen3-32b` only *proposes* via the `propose_payment` tool. `lib/policy.ts` (pure TypeScript) decides. Only `lib/chain.ts` touches the wallet, and only after `evaluate()` returned `APPROVE`.
2. **Never rely on forced tool calls.** Kiln applies `tool_choice: "auto"` only; `"required"`/named are silently ignored. No tool call ⇒ no proposal ⇒ nothing is spent.
3. **Every model call goes through `chatWithUsage({ flow })`**, and work done *without* the model is recorded with `zeroUsage("status_fastpath" | "stop_template")`. No direct `openai.chat.completions.create` anywhere else. `/metrics` reads `usage_records` grouped by flow.
4. **STOP never calls the model.** Refusal text is templated from `StopReason[]`.
5. **Server only for secrets.** `KILN_API_KEY`, `AGENT_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are read only in Route Handlers / server code. Never import `lib/chain.ts` or `lib/kiln.ts` from a client component. Never print the private key, never paste it into a prompt.
6. **Testnet only.** Sepolia. Refuse any change that points at mainnet.
7. **Two-step settlement.** `sendPaymentNoWait()` / `anchorMandate()` broadcast and return; ledger status `pending`; the client polls `/api/ledger/[id]/confirm` which calls `getSettlementStatus()` → `settled | failed`. No `waitForTransactionReceipt` inside any request handler.
8. **Hashes are stable.** `mandateHash()` excludes `status`; `receiptHash()` excludes `txHash, receiptHash, status, actualFeeUsd, settledAt`. The confirm route may update ONLY those fields. `lib/db.ts::getMandate()` must merge the `mandates.status` column over the stored JSON (otherwise Pause is a no-op).
9. **Fail closed.** If the fee cannot be estimated, `evaluate()` returns `FEE_UNAVAILABLE`. Never default a missing fee to 0.
10. Keep prompts short. Catalog goes into the system prompt as `id | name | category` lines from `mandate.catalog` (7 merchants), never JSON. `reasoning_effort: "low"`, `max_tokens ≤ 300`, and `/no_think` appended to the user message for `propose` (`KILN_NO_THINK=1`; measured 2026-09-27 on Kiln qwen3-32b with the production prompt: completion 180 → 47 tokens (−74%), latency 2.9 s → 0.9 s, cost −50%, tool calls 5/5 both ways; the pre-kickoff spike measured 160 → 47).
11. `Response.json()` cannot serialize `bigint`. `lib/chain.ts` already returns strings; keep it that way.

## Stack
Next.js 16.3.6 App Router + React 19.2 + TypeScript + Tailwind 4 + shadcn/ui (radix-nova style, 22 components already installed) + `lucide-react` 1.x + `sonner` + `zod` 4 | Supabase (Postgres, `@supabase/supabase-js`, service role on server) | viem 2 on Sepolia (RPC defaults to PublicNode's keyless endpoint; `SEPOLIA_RPC_URL` overrides) | `openai` SDK pointed at `https://api.bricksum.com/v1`.

## File map
```
contracts/api.ts                   THE contract: domain + view types, ENDPOINTS, DEMO_SCRIPT (read-only)
docs/fixtures/*.json               mock data for the frontend, generated from lib/policy.ts (read-only)
app/api/health/route.ts            GET → HealthResponse
app/api/merchants/route.ts         GET → MerchantsResponse
app/api/mandates/route.ts          GET → MandatesResponse | POST CreateMandateRequest → 201 CreateMandateResponse (anchor broadcast only)
app/api/mandates/[id]/route.ts     GET → MandateDetailResponse | PATCH UpdateMandateStatusRequest → UpdateMandateStatusResponse
app/api/chat/route.ts              POST ChatRequest → ChatResponse (handleTravelerMessage)
app/api/ledger/route.ts            GET ?mandateId= → LedgerResponse
app/api/ledger/[id]/confirm/route.ts GET → ConfirmResponse; updates status/actualFeeUsd/settledAt only
app/api/usage/route.ts             GET → UsageResponse (byFlow, totals, zeroTokenCalls, energy, comparison)
app/api/audit/[mandateId]/route.ts GET → AuditResponse (rehash, anchor memo, replayLedger, TxCheck per tx)
app/{traveler,principal,audit,metrics}/  FRONTEND (FE role) — client components on lib/api-client.ts
lib/kiln.ts    client + chatWithUsage + zeroUsage + proposePaymentTool + stripThink + extractToolCall
lib/policy.ts  types, evaluate() (12 checks), mandateHash, receiptHash, fmtUsd, findMerchant, replayLedger()
lib/chain.ts   viem clients, estimateFeeUsd (with fallback), sendPaymentNoWait, getSettlementStatus, anchorMandate, readMemo
lib/agent.ts   handleTravelerMessage(): fast-path → propose (/no_think) → evaluate → send/record
lib/db.ts      Supabase helpers (getMandate merges status column, listLedger, saveEntry, updateEntry, saveUsage, usageByFlow)
lib/view.ts    LedgerEntry → LedgerEntryView, Mandate → MandateSummary/Detail (backend-owned)
lib/api-client.ts  FRONTEND-owned: mock|live client over ENDPOINTS
scripts/spike.ts, scripts/verify.ts (prepared) | scripts/seed.ts, export.ts (BE) | scripts/scenario.ts, compare-reasoning.ts, metrics.ts, capture.ts, deck.ts (FS) — built during the event
docs/seed.json agent address, 7 merchants with Sepolia addresses, complete Mandate objects A ($150), B ($10, fee scenario), C (expired)
tests/policy.test.ts  `npm test` — must stay green | tests/contract.check.ts — typecheck proves contract == lib
```

## Commands
```
npm run dev                       # lead only (port 3000); devs: npm run dev -- -p <your port>
npm run typecheck                 # next typegen && tsc --noEmit (includes tests/contract.check.ts)
npm run lint                      # eslint (next build does NOT run lint)
npm test                          # policy engine (17 blocks) + view mapping (10) + mandate-request validation (5)
npm run spike -- kiln             # model + tool-call smoke test (5 prompts)
npm run spike -- chain            # SPENDS test ETH (anchor tx) — backend dev only
npm run seed -- --window now      # new A/B/C demo set + 3 anchor txs → evidence/seed-latest.json (spends test ETH)
npm run scenario                  # DEMO_SCRIPT 0–7 against BASE_URL (default http://localhost:3000) → evidence/scenario-*.json
npm run export -- <mandateId>     # evidence/mandate-<id>.json + evidence/ledger-<id>.json
npm run verify -- evidence/mandate-<id>.json evidence/ledger-<id>.json   # auditor, no app needed
npm run compare                   # thinking on vs off (/no_think), 10 Kiln calls → docs/reasoning-comparison.json
npm run metrics                   # /api/usage + logs/dev-server.log → evidence/{metrics.md,kiln-calls-by-flow.md,06-kiln-calls.txt,logs-stop.txt}
npm run build                     # run it early (after the first page), not on the last night
```

The npm scripts that touch secrets run `tsx --conditions=react-server --env-file=.env.local`. Both flags matter: tsx does not read `.env.local` by itself, and `lib/db.ts` / `lib/view.ts` start with `import "server-only"`, which throws outside the `react-server` export condition. Do not replace them with a bare `npx tsx scripts/<x>.ts` for anything that imports `lib/db.ts`.

## Env (see .env.example)
`KILN_API_KEY`, `KILN_BASE_URL`, `KILN_MODEL=qwen3-32b`, `KILN_NO_THINK=1`, `AGENT_PRIVATE_KEY`, `SEPOLIA_RPC_URL`, `DEMO_ETH_USD=4000`, `ENERGY_J_PER_TOKEN` + `ENERGY_SOURCE` (labeled assumption + source), `NEXT_PUBLIC_API_MODE` (`mock` | `live`), `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Never print, echo or commit `.env.local`.

## Definition of done per feature
- Works via UI **and** via `curl` (paste the curl in the commit message).
- Any change to `lib/policy.ts` keeps `npm test` green and adds a case.
- Any new model call has a `flow` label and shows up in `usage_records`.
- Any on-chain call writes `txHash` to the ledger and renders an Etherscan link.

## Gotchas
- Next.js 16: dynamic route `params` is a `Promise` — `const { id } = await params`. `LayoutProps` / `PageProps` are global types generated by `next typegen` (run by `npm run typecheck`). `next build` does not run lint.
- If typecheck or build fails with TS2307 inside `.next/dev/types/validator.ts`, delete the stale dev types (`find .next/dev -delete`) and retry.
- zod 4: `z.string().datetime()` rejects `datetime-local` strings and `+09:00` offsets (use `z.iso.datetime({ offset: true, local: true })` or parse yourself); error details live in `.issues` (not `.errors`).
- supabase-js 2.117 retries failed GETs 3 times (1 s + 2 s + 4 s); use `.retry(false)` for fast probes.
- This Mac has a global shell hook: any command containing `rm` with `-r` or `-f` is denied, and so are privilege-escalation (superuser) commands. Delete with `find <path> -delete` or `mv <path> ~/.Trash/`.
- Money is compared **unrounded** in `evaluate()` (Sepolia fees can be sub-cent). Use `fmtUsd()` for display only; never add `toFixed`/rounding before a comparison. Run 3 = request exactly $10 on mandate B ($10).
- Re-running the same request within 5 minutes trips `DUPLICATE` — use a fresh mandate per demo take (`npm run seed` recreates A/B/C).
- `<tool_call>` text in `content` is handled by `extractToolCall`; `<think>` blocks by `stripThink`.

## Style
English UI copy (judges are international). `$12.00` formatting. Reasons as chips `[CODE] message`. Every page has empty and error states. Server components + small client islands. No auth: role links in the header.

## When stuck
Ask for the smallest failing repro (curl + response). Patch, don't rewrite. If Kiln is unreachable, set `KILN_BASE_URL` to another OpenAI-compatible endpoint for development only and leave `// TODO: revert to Kiln before submission`.
