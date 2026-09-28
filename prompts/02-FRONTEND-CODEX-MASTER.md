# 02 — Codex (GPT-6 Astra) 프론트엔드 마스터 프롬프트

**쓰는 법:** ChatGPT → Codex → 새 태스크. 저장소 `perdiem`, 브랜치 `main`(Claude Code가 Phase 0을 푸시한 뒤)을 선택하고, 아래 "=== PROMPT START ===" 부터 "=== PROMPT END ===" 까지를 붙여넣습니다. Codex는 저장소의 `AGENTS.md`를 자동으로 읽으므로 소유권 규칙은 거기에도 있습니다. 결과는 `feat/frontend` 브랜치의 PR 하나입니다. Codex CLI를 쓴다면 저장소 루트에서 같은 프롬프트를 붙여넣으면 됩니다.

Codex가 질문을 하면 "계약서(contracts/api.ts)대로, 목 데이터(docs/fixtures)대로, 나머지는 네 판단으로" 라고 답하면 됩니다. 시간이 없으면 §7의 우선순위대로 잘라도 됩니다.

---

=== PROMPT START ===

You are building the **frontend** of **PerDiem** for a 48-hour hackathon (GWDC 2026 Korea, FuriosaAI x Bricksum, Challenge B: "Build the Controls and Records for an AI Agent That Spends"). Work on branch `feat/frontend` from `main`, commit in small steps, and open one PR when done. Read `AGENTS.md` first, then `contracts/api.ts`, then skim `docs/PRD.md` (background only; the contract wins).

The backend is being built at the same time by another agent. **You never call the backend directly and never touch its files.** You build against `contracts/api.ts` and `docs/fixtures/*.json`, with a mock mode that makes the whole UI demoable without a backend.

## 1. What PerDiem is (for copy and tone)

A finance manager ("Principal") grants an AI agent a per-diem budget and rules (a "mandate") for one business trip. The traveler chats with the agent to buy things. The agent only *proposes* a payment; a deterministic policy engine in code approves or **stops** it; approved payments settle on the Ethereum Sepolia testnet with the mandate hash and a receipt hash written into the transaction; an auditor can verify everything from records alone. The demo story is a trip to this very conference.

Tone: calm fintech tool, not crypto-flashy. English UI copy. Judges score "stopping is recorded, not silent", so **refusals must look as deliberate and informative as approvals.**

## 2. Stack and constraints

- Already on `main`: Next.js App Router + TypeScript + Tailwind + shadcn/ui (button, card, input, badge, table, textarea, separator, skeleton, tabs, tooltip, select, switch, dialog, sonner, progress, checkbox, collapsible, label, sheet, scroll-area, popover, alert), `lucide-react`, alias `@/*`. **Do not run `npm install` or `npx shadcn add`** (your sandbox may be offline and any `package.json` change conflicts at merge); hand-write anything missing with Tailwind.
- Everything that fetches is a client component (`"use client"`). No server actions, no route handlers, no `lib/{kiln,policy,chain,agent,db}` imports, no env vars other than `NEXT_PUBLIC_API_MODE`.
- Types: import from `@/contracts/api` only. Do not redeclare domain types.
- State: React state + URL search param `?m=<mandateId>` for the selected mandate (shared by Traveler, Principal, Metrics; the Audit page uses its path param and the selector links to `/audit/<id>`); `localStorage` only to remember the last selected mandate.
- `app/layout.tsx` stays a **server component**. Put the nav, MandateSelector and health badge in a `"use client"` `<AppShell>` and wrap it in `<Suspense>` — `useSearchParams` outside Suspense fails `next build`. In `app/audit/[mandateId]/page.tsx` read the id with `useParams<{ mandateId: string }>()` (client component; `params` is a Promise in server components).
- Polling instead of websockets: ledger/mandate views refresh every 5 s while mounted; entries call `confirm` every 5 s **only while `status === "pending" && txHash`** until `settled` or `failed` (live returns 400 for entries without a tx). `/audit` and `/metrics` fetch once with a manual Refresh button (audit does one RPC call per transaction on the server).
- Mandate ids in `DEMO_SCRIPT` are prefixes (`man_A`); live ids look like `man_A_k3x9`. Match with `id.startsWith(prefix)` everywhere (quick chips, hints).
- Money: format with `lib/format.ts` — `fmtUsd(n)`: if `n` has no sub-cent part show two decimals (`$12.00`); otherwise show up to six decimals with trailing zeros trimmed (`$10.1006`, `$0.0989`) — this is the backend's exact rule; `fmtHash(h)` → `0x6f83…af6e` with a copy button; `fmtRel(iso)` → "2 min ago"; `fmtDate(iso)` in the viewer's locale.
- Accessibility basics: buttons have labels, color is never the only signal (icons + text on status), focus visible.
- Responsive: designed for 1280 px desktop (demo video), must not break at 390 px.

