# Evidence run — runbook (lead, one server on port 3000)

Owner of this file: planner + full-stack dev (FS). Written 2026-09-28 (Mon) 20:15 KST for tonight's run. Replaces the short order in `docs/REVIEW-NOTES.md` §6.

**What it produces** (all in `evidence/`, names from `docs/PLAN.md` §4): the eight scripted runs on real Kiln + Sepolia (`scenario-*.json`), exported records and `12-verify.txt`, the nine checklist PNGs, `05-health.json`, `14-evidence-drawer.png`, optionally `13-trip-statement.pdf`, and the log-derived files (`06-kiln-calls.txt`, `kiln-calls-by-flow.md`, `logs-stop.txt`, `logs-status.txt`, `metrics.md`). Then README markers, the deck, a secret scan and one commit.

**Time:** about 75 minutes. **Test ETH:** about 0.009 ETH (two demo sets; details in the last section).

**Rules for the whole run**
- Exactly one PerDiem server, on port 3000. Locks and the wallet's nonce manager are per process, and every worktree shares one database and one wallet (`docs/REVIEW-NOTES.md` issue 1).
- Run every command from the repo root of the lead worktree (`/Users/mac/perdiem`, branch `main`) in a **second** terminal; terminal 1 only runs the server.
- Do not edit files in the repo while the server runs (dev hot reload can interfere with the capture). Commit at the end.
- Never open `.env.local` on screen and never paste a value from it anywhere. The checks below print counts, not values.
- Never commit mock-mode output (placeholder hashes), downloaded files, `logs/`, or a video file.
- Every step ends with **Go / no-go**. On a no-go, stop and fix before spending more test ETH.

---

## 0. Preconditions

```bash
cd /Users/mac/perdiem && git status --short && git log --oneline -1
npm run typecheck && npm run lint && npm test && npm run build && NEXT_PUBLIC_API_MODE=mock npm run build
grep -c '^NEXT_PUBLIC_API_MODE=live$' .env.local     # 1
grep -c '^DEMO_ETH_USD=4000$' .env.local             # 1 (verify.ts and the app must use the same rate)
grep -c '^ENERGY_J_PER_TOKEN=' .env.local            # 1 (its value is checked through /api/usage in step 3)
grep -rl 'data-evidence-fab' components app | head -1   # the Evidence button is merged (prints a file)
ls app/api/_lib/audit.ts scripts/db-clean.ts /Users/mac/perdiem-tools/node_modules/playwright/package.json
ls 'app/audit/[mandateId]/report/page.tsx'              # the printable statement shipped (FE 4504769); optional
```

In Chrome (for step 8 and the video): downloads go to `~/Downloads`, "Ask where to save each file" is **off**. Move older record files out of the way so Chrome does not save the new ones as `… (1).json`:

```bash
mkdir -p ~/perdiem-old-downloads && find ~/Downloads -maxdepth 1 \( -name 'mandate-man_*.json' -o -name 'ledger-man_*.json' \) -exec mv {} ~/perdiem-old-downloads/ \;
```

**Go / no-go:** working tree clean on `main` with the round-2 merges (FE Evidence button + receipt card, BE `5fbd6c7` audit count in `app/api/_lib/audit.ts`, `76b155e` log lines, `bf87060` db-clean, FS); all five gates exit 0; the three `grep -c` print `1`; `ls` finds all three files. If `data-evidence-fab` is missing, the button did not ship: skip the drawer parts of steps 8 and 9 and remove the Evidence-button lines listed in step 12. If `app/api/_lib/audit.ts` is missing, `/audit` still counts 19 instead of 24 for mandate A: merge `feat/backend` first, or remove the sentence "`GET /api/audit/<id>` counts them with the same formula" from the README (step 12).

## 1. Stop all other servers

```bash
lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(3000|3001|3100|3200|3297|3299) ' || echo "no servers"
pkill -f 'next dev -p 3001'; pkill -f 'next dev -p 3100'; pkill -f 'next dev -p 3200'; pkill -f 'next start -p 3001'
pkill -f 'mock-app'; pkill -f 'mock-server'
lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(3000|3001|3100|3200|3297|3299) ' || echo "no servers"
```

