# Acceptance checklist — Challenge B (FuriosaAI x Bricksum)

과제서의 문장을 그대로 왼쪽에 두고, 무엇으로 증명할지 오른쪽에 적었습니다. 제출 전에 전부 ✅가 되어야 합니다. 증거 파일은 `evidence/` 폴더에 번호대로 저장하세요.

## A. Declared Function & User Need
| 과제서 문장 | 구현 | 증거 | 상태 |
|---|---|---|---|
| Declare in one sentence, in your README, the function you built | README 1번째 줄 = PRD §1 선언문 | README | ☐ |
| Identify the intended user and the problem being solved | README "Problem & user" | README | ☐ |
| Demonstrate the workflow from user input to a usable outcome | `/traveler` 채팅 → 영수증 카드(승인, tx 링크) | `evidence/01-approve.png`, 영상 0:00~0:40 | ☐ |
| Explain which task the AI agent performs and which parts you kept in code | README 표: "LLM = 의도 파악과 제안(propose_payment)만 / 코드 = 정책 검사, 수수료 추정, 서명, 기록, 감사" | README | ☐ |

## B. Boundaries & Stopping
| 과제서 문장 | 구현 | 증거 | 상태 |
|---|---|---|---|
| State the boundary the agent must not cross and where in your system it is enforced | README "The boundary" = 11개 검사 표 + "enforced in `lib/policy.ts::evaluate()` before any call to `lib/chain.ts`" | README, 코드 링크 | ☐ |
| Include at least two runs in which the agent is pushed outside the permitted scope — a budget exceeded once fees are added | Run 3 `OVER_BUDGET_WITH_FEES` (mandate B, $10 예산, $10 요청, 수수료 비반올림) | `evidence/03-over-budget-with-fees.png` + 장부 JSON | ☐ |
| — a merchant that is not on the list | Run 2 `MERCHANT_NOT_ALLOWED` (+ category, keyword) | `evidence/02-merchant-not-allowed.png` | ☐ |
| — a deadline already past | mandate C(만료일 과거)로 요청 → `EXPIRED`. 코드 없음 | `evidence/04-expired.png` | ☐ |
| show through logs or history that it stopped | 장부 행 status=stopped, reasons[] 저장, 서버 로그 | `evidence/logs-stop.txt` | ☐ |
| Stopping is a correct outcome, and it should be recorded rather than silent | STOP도 receiptHash를 갖고 `/audit`에 나타남 | `/audit` 캡처 | ☐ |

## C. Kiln API Integration & Efficiency
| 과제서 문장 | 구현 | 증거 | 상태 |
|---|---|---|---|
| The resulting AI agent must operate using the NPU-based Kiln API with (Qwen3-32B, 변경 공지) | `lib/kiln.ts` baseURL `api.bricksum.com/v1`, model `qwen3-32b`, `/api/health`가 GET /models 결과 표시 | `evidence/05-health.json` | ☐ |
| Demonstrate actual API calls within the selected workflow | `chatWithUsage`가 호출마다 `{"kind":"kiln", id, tool_calls, usage}` JSON 한 줄을 로그로 남김. 장부 행에 `kilnResponseId`, `toolArgsRaw` 저장 | `evidence/06-kiln-calls.txt` (서버 로그에서 `"kind":"kiln"` grep) | ☐ |
| show how the responses inform the agent's decisions or actions | 툴콜 인자 → Proposal → evaluate 입력. README 시퀀스 다이어그램 | README | ☐ |
| Report token usage broken down by flow rather than as a single total | `usage_records`를 flow별 집계: propose / status_fastpath(0) / stop_template(0) / compare | `evidence/07-metrics.png` 또는 스크립트 출력 표 | ☐ |
| explain how the design reduces unnecessary inference and energy consumption | README 표: fast-path 0토큰, 템플릿 STOP 0토큰, 컴팩트 카탈로그, low vs high 실측, 단일 툴콜 | README + 비교표 | ☐ |
| supporting energy estimates with available measurements or clearly stated assumptions | "Energy (assumed X J/token, source: …)" 카드, env `ENERGY_J_PER_TOKEN`. 수치가 없으면 카드 W × latency ÷ completion tokens 상한 공식과 출처 | `evidence/07-metrics.png` | ☐ |

## D. Blockchain Integration
| 과제서 문장 | 구현 | 증거 | 상태 |
|---|---|---|---|
| Demonstrate the selected functionality on a devnet or testnet | Ethereum Sepolia | README 체인 명시 | ☐ |
| An end-to-end run of the workflow should produce at least one on-chain transaction — a payment, a settlement, or a record written on-chain | 결제 tx(가맹점 송금) + 앵커 tx(mandate 해시) | README에 해시 2개 이상 + Etherscan 링크 | ☐ |
| provide its transaction hash with the matching log or history entry | 장부 행에 tx_hash, receiptHash; calldata에 같은 receiptHash | `evidence/08-tx-and-ledger.png` (나란히) | ☐ |
| Show how the chain is used by the workflow: which state the agent reads, writes, or settles | README 표: reads = 잔액, 가스가; writes = 앵커, 결제 calldata; settles = ETH 송금 | README | ☐ |

## E. Approval & Evidence
| 과제서 문장 | 구현 | 증거 | 상태 |
|---|---|---|---|
| how a person grants a budget | `/principal` mandate 폼 → 앵커 tx | 영상 0:00~0:20 | ☐ |
| follows what is being spent | `/principal` 잔액 게이지 + 실시간 장부 | `evidence/09-principal.png` | ☐ |
| stops the agent | Pause 버튼 → `MANDATE_NOT_ACTIVE` | 영상, `evidence/10-paused.png` | ☐ |
| receives a receipt | 영수증 카드(금액, 수수료, 해시, 링크) | `evidence/01-approve.png` | ☐ |
| another person, working from your records alone, can reconstruct whether a completed payment was inside what the user allowed | `scripts/verify.ts`(내보낸 JSON + RPC만 사용, 앱 불필요): mandate 해시 = 온체인 앵커, 항목별 재계산 = 저장된 결정, 영수증 해시 재계산 = 저장값 = calldata, 수취 주소와 금액 일치. `/audit/[id]`는 같은 내용의 화면 | `evidence/11-audit.png` + `evidence/12-verify.txt`, 영상 1:50~2:40 | ☐ |

## F. 제출 형식(공식 Q&A)
| 항목 | 상태 |
|---|---|
| Challenge 명시 ("FuriosaAI x Bricksum — Challenge B") | ☐ |
| GitHub 저장소 링크(접근 가능) | ☐ |
| 데모 영상 3분 이내 링크 | ☐ |
| 프로젝트 요약 + 피치덱 PDF | ☐ |
| README에 사전 준비 범위 공개(lib/, scripts/, tests/, 문서, 스캐폴드, 지갑, 키) | ☐ |
| 시크릿 창에서 모든 링크 열림 확인 | ☐ |
