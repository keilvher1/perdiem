# Claude Code 프롬프트 시퀀스 (플랜 B: 전부 Claude Code로 할 때)

> 기본 계획은 `prompts/01-CLAUDE-CODE-MASTER.md`(백엔드) + `prompts/02-FRONTEND-CODEX-MASTER.md`(프론트) + `prompts/03-INTEGRATION.md`입니다. 이 문서는 Codex 프론트가 늦거나 실패했을 때 Claude Code 하나로 전부 만드는 순서입니다. 화면 프롬프트(P8~P11)는 `contracts/api.ts`와 `lib/api-client.ts`(live 모드)를 쓰도록 되어 있어 마스터 프롬프트와 구조가 같습니다.

사용법: 저장소 루트에 `CLAUDE.md`, `docs/PRD.md`, `docs/seed.json`(이미 생성됨), `lib/*.ts`, `tests/`, `scripts/`, `.env.example`을 넣은 뒤, 아래 프롬프트를 **순서대로** 하나씩 넣습니다. `lib/`는 사전 준비한 레퍼런스 모듈이고 그대로 씁니다(README에 공개). 각 단계 끝의 "확인"이 통과해야 다음으로 갑니다. 한 단계가 40분을 넘기면 멈추고 "가장 작은 실패 재현(curl + 응답)"을 만들어 다시 물어보세요.

시간 표시는 목표치입니다. 평일 낮에는 회사 업무라 개발은 저녁, 밤, 이른 아침에만 합니다. **00:30이 되면 어디까지 했든 멈추고 자세요.** 남은 일은 다음 작업 블록으로 넘깁니다. P10-B(Audit 화면), P11의 화면 부분, P13은 기본 계획에서 뺐습니다(시간이 남을 때만).

---

## P0. 스캐폴드 확인 (9/28 월 20:00, 15분)
```
이 저장소는 GWDC 해커톤 48시간 프로젝트야. 먼저 CLAUDE.md와 docs/PRD.md를 읽고, 이해한 내용을 10줄 이내로 요약해줘. 그 다음 현재 create-next-app 스캐폴드(App Router, TS, Tailwind)를 확인하고 필요한 패키지를 설치해줘: openai, viem, @supabase/supabase-js, zod, tsx(dev). shadcn/ui를 초기화하고 button, card, input, badge, table, dialog, switch 컴포넌트를 추가해줘. .gitignore에 .env.local이 있는지 확인하고, .env.example을 .env.local로 복사해줘(값은 내가 채움). 마지막으로 git init 후 "chore: scaffold + docs" 커밋을 만들어줘.
```
확인: `npm run dev` 뜸, 커밋 1개.

## P1. 헬스체크 (20분)
```
lib/kiln.ts와 lib/chain.ts를 그대로 두고 app/api/health/route.ts를 만들어줘. GET 요청에 { models: string[] (Kiln GET /models 결과 id 목록), model: KILN_MODEL, modelAvailable: boolean, agentAddress, balanceUsd, demoEthUsd }를 JSON으로 반환. 실패하면 각 항목을 null로 두고 error 필드에 이유를 담아. runtime은 nodejs. 완료 후 curl localhost:3000/api/health 결과를 보여줘.
```
확인: `modelAvailable: true`, 잔액 > 0.

## P2. 시드 데이터 (20분)
`docs/seed.json`은 이미 만들어져 있습니다(에이전트 지갑 주소, 가맹점 7개, mandate A/B/C). 구조 요약:
```
{ "merchants": [ { "id": "m1", "name": "Yangjae Kitchen", "category": "meal", "wallet": "0x…" }, … m7 ],
  "mandates": [
    { "id": "man_A", "budgetUsd": 150, "startsAt": "2026-09-28T08:00:00Z", "expiresAt": "2026-09-30T09:00:00Z", … },
    { "id": "man_B", "budgetUsd": 10,  … same window … },
    { "id": "man_C", "budgetUsd": 150, "startsAt": "2026-09-20T00:00:00Z", "expiresAt": "2026-09-25T00:00:00Z", … } ] }
```
(가맹점 주소는 수신 전용이라 개인키를 버렸습니다. 에이전트 지갑 개인키는 `perdiem-dev-wallet.txt`에만 있습니다.)

