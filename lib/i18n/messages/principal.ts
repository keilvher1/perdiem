/**
 * "principal" namespace. `en` is the reference: its strings must equal the English UI copy exactly.
 * The other languages are typed `typeof en`, so a missing key is a compile error.
 * Data (merchant names, mandate ids, amounts, STOP codes, the grant form's default values) is
 * never translated; `byline` takes the name elements so each language can order them.
 */
export const en = {
  /** Joins data lists (categories, merchant names). */
  listSep: ", ",
  page: {
    eyebrow: "Principal",
    title: "Grant a budget, watch it, stop it",
    description:
      "Set the terms once. Every agent payment is checked against them in code; pause is a kill switch, revoke is final.",
    granted: "Mandate granted — anchored on Sepolia",
    loadMandatesFailed: "Couldn’t load mandates",
    noMandates: "No mandates yet",
    noMandatesHint:
      "Grant the first one with the form. It is hashed and anchored on Sepolia.",
    loadMandateFailed: (id: string) => `Couldn’t load ${id}`,
    ledgerTitle: "Ledger",
    ledgerDescription:
      "Every decision, approved or stopped, newest first. Refreshes every 5 s; click a row for the proposal, hashes and Kiln evidence.",
    updated: (rel: string) => `Updated ${rel}`,
    refreshLedger: "Refresh ledger",
    refresh: "Refresh",
    staleCopy: (msg: string) =>
      `Showing the last good copy — refresh failed: ${msg}`,
    loadLedgerFailed: "Couldn’t load the ledger",
    noRequests: "No requests yet — try a quick prompt",
    noRequestsHint:
      "The traveler has not asked the agent for anything under this mandate.",
    openTraveler: "Open Traveler",
  },
  grant: {
    title: "Grant a mandate",
    description:
      "Budget, per-payment cap, permitted merchants and categories, blocked words and a trip window.",
    loadMerchantsFailed: "Couldn’t load the merchant catalog",
    loadingForm: "Loading form",
    principal: "Principal",
    traveler: "Traveler",
    budget: "Budget (USD)",
    cap: "Per-transaction cap (USD)",
    categories: "Allowed categories",
    merchants: "Allowed merchants",
    offCategory: (names: string, n: number) =>
      `${names} ${n === 1 ? "is" : "are"} allowed but ${n === 1 ? "its" : "their"} category is not — payments there will still be stopped.`,
    blocked: "Blocked keywords",
    blockedHint:
      "Comma-separated. Checked against the agent’s memo and the traveler’s own words.",
    start: "Window start",
    end: "Window end",
    submit: "Grant and anchor",
    submitting: "Anchoring on Sepolia…",
    footnote: "The terms are hashed and the hash is written to Sepolia.",
    notCreated: "Mandate was not created",
    errors: {
      principal: "Who grants the budget?",
      traveler: "Who travels?",
      budget: "Budget must be a positive number.",
      cap: "Cap must be a positive number.",
      capOverBudget: (budget: string) =>
        `Cap cannot exceed the budget (${budget}).`,
      categories: "Allow at least one category.",
      merchants: "Allow at least one merchant.",
      start: "Pick a start time.",
      end: "Pick an end time.",
      endBeforeStart: "End must be after the start.",
    },
  },
  controls: {
    /** "<traveler> on behalf of <principal> · cap $40.00 per payment"; the names arrive as elements. */
    byline: <T>(traveler: T, principal: T, cap: string): (T | string)[] => [
      traveler,
      " on behalf of ",
      principal,
      ` · cap ${cap} per payment`,
    ],
    pause: "Pause",
    resume: "Resume",
    revoke: "Revoke",
    revoked: "Revoked",
    paused: (id: string) => `${id} paused`,
    pausedHint:
      "The kill switch is on: every agent request is stopped and recorded.",
    resumed: (id: string) => `${id} resumed`,
    resumedHint: "The agent can propose again, inside the same terms.",
    revokedToast: (id: string) => `${id} revoked`,
    revokedHint: "Final. The mandate can no longer spend.",
    failed: {
      pause: (id: string) => `Could not pause ${id}`,
      resume: (id: string) => `Could not resume ${id}`,
      revoke: (id: string) => `Could not revoke ${id}`,
    },
    revokedNotice:
      "Revoked — this is final. Pause and resume are disabled; every request against this mandate is stopped and recorded.",
    expiredNotice: (date: string) =>
      `The trip window closed on ${date}. Requests are stopped with EXPIRED regardless of status.`,
    budget: "Budget",
    spent: "Spent",
    spentHint: "approved + pending + settled",
    pending: "Pending",
    pendingHint: "broadcast, not yet mined",
    remaining: "Remaining",
    remainingHint: (pct: number) => `${pct}% of budget`,
    mandateHash: "Mandate hash (terms, excludes status)",
    mandateHashWhat: "mandate hash",
    anchorTx: "Anchor transaction on Sepolia",
    anchorTxWhat: "anchor transaction",
    notAnchored: "not anchored",
    confirmTitle: (id: string) => `Revoke ${id}?`,
    confirmBody:
      "Revoking is final. The agent will be stopped on every request under this mandate, and it cannot be resumed. Past receipts and the on-chain anchor stay verifiable.",
    keep: "Keep it",
    confirm: "Revoke mandate",
  },
  boundary: {
    title: "How the boundary works",
    /** Text before and after the monospace "lib/policy.ts evaluate()". */
    introBefore: "Every proposal runs through 12 checks in ",
    introAfter:
      " — plain code, before any on-chain call. The model never holds keys, and every failing rule is reported, not just the first.",
  },
};

