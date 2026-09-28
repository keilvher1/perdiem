# Acceptance checklist — Challenge B (FuriosaAI x Bricksum)

과제서의 문장을 그대로 왼쪽에 두고, 무엇으로 증명할지 오른쪽에 적었습니다. 제출 전에 전부 ✅가 되어야 합니다. 증거 파일은 `evidence/` 폴더에 번호대로 저장하세요.

**2026-09-28 22:30 KST 기준.** 증거 실행(서버 1대, DB 정리 후): **ev1** = 기록된 API 실행(`evidence/seed-1.json`, 20:32–20:33 KST, `scenario-20260928-2033.json` 8/8), **ev3** = 채팅 스크린샷(`evidence/seed-3.json`, 22:10 KST), **ev2** = 헤드라인이 잘려 교체된 촬영(호출은 로그·DB에 남음). 남은 항목: 영상, 저장소 공개, 모델 공지 링크, 제출, 시크릿 창 확인.

## A. Declared Function & User Need
| 과제서 문장 | 구현 | 증거 | 상태 |
|---|---|---|---|
| Declare in one sentence, in your README, the function you built | README 1번째 줄 = PRD §1 선언문 | README 1번째 줄 | ✅ |
| Identify the intended user and the problem being solved | README "Problem & user" | README "Problem & user" | ✅ |
| Demonstrate the workflow from user input to a usable outcome | `/traveler` 채팅 → 영수증 카드(승인, tx 링크) | `evidence/01-approve.png`(ev3), `evidence/scenario-20260928-2033.json` #0(ev1: 승인 → settled, 블록 11800240), 영상 대기 | ✅ |
| Explain which task the AI agent performs and which parts you kept in code | README 표: "LLM = 의도 파악과 제안(propose_payment)만 / 코드 = 정책 검사, 수수료 추정, 서명, 기록, 감사" | README "What the model does vs. what stays in code" | ✅ |

## B. Boundaries & Stopping
| 과제서 문장 | 구현 | 증거 | 상태 |
|---|---|---|---|
| State the boundary the agent must not cross and where in your system it is enforced | README "The boundary" = 12개 검사(StopCode 12개) 표 + "enforced in `lib/policy.ts::evaluate()` before any call to `lib/chain.ts`" | README "The boundary and where it is enforced", `lib/policy.ts`, `npm test` 9개 스위트 통과 | ✅ |
| Include at least two runs in which the agent is pushed outside the permitted scope — a budget exceeded once fees are added | Run 3 `OVER_BUDGET_WITH_FEES` (mandate B, $10 예산, $10 요청, 수수료 비반올림) | `evidence/03-over-budget-with-fees.png`(ev3) + `scenario-20260928-2033.json` #3(ev1 `led_1790595213468_o37s`: $10 + 수수료 $0.122199 > $10.00) + `12-verify-B.txt` 4/4 | ✅ |
| — a merchant that is not on the list | Run 2 `MERCHANT_NOT_ALLOWED` (+ category, keyword) | `evidence/02-merchant-not-allowed.png`(ev3) + #2(ev1 `led_1790595211709_t7b5`, 사유 3개) | ✅ |
| — a deadline already past | mandate C(만료일 과거)로 요청 → `EXPIRED`. 코드 없음 | `evidence/04-expired.png`(ev3) + #5(ev1 `led_1790595221963_zreu`) + `12-verify-C.txt` 4/4 | ✅ |
| show through logs or history that it stopped | 장부 행 status=stopped, reasons[] 저장, 서버 로그(`"kind":"decision"`, 일시정지·재개는 `"kind":"mandate_status"`) | `evidence/logs-stop.txt`(결정 21줄: STOP 15, APPROVE 6) + `evidence/logs-status.txt`(mandate_status 6줄 + decision 21줄; 해시된 기록이 아니라 서버 로그 줄) | ✅ |
| Stopping is a correct outcome, and it should be recorded rather than silent | STOP도 receiptHash를 갖고 `/audit`에 나타남 | `evidence/11-audit.png`(24/24, A의 STOP 3건 재생), `evidence/metrics.md`(`stop_template` 15행, 0토큰) | ✅ |