## 3. `lib/api-client.ts` (build this first)

Export one object `api` with typed methods matching `ENDPOINTS`:

```ts
health(): Promise<HealthResponse>
merchants(): Promise<MerchantsResponse>
mandates(): Promise<MandatesResponse>
mandate(id): Promise<MandateDetailResponse>
createMandate(body: CreateMandateRequest): Promise<CreateMandateResponse>
updateMandateStatus(id, status): Promise<UpdateMandateStatusResponse>
chat(body: ChatRequest): Promise<ChatResponse>
ledger(mandateId): Promise<LedgerResponse>
confirm(entryId): Promise<ConfirmResponse>
usage(): Promise<UsageResponse>
audit(mandateId): Promise<AuditResponse>
```

Mode = `process.env.NEXT_PUBLIC_API_MODE === "live" ? "live" : "mock"`.

**live:** `fetch(path, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" })` — `POST` for `chat` and `createMandate`, `PATCH` for `updateMandateStatus`, `GET` otherwise. On non-2xx, try to parse the body as `ApiError`; if the body is not JSON (a Next error page), use `{ code: "HTTP_" + status, message: response.statusText }`. Throw `new ApiClientError(status, code, message)`. Export the error class.

**mock:** static-import the JSON files under `docs/fixtures/` (`import healthJson from "@/docs/fixtures/health.json"`). JSON imports widen literal types (`"0x…"` becomes `string`, `"settled"` becomes `string`), so cast once at the import site: `const health = healthJson as unknown as HealthResponse`. Never copy or edit the fixture files. Behaviour:
- 300–800 ms random latency on every call; `health` always ok.
- Keep an in-memory store seeded from the fixtures: mandates (A, B, C summaries + details), ledgers, usage.
- `updateMandateStatus` mutates the store (so Pause/Resume works in the demo).
- `chat`: pick the first rule in `chat-responses.json` whose `match` regex (case-insensitive) hits the text **and** whose `mandateId` is `"*"`, equals the request's mandateId, or equals `<mandateId>:paused` when that mandate is currently paused in the store (check paused rules first). Return a deep copy with a fresh `entry.id` (`led_<timestamp>`) and `at = now`; append the entry to that mandate's ledger and bump spent/remaining when the decision is APPROVE. No rule → `fallback`.
- `confirm`: an entry created ≥ 10 s ago flips to `settled` (use `settlement-settled.json`, set `actualFeeUsd`, `settledAt`); earlier → `pending`.
- `createMandate`: build a `MandateDetail` from the request (catalog = merchants fixture, agentWallet = health fixture address, status active), compute a fake but stable hash (`0x` + 64 hex chars derived from `JSON.stringify(body)` via a tiny FNV hash — no crypto libs), fake anchor tx, add to store.
- `audit`: return `audit-man_A.json` for any id but replace `mandate` with the store's mandate when the id differs (keep the checks all ✅).
- `usage`: return `usage.json`, adding the usage records produced by chats in this session.

Export `DEMO_SCRIPT` re-exported from the contract so the Traveler page can offer the scripted prompts as quick chips.