export const ko: typeof en = {
  listSep: ", ",
  page: {
    eyebrow: "위임자",
    title: "예산을 부여하고, 지켜보고, 멈춥니다",
    description:
      "조건은 한 번만 정합니다. 에이전트의 모든 결제는 코드로 이 조건과 대조됩니다. 일시정지는 킬 스위치이고, 철회는 되돌릴 수 없습니다.",
    granted: "위임 발급 완료 — Sepolia에 앵커링됨",
    loadMandatesFailed: "위임 목록을 불러오지 못했습니다",
    noMandates: "아직 위임이 없습니다",
    noMandatesHint:
      "양식에서 첫 위임을 발급할 수 있습니다. 위임은 해시되어 Sepolia에 앵커링됩니다.",
    loadMandateFailed: (id) => `${id} 위임을 불러오지 못했습니다`,
    ledgerTitle: "장부",
    ledgerDescription:
      "승인되거나 중단된 모든 결정을 최신순으로 표시합니다. 5초마다 갱신되며, 행을 클릭하면 제안 내용·해시·Kiln 증빙을 볼 수 있습니다.",
    updated: (rel) => `업데이트: ${rel}`,
    refreshLedger: "장부 새로고침",
    refresh: "새로고침",
    staleCopy: (msg) =>
      `마지막으로 불러온 내용을 표시합니다 — 새로고침 실패: ${msg}`,
    loadLedgerFailed: "장부를 불러오지 못했습니다",
    noRequests: "아직 요청이 없습니다 — 빠른 요청으로 시작해 보세요",
    noRequestsHint:
      "출장자가 이 위임으로 에이전트에게 아직 아무것도 요청하지 않았습니다.",
    openTraveler: "출장자 화면 열기",
  },
  grant: {
    title: "위임 발급",
    description:
      "예산, 1회 결제 한도, 허용 가맹점과 분류, 차단 키워드, 출장 기간을 정합니다.",
    loadMerchantsFailed: "가맹점 목록을 불러오지 못했습니다",
    loadingForm: "양식 불러오는 중",
    principal: "위임자",
    traveler: "출장자",
    budget: "예산 (USD)",
    cap: "1회 결제 한도 (USD)",
    categories: "허용 분류",
    merchants: "허용 가맹점",
    offCategory: (names) =>
      `${names}: 가맹점은 허용했지만 분류는 허용하지 않았습니다 — 해당 가맹점의 결제는 여전히 중단됩니다.`,
    blocked: "차단 키워드",
    blockedHint:
      "쉼표로 구분합니다. 에이전트의 메모와 출장자가 직접 입력한 문장 모두와 대조합니다.",
    start: "기간 시작",
    end: "기간 종료",
    submit: "발급 및 앵커링",
    submitting: "Sepolia에 앵커링 중…",
    footnote: "조건을 해시하고, 그 해시를 Sepolia에 기록합니다.",
    notCreated: "위임을 생성하지 못했습니다",
    errors: {
      principal: "위임자를 입력해 주세요.",
      traveler: "출장자를 입력해 주세요.",
      budget: "예산은 양수여야 합니다.",
      cap: "한도는 양수여야 합니다.",
      capOverBudget: (budget) => `한도는 예산(${budget})을 넘을 수 없습니다.`,
      categories: "분류를 하나 이상 허용해야 합니다.",
      merchants: "가맹점을 하나 이상 허용해야 합니다.",
      start: "시작 시각을 선택해 주세요.",
      end: "종료 시각을 선택해 주세요.",
      endBeforeStart: "종료 시각은 시작 시각보다 뒤여야 합니다.",
    },
  },
  controls: {
    byline: (traveler, principal, cap) => [
      "출장자 ",
      traveler,
      " · 위임자 ",
      principal,
      ` · 1회 결제 한도 ${cap}`,
    ],
    pause: "일시정지",
    resume: "재개",
    revoke: "철회",
    revoked: "철회됨",
    paused: (id) => `${id} 일시정지됨`,
    pausedHint:
      "킬 스위치가 켜졌습니다. 에이전트의 모든 요청은 중단되고 기록됩니다.",
    resumed: (id) => `${id} 재개됨`,
    resumedHint: "에이전트가 같은 조건 안에서 다시 제안할 수 있습니다.",
    revokedToast: (id) => `${id} 철회됨`,
    revokedHint:
      "되돌릴 수 없습니다. 이 위임으로는 더 이상 지출할 수 없습니다.",
    failed: {
      pause: (id) => `${id} 위임을 일시정지하지 못했습니다`,
      resume: (id) => `${id} 위임을 재개하지 못했습니다`,
      revoke: (id) => `${id} 위임을 철회하지 못했습니다`,
    },
    revokedNotice:
      "철회됨 — 되돌릴 수 없습니다. 일시정지와 재개가 비활성화되며, 이 위임에 대한 모든 요청은 중단되고 기록됩니다.",
    expiredNotice: (date) =>
      `출장 기간이 ${date}에 종료되었습니다. 상태와 관계없이 요청은 EXPIRED로 중단됩니다.`,
    budget: "예산",
    spent: "사용액",
    spentHint: "승인됨 + 대기 중 + 정산 완료",
    pending: "대기 중",
    pendingHint: "전송됨, 아직 채굴되지 않음",
    remaining: "잔액",
    remainingHint: (pct) => `예산의 ${pct}%`,
    mandateHash: "위임 해시 (조건만, 상태 제외)",
    mandateHashWhat: "위임 해시",
    anchorTx: "Sepolia 앵커 트랜잭션",
    anchorTxWhat: "앵커 트랜잭션",
    notAnchored: "앵커링 안 됨",
    confirmTitle: (id) => `${id} 위임을 철회하시겠습니까?`,
    confirmBody:
      "철회는 되돌릴 수 없습니다. 이 위임으로 들어오는 에이전트의 모든 요청이 중단되며, 재개할 수도 없습니다. 지난 영수증과 온체인 앵커는 계속 검증할 수 있습니다.",
    keep: "유지",
    confirm: "위임 철회",
  },
  boundary: {
    title: "경계 작동 방식",
    introBefore: "모든 제안은 ",
    introAfter:
      "의 12가지 검사를 거칩니다 — 온체인 호출 전에 실행되는 일반 코드입니다. 모델은 키를 갖지 않으며, 첫 번째 위반뿐 아니라 위반한 모든 규칙을 보고합니다.",
  },
};

