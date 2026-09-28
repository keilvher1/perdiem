# PerDiem — demo video script (2:55, English)

Organizer limit: **≤ 3:00**. Target: **2:55** of narration + a 5-second end card at most. Follows the storyboard in `docs/PITCH.md`. Narration ≈ 427 words at ~150–155 words per minute, written to be voiced by ElevenLabs TTS (or read aloud). Numbers are said in words that stay true for any evidence run ("about seventy percent"), while the screen shows the exact values.

---

## 1. Timeline and shot list

| Time | Shot (screen) | Action on screen | On-screen caption | Doubles as evidence |
|---|---|---|---|---|
| 0:00–0:15 | Title card (slide 1 of `docs/deck.pdf`) | static; slow zoom optional | "PerDiem — an AI agent that spends your per-diem and cannot cross the line" | — |
| 0:15–0:40 | `/principal` | fill the grant form (budget $150, cap $40, meal/transport/supplies, 5 merchants, blocked: alcohol, wine, gift) → **Grant** → toast "Anchored on Sepolia" → click the anchor link → Etherscan → *Input Data* → *View Input As UTF-8* shows `PERDIEM-MANDATE|0x…` | "The budget and rules are hashed and anchored on Sepolia" | `09-principal.png` |
| 0:40–1:00 | `/traveler?m=<A>` | click chip #0 "Order a bibimbap lunch…, $12" → APPROVED card → status flips pending → settled → click "View on Etherscan" | "The model proposes. Code decides. The chain settles." | `01-approve.png` |
| 1:00–1:35 | `/traveler` (A, then B) | #1 taxi $85 → STOPPED `OVER_PER_TX_CAP`; #2 wine gift $30 → STOPPED with 3 chips; switch mandate to B → #3 dinner $10 → STOPPED `OVER_BUDGET_WITH_FEES` (hover the chip: $10 + fee > $10.00) | "Stopped: over the per-payment cap" → "Stopped: three reasons" → "Stopped: $10 + fee > $10" | `02-…`, `03-…` |
| 1:35–1:50 | `/principal` ⇄ `/traveler` | **Pause** A → #4 coffee $5 → STOPPED `MANDATE_NOT_ACTIVE` → **Resume** → #6 coffee $5 → APPROVED; switch to C → #5 → STOPPED `EXPIRED` | "The human can stop the agent at any time" | `10-paused.png`, `04-expired.png` |
| 1:50–2:30 | terminal, then `/audit/<A>` | `npm run export -- <A>` and `npm run verify -- evidence/mandate-<A>.json evidence/ledger-<A>.json` → all ✅ → `ALL RECORDS VERIFIED`; then `/audit/<A>`: anchor match, replay table, decoded memos | "An auditor can verify from records alone — no app needed" | `12-verify.txt`, `11-audit.png` |
| 2:30–2:55 | `/metrics` | scroll: tokens by flow (highlight the 0-token rows), thinking on vs off table, energy card with its assumption | "Efficient on the NPU by design" | `07-metrics.png` |
| 2:55–3:00 | End card | `github.com/keilvher1/perdiem` · "FuriosaAI x Bricksum — Challenge B" | — | — |

Tip: record each row as its own clip (you can retake one row without redoing the rest), then lay the TTS audio over the stitched clips and trim the clips to the audio.

---

## 2. Narration (with timestamps)

**[0:00–0:15] Title**
PerDiem is a policy layer for AI agents that spend money. It holds a traveler's per-diem budget and permitted merchants for one business trip, stops any payment outside those rules before it reaches the chain, and leaves receipts an auditor can verify.

**[0:15–0:40] Grant**
Here is the finance manager. She grants a mandate once: a hundred and fifty dollars, forty per payment, meals, transport and supplies, five merchants, and a few blocked words. PerDiem hashes those terms and anchors the hash on the Sepolia testnet. On Etherscan, the transaction data carries that hash.

**[0:40–1:00] First payment**
Now the traveler talks to the agent. The agent runs on Kiln — Qwen3 32B on Furiosa NPUs — and it can do exactly one thing: propose a payment through a tool call. Code checks the proposal, and only then does the payment go out. Pending… settled. Twelve dollars for lunch, on-chain.

**[1:00–1:35] Pushed outside the line**
Now let's push it. A taxi to the airport for eighty-five dollars: stopped — over the per-payment cap. A bottle of wine as a gift for a client: stopped, with three reasons at once — the merchant is not on the list, the category is not allowed, and the request mentions a blocked word. And on a second mandate with a ten-dollar budget, a ten-dollar dinner: stopped, because the real network fee is added, and ten dollars plus even a fraction of a cent is over budget. Every refusal is written to the ledger, without a second model call.