Also ask FE, BE and FS in chat to stop their servers and not to start one until you say so.

**Go / no-go:** the last line prints `no servers`.

## 2. Back up and clean the database (no server running)

`scripts/db-clean.ts` (backend) always writes a full backup first (outside the repo; it refuses a path inside any worktree), and deletes nothing without `--apply`. Dev and QA sets present at 20:00 KST (read-only `GET /api/mandates`): `man_{A,B,C}_devbe1` (backend dev) and `man_{A,B,C}_qalv0928` (QA, not anchored). **Keep** `man_{A,B,C}_mul19mde`: the README's committed backend-run evidence refers to it.

Dry run:

```bash
npx tsx --env-file=.env.local scripts/db-clean.ts --backup ~/perdiem-backups/ --suffix devbe1,qalv0928 --usage
```

Expected: `backup: /Users/mac/perdiem-backups/perdiem-db-backup-<UTC>.json` with `mandates 9, merchants 7, ledger_entries 16, usage_records 35` or more (counts at 19:58 KST); `WOULD DELETE (dry run)` 6 mandates with 9 ledger entries and all usage rows; `KEPT: 3 mandate(s): man_A_mul19mde, man_B_mul19mde, man_C_mul19mde`.

**Go / no-go before `--apply`:** the KEPT list is exactly the three `mul19mde` mandates. If it lists anything else (a newer QA or dev set), add that suffix to `--suffix` and dry-run again; if it is not a throwaway set, stop and ask its owner.

Apply (writes a second, fresh backup, then deletes):

```bash
npx tsx --env-file=.env.local scripts/db-clean.ts --backup ~/perdiem-backups/ --suffix devbe1,qalv0928 --usage --apply
```

**Go / no-go:** `deleted: ledger_entries 9, mandates 6, usage_records <all>` and `now: 3 mandate(s) left: man_A_mul19mde, man_B_mul19mde, man_C_mul19mde`. `/metrics` now starts from zero, so tonight's token table covers only tonight. Restore, if ever needed: insert the backup's tables in the order merchants, mandates, ledger_entries, usage_records.

## 3. Start the one server (terminal 1)

```bash
cd /Users/mac/perdiem && mkdir -p logs && npm run dev 2>&1 | tee logs/dev-server.log
```

Terminal 2:

```bash
curl -s localhost:3000/api/health | jq '{ok, model, modelAvailable, agentAddress, balanceEth, demoEthUsd, rpc, errors}'
curl -s localhost:3000/api/mandates | jq -r '.mandates[].id'
curl -s localhost:3000/api/usage | jq '{calls: .totals.calls, energy: .energy.assumedJPerToken}'
curl -s localhost:3000/api/audit/man_A_mul19mde | jq '.summary'     # read-only; RPC reads only
```

**Go / no-go:** `ok: true`, `modelAvailable: true`, `demoEthUsd: 4000`, `errors: []`, `balanceEth` ≥ **0.012** (0.0455 at 20:00 KST); the mandate list is the three `mul19mde` ids; usage `calls: 0` (cleaned) and `energy: 0.429`; the kept backend-run mandate audits as `{"passed": 24, "total": 24, "allVerified": true}` — the same 24 that `scripts/verify.ts` prints for its committed files (it was 19 before `5fbd6c7`). `logs/dev-server.log` is growing (`wc -l logs/dev-server.log`).

## 4. Seed 1 — the API evidence set (3 anchor txs, ≈ 0.0001 ETH)

```bash
npm run seed -- --window now --suffix ev1
cp evidence/seed-latest.json evidence/seed-1.json
A1=man_A_ev1; B1=man_B_ev1; C1=man_C_ev1
```

**Go / no-go:** three `anchor broadcast 0x…` lines and `wrote evidence/seed-latest.json (A=man_A_ev1, …)`. If seed says `already exists`, pick a new suffix (`ev1b`) and use it everywhere below.