현장 프롬프트:
```
docs/seed.json이 있어(mandates는 이미 lib/policy.ts의 Mandate 타입 그대로, catalog 스냅샷 포함). scripts/seed.ts를 만들어줘: `--suffix` 인자(기본값 현재 시각)를 받아 mandate id 뒤에 붙여 새 id로 만들고(데모 테이크마다 새 mandate, DUPLICATE 회피), merchants를 upsert, 각 mandate마다 mandateHash 계산 → anchorMandate(hash)로 온체인 앵커(브로드캐스트만) → mandates 테이블에 json, hash, status, anchor_tx 저장. agentWallet이 env의 AGENT_PRIVATE_KEY 주소와 다르면 경고. 실행 후 새 mandate id 3개와 앵커 tx 링크를 출력해줘.
```
확인: merchants 7행, 새 mandate 3행(A, B, C)과 각각의 앵커 tx 링크.

## P3. 정책 엔진 테스트 (10분)
```
lib/policy.ts와 tests/policy.test.ts는 이미 있어. package.json에 "test": "tsx tests/policy.test.ts"를 넣고 npm test를 실행해 17블록이 통과하는지 보여줘. 정책 로직은 바꾸지 마.
```
확인: `npm test` 통과.

## P4. Kiln 연결 확인 (10분)
```
npx tsx scripts/spike.ts kiln을 실행해서 결과를 보여줘. 5개 프롬프트 중 구매 요청 4개(와인 선물 포함)에서 propose_payment 툴콜이 나오고 상태 질문에서는 안 나오는지, usage.cost가 오는지 확인해.
```
확인: PASS 5/5 (최소 4/5).

### P4-B. (툴콜이 불안정할 때만) JSON 모드 폴백
```
qwen3-32b의 툴콜이 불안정해. lib/kiln.ts에 proposeViaJson(messages)를 추가해줘: 시스템 프롬프트에 "Respond with ONLY one JSON object: {"action":"propose","merchant_id":"...","amount_usd":12,"memo":"..."} or {"action":"reply","text":"..."}"를 넣고, 응답에서 첫 번째 {…} 블록을 정규식으로 뽑아 JSON.parse. 파싱 실패나 action이 propose가 아니면 null 반환(=제안 없음). 반환 형태는 extractToolCall과 같은 { args, raw }. 환경변수 KILN_PROPOSE_MODE=json이면 lib/agent.ts가 처음부터 JSON 모드를 쓰게 해줘(툴콜 실패 후 재시도는 하지 마 — 토큰 낭비). spike의 5개 프롬프트로 결과를 표로 보여줘.
```

## P5. 체인 연결 확인 (10분)
```
npx tsx scripts/spike.ts chain을 실행해줘. 지금 수수료가 $ 얼마인지 기록하고(발표 자료에 씀), 앵커 tx가 settled로 바뀌는지, memo가 "PERDIEM-MANDATE|0x…"로 읽히는지 확인해. 잔액이 0.02 ETH 미만이면 경고해줘.
```
확인: settled, memo 문자열, 수수료 값 메모.

## P6. DB 헬퍼 (25분)
```
lib/db.ts를 만들어줘(서버 전용, service role). 함수: getMandate(id) — mandates.json에 status 컬럼을 덮어써서 반환(중요: Pause가 반영되게), listMandates(), createMandate(mandate, hash, anchorTx), updateMandateStatus(id, status), listLedger(mandateId) — 오래된 순, saveEntry(entry), updateEntry(id, patch) — patch는 status/txHash/actualFeeUsd/settledAt만 허용, saveUsage(record, mandateId), usageByFlow() — usage_by_flow_v 뷰. 타입은 lib/policy.ts와 lib/kiln.ts의 것을 재사용. scripts/db-smoke.ts로 각 함수를 한 번씩 호출해 확인해줘.
```