## 4. Layout

`app/layout.tsx`: top bar with wordmark **PerDiem** (small tagline "delegated spend, kept inside the line"), nav links `Traveler  Principal  Audit  Metrics` (spaced links, active one underlined), a global **MandateSelector** (select from `api.mandates()`, shows `id`, traveler, status pill, remaining/budget; persists `?m=` on navigation), and a right-side badge `Testnet | Sepolia | 1 ETH = $4,000 demo rate` (read `demoEthUsd` from `health`). Sonner `<Toaster />` mounted once. Footer: "Challenge B | FuriosaAI x Bricksum | GWDC 2026 Korea".

`app/page.tsx`: redirect to `/traveler`.

Nav is four spaced links; the active one is underlined. Shared components (in `components/perdiem/`):
- `StatusPill` — LedgerStatus and MandateStatus variants: `approved`/`settled` emerald, `pending` amber with a subtle spinner, `stopped` rose, `failed` slate, mandate `active` emerald / `paused` amber / `revoked` slate. Icon + text.
- `ReasonChips` — one chip per `StopReason`: monospace `[CODE]` + message; tooltip shows `observed` / `limit` when present.
- `HashChip` — truncated hash, copy button, optional external link (Etherscan) opening in a new tab.
- `MoneyText` — right-aligned tabular numerals.
- `EmptyState`, `ErrorState` (with retry), `LoadingRows` (skeletons).
- `LedgerTable` — columns: time, merchant (name + category), amount, fee, total, decision, reasons, status, tx. (Optional, last priority: row click expands an inline details row with proposal.sourceText, memo, hashes, kilnResponseId, toolArgsRaw.)
- `ReceiptCard` — used in the chat: APPROVED (emerald border; amount, est. fee, status pill that auto-updates pending → settled, "View on Etherscan"), STOPPED (rose border; "Stopped — nothing was sent", ReasonChips, "Recorded in ledger as <id>").

## 5. Pages

### `/traveler` — the agent chat (most important)
- Header card: selected mandate — traveler, principal, **remaining / budget** as a slim progress bar, per-tx cap, window (start → end), status pill. If paused/revoked/expired, show a quiet banner ("The principal paused this mandate. Requests will be stopped.").
- Chat column: message list (user bubbles right, agent replies left). Agent replies that include an `entry` render a `ReceiptCard` under the text; replies with `entry: null` render as plain text (e.g. the balance answer).
- Composer: textarea + Send (Enter to send, Shift+Enter newline), disabled while awaiting. Above it, **quick chips** for the 8 `DEMO_SCRIPT` prompts filtered to the selected mandate (`man_A` chips on A, etc.; also show all with a "for man_B" hint). Clicking a chip fills the composer.
- Right rail (hidden < 1024 px): "This session" — tokens used per flow from the `usage` arrays of the replies in this session (propose / status_fastpath / stop_template), count of stopped vs approved, a small note "Refusals never call the model".
- After an APPROVED reply: poll `confirm` until settled; update the card and toast "Settled on Sepolia, fee $0.0989".