export const ja: typeof en = {
  listSep: "、",
  page: {
    eyebrow: "委任者",
    title: "予算を割り当て、見守り、止める",
    description:
      "条件は一度決めるだけです。エージェントの支払いはすべてコードでこの条件と照合されます。一時停止はキルスイッチで、取り消しは元に戻せません。",
    granted: "委任を付与しました — Sepoliaにアンカー済み",
    loadMandatesFailed: "委任を読み込めませんでした",
    noMandates: "委任はまだありません",
    noMandatesHint:
      "フォームから最初の委任を付与できます。委任はハッシュ化され、Sepoliaにアンカーされます。",
    loadMandateFailed: (id) => `${id} を読み込めませんでした`,
    ledgerTitle: "台帳",
    ledgerDescription:
      "承認・停止を問わず、すべての判定を新しい順に表示します。5 秒ごとに更新されます。行をクリックすると、提案内容、ハッシュ、Kiln の証跡を確認できます。",
    updated: (rel) => `更新：${rel}`,
    refreshLedger: "台帳を更新",
    refresh: "更新",
    staleCopy: (msg) =>
      `最後に取得できた内容を表示しています — 更新に失敗しました：${msg}`,
    loadLedgerFailed: "台帳を読み込めませんでした",
    noRequests: "まだ依頼はありません — クイック依頼を試してください",
    noRequestsHint:
      "出張者はこの委任のもとで、まだエージェントに何も依頼していません。",
    openTraveler: "出張者画面を開く",
  },
  grant: {
    title: "委任を付与",
    description:
      "予算、1回あたりの上限、許可する加盟店とカテゴリ、ブロックキーワード、出張期間を設定します。",
    loadMerchantsFailed: "加盟店カタログを読み込めませんでした",
    loadingForm: "フォームを読み込み中",
    principal: "委任者",
    traveler: "出張者",
    budget: "予算（USD）",
    cap: "1回あたりの上限（USD）",
    categories: "許可するカテゴリ",
    merchants: "許可する加盟店",
    offCategory: (names) =>
      `${names} は許可されていますが、カテゴリが許可されていないため、そこでの支払いは停止されます。`,
    blocked: "ブロックキーワード",
    blockedHint:
      "カンマ区切りで入力します。エージェントのメモと出張者自身の発言の両方と照合されます。",
    start: "期間の開始",
    end: "期間の終了",
    submit: "付与してアンカー",
    submitting: "Sepoliaにアンカー中…",
    footnote: "条件はハッシュ化され、そのハッシュが Sepolia に書き込まれます。",
    notCreated: "委任を作成できませんでした",
    errors: {
      principal: "委任者を入力してください。",
      traveler: "出張者を入力してください。",
      budget: "予算には正の数を入力してください。",
      cap: "上限には正の数を入力してください。",
      capOverBudget: (budget) => `上限は予算（${budget}）を超えられません。`,
      categories: "カテゴリを1つ以上許可してください。",
      merchants: "加盟店を1つ以上許可してください。",
      start: "開始日時を選択してください。",
      end: "終了日時を選択してください。",
      endBeforeStart: "終了は開始より後にしてください。",
    },
  },
  controls: {
    byline: (traveler, principal, cap) => [
      traveler,
      "（",
      principal,
      ` の代理）· 1回あたりの上限 ${cap}`,
    ],
    pause: "一時停止",
    resume: "再開",
    revoke: "取り消し",
    revoked: "取り消し済み",
    paused: (id) => `${id} を一時停止しました`,
    pausedHint:
      "キルスイッチがオンです。エージェントへの依頼はすべて停止され、記録されます。",
    resumed: (id) => `${id} を再開しました`,
    resumedHint: "エージェントは同じ条件の範囲内で、再び提案できます。",
    revokedToast: (id) => `${id} を取り消しました`,
    revokedHint: "元に戻せません。この委任ではこれ以上支出できません。",
    failed: {
      pause: (id) => `${id} を一時停止できませんでした`,
      resume: (id) => `${id} を再開できませんでした`,
      revoke: (id) => `${id} を取り消せませんでした`,
    },
    revokedNotice:
      "取り消し済み — 元に戻せません。一時停止と再開は無効になり、この委任での依頼はすべて停止され、記録されます。",
    expiredNotice: (date) =>
      `出張期間は ${date} に終了しました。ステータスにかかわらず、依頼は EXPIRED で停止されます。`,
    budget: "予算",
    spent: "使用額",
    spentHint: "承認済み＋保留中＋決済完了",
    pending: "保留中",
    pendingHint: "送信済み、未マイニング",
    remaining: "残額",
    remainingHint: (pct) => `予算の ${pct}%`,
    mandateHash: "委任ハッシュ（条件のみ、ステータスを除く）",
    mandateHashWhat: "委任ハッシュ",
    anchorTx: "Sepolia のアンカートランザクション",
    anchorTxWhat: "アンカートランザクション",
    notAnchored: "未アンカー",
    confirmTitle: (id) => `${id} を取り消しますか？`,
    confirmBody:
      "取り消しは元に戻せません。この委任での依頼はすべて停止され、再開もできません。過去のレシートとオンチェーンのアンカーは、引き続き検証できます。",
    keep: "維持する",
    confirm: "委任を取り消す",
  },
  boundary: {
    title: "境界の仕組み",
    introBefore: "すべての提案は ",
    introAfter:
      " で12項目のチェックを受けます — オンチェーン呼び出しの前に実行される、ただのコードです。モデルが鍵を持つことはなく、最初の違反だけでなく、違反したルールはすべて報告されます。",
  },
};