## P7. 에이전트 API (30분)
```
app/api/chat/route.ts를 만들어줘(runtime nodejs). POST { mandateId, text } → lib/db에서 mandate(상태 병합됨)와 ledger를 읽고 lib/agent.ts의 handleTravelerMessage를 호출, 결과 { text, entry, usage }를 반환. lib/agent.ts는 수정하지 말고 deps만 연결해. app/api/ledger/[id]/confirm/route.ts(GET: getSettlementStatus → settled면 status/actualFeeUsd/settledAt만 updateEntry, failed면 status만; params는 Promise니까 await)도 만들어. 그리고 app/api/mandates/route.ts(POST 생성: mandateHash 계산 → anchorMandate(브로드캐스트만) → createMandate; GET 목록)와 app/api/mandates/[id]/route.ts(PATCH status)를 만들어. 완료 후 아래 curl 결과를 보여줘:
1) man_A 점심 12달러 (APPROVE, pending, txHash) → confirm 폴링으로 settled
2) man_A 인천공항 택시 85달러 (STOP OVER_PER_TX_CAP)
3) man_A 와인 선물 30달러 (STOP 사유 3개)
4) man_B 저녁 10달러 (STOP OVER_BUDGET_WITH_FEES — 예산과 같은 금액 + 수수료)
5) man_C 커피 5달러 (STOP EXPIRED)
```
확인: 5개 결과가 PRD §7과 일치. **여기까지 되면 MVP 백엔드 끝. 자도 됨.**

## P8. Traveler 화면 (9/29 화 06:00, 90분)
```
먼저 lib/api-client.ts가 없으면 만들어줘: contracts/api.ts의 ENDPOINTS만 호출하는 typed fetch 래퍼(health, mandates, mandate, createMandate, updateMandateStatus, chat, ledger, confirm, usage, audit), 비2xx면 ApiError를 파싱해 throw. 그 다음 app/traveler/page.tsx("use client")를 만들어줘. 데이터는 api-client로만. 상단에 mandate 선택(api.mandates()), 채팅 리스트, 입력창. 각 응답은 카드로: APPROVED(초록, 금액, 예상 수수료, "pending" 뱃지, Etherscan 링크) / STOPPED(빨강, 사유 칩 = [CODE] 메시지) / 일반 답변. pending 카드는 5초마다 /api/ledger/[id]/confirm을 폴링해서 settled(actualFeeUsd 표시)나 failed로 바뀜. 빈 상태와 에러 상태를 넣어. 영어 카피. 디자인은 깔끔한 SaaS 톤, 카드 간격 넉넉하게. 끝나면 npm run build를 돌려 통과시켜줘.
```
확인: 브라우저에서 시나리오 0, 1, 2 재현, pending → settled 전환 목격, build 통과.

## P9. Principal 화면 (9/29 화 19:00, 60~90분)
```
app/principal/page.tsx("use client", api-client만 사용)를 만들어줘. 왼쪽: mandate 선택과 생성 폼(POST /api/mandates, CreateMandateRequest 타입)(principal, traveler, budget, perTxCap, categories 멀티선택, merchants 체크박스 — 체크한 목록과 별개로 catalog에는 7개 전부 스냅샷, blocked keywords, 기간). 생성하면 앵커 tx 링크가 토스트로 뜸. 오른쪽: 선택한 mandate의 spent/remaining(pending 포함), Pause/Resume/Revoke 버튼(PATCH), 장부 표(시간, 가맹점, 금액, 수수료, 결정, 사유, 상태, tx 링크). 5초 폴링. 상단 헤더에 링크(Principal / Traveler / Audit / Metrics). 게이지 같은 장식은 나중에.
```
확인: Pause 후 traveler 요청이 MANDATE_NOT_ACTIVE, Resume 후 APPROVE.

