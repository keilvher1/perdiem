# 01 — Claude Code 마스터 프롬프트 (백엔드 + 스크립트 + 통합 + 증거)

**쓰는 법:** 저장소 루트에서 `claude`를 열고, 아래 "=== 프롬프트 시작 ===" 부터 "=== 프롬프트 끝 ===" 까지를 통째로 붙여넣습니다. Claude Code가 Phase 0부터 순서대로 진행하며, 각 Phase 끝에서 확인 결과를 보고하고 커밋합니다. 중간에 멈추고 다음 날 이어갈 때는 "Phase N부터 이어서 진행해"라고만 하면 됩니다.

Phase 0은 **9/28 20:00에 가장 먼저** 실행해서 `main`에 올려야 Codex가 출발할 수 있습니다. Phase 1~4는 월요일 밤, Phase 5(통합)는 화요일 아침, Phase 6~7은 화요일 밤입니다.

---

=== 프롬프트 시작 ===

너는 GWDC 2026 Korea 해커톤(FuriosaAI x Bricksum, Challenge B "Build the Controls and Records for an AI Agent That Spends") 프로젝트 **PerDiem**의 백엔드, 스크립트, 통합, 증거 수집을 맡는다. 나는 혼자 참가하고 낮에는 회사 업무가 있어서 저녁과 새벽에만 작업한다. 프론트엔드는 다른 에이전트(Codex)가 `feat/frontend` 브랜치에서 **동시에** 만들고 있으며, 둘의 접점은 오직 `contracts/api.ts`와 `docs/fixtures/*.json`이다.

먼저 `CLAUDE.md`, `docs/PRD.md`, `contracts/api.ts`를 읽어라. 그 다음 아래 Phase를 순서대로 진행한다. **각 Phase의 "완료 조건"을 실제로 실행해서 결과를 나에게 보여준 뒤 커밋하고, 다음 Phase로 넘어가라.** 40분 넘게 막히면 멈추고 가장 작은 실패 재현(명령 + 출력)을 보여줘라.

