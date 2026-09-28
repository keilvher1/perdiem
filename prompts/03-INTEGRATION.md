# 03 — 통합 (Codex 프론트 PR을 Claude Code 백엔드에 합치기)

**언제:** 9/29(화) 06:00~08:30. Codex PR이 올라와 있고, `main`에 Phase 3(API)까지 커밋된 상태.
**쓰는 법:** 사람이 §A를 5분 안에 하고, §B를 Claude Code에 붙여넣습니다. §C는 통합 후 손으로 확인하는 목록입니다.

---

## A. 사람이 먼저 (5분)
1. GitHub에서 Codex PR 열기 → "Files changed"에서 **`contracts/`나 `docs/fixtures/`, `app/api/`, `lib/{kiln,policy,chain,agent,db}.ts`가 바뀌지 않았는지** 확인. 바뀌었으면 PR 설명의 `TODO(contract)`를 읽고 메모(Claude Code에 전달).
2. PR을 **머지하지 말고** 그대로 둔다(Claude Code가 로컬에서 머지하고 푸시).
3. `.env.local`에 `NEXT_PUBLIC_API_MODE=live` 한 줄 추가.

## B. Claude Code 프롬프트

=== 프롬프트 시작 ===

`feat/frontend` 브랜치(Codex가 만든 프론트엔드)를 `main`(백엔드)에 통합해라. 기준은 `contracts/api.ts`이고, 계약서는 수정하지 않는다. 순서대로 진행하고 각 단계 결과를 보여줘라.

1. `git fetch origin` → `git checkout main` → `git merge --no-ff origin/feat/frontend -m "feat: integrate frontend (Codex)"`. 충돌이 나면 소유권 규칙으로 해결: `app/api/**`, `lib/{kiln,policy,chain,agent,db,view}.ts`, `scripts/**`, `tests/**`, `docs/**`, `CLAUDE.md`는 `main` 쪽(ours), `app/{layout,page,globals.css}`, `app/{traveler,principal,audit,metrics}/**`, `components/**`, `hooks/**`, `lib/{api-client,format}.ts`, `AGENTS.md`는 브랜치 쪽(theirs). `package.json`과 `package-lock.json`은 양쪽 의존성을 합친 뒤 `npm install`로 lock을 다시 만든다. `package.json`/`package-lock.json`이 충돌하면 `package.json`을 손으로 합친 뒤 `rm package-lock.json && npm install`. 충돌 파일 목록과 선택을 보고해라.
2. `git diff --stat main~1 origin/feat/frontend -- contracts docs/fixtures app/api lib/kiln.ts lib/policy.ts lib/chain.ts lib/agent.ts lib/db.ts` 가 비어 있는지 확인. 비어 있지 않으면 그 변경을 되돌리고(`git checkout main~1 -- <path>`) 내용을 나에게 보고해라.
3. `npm ci` → `npm run typecheck` → `npm run lint` → `npm run build`. 에러는 유형별로 분류해 고쳐라:
   - 프론트가 계약서와 다른 필드명/경로를 쓴 경우 → 프론트를 계약서에 맞춘다(최소 수정, 파일과 줄을 목록으로).
   - 백엔드 응답이 계약서와 다른 경우 → 백엔드를 고친다.
   - 프론트가 `lib/kiln|chain|db`를 import한 경우 → `lib/api-client.ts`를 통하도록 바꾼다.
   - `next build`에서 "server-only" 또는 Node 내장 모듈이 클라이언트 번들에 들어갔다는 경고 → 원인 컴포넌트에서 import 제거.
4. `lib/api-client.ts`를 읽고: live 모드가 `ENDPOINTS`의 경로만 호출하는지, `ApiError` 형태를 파싱하는지, `NEXT_PUBLIC_API_MODE` 외의 env를 읽지 않는지 확인. 문제가 있으면 고쳐라.
5. `npm run dev`를 백그라운드로 띄우고(`NEXT_PUBLIC_API_MODE=live`), `npm run seed`로 새 mandate A/B/C를 만든 뒤 `npm run scenario -- --mandates <A>,<B>,<C>`를 실행해 8행이 기대와 일치하는지 확인.
6. 브라우저에서 `/traveler?m=<A>`를 열어 점심 $12(승인)와 택시 $85(중단)가 카드로 보이는지만 확인한다. 나머지 화면 확인과 스크린샷 11장은 화요일 저녁(마스터 프롬프트 Phase 6의 0번)으로 미룬다. 08:30까지 build와 scenario가 초록이면 통합은 성공이다.
7. 커밋 → `git push origin main`. 통합에서 프론트 파일을 수정했다면 수정 목록을 PR 코멘트용으로 정리해 출력해라(내가 Codex PR에 남긴다).

=== 프롬프트 끝 ===

## C. 통합 후 손으로 확인 (10분)
(화요일 아침에는 첫 두 항목만, 나머지는 화요일 저녁에)
- [ ] `/traveler`에서 점심 $12 → APPROVED 카드 → 약 15초 뒤 settled로 바뀜, Etherscan 링크가 실제 tx로 열림
- [ ] 택시 $85, 와인 선물 $30 → STOPPED 카드에 사유 칩(택시 1개, 와인 3개)
- [ ] mandate B로 바꿔 저녁 $10 → `OVER_BUDGET_WITH_FEES`, 메시지에 "+ network fee"
- [ ] `/principal`에서 Pause → 커피 $5 STOPPED `MANDATE_NOT_ACTIVE` → Resume → APPROVED
- [ ] mandate C → `EXPIRED`
- [ ] "How much do I have left?" → 잔액 답변, 카드 없음
- [ ] `/audit/<A>` 전부 ✅, 앵커 해시 일치
- [ ] `/metrics`에 `status_fastpath`, `stop_template` 0토큰 행
- [ ] 콘솔 에러 0, `npm run build` 통과
- [ ] `git log --all -- .env.local`이 비어 있음

## D. Codex 프론트가 없을 때 (플랜 B)
Codex PR이 늦거나 품질이 안 되면, Claude Code에 `docs/PROMPTS.md`의 P8(Traveler), P9(Principal), P10-B(Audit), P11(Metrics)을 순서대로 넣는다. 그 프롬프트들도 `lib/api-client.ts`(live 모드만)와 계약서를 쓰도록 되어 있으니 구조는 같다. Traveler와 Principal만 만들어도 제출은 가능하다(Audit은 `scripts/verify.ts` 출력, Metrics는 `evidence/metrics.md`로 대체).