## P10-A. 증거 내보내기 + verify (9/29 화 20:30, 45분) — MVP
```
scripts/export.ts를 만들어줘: `npx tsx scripts/export.ts man_A`가 Supabase에서 mandate(json + status + anchor_tx)와 장부를 읽어 evidence/mandate-A.json({ mandate, anchorTx })과 evidence/ledger-A.json(LedgerEntry[])으로 저장. 그 다음 `npx tsx scripts/verify.ts evidence/mandate-A.json evidence/ledger-A.json`을 실행해 전부 ✅인지 보여주고 출력을 evidence/12-verify.txt로 저장해줘.
```
확인: ALL RECORDS VERIFIED. (선택) Supabase에서 항목 하나의 decision을 손으로 APPROVE로 바꾸고 다시 export → ❌ — 캡처 후 되돌리기.

## P10-B. Audit 화면 (60분) — 시간이 남을 때만
```
app/audit/[mandateId]/page.tsx를 만들어줘. 클라이언트 컴포넌트로 api.audit(mandateId)(GET /api/audit/[id], AuditResponse)를 호출해 그린다. 백엔드 라우트가 없으면 먼저 만들어라(마스터 프롬프트 Phase 3 표 참고). 섹션 1 "Mandate": canonical terms JSON, keccak 해시, 앵커 tx에서 readMemo로 읽은 해시와 일치 여부(✅/❌). 섹션 2 "Replay": lib/policy.ts의 replayLedger(mandate, entries) 결과 표 — 항목별 저장된 결정 vs 재계산 결정, consistent, 사유. 섹션 3 "Transactions": txHash가 있는 항목마다 tx 링크, readMemo 결과, receiptHash(entry) 재계산값이 저장값 및 calldata와 같은지 ✅. 맨 위에 요약 배지 "N of N checks passed". 이 페이지는 DB의 decision 필드를 믿지 않고 재계산한다는 문장을 상단에 써줘.
```

## P11. 토큰 비교와 Metrics (9/29 화 21:15, 45분 — 화면 대신 스크립트 표로)
```
scripts/compare-reasoning.ts를 먼저 만들어줘: 실제 앱의 systemPrompt와 proposePaymentTool로, spike의 구매 요청 5개를 flow "compare"로 (1) 생각 켬(사용자 메시지 그대로) (2) 생각 끔(메시지 끝에 " /no_think") 두 방식으로 각각 1회씩 호출해 completion 토큰, prompt 토큰, 비용, latency, 툴콜 여부를 docs/reasoning-comparison.json에 저장하고 절감률(%)을 출력. (9/27 측정값: 5/5 동일, completion 180 → 47(−74%), latency 2.9초 → 0.9초, 비용 −50%; 킥오프 전 스파이크는 160 → 47) 그 다음 app/metrics/page.tsx("use client", api.usage() → UsageResponse): 표 1 byFlow(flow, calls, prompt/completion/total tokens, cost, avg latency — status_fastpath와 stop_template의 0토큰 행 포함). 표 2: reasoning-comparison.json. 카드: Energy estimate = total_tokens × ENERGY_J_PER_TOKEN / 3600 Wh, 옆에 "Assumption: X J/token, source: …" 필수. ENERGY_J_PER_TOKEN이 비어 있으면 "assumption not set — see README"라고 보여줘. 시간이 없으면 페이지 대신 scripts/metrics.ts가 같은 내용을 마크다운 표로 출력하게 해줘.
```
확인: 비교표에 실제 숫자, 에너지 카드에 가정 문구.