## 절대 규칙
1. **모델은 결제하지 않는다.** Kiln `qwen3-32b`는 `propose_payment` 툴로 제안만 하고, `lib/policy.ts::evaluate()`가 결정하며, `lib/chain.ts`만 지갑을 만진다. 이 세 파일과 `lib/kiln.ts`, `lib/agent.ts`는 이미 검증되어 있으니 **테스트가 요구하지 않는 한 수정하지 마라.**
2. **계약서가 법이다.** 모든 라우트 핸들러의 응답은 `contracts/api.ts`의 타입으로 선언한다(`NextResponse.json<HealthResponse>(...)` 또는 `const body: HealthResponse = ...`). 계약서는 수정하지 않는다. 계약서와 lib가 어긋나면 `tests/contract.check.ts`가 타입 에러를 낸다.
3. **비밀은 서버에만.** `KILN_API_KEY`, `AGENT_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 Route Handler와 스크립트에서만 읽는다. 클라이언트 컴포넌트에서 `lib/kiln.ts`, `lib/chain.ts`, `lib/db.ts`를 import하지 않는다. 개인키를 출력하거나 로그에 남기지 않는다.
4. **테스트넷만.** Sepolia. 메인넷을 가리키는 변경은 거부한다.
5. **요청 핸들러 안에서 트랜잭션 확정을 기다리지 않는다.** `sendPaymentNoWait`/`anchorMandate`는 브로드캐스트만 하고, 확정은 `/api/ledger/[id]/confirm` 폴링으로 한다.
6. **해시는 안정적이어야 한다.** `mandateHash()`는 `status`를 제외하고, `receiptHash()`는 `txHash, receiptHash, status, actualFeeUsd, settledAt`을 제외한다. confirm 라우트는 이 다섯 필드만 갱신한다. `lib/db.ts::getMandate()`는 `mandates.status` 컬럼을 JSON 위에 덮어써서 반환한다(안 그러면 Pause가 무효).
7. **fail-closed.** 수수료 추정이 안 되면 `FEE_UNAVAILABLE`로 STOP. 수수료를 0으로 기본값 처리하지 않는다. 돈 비교는 반올림 없이(`fmtUsd`는 표시용).
8. **모든 모델 호출은 `chatWithUsage({ flow })`**로, 모델 없이 처리한 흐름은 `zeroUsage("status_fastpath" | "stop_template")`로 기록한다. `usage_records`에 저장한다.
9. **프론트 소유 경로는 건드리지 않는다:** `app/traveler/**`, `app/principal/**`, `app/audit/**`, `app/metrics/**`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `components/**`, `hooks/**`, `lib/api-client.ts`, `lib/format.ts`. (Phase 5 통합에서만 예외적으로 최소 수정 허용.)
10. `Response.json()`은 `bigint`를 직렬화 못 한다. `lib/chain.ts`는 이미 문자열을 돌려주니 그대로 둔다.
11. Next.js 15+ 동적 라우트의 `params`는 Promise다: `const { id } = await params`.
12. 각 Phase 끝에 `npm run build`를 돌린다(마지막 날 밤에 몰아서 고치지 않기 위해).

---

## Phase 0 — 스캐폴드와 첫 커밋 (10분, 9/28 20:00에 가장 먼저)

현재 폴더에는 준비 키트 파일이 있다: `CLAUDE.md`, `AGENTS.md`, `contracts/api.ts`, `docs/**`(PRD, schema.sql, seed.json, fixtures/, PROMPTS, PITCH 등), `lib/{kiln,policy,chain,agent}.ts`, `scripts/{spike,verify}.ts`, `tests/{policy.test,contract.check}.ts`, `.env.example`, `.env.local`(값 채워짐), `prompts/**`.

1. 같은 폴더에 Next.js를 스캐폴드한다(파일이 있는 폴더라 `create-next-app`은 임시 폴더에 만들고 옮겨라): `npx create-next-app@latest perdiem-tmp --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes` → 생성된 파일(`app/`, `public/`, `next.config.*`, `tsconfig.json`, `package.json`, `postcss.config.*`, `eslint.config.*`, `.gitignore`, `next-env.d.ts`)을 현재 폴더로 옮기고 임시 폴더 삭제. 기존 키트 파일은 덮어쓰지 않는다. `.gitignore`에 `.env*.local`, `evidence/*.mp4`가 있는지 확인.
2. 의존성(버전 고정 — lib는 openai 7.x, viem 2.56에서 검증됨): `npm i openai@7 viem@2 @supabase/supabase-js zod server-only lucide-react sonner` / `npm i -D tsx`. **이후 Phase에서는 패키지를 추가하지 않는다**(Codex 브랜치와 `package.json` 충돌 방지). `package.json` scripts에 추가(스크립트는 `next dev`와 달리 `.env.local`을 자동으로 읽지 않으므로 `--env-file` 필수): `"test": "tsx tests/policy.test.ts"`, `"typecheck": "tsc --noEmit"`, `"seed": "tsx --env-file=.env.local scripts/seed.ts"`, `"scenario": "tsx --env-file=.env.local scripts/scenario.ts"`, `"export": "tsx --env-file=.env.local scripts/export.ts"`, `"verify": "tsx --env-file=.env.local scripts/verify.ts"`, `"compare": "tsx --env-file=.env.local scripts/compare-reasoning.ts"`, `"metrics": "tsx --env-file=.env.local scripts/metrics.ts"`, `"spike": "tsx --env-file=.env.local scripts/spike.ts"`. `.env.local`에는 줄 끝 주석(`KEY=value # 설명`)이 없어야 한다(Node의 env-file 파서가 값에 포함시킴).
3. shadcn: `npx shadcn@latest init -d` 후 `npx shadcn@latest add button card input badge table textarea separator skeleton tabs tooltip select switch dialog sonner progress checkbox collapsible label sheet scroll-area popover alert`. Codex 샌드박스는 setup 이후 네트워크가 없을 수 있어서 **프론트가 쓸 컴포넌트를 전부 여기서 설치**한다. `lib/utils.ts`(shadcn `cn`)는 이후 아무도 수정하지 않는다.
   3-1. `npm run lint`를 돌려 통과시킨다(스크립트나 테스트가 걸리면 `eslint.config.*`의 ignores에 `scripts/**`, `tests/**` 추가). Codex가 lint 에러 때문에 백엔드 파일을 건드리는 일을 막기 위해서다.
4. `app/page.tsx`는 `redirect("/traveler")` 한 줄로 바꿔 둔다(Codex가 덮어씀). `lib/db.ts`와 `lib/view.ts`는 첫 줄에 `import "server-only";`를 넣는다(클라이언트에서 실수로 import하면 빌드가 실패하게). `app/api/health/route.ts`는 Phase 1에서.
5. `npm run typecheck`(tests/contract.check.ts 포함해 통과해야 함), `npm test`(16블록), `npm run build`.
6. `git init` → `git add -A` → 커밋 `chore: scaffold + prep kit (contract, fixtures, lib, docs)` → GitHub 원격 `origin` 추가 → `git push -u origin main`. **푸시 후 "Phase 0 완료, main 푸시됨"이라고 보고하라.** 내가 그때 Codex를 시작한다.

완료 조건: `npm run build` 통과, `git log`에 커밋 1개, `origin/main` 존재.

---

## Phase 1 — 헬스체크 (20분)

`app/api/health/route.ts` (GET, `runtime = "nodejs"`): `kiln.models.list()`를 직접 호출해 id 목록을 만들고(`assertModelAvailable`은 모델이 없으면 throw하므로 쓰지 않는다; 실패 시 빈 배열 + `errors`에 사유), `modelAvailable = models.includes(KILN_MODEL)`, `lib/chain.ts::agentBalanceUsd()`(실패 시 null + errors), `demoEthUsd`, `chain: "sepolia"`, `rpc: process.env.SEPOLIA_RPC_URL ? "custom" : "publicnode"`. 응답 타입 `HealthResponse`. 부분 실패여도 200을 주고 `ok`는 `modelAvailable && balanceUsd !== null`. 레이아웃이 페이지마다 호출하므로 **모듈 스코프에 60초 캐시**를 둔다.

완료 조건: `curl -s localhost:3000/api/health | jq` 에서 `modelAvailable: true`, `balanceUsd > 0`.

---

## Phase 2 — DB와 시드 (45분)

1. `docs/schema.sql`이 Supabase에 적용되어 있는지 확인하라. 안 되어 있으면 나에게 SQL 편집기에서 실행하라고 알려주고 기다려라(service role로 DDL을 실행하지 마라).
2. `lib/db.ts`(서버 전용, `@supabase/supabase-js` + service role): 
   - `getMandate(id): Promise<{ mandate: Mandate; hash: Hex; anchorTx: Hex | null; createdAt: string } | null>` — `json` 컬럼을 파싱한 **순수 `Mandate` 객체**에 `status` 컬럼을 덮어써서 `mandate`로 돌려주고, hash/anchorTx/createdAt은 **옆에** 둔다(Mandate 객체에 섞지 않는다. `mandateHash`와 `replayLedger`, `export`에는 항상 이 순수 객체만 넘긴다).
   - `listMandates()` — 각 행을 같은 방식으로(status 컬럼 덮어쓰기), `createMandate(mandate, hash, anchorTx)`, `updateMandateStatus(id, status)` — `status` 컬럼과 `json.status`를 둘 다 갱신.
   - `listMerchants()`, `upsertMerchants(merchants)`
   - `listLedger(mandateId)` 오래된 순 — `json`을 파싱하고 `status`, `tx_hash` 컬럼을 덮어쓴다, `getEntry(id)`, `saveEntry(entry)`, `updateEntry(id, patch)` — patch는 `status | txHash | actualFeeUsd | settledAt`만 허용(타입으로 제한)하고, **`json`을 읽어 합친 뒤 다시 쓰고 `status`/`tx_hash` 컬럼도 같이 갱신**한다(컬럼만 바꾸면 `listLedger`가 영원히 pending을 돌려준다).
   - `saveUsage(record, mandateId?)`, `usageByFlow()`(뷰 `usage_by_flow_v`, `cost_usd`는 `coalesce(...,0)`으로 숫자 보장), `usageTotals()`.
   - 모든 함수는 `contracts/api.ts`의 도메인 타입을 쓴다.
3. `scripts/seed.ts`: `docs/seed.json`을 읽어 merchants upsert, mandate A/B/C를 `--suffix <s>`(기본값 `Date.now().toString(36)`)를 id 뒤에 붙여 새로 만든다(예: `man_A_k3x9`). 각 mandate에 대해 `mandateHash` 계산 → `anchorMandate(hash)`(브로드캐스트만) → `createMandate`. `agentWallet`이 env 지갑 주소와 다르면 경고하고 env 주소로 교체. 끝나면 새 id 3개와 앵커 tx 링크를 출력하고 **`evidence/seed-latest.json`에 `{ A, B, C, anchors, at }`를 저장**한다(scenario가 읽는다). `--no-anchor` 옵션이면 체인 호출 생략(개발용). 테스트 ETH를 아끼기 위해 재시도할 때는 새로 시드하지 말고 같은 mandate를 다시 쓴다(DUPLICATE 창은 5분뿐).

완료 조건: `npm run seed`가 mandate 3개와 앵커 링크 3개를 출력하고 `evidence/seed-latest.json`이 생김. 새 id들을 나에게 알려줘라(이후 curl에 사용). (별도 DB 스모크 스크립트는 만들지 않는다. Phase 3의 curl이 대신한다.)

---

## Phase 3 — API 라우트 (90분)

모두 `runtime = "nodejs"`. 에러는 `ApiError` 형태(`{ error: { code, message } }`)와 적절한 상태 코드(400 검증 실패, 404 없음, 409 상태 충돌, 502 체인/Kiln 오류). `zod`로 바디 검증. 응답 타입은 계약서 타입으로 선언.

| 라우트 | 동작 |
|---|---|
| `GET /api/merchants` | `MerchantsResponse` |
| `GET /api/mandates` | `MandatesResponse`, 최신순, 각 항목에 spent/pending/remaining 계산(장부 집계) |
| `POST /api/mandates` | `CreateMandateRequest` 검증 → 카탈로그 스냅샷(merchants 테이블 전체) + `agentWallet`(env) + `status: "active"`로 `Mandate` 구성 → `mandateHash` → `anchorMandate`(브로드캐스트) → 저장 → 201 `CreateMandateResponse` |
| `GET /api/mandates/[id]` | `MandateDetailResponse` (mandate + 장부) |
| `PATCH /api/mandates/[id]` | `UpdateMandateStatusRequest` → `updateMandateStatus` → `UpdateMandateStatusResponse`. revoked에서 active로는 409 |
| `POST /api/chat` | `ChatRequest` → mandate(상태 병합)와 ledger를 읽고 `lib/agent.ts::handleTravelerMessage(text, deps)` 호출 → `ChatResponse { reply: r.text, entry: view(r.entry) ?? null, usage: r.usage }`. `export const maxDuration = 60`. |
| `GET /api/ledger?mandateId=` | `LedgerResponse` |
| `GET /api/ledger/[id]/confirm` | 항목의 `txHash`로 `getSettlementStatus()` → settled면 `status, actualFeeUsd, settledAt`만 갱신, failed면 `status`만 → `ConfirmResponse`. txHash가 없으면 400. RPC 예외는 502 |
| `GET /api/usage` | `UsageResponse`: `usageByFlow()`, totals, zeroTokenCalls(flow별 count), energy(`ENERGY_J_PER_TOKEN` env 없으면 null, `ENERGY_SOURCE` env를 source로), comparison(`docs/reasoning-comparison.json`이 있으면 파싱, 없으면 null) |
| `GET /api/audit/[mandateId]` | `AuditResponse`: 순수 `Mandate`로 재해시, 앵커 tx `readMemo` → `matches`(실패하면 `memo: null, matches: false`), `replayLedger(mandate, ledger)`, **`status === "settled"`인 항목만** `readMemo` + `receiptHash(entry)` 재계산으로 `TxCheck`(각 tx는 try/catch, 실패하면 네 불리언 모두 false와 `memo: ""`), summary(passed = 통과한 불리언 개수, total = 검사한 불리언 개수). 이 라우트는 tx 수만큼 RPC를 호출하므로 폴링 대상이 아니다 |

`view(entry)` 헬퍼(`lib/view.ts`, 백엔드 소유, `import "server-only"`): `LedgerEntry → LedgerEntryView`(merchantCategory는 mandate.catalog에서, explorerUrl은 `lib/chain.ts::explorerTxUrl`), `toSummary(row, ledger) → MandateSummary`, `toDetail(row, ledger) → MandateDetail`. 뷰 객체는 표시용이다. **해시 계산, replay, export에는 절대 뷰를 넘기지 않는다**(정책 라이브러리가 필드를 화이트리스트로 해싱하긴 하지만, 원칙으로 지킨다).

완료 조건 — 아래 curl을 **실제 실행해서 결과를 보여줘라** (`$A`, `$B`, `$C`는 Phase 2의 새 id):
1. `POST /api/chat {mandateId:$A, text:"Order a bibimbap lunch from Yangjae Kitchen, $12"}` → `entry.decision: "APPROVE"`, `entry.status: "pending"`, `txHash` 있음. 20초 뒤 `GET /api/ledger/<entryId>/confirm` → `settlement.state: "settled"`, `entry.actualFeeUsd` 숫자.
2. `$A` "Taxi to Incheon airport, about $85" → STOP, reasons 코드 `["OVER_PER_TX_CAP"]`.
3. `$A` "Buy a bottle of wine as a gift for the client, $30" → STOP, 코드 3개 `MERCHANT_NOT_ALLOWED, CATEGORY_NOT_ALLOWED, BLOCKED_KEYWORD`.
4. `$B` "Dinner from Yangjae Kitchen, $10" → STOP `OVER_BUDGET_WITH_FEES`, message에 "$10.00 + network fee".
5. `PATCH /api/mandates/$A {status:"paused"}` → `$A` "Coffee at Starbucks, $5" → STOP `MANDATE_NOT_ACTIVE` → `PATCH active` → 같은 요청 → APPROVE(두 번째 tx).
6. `$C` "Coffee at Starbucks, $5" → STOP `EXPIRED`.
7. `$A` "How much do I have left?" → `entry: null`, `usage[0].flow: "status_fastpath"`, 토큰 0.
8. `GET /api/usage` → byFlow에 `propose`, `status_fastpath`, `stop_template` 행. `GET /api/audit/$A` → `summary.allVerified: true`.
9. `npm run build` 통과. 커밋 `feat(api): mandates, chat, ledger confirm, usage, audit`. **여기까지가 월요일 밤의 목표다. 00:30이면 여기서 멈추고 자라.**

---

## Phase 4 — 시나리오 스크립트 (30분, 월요일에 시간이 남으면, 아니면 화요일 밤)

`scripts/scenario.ts`: `evidence/seed-latest.json`에서 A/B/C id를 읽어(또는 `--mandates A,B,C` 인자) `contracts/api.ts::DEMO_SCRIPT`의 0~7번을 순서대로 `POST /api/chat`(로컬 서버 `BASE_URL`, 기본 `http://localhost:3000`)에 보낸다. 4번 앞에 PATCH paused, 6번 앞에 PATCH active. APPROVE는 confirm을 6초 간격으로 최대 20회 폴링해 settled까지 기다린다. 결과를 `evidence/scenario-<YYYYMMDD-HHmm>.json`(요청, 응답 전체)과 콘솔 표(n, mandate, decision, reason codes, txHash, tokens)로 저장. 기대 결과(`expect` 필드)와 다르면 빨간색으로 표시하고 exit 1.

완료 조건: 8행 전부 기대와 일치, JSON 파일 생성.

---

## Phase 5 — 프론트엔드 통합 (화요일 06:00~08:30)

Codex가 `feat/frontend` PR을 올렸다. 순서:
1. `git fetch origin && git checkout main && git merge --no-ff origin/feat/frontend` (충돌은 소유권 표대로: 백엔드 경로는 main, 프론트 경로는 브랜치 쪽을 택한다. Codex는 패키지를 추가하지 않기로 되어 있지만, `package.json`이 충돌하면 손으로 합친 뒤 `rm package-lock.json && npm install`).
2. `npm ci` → `npm run typecheck` → `npm run build`. 타입 에러가 계약서 위반이면 **위반한 쪽을 고친다**(계약서는 그대로). 프론트 코드 수정은 최소한으로 하고 무엇을 고쳤는지 목록으로 남겨라.
3. `.env.local`에 `NEXT_PUBLIC_API_MODE=live` 추가 → `npm run dev` → 브라우저에서 `/traveler`, `/principal`, `/audit/<id>`, `/metrics`를 열어 Phase 3의 시나리오 1~8을 화면에서 재현. 각 화면 스크린샷을 `evidence/`에 `ACCEPTANCE-CHECKLIST.md`의 번호로 저장(`01-approve.png` …).
4. `lib/api-client.ts`의 live 모드가 계약서 `ENDPOINTS`만 호출하는지, 클라이언트 번들에 `lib/kiln|chain|db`가 섞이지 않았는지(`npm run build` 출력에서 server-only 경고 없음) 확인.
5. 커밋 `feat: integrate frontend (Codex) with live API`.

완료 조건(06:00~08:30 안에 끝낼 것): build 통과, `npm run scenario` 8행 일치, `/traveler`에서 승인 1건과 중단 1건이 화면에 보임. 나머지 화면 확인과 스크린샷 11장은 Phase 6(화요일 저녁) 첫 30분에 한다.

---

## Phase 6 — 증거와 지표 (화요일 19:00~23:00)

0. (Phase 5에서 미룬 것) 브라우저에서 `/traveler`, `/principal`, `/audit/<id>`, `/metrics`를 열어 시나리오 1~8을 화면에서 재현하고 스크린샷을 `evidence/`에 `ACCEPTANCE-CHECKLIST.md` 번호로 저장한다.
1. `scripts/export.ts <mandateId>`: `evidence/mandate-<id>.json`(`{ mandate, anchorTx }` — `mandate`는 DB `json`의 순수 Mandate에 status 컬럼을 덮어쓴 것)과 `evidence/ledger-<id>.json`(`LedgerEntry[]`, 뷰 필드 없이)을 DB에서 내보낸다. 그 다음 `npm run verify -- evidence/mandate-<id>.json evidence/ledger-<id>.json` → `ALL RECORDS VERIFIED` 출력을 `evidence/12-verify.txt`로 저장.
2. `scripts/compare-reasoning.ts`: `lib/agent.ts`에서 export된 `systemPrompt(mandate)`와 `proposePaymentTool`로 `DEMO_SCRIPT` 중 구매 요청 5개(0,1,2,3,6)를 flow `"compare"`로 두 번 호출한다 — (a) 사용자 메시지 그대로, (b) 끝에 ` /no_think`. 각 호출의 usage를 `saveUsage`로 DB에도 남긴다(그래야 `/api/usage`의 compare 행이 채워진다). 결과를 `contracts/api.ts::ReasoningComparison` 형태로 `docs/reasoning-comparison.json`에 저장하고 요약(툴콜 성공 수, 평균 completion, 절감률, 평균 latency)을 출력. 사전 측정값은 5/5, 160→47(−71%), 2.9s→1.1s였다.
3. `scripts/metrics.ts`: `GET /api/usage`를 호출해 마크다운 표 2개(byFlow, comparison)와 에너지 카드 문구를 `evidence/metrics.md`로 저장. `ENERGY_J_PER_TOKEN`이 비어 있으면 "assumption not set — see README"라고 쓴다.
4. Kiln 호출 증거: 서버 로그에서 `"kind":"kiln"` 줄을 모아 `evidence/06-kiln-calls.txt`로 저장(`npm run dev` 출력을 `tee`로 받아 두거나 시나리오 실행 시 로그 파일 지정).
5. 커밋 `chore: evidence, verify, reasoning comparison, metrics`.

완료 조건: `evidence/`에 12-verify.txt, metrics.md, 06-kiln-calls.txt, scenario JSON, 스크린샷 11장.

---

## Phase 7 — README와 제출물 (수요일 07:30~09:00)

`docs/SUBMISSION-README-template.md`를 채워 `README.md`를 만든다. 실제 값으로: 앵커 tx와 결제 tx 해시(Etherscan 링크), scenario JSON에서 뽑은 STOP 런 5개 표, `docs/reasoning-comparison.json` 표, `evidence/metrics.md`의 byFlow 표(0토큰 행 포함), 에너지 가정과 출처, `evidence/12-verify.txt` 발췌, mermaid 시퀀스 다이어그램. "Pre-hackathon preparation" 절은 사실대로: `lib/{kiln,policy,chain,agent}.ts`, `scripts/{spike,verify}.ts`, `tests/`, `contracts/api.ts`, `docs/`(PRD, fixtures, seed), 지갑, Kiln 키, 스캐폴드는 사전 준비; `app/`, `lib/db.ts`, `lib/view.ts`, `scripts/{seed,scenario,export,compare-reasoning,metrics}.ts`, UI는 대회 기간에 작성(프론트는 Codex, 백엔드는 Claude Code). 저장소를 Public으로 바꾸기 전에 `.env.local`이 커밋된 적 없는지 `git log --all -- .env.local`로 확인.

완료 조건: README에 빈칸(`…`) 없음, 시크릿 창에서 GitHub 링크 열림.

=== 프롬프트 끝 ===