## C. Kiln API Integration & Efficiency
| 과제서 문장 | 구현 | 증거 | 상태 |
|---|---|---|---|
| The resulting AI agent must operate using the NPU-based Kiln API with (Qwen3-32B, 변경 공지) | `lib/kiln.ts` baseURL `api.bricksum.com/v1`, model `qwen3-32b`, `/api/health`가 GET /models 결과 표시 | `evidence/05-health.json`(`qwen3-32b` 목록, `modelAvailable: true`) | ✅ |
| Demonstrate actual API calls within the selected workflow | `chatWithUsage`가 호출마다 `{"kind":"kiln", id, tool_calls, usage}` JSON 한 줄을 로그로 남김. 장부 행에 `kilnResponseId`, `toolArgsRaw` 저장 | `evidence/06-kiln-calls.txt` + `evidence/kiln-calls-by-flow.md`(31회: propose 21, compare 10), README 발췌(ev1 propose 7회 → 장부 id → 결정) | ✅ |
| show how the responses inform the agent's decisions or actions | 툴콜 인자 → Proposal → evaluate 입력. README 시퀀스 다이어그램 | README 시퀀스 다이어그램 + propose 표(툴콜 인자 → 장부 항목) | ✅ |
| Report token usage broken down by flow rather than as a single total | `usage_records`를 flow별 집계: propose / status_fastpath(0) / stop_template(0) / compare | `evidence/07-metrics.png`(ev1 후 13회) + `evidence/metrics.md`(ev1–ev3: 39행, 10,797토큰, 22:11 KST) | ✅ |
| explain how the design reduces unnecessary inference and energy consumption | README 표: fast-path 0토큰, 템플릿 STOP 0토큰, 컴팩트 카탈로그, thinking on vs off(`/no_think`) 실측(9/28 행사 중 `npm run compare` → `docs/reasoning-comparison.json`: 툴콜 5/5 동일, completion 154→47.4 −69.2%, latency 3.0s→1.2s, 비용 −47.5%; 9/27 사전 측정 180→47은 원자료가 저장소에 없어 증거로 인용하지 않음), 단일 툴콜 | README + `docs/reasoning-comparison.json` + `evidence/metrics.md` | ✅ |
| supporting energy estimates with available measurements or clearly stated assumptions | "Energy (assumed X J/token, source: …)" 카드, env `ENERGY_J_PER_TOKEN`. 수치가 없으면 카드 TDP W × latency ÷ 요청당 처리 토큰(prompt + completion) 추정 공식과 출처 (적용값 180 W × 1.233 s ÷ 517 = 0.429 J/token; 상한이 아니라 양방향 오차가 있는 추정) | `evidence/07-metrics.png`(가정과 출처 표시) + `evidence/metrics.md`(≈ 1.29 Wh / 10,797토큰, 0.429 J/token) | ✅ |

## D. Blockchain Integration
| 과제서 문장 | 구현 | 증거 | 상태 |
|---|---|---|---|
| Demonstrate the selected functionality on a devnet or testnet | Ethereum Sepolia | README "Blockchain integration (Ethereum Sepolia)" | ✅ |
| An end-to-end run of the workflow should produce at least one on-chain transaction — a payment, a settlement, or a record written on-chain | 결제 tx(가맹점 송금) + 앵커 tx(mandate 해시) | README "Proof of API usage" 표: ev1 앵커 3건 + 결제 #0·#6(블록 11800240, 11800242), Etherscan 링크 | ✅ |
| provide its transaction hash with the matching log or history entry | 장부 행에 tx_hash, receiptHash; calldata에 같은 receiptHash | `evidence/08-tx-and-ledger.png`(장부 옆에 디코딩한 calldata; 헤드리스 Chrome은 Etherscan이 차단) + README 표의 장부 id | ✅ |
| Show how the chain is used by the workflow: which state the agent reads, writes, or settles | README 표: reads = 잔액, 가스가; writes = 앵커, 결제 calldata; settles = ETH 송금 | README "reads / writes / settles" 표 | ✅ |