### `/principal` — grant, watch, stop
- Left (≈ 40%): **Grant a mandate** form → `createMandate`. Keep it simple: principal, traveler, budget (USD), per-transaction cap, allowed categories (checkboxes from the merchants' categories), allowed merchants (checkbox list from `merchants`), blocked keywords (one comma-separated input), window start/end (datetime-local, default now → +2 days). Plain client validation (cap ≤ budget, end > start). On success: toast with "Anchored on Sepolia" + Etherscan link, select the new mandate.
- Right: selected mandate — summary tiles (Budget, Spent, Pending, Remaining), **Pause / Resume / Revoke** buttons (confirm dialog for Revoke; Revoke is final and disables the others), hash + anchor tx `HashChip`s, then `LedgerTable` (auto-refresh 5 s).
- (Optional, last priority) "How the boundary works" collapsible: the 12 stop codes with one-line meanings.

### `/audit/[mandateId]` — verify from records alone
- Banner: `N of N checks passed` (emerald) or `X failed` (rose), with the line "This page does not trust the stored decisions — it recomputes them."
- Section 1 **Mandate terms**: pretty JSON of the mandate (catalog collapsed), recomputed hash, anchor tx `HashChip`, decoded memo, ✅/❌ "anchor matches recomputed hash".
- Section 2 **Replay**: table from `replay[]` — entry id, stored decision, recomputed decision, consistent ✅/❌, mandate hash ✅/❌, recomputed reasons as chips.
- Section 3 **Transactions**: table from `transactions[]` — entry, tx (link), recipient ✅, amount ✅, receipt hash ✅, memo ✅, decoded memo in monospace.
- "Verify yourself" box: the exact command `npx tsx scripts/verify.ts evidence/mandate-<id>.json evidence/ledger-<id>.json` with a copy button.

### `/metrics` — tokens, cost, energy
- Table 1 **Tokens by flow** from `byFlow`, plus totals row; highlight the 0-token rows (`status_fastpath`, `stop_template`) with a note "answered without the model".
- Tiles: "Status questions answered without the model: N", "Refusals explained without the model: N", "Cost so far: $0.000xx".
- Table 2 **Thinking on vs off** from `comparison` (if null, show an empty state "run `npm run compare`"): per prompt tool call ✓, completion tokens on/off, latency on/off; summary tiles: tool calls 5/5 vs 5/5, completion −71%, latency 2.9 s → 1.1 s (use the numbers in the payload, never hardcode).
- **Energy** card: if `assumedJPerToken` is null → "Assumption not set — see README"; else `totalWh` with the assumption and source printed right next to it. Never show the number without the assumption.

## 6. Visual design

- Light theme only (no dark mode work). Background `zinc-50`, cards white with `border-zinc-200`, text `zinc-900/600`. Accent: `indigo-600` for primary actions only. Status colors as in StatusPill. Monospace (`font-mono`) for hashes, codes, JSON.
- Typography: 14 px base, 20/28 px headings, generous whitespace (cards `p-6`, gaps `gap-6`). No gradients, no emoji in UI.
- Tables: sticky header, zebra-free, hover row, right-aligned numbers with `tabular-nums`.
- Every async area: skeleton while loading, `EmptyState` when empty ("No requests yet — try a quick prompt"), `ErrorState` with retry on `ApiClientError`.

## 7. Priority if time runs out
1. `lib/api-client.ts` (both modes) + layout + MandateSelector
2. `/traveler` with ReceiptCard, quick chips, pending → settled polling
3. `/principal` (summary tiles, Pause/Resume/Revoke, LedgerTable); the grant form can be simplified to the required fields
4. `/audit/[mandateId]`
5. `/metrics`
6. Polish (inline details row, boundary explainer)

**Open the PR as soon as items 1–3 work** (with screenshots), then keep pushing items 4–6 to the same branch. The integration starts at 06:00 KST Sep 29 from whatever is on the branch then.

## 8. Definition of done / PR
- `NEXT_PUBLIC_API_MODE=mock npm run build` passes; `npm run lint` shows no errors in files you own (do not touch backend files to silence lint).
- Walk-through in mock mode: select `man_A` → send the 8 `DEMO_SCRIPT` prompts in order (pause via `/principal` before #4, resume before #6; switch mandate to B for #3 and C for #5) → outcomes match the `expect` strings; approved cards flip to settled after ~10 s; `/audit/man_A` shows all ✅; `/metrics` shows 0-token rows and the comparison table.
- Only the paths listed in `AGENTS.md` are touched. `contracts/api.ts`, `docs/fixtures/**`, `package.json`, `package-lock.json` unchanged (`git diff --stat main -- contracts docs/fixtures package.json package-lock.json` is empty).
- PR description: files touched, how to run mock mode, screenshots of the four pages, any `TODO(contract)` notes.

=== PROMPT END ===