**[1:35–1:50] Kill switch and deadline**
The manager can stop the agent at any moment. Pause — the next coffee is stopped. Resume — the same coffee goes through. And a mandate whose deadline has passed stops everything.

**[1:50–2:30] Verify from records alone**
Now the auditor. We export the mandate and the ledger as plain files. The verify script uses only those files and a public Sepolia node — no database, no access to our app. It recomputes the mandate hash and matches it to the anchor, replays every decision through the same policy code, and checks that each payment's receipt hash, recipient and amount match the transaction on-chain. Everything is green. If anyone edits a single decision by hand, it turns red.

**[2:30–2:55] Efficient on the NPU**
And it is cheap by design. Token use is reported per flow. Status questions are answered from the ledger — zero tokens. Refusals come from a template — zero tokens. For proposals, thinking is switched off: the model still made the right tool call every time, with about seventy percent fewer output tokens and less than half the latency. Energy is estimated from tokens, with the assumption shown next to it.

**[2:55–3:00] End card** *(no narration, or:)* PerDiem. Challenge B.

Word count ≈ 427 (≈ 2:51 at 150 wpm, ≈ 2:45 at the 155 wpm typical of TTS voices, plus ≈ 6 s of breaks). If the TTS reads slower than 2:55, cut "Pending… settled." first, then "Now let's push it."

---

## 3. TTS-ready text (paste into ElevenLabs, one block per clip)

Plain text, no markdown. `<break time="0.6s" />` tags work with ElevenLabs models that support SSML-style breaks; delete them if your model reads them aloud. Spelled-out forms are there on purpose.

```
PerDiem is a policy layer for AI agents that spend money. <break time="0.3s" /> It holds a traveler's per diem budget and permitted merchants for one business trip, stops any payment outside those rules before it reaches the chain, and leaves receipts an auditor can verify.
```
```
Here is the finance manager. She grants a mandate once: a hundred and fifty dollars, forty per payment, meals, transport and supplies, five merchants, and a few blocked words. <break time="0.3s" /> PerDiem hashes those terms and anchors the hash on the Sepolia testnet. On Etherscan, the transaction data carries that hash.
```
```
Now the traveler talks to the agent. The agent runs on Kiln, Qwen three, thirty-two B, on Furiosa N P Us, and it can do exactly one thing: propose a payment through a tool call. Code checks the proposal, and only then does the payment go out. <break time="0.6s" /> Pending. <break time="0.4s" /> Settled. Twelve dollars for lunch, on chain.
```
```
Now let's push it. A taxi to the airport for eighty-five dollars: <break time="0.3s" /> stopped. Over the per payment cap. <break time="0.4s" /> A bottle of wine as a gift for a client: <break time="0.3s" /> stopped, with three reasons at once. The merchant is not on the list, the category is not allowed, and the request mentions a blocked word. <break time="0.4s" /> And on a second mandate with a ten dollar budget, a ten dollar dinner: <break time="0.3s" /> stopped, because the real network fee is added, and ten dollars plus even a fraction of a cent is over budget. Every refusal is written to the ledger, without a second model call.
```
```
The manager can stop the agent at any moment. Pause. <break time="0.3s" /> The next coffee is stopped. Resume. <break time="0.3s" /> The same coffee goes through. And a mandate whose deadline has passed stops everything.
```
```
Now the auditor. We export the mandate and the ledger as plain files. The verify script uses only those files and a public Sepolia node. No database, no access to our app. <break time="0.3s" /> It recomputes the mandate hash and matches it to the anchor, replays every decision through the same policy code, and checks that each payment's receipt hash, recipient and amount match the transaction on chain. <break time="0.4s" /> Everything is green. If anyone edits a single decision by hand, it turns red.
```
```
And it is cheap by design. Token use is reported per flow. Status questions are answered from the ledger: zero tokens. Refusals come from a template: zero tokens. For proposals, thinking is switched off. The model still made the right tool call every time, with about seventy percent fewer output tokens and less than half the latency. <break time="0.3s" /> Energy is estimated from tokens, with the assumption shown next to it.
```

Suggested voice settings: a calm, neutral English voice; stability ≈ 0.5, similarity ≈ 0.75, style 0, speed 1.0. Pronunciation: PerDiem = "per DEE-em", Qwen = "chwen", Sepolia = "seh-POH-lee-uh", Furiosa = "fyoo-ree-OH-sa", Kiln = "kiln". Export each clip as MP3/WAV and note its length; the clip lengths should add up to ≤ 2:55.

