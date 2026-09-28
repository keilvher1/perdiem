# 개발 워크플로우 — Claude Code(백엔드) + Codex GPT-6 Astra(프론트엔드) → 통합

혼자서 두 에이전트를 **동시에** 돌리는 방식입니다. 백엔드와 프론트엔드가 서로를 기다리지 않도록, 둘 다 `contracts/api.ts`(API 계약서)와 `docs/fixtures/*.json`(목 데이터)만 보고 만듭니다. 계약서가 같으니 마지막에 파일을 합치기만 하면 됩니다.

```
                 contracts/api.ts  +  docs/fixtures/*.json   (읽기 전용, 둘 다 같은 파일)
                          │                         │
        ┌─────────────────┴───────┐     ┌───────────┴──────────────┐
        │ Claude Code (터미널)     │     │ Codex GPT-6 Astra (클라우드)│
        │ lib/db, app/api/*,      │     │ app/*/page.tsx, components/,│
        │ scripts/, tests/        │     │ lib/api-client.ts (mock+live)│
        │ → main 브랜치            │     │ → feat/frontend 브랜치 (PR)  │
        └─────────────┬───────────┘     └────────────┬───────────────┘
                      └──────────── 통합 (Claude Code) ┘
                        PR 머지 → NEXT_PUBLIC_API_MODE=live → build → 시나리오 → 영상
```

## 파일 소유권 (충돌 방지의 핵심)

| 영역 | 소유자 | 경로 |
|---|---|---|
| 계약서, 목 데이터 | 읽기 전용(둘 다) | `contracts/api.ts`, `docs/fixtures/**` |
| 백엔드 | Claude Code | `lib/**`(단, `lib/api-client.ts`, `lib/format.ts` 제외), `app/api/**`, `scripts/**`, `tests/**`, `docs/**`(fixtures 제외), `.env*`, `CLAUDE.md` |
| 프론트엔드 | Codex | `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `app/traveler/**`, `app/principal/**`, `app/audit/**`, `app/metrics/**`, `components/**`, `lib/api-client.ts`, `lib/format.ts`, `hooks/**`, `AGENTS.md` |
| 공통 설정 | Claude Code가 Phase 0에서 만들고 **그 뒤로는 둘 다 손대지 않음** | `package.json`, `package-lock.json`, `components.json`, `eslint.config.*`, `next.config.*`, `tsconfig.json`, `postcss.config.*`, `lib/utils.ts`, `README.md`(Phase 7에서 Claude Code만) |

`AGENTS.md`(Codex가 자동으로 읽음)와 `CLAUDE.md`(Claude Code가 자동으로 읽음)에 같은 표가 들어 있습니다.

## 순서

### 0. 준비 (9/27 일, 30분) — 사람이 직접
1. GitHub에 빈 저장소 `perdiem` 생성(Private 가능, 제출 때 Public으로).
2. Codex(ChatGPT → Codex)에서 GitHub 연결, `perdiem` 저장소 접근 허용. 환경 설정에서 setup 스크립트 `npm ci` 권장.
3. 이 키트의 zip을 풀어 둔다. `.env.local`은 `perdiem-env-local.txt`에서 복사(Supabase 두 줄은 일요일에 채움).

### 1. 스캐폴드 커밋 (9/28 월 20:00, Claude Code 10분)
`prompts/01-CLAUDE-CODE-MASTER.md`의 **Phase 0**만 먼저 실행 → `main`에 첫 커밋(스캐폴드 + 키트 파일 전부 + AGENTS.md). **이 커밋이 Codex의 출발점**이라 먼저 올려야 합니다.

### 2. 동시 진행 (9/28 월 20:15~00:30)
- **Codex:** `prompts/02-FRONTEND-CODEX-MASTER.md` 전체를 새 태스크로 붙여넣고 `main`에서 시작, 브랜치 `feat/frontend`. Traveler 화면까지 되면 PR을 먼저 열고 나머지는 같은 브랜치에 계속 푸시하게 되어 있음. 한 태스크가 끝나면 "continue with priority item N"으로 이어서 시킴. 클라우드에서 돌아가므로 회사 일이나 백엔드 작업과 겹쳐도 됨. Codex 환경 설정의 setup 스크립트는 `npm ci`, 인터넷 접근은 켜 두는 것을 권장(꺼져 있어도 되도록 패키지는 미리 설치됨).
- **Claude Code:** `01-CLAUDE-CODE-MASTER.md`의 Phase 1~4(백엔드). 00:30 하드 스톱.

### 3. 통합 (9/29 화 06:00~08:30, Claude Code)
`prompts/03-INTEGRATION.md`: PR 머지 → `NEXT_PUBLIC_API_MODE=live` → `npm run build` → `scripts/scenario.ts` → `/traveler`에서 승인 1건, 중단 1건 확인. 계약서 위반이 있으면 **계약서가 기준**, 위반한 쪽을 고침. 화면 전체 확인과 스크린샷은 화요일 저녁.

### 4. 증거와 제출물 (9/29 화 19:00~00:30, Claude Code)
`01-CLAUDE-CODE-MASTER.md`의 Phase 5~6(export, verify, compare, metrics, evidence). 23:00 영상 1차 녹화.

### 5. 제출 (9/30 수 아침)
`docs/PITCH.md`, `docs/SUBMISSION-README-template.md`, `docs/ACCEPTANCE-CHECKLIST.md`.

## Codex 프론트가 늦거나 실패하면
Claude Code에 `docs/PROMPTS.md`의 P8, P9(화면 프롬프트)를 그대로 넣어 프론트를 만들면 됩니다. 계약서와 `lib/api-client.ts` 규칙은 동일합니다.

## 커밋 규칙
- 백엔드는 `main`에 직접 커밋(혼자라 브랜치 불필요), 프론트는 `feat/frontend` PR 1개.
- 매 블록 끝에 커밋. 커밋 메시지에 확인용 curl을 붙이면 나중에 README 증거로 재사용됨.
- 9/28 20:00 이전 커밋 금지(트랙 규정상 제한은 없지만 "대회 기간에 만들었다"는 증거).