## P12. 시나리오 실행 + 증거 수집 (9/29 화 22:00, 60분) — 이어서 23:00에 데모 영상 1차 녹화
```
scripts/scenario.ts를 만들어줘. 먼저 scripts/seed.ts로 A/B/C를 새로 만들고(DUPLICATE 회피), PRD §7의 0~7번 요청을 순서대로 /api/chat에 보내(mandate는 요청별로 A/B/C 지정), pending 항목은 confirm을 폴링해 settled까지 기다린 뒤, 각 응답과 장부 행을 evidence/scenario-YYYYMMDD-HHmm.json에 저장해. Pause/Resume은 PATCH로 사이에 끼워 넣어. 끝나면 요약 표(요청, mandate, 결정, 사유 코드, txHash)를 출력해.
```
확인: 표가 PRD §7과 일치. 스크린샷 9장(01, 02, 03, 04, 07, 08, 09, 10, 11) + 05-health.json, 06-kiln-calls.txt, 12-verify.txt (`docs/PLAN.md` §4 명명 규칙).

## P13. 다듬기 — 시간이 남을 때만
```
UI 점검(시간 남을 때만): 모든 페이지의 빈 상태/로딩/에러 상태, 숫자 포맷 $12.00, 해시는 앞 6자리+…+뒤 4자리로 줄이고 복사 버튼. 헤더에 "Testnet | Sepolia | demo rate 1 ETH = $4,000" 배지. 콘솔 에러 0. npm run build 통과 확인. Vercel 배포는 선택(환경변수 목록만 출력해줘).
```

## P14. README와 제출물 (9/30 수 07:30, 90분)
```
docs/SUBMISSION-README-template.md를 채워 README.md를 만들어줘. 실제 값으로: tx 해시들(앵커, 결제 2건 이상), evidence/scenario JSON에서 뽑은 STOP 런 5개(cap, merchant 3사유, fees, paused, expired), docs/reasoning-comparison.json의 비교표, flow별 토큰 표(0토큰 행 포함), 에너지 가정과 출처, evidence/12-verify.txt 발췌. "Pre-hackathon preparation" 섹션은 템플릿 문구를 실제 한 일에 맞게 고쳐줘(lib/, scripts/, tests/, 문서, 스캐폴드, 지갑, 키는 사전 준비; app/, lib/db.ts, seed/export/scenario/compare 스크립트, UI는 현장).
```

---

## 막힐 때 쓰는 프롬프트

**툴콜 인자가 이상할 때**
```
propose_payment 인자에서 amount_usd가 문자열("12 dollars")로 올 때가 있어. lib/agent.ts에서 zod로 인자를 정규화해줘: 숫자만 추출, merchant_id는 catalog id와 대소문자 무시 매칭, 매칭 실패 시 name 부분일치로 1개만 허용, 그래도 없으면 UNKNOWN_MERCHANT로 흘려보내. 테스트 3개 추가.
```

**Sepolia 가스 추정 실패**
```
estimateGas가 "insufficient funds"로 실패해. 추정 실패 시 feeUsd를 0으로 두지 말고, 최근 성공 tx의 실제 수수료 평균(장부에서)을 fallback으로 쓰고, 그것도 없으면 21000 gas × 현재 gasPrice로 계산해줘. 어떤 경로를 썼는지 entry.feeSource에 기록.
```

**Vercel에서 결제 API가 타임아웃**
```
app/api/chat/route.ts에 export const maxDuration = 60, runtime = "nodejs"를 넣고, 그래도 느리면 sendPaymentNoWait만 쓰고 있는지 확인해줘. waitForTransactionReceipt 호출이 요청 경로에 남아 있으면 제거.
```

**402 Payment Required (Kiln 크레딧 소진)**
```
Kiln이 402를 줘. lib/kiln.ts에 KILN_FALLBACK_BASE_URL/KILN_FALLBACK_API_KEY가 설정되어 있으면 402/429/5xx에서 한 번만 폴백하고 usage.model에 "fallback:"를 접두어로 남겨줘. /metrics에서 fallback 호출 수를 따로 보여줘. 제출 전 반드시 Kiln으로 되돌린다는 TODO 주석.
```

**같은 요청이 DUPLICATE로 막힐 때(영상 재촬영)**
```
scripts/seed.ts를 다시 실행해 mandate A/B/C를 새로 만들고, 장부와 usage는 그대로 둬(증거 보존). 새 mandate id로 시나리오를 다시 돌려줘.
```