export const zh: typeof en = {
  listSep: "、",
  page: {
    eyebrow: "委托方",
    title: "授予预算，实时监控，随时叫停",
    description:
      "条款只需设定一次。代理的每笔付款都由代码对照这些条款检查；暂停即紧急停止，撤销不可恢复。",
    granted: "已授予授权 — 已锚定到 Sepolia",
    loadMandatesFailed: "无法加载授权列表",
    noMandates: "暂无授权",
    noMandatesHint: "使用表单授予第一个授权。授权会被哈希并锚定到 Sepolia。",
    loadMandateFailed: (id) => `无法加载 ${id}`,
    ledgerTitle: "账本",
    ledgerDescription:
      "所有决策（已批准或已拦截）按时间倒序显示。每 5 秒刷新一次；点击某行可查看提案、哈希和 Kiln 证据。",
    updated: (rel) => `更新：${rel}`,
    refreshLedger: "刷新账本",
    refresh: "刷新",
    staleCopy: (msg) => `正在显示上次成功加载的内容 — 刷新失败：${msg}`,
    loadLedgerFailed: "无法加载账本",
    noRequests: "暂无请求 — 试试快捷请求",
    noRequestsHint: "出差人尚未在此授权下向代理提出任何请求。",
    openTraveler: "打开出差人页面",
  },
  grant: {
    title: "授予授权",
    description: "预算、单笔上限、允许的商户和类别、屏蔽关键词以及差旅期间。",
    loadMerchantsFailed: "无法加载商户目录",
    loadingForm: "正在加载表单",
    principal: "委托方",
    traveler: "出差人",
    budget: "预算（USD）",
    cap: "单笔上限（USD）",
    categories: "允许的类别",
    merchants: "允许的商户",
    offCategory: (names, n) =>
      `已允许 ${names}，但未允许${n === 1 ? "其" : "它们的"}类别 — 向${n === 1 ? "该" : "这些"}商户的付款仍会被拦截。`,
    blocked: "屏蔽关键词",
    blockedHint: "以逗号分隔。将与代理的备注及出差人本人的原话进行比对。",
    start: "开始时间",
    end: "结束时间",
    submit: "授予并锚定",
    submitting: "正在锚定到 Sepolia…",
    footnote: "条款会被哈希，哈希值写入 Sepolia。",
    notCreated: "未能创建授权",
    errors: {
      principal: "请填写委托方。",
      traveler: "请填写出差人。",
      budget: "预算必须为正数。",
      cap: "上限必须为正数。",
      capOverBudget: (budget) => `上限不能超过预算（${budget}）。`,
      categories: "请至少允许一个类别。",
      merchants: "请至少允许一个商户。",
      start: "请选择开始时间。",
      end: "请选择结束时间。",
      endBeforeStart: "结束时间必须晚于开始时间。",
    },
  },
  controls: {
    byline: (traveler, principal, cap) => [
      traveler,
      "（代表 ",
      principal,
      `）· 单笔上限 ${cap}`,
    ],
    pause: "暂停",
    resume: "恢复",
    revoke: "撤销",
    revoked: "已撤销",
    paused: (id) => `${id} 已暂停`,
    pausedHint: "紧急停止已开启：代理的每个请求都会被拦截并记录。",
    resumed: (id) => `${id} 已恢复`,
    resumedHint: "代理可以在相同条款内再次提出付款。",
    revokedToast: (id) => `${id} 已撤销`,
    revokedHint: "不可恢复。该授权无法再产生任何支出。",
    failed: {
      pause: (id) => `无法暂停 ${id}`,
      resume: (id) => `无法恢复 ${id}`,
      revoke: (id) => `无法撤销 ${id}`,
    },
    revokedNotice:
      "已撤销 — 此操作不可恢复。暂停和恢复均已禁用；针对该授权的每个请求都会被拦截并记录。",
    expiredNotice: (date) =>
      `差旅期间已于 ${date} 结束。无论状态如何，请求都会因 EXPIRED 被拦截。`,
    budget: "预算",
    spent: "已用",
    spentHint: "已批准 + 待确认 + 已结算",
    pending: "待确认",
    pendingHint: "已广播，尚未上链",
    remaining: "剩余",
    remainingHint: (pct) => `占预算 ${pct}%`,
    mandateHash: "授权哈希（仅条款，不含状态）",
    mandateHashWhat: "授权哈希",
    anchorTx: "Sepolia 上的锚定交易",
    anchorTxWhat: "锚定交易",
    notAnchored: "未锚定",
    confirmTitle: (id) => `撤销 ${id}？`,
    confirmBody:
      "撤销不可恢复。代理在该授权下的每个请求都会被拦截，且授权无法再恢复。过去的收据和链上锚定仍可验证。",
    keep: "保留",
    confirm: "撤销授权",
  },
  boundary: {
    title: "边界如何运作",
    introBefore: "每个提案都要经过 ",
    introAfter:
      " 中的 12 项检查 — 纯代码执行，发生在任何链上调用之前。模型从不持有密钥；所有未通过的规则都会被报告，而不仅是第一条。",
  },
};