## 5. Scenario — the eight scripted runs (2 payments, ≈ 0.0043 ETH)

```bash
npm run scenario
```

**Go / no-go:** exit 0 and `8/8 runs match the expected outcome. Saved evidence/scenario-<YYYYMMDD-HHmm>.json`; #0 and #6 `APPROVE` with a tx hash and `settled` after the confirm polls; #1 `OVER_PER_TX_CAP`; #2 `MERCHANT_NOT_ALLOWED, CATEGORY_NOT_ALLOWED, BLOCKED_KEYWORD`; #3 `OVER_BUDGET_WITH_FEES`; #4 `MANDATE_NOT_ACTIVE`; #5 `EXPIRED`; #7 0 tokens, no entry. On exit 1: read the table. Do not re-run on the same set within 5 minutes (that trips `DUPLICATE` by design); a clean retry is a new seed (`--suffix ev1b`, another ≈ 0.0044 ETH) and steps 4–5 again.

## 6. Wait until every payment has settled

```bash
curl -s localhost:3000/api/mandates/$A1 | jq '{pendingUsd: .mandate.pendingUsd, spentUsd: .mandate.spentUsd, statuses: [.ledger[].status]}'
curl -s localhost:3000/api/audit/$A1 | jq '.summary'
```

**Go / no-go:** `pendingUsd: 0`; statuses `settled, stopped, stopped, stopped, settled` (5 entries); audit summary `{"passed": 24, "total": 24, "allVerified": true}`. If a payment stays `pending` for more than 2 minutes, poll `curl -s localhost:3000/api/ledger/<entryId>/confirm | jq .settlement` and wait; never export while anything is pending (verify's "tx mined and succeeded" fails for an unmined payment, and the file keeps status `pending`).

## 7. Export and verify from records alone

```bash
npm run export -- $A1 $B1 $C1
npm run -s verify -- evidence/mandate-$A1.json evidence/ledger-$A1.json > evidence/12-verify.txt; echo "exit=$?"
grep -c '^✅' evidence/12-verify.txt; grep -c '^❌' evidence/12-verify.txt; tail -1 evidence/12-verify.txt
npm run -s verify -- evidence/mandate-$B1.json evidence/ledger-$B1.json > evidence/12-verify-B.txt; echo "exit=$?"
npm run -s verify -- evidence/mandate-$C1.json evidence/ledger-$C1.json > evidence/12-verify-C.txt; echo "exit=$?"
grep -c '^✅' evidence/12-verify-B.txt evidence/12-verify-C.txt
```

Use `npm run -s` (silent): without it npm writes its own banner into the file, and the deck quotes the file's first line.

**Go / no-go:** export prints no `pending` note; A: `exit=0`, `24` ✅, `0` ❌, `ALL RECORDS VERIFIED`, and 24 equals the audit `total` of step 6. Check-count formula: 2 (anchor memo, anchor sender) + 2 × entries (carries the mandate hash, stored == recomputed decision) + 6 × entries with a tx hash (receipt hash, calldata memo, recipient, amount, payer, mined) = 2 + 10 + 12. B and C: `exit=0`, `4` ✅ each (anchor 2 + one STOP entry 2).

## 8. Evidence drawer: download A and compare byte for byte

In Chrome: `http://localhost:3000/traveler?m=man_A_ev1` → **Evidence** (bottom right) → drawer shows `Live records`, 2 settled / 3 stopped, no pending warning → **Download** the mandate file, then the ledger file (two separate clicks; allow "multiple downloads" if Chrome asks). Optional: **Run checks now** → `24 of 24 checks passed`.

```bash
cmp evidence/mandate-$A1.json ~/Downloads/mandate-$A1.json && cmp evidence/ledger-$A1.json ~/Downloads/ledger-$A1.json && echo IDENTICAL
npm run -s verify -- ~/Downloads/mandate-$A1.json ~/Downloads/ledger-$A1.json | grep -c '^✅'
npm run -s verify -- ~/Downloads/mandate-$A1.json ~/Downloads/ledger-$A1.json | tail -1
```

**Go / no-go:** `IDENTICAL`; `24`; `ALL RECORDS VERIFIED`. If `cmp` reports a difference, check whether only formatting differs: `diff <(jq -S . evidence/ledger-$A1.json) <(jq -S . ~/Downloads/ledger-$A1.json) && echo "same content"`. Same content → replace "byte-identical to what `npm run export` writes" in README (Approval & evidence) with "the same records as `npm run export` writes" and continue; different content → do not claim the download path in the README or the video, report to FE, continue with the export path. Leave the downloaded files in `~/Downloads`; never copy them into `evidence/`.

## 9. Capture the pages, the drawer and (if shipped) the report — GETs only, no spending

```bash
npx tsx scripts/capture.ts --only pages,drawer
npx tsx scripts/capture.ts --only report
```

Both read the ids from `evidence/seed-latest.json` (still seed 1 here). The first writes `05-health.json`, `09-principal.png`, `08-tx-and-ledger.png`, `11-audit.png`, `07-metrics.png` and `14-evidence-drawer.png` (the drawer after "Run checks now"), plus `capture-log-pages-drawer.json`. The second writes `13-trip-statement.pdf` (A4, no header/footer) only if `/audit/<A>/report` exists; otherwise it prints a warning and saves nothing. If the report route is merged later, run `npx tsx scripts/capture.ts --only report --mandates man_A_ev1` later against the same database.

**Go / no-go:** no `!` warnings except, if the route is not merged, the `report … 404` one. Open every file and look: `11-audit.png` shows 24 of 24; `08-tx-and-ledger.png` shows a ledger row next to its transaction (Etherscan, or the decoded calldata if Etherscan blocked the headless browser); `14-evidence-drawer.png` shows the latest receipt, the download buttons and `24 of 24 checks passed`; the Evidence button and the Next.js "N" badge are **not** in 05–11; `13-trip-statement.pdf` (if any) has no URL, date stamp or local path in its margins.

## 10. Seed 2 + the chat screenshots (3 anchors + 2 payments, ≈ 0.0044 ETH)

The chat lives in page state, so the receipt and stop cards exist only for requests typed in that page: a second, fresh set.

```bash
npm run seed -- --window now --suffix ev2
cp evidence/seed-latest.json evidence/seed-2.json
npx tsx scripts/capture.ts --only chat
```

**Go / no-go:** each `#n` line shows the expected decision (same list as step 5), `→ settled (UI polled confirm)` after #0 and #6, no `!` warnings, and `01-approve.png`, `02-merchant-not-allowed.png`, `03-over-budget-with-fees.png`, `10-paused.png`, `04-expired.png` plus `capture-log.json` saved. Look at each PNG: the 3-reason card is whole, `$10 + fee > $10.00` is readable, no Evidence button. Then confirm seed 2 settled: `curl -s localhost:3000/api/mandates/man_A_ev2 | jq .mandate.pendingUsd` → `0`.

## 11. Metrics and log files

```bash
npm run metrics
head -3 evidence/logs-status.txt; head -1 evidence/logs-stop.txt
```

Expected for exactly steps 5 and 10 (two sets): `Kiln calls: 24 (propose=14 compare=10)`; `Decisions: 14 (10 STOP, 4 APPROVE)`; `Status timeline: 4 mandate_status + 14 decision line(s)` with 2 `MANDATE_NOT_ACTIVE`; `metrics.md` by flow: `propose` 14, `status_fastpath` 2, `stop_template` 10, and an `Energy estimate: ≈ … Wh` line with the 0.429 J/token assumption.

**Go / no-go:** exit 0 (it exits 1 only if `/api/usage` was unreachable); counts as above, or explainable by a retry you know about; `logs-status.txt` shows, for each set, `active→paused`, then the `MANDATE_NOT_ACTIVE` STOP, then `paused→active`, then the APPROVE. Its header says these are server log lines, not hashed records — keep that wording wherever you quote it.

## 12. Fill the README

`grep -n 'FILL(lead)\|OPTIONAL(lead)' README.md` lists the markers. Fill from tonight's files (seed 1 = `*_ev1` is the recorded run; seed 2 = `*_ev2` only produced the chat screenshots):

| Marker (section) | Fill from |
|---|---|
| `FILL(lead)` video URL (line 7) | after the video upload |
| `FILL(lead)` announcement link (Kiln integration → Model note) | the organizer announcement |
| `OPTIONAL(lead)` runs table (Runs pushed outside the permitted scope) | `evidence/scenario-*.json` → `steps[n].chat.response.entry.id`; relabel "Recorded run" to "evidence run, 2026-09-28 <time> KST, mandates `man_*_ev1`" and point it at the scenario file, `logs-stop.txt` and `logs-status.txt` |
| `OPTIONAL(lead)` Tokens by flow table + time + scope sentence | `evidence/metrics.md`; say the database was cleaned before the run (`db-clean --usage`), so the table covers tonight's two sets (+ later video takes) |
| `OPTIONAL(lead)` energy total | the `Energy estimate` line of `evidence/metrics.md` |
| `OPTIONAL(lead)` tx table (Proof of API usage) | anchors from `evidence/seed-1.json`; payments #0 and #6 from the scenario file (tx hash, entry id, block from the confirm) |
| `OPTIONAL(lead)` Flow `propose` table | the `Flow propose` section of `evidence/kiln-calls-by-flow.md` (the ev1 rows) |

Round-2 statements to confirm or edit:
- Approval & evidence → "24" and the formula: equals `grep -c '^✅' evidence/12-verify.txt` and the audit total (step 6). The "Check one yourself" paragraph: point it at `evidence/12-verify.txt` for the `ev1` set.
- "byte-identical to what `npm run export` writes": keep only if step 8 printed `IDENTICAL`.
- Evidence index: keep the `13-trip-statement.pdf` row only if the file exists; add `12-verify-B.txt`, `12-verify-C.txt`, `seed-1.json`, `seed-2.json`, `capture-log*.json` rows if you commit them.
- If the printable statement did not ship (no `13-trip-statement.pdf`): remove its clause from the "Evidence button" bullet and its evidence-index row.
- If the Evidence button did not ship: remove the "Evidence button" bullet, the Download-records half of "Reconstruct from records alone", the `14-evidence-drawer.png` row, the capture sentence under the evidence index, and in `docs/deck/deck.html` the Evidence wording on slides 3 and 7.

**Go / no-go:** `grep -n 'FILL(lead)' README.md` lists only the video URL (until the upload) and the announcement link if you have no link yet; no `OPTIONAL(lead)` marker points at data you did not replace.

## 13. Re-render the deck

```bash
npx tsx scripts/deck.ts --preview /tmp/perdiem-deck-pages
```

**Go / no-go:** `wrote docs/deck.pdf: 9 page(s) from 9 slide(s)`; `filled from:` lists 01, 02, 03, 11, the scenario file, `metrics.md` and `12-verify.txt`; `placeholders kept for:` is absent. Open all nine PNGs in `/tmp/perdiem-deck-pages`: nothing cut off at the bottom of slides 3 and 7, slide 7's terminal ends with `ALL RECORDS VERIFIED`, slide 8's energy line shows the assumption.

## 14. Secret scan and leak check

```bash
git ls-files | grep -E '(^|/)\.env' ; git log --all --oneline -- .env.local | wc -l      # only .env.example; 0
node -e '
const fs=require("fs"),cp=require("child_process");
const env=Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1).trim().replace(/^["\x27]|["\x27]$/g,"")]));
const keys=["KILN_API_KEY","AGENT_PRIVATE_KEY","SUPABASE_SERVICE_ROLE_KEY","NEXT_PUBLIC_SUPABASE_URL","SEPOLIA_RPC_URL"];
const vals=keys.flatMap(k=>env[k]&&env[k].length>12?[[k,env[k]],[k,env[k].replace(/^0x/,"")]]:[]);
const files=cp.execSync("git ls-files -co --exclude-standard",{encoding:"utf8"}).split("\n").filter(Boolean);
let hits=0;for(const f of files){let s;try{s=fs.readFileSync(f).toString("latin1")}catch{continue}for(const [k,v] of vals)if(s.includes(v)){console.log("HIT",k,"in",f);hits++;break}}
console.log(hits?hits+" hit(s)":"0 hits in "+files.length+" files");'
git grep -nIE 'sk-bk-[A-Za-z0-9]|eyJhbGciOi|BEGIN [A-Z ]*PRIVATE KEY' -- . ':!node_modules' ':!.env.example' | head   # .env.example has the sk-bk-xxxx placeholder
pdftotext docs/deck.pdf - | grep -nE '/Users/|/private/|localhost' ; [ -f evidence/13-trip-statement.pdf ] && pdftotext evidence/13-trip-statement.pdf - | grep -nE '/Users/|/private/|localhost|file://'
```

The node check compares the real values in memory and prints key names only. A `SEPOLIA_RPC_URL` hit is harmless only if `.env.local` uses the public keyless PublicNode URL (`/api/health` says `rpc: "publicnode"`); a keyed RPC URL must not appear anywhere.

Reference kit: rerun the identifier grep from the private kit analysis (the identifier list stays outside this repo — never paste it in) over the repo excluding `node_modules`, `.next` and `.git`, and check the PNGs by eye: no agency or program names, KRW amounts, registration numbers, card digits, names other than the builder's.

**Go / no-go:** `.env.example` only and `0`; `0 hits`; the `git grep` prints nothing; no paths or `localhost` in the PDFs; kit grep 0 files.

## 15. Commit

```bash
git add evidence/ README.md docs/deck.pdf docs/deck/deck.html
git status --short            # only evidence/*, README.md, docs/deck.* — no .env*, logs/, *.mp4, no downloaded files
git commit -m "evidence: run 2026-09-28 (man_*_ev1 API run, man_*_ev2 chat screenshots)" -m "Verified: scenario 8/8; 12-verify.txt 24/24 ALL RECORDS VERIFIED (B 4/4, C 4/4); /api/audit 24/24; drawer download cmp IDENTICAL; deck 9 pages; secret scan 0 hits." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```

Keep the server and `tee` running if the video follows right away (`docs/VIDEO-SCRIPT.md`, one fresh seed per take); run `npm run metrics` again after the takes and commit the refreshed log files. Otherwise stop it: `Ctrl-C` in terminal 1, then `lsof -nP -iTCP:3000 -sTCP:LISTEN || echo stopped`.

---

## Test-ETH cost

Measured on the backend verification run (2026-09-28 18:16–18:18 KST): one demo set = 3 anchors (0-value self-transactions) + payments #0 ($12) and #6 ($5) took the wallet from 0.049975 to 0.045543 ETH, i.e. **≈ 0.00443 ETH per set** (0.00425 ETH of value at `DEMO_ETH_USD=4000` + ≈ 0.000036 ETH gas per transaction, 5 transactions).

| Step | Transactions | ≈ ETH |
|---|---|---:|
| 4 seed 1 | 3 anchors | 0.0001 |
| 5 scenario | 2 payments | 0.0043 |
| 10 seed 2 + chat capture | 3 anchors + 2 payments | 0.0044 |
| **Tonight** | 10 | **≈ 0.009** |
| each video take (fresh seed + grant-form anchor) | 4 anchors + 2 payments | ≈ 0.0045 |

Balance at 20:00 KST: 0.045543 ETH. After tonight ≈ 0.0366 ETH; after two video takes ≈ 0.0276 ETH. Steps 1–3, 6–9 and 11–15 send nothing (GET requests, local scripts and a database clean-up). Gas can spike on Sepolia; check `balanceEth` in `/api/health` before steps 4 and 10, and stop seeding below 0.012 ETH.