## E. Approval & Evidence
| 과제서 문장 | 구현 | 증거 | 상태 |
|---|---|---|---|
| how a person grants a budget | `/principal` mandate 폼 → 앵커 tx | `evidence/09-principal.png`(부여 폼, mandate 해시, 앵커 tx) + `seed-1.json` 앵커, 영상 대기 | ✅ |
| follows what is being spent | `/principal` 잔액 게이지 + 실시간 장부 | `evidence/09-principal.png`(예산·지출·대기·잔액) | ✅ |
| stops the agent | Pause 버튼 → `MANDATE_NOT_ACTIVE`. 한계: 일시정지·재개 자체는 해시된 기록이나 온체인 기록이 아니라 로그 줄과 `MANDATE_NOT_ACTIVE` 항목으로만 보임(README에 명시) | `evidence/10-paused.png`(ev3), `evidence/logs-status.txt`(세트마다 active→paused, `MANDATE_NOT_ACTIVE` STOP, paused→active, APPROVE), 영상 대기 | ✅ |
| receives a receipt | 영수증 카드(금액, 수수료, "You said", tx·receipt·mandate 해시, 링크). 우하단 **Evidence** 버튼 → 드로어에 최신 영수증 | `evidence/01-approve.png`(ev3), `evidence/14-evidence-drawer.png`(ev1, 24 of 24) | ✅ |
| another person, working from your records alone, can reconstruct whether a completed payment was inside what the user allowed | Evidence 드로어(또는 `/audit` 페이지)의 **Download records** → `mandate-<id>.json`, `ledger-<id>.json`(`npm run export`와 바이트 동일, `cmp`로 확인) → `npx tsx scripts/verify.ts ~/Downloads/mandate-<id>.json ~/Downloads/ledger-<id>.json`(파일 + 공개 RPC만 사용, 앱 불필요): mandate 해시 = 온체인 앵커, 앵커 발신자 = agentWallet, 항목별 재계산 = 저장된 결정, 결제마다 영수증 해시 = calldata, 수취 주소, 금액, 발신자 = agentWallet, 채굴·성공. 검사 수 = 2 + 2 × 항목 + 6 × 결제(mandate A: 24). 금액은 `DEMO_ETH_USD`(기본 4000, 앱과 같은 환율)로 환산. `/audit/[id]`와 `GET /api/audit/<id>`도 같은 공식으로 같은 수를 셈 | `evidence/12-verify.txt`(24 ✅, ALL RECORDS VERIFIED) + `evidence/11-audit.png`(24/24) + 드로어 다운로드 `cmp` 바이트 동일·24/24(lead 확인, 파일은 커밋 안 함) | ✅ |

## F. 제출 형식(공식 Q&A)
| 항목 | 상태 |
|---|---|
| Challenge 명시 ("FuriosaAI x Bricksum — Challenge B") | ✅ README 5번째 줄 |
| GitHub 저장소 링크(접근 가능) | ☐ 공개 전환 후 시크릿 창 확인(lead) |
| 데모 영상 3분 이내 링크 | ☐ 촬영·업로드 대기(README 7번째 줄 자리표시 1개) |
| 프로젝트 요약 + 피치덱 PDF | ✅ 요약 = README, 덱 = `docs/deck.pdf`(9쪽, 22:29 KST에 오늘 증거로 재렌더) |
| README에 사전 준비 범위 공개(contracts/, docs/, prompts/, lib/{kiln,policy,chain,agent}.ts, scripts/{spike,verify}.ts, tests/, 지갑, 키, Supabase 프로젝트) | ✅ README "Pre-hackathon preparation (disclosure)" |
| 공개(Public) GitHub 저장소 + README에 설명과 실행 방법(how to run) | ◐ README 설명·실행 방법 ✅, 공개 전환(lead) ☐ |
| 발표 자료 PDF 10쪽 이내 (`docs/deck.pdf`) | ✅ 9쪽(`docs/deck.pdf`, 22:29 KST 재렌더, `scripts/deck.ts`는 10쪽 초과 시 거부) |
| **README에 API 사용 증거: 온체인 tx 해시(앵커 + 결제) + Kiln API 호출 로그(flow별, `evidence/kiln-calls-by-flow.md`)** | ✅ README "Proof of API usage"(ev1 tx 5건 + flow별 Kiln 로그) |
| 모델 표기: 과제서 문구는 gpt-oss-120b, Kiln 제공 모델은 qwen3-32b와 deepseek-v4.1-flash뿐 → 트랙은 qwen3-32b 사용(공지 링크) | ◐ 문구 ✅, 공지 링크 대기(README 자리표시 1개) |
| 마감 2026-09-30 12:00 KST 전 제출 | ☐ |
| 시크릿 창에서 모든 링크 열림 확인 | ☐ |