---

## 4. Recording checklist

**Before the take (15 min)**
- [ ] Clean `main` checked out with all three branches merged; `npm run build` green.
- [ ] `.env.local` has `NEXT_PUBLIC_API_MODE=live`. **Never open `.env.local` on screen**; close any terminal whose history shows keys (`clear` and a fresh window).
- [ ] Server with a kept log: `mkdir -p logs && npm run dev 2>&1 | tee logs/dev-server.log` (port 3000).
- [ ] `/api/health` shows `modelAvailable: true` and a test-ETH balance ≥ 0.01 ETH.
- [ ] **Fresh demo set for this take:** `npm run seed -- --window now` (the DUPLICATE window is 5 minutes, and runs #0/#6 spend ~$17 of test ETH ≈ 0.0045 ETH per take). Note the A/B/C ids from `evidence/seed-latest.json`.
- [ ] Mandate creation in 0:15–0:40 uses the form (one extra anchor tx, gas only); the traveler runs use the seeded A/B/C so B ($10) and C (expired) exist.
- [ ] Browser: one window at 1920×1080, browser zoom 100% (the traveler chat needs ≥ 950 CSS px of viewport height to show a 3-reason STOP card whole; on a 1512×982 MacBook screen use 90% browser zoom instead; never zoom above 100% — at 1280×800 / 125% the wine card's "Stopped — nothing was sent" header is cut off), bookmarks bar hidden, notifications off (macOS Focus), no other tabs with personal data. Pre-open tabs: `/principal?m=<A>`, `/traveler?m=<A>`, `/audit/<A>`, `/metrics`.
- [ ] Terminal: large font (≥ 18 pt), dark theme, prompt without the user/host name, commands ready: `npm run export -- <A>` and `npm run verify -- evidence/mandate-<A>.json evidence/ledger-<A>.json`.
- [ ] Energy assumption set (`ENERGY_J_PER_TOKEN`, `ENERGY_SOURCE`) — or be ready to show the "assumption not set" state honestly.
- [ ] `/metrics` shows the thinking on/off table (read from the committed `docs/reasoning-comparison.json`). Do not re-run `npm run compare` unless you also update the README tables and re-render the deck (it overwrites the measurement).
- [ ] Only this one server is running against the shared database and wallet (stop the FE/BE/FS dev servers on 3100/3001/3200).

**During the take**
- [ ] Record clip by clip (section 1 rows). Move the mouse slowly; pause 1 s on each STOP card so the reasons can be read.
- [ ] On the wine card, hover a reason chip once; on the $10 dinner card, show the "$10 + fee" message.
- [ ] Optional tamper shot for "if anyone edits a single decision by hand, it turns red" (1:50–2:30): copy the exported ledger outside the repo (`cp evidence/ledger-<A>.json /tmp/ledger-tampered.json`), change **only** the `decision` field of the #1 taxi entry from `"STOP"` to `"APPROVE"`, run `npx tsx scripts/verify.ts evidence/mandate-<A>.json /tmp/ledger-tampered.json` → `❌ … stored APPROVE == recomputed STOP (OVER_PER_TX_CAP)`, `1 CHECK(S) FAILED`. Edit nothing else: clearing `reasons` as well on the paused #4 entry replays as APPROVE and stays green (README → Approval & evidence → Limitation).
- [ ] Wait for "settled" on camera once (#0); for #6 a cut is fine.
- [ ] Order matters: #4 must be sent while A is paused and #6 after Resume (the scenario order in `contracts/api.ts`).

**After the take**
- [ ] Stitch the clips, lay the TTS audio, trim to **≤ 3:00** (target 2:55). Add the captions from section 1 (bottom third, ≥ 32 px, 3–4 s each).
- [ ] Export 1080p MP4 (H.264). Keep the file as `evidence/demo-<date>.mp4` locally (git-ignored — never commit video).
- [ ] Upload as **unlisted** (YouTube or similar), open the link in an incognito window, check audio and length.
- [ ] Put the link on the `Video (≤ 3 min): …` line at the top of README.md and in the submission form.
- [ ] Run `npm run metrics` after the take so `evidence/kiln-calls-by-flow.md` includes the calls you just recorded.

**If something goes wrong on camera**
- Kiln slow or 5xx → wait 10 s and resend the same chip once; if it keeps failing, record that clip later.
- A payment stays pending > 2 min → keep recording other clips; confirm later with `/api/ledger/<id>/confirm`.
- You sent a request twice → `DUPLICATE` stop (this is correct behavior); reseed for a clean take.
