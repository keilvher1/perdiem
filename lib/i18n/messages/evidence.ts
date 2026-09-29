/**
 * "evidence" namespace: the Evidence button and drawer (components/perdiem/evidence-fab.tsx) and the
 * record downloads it shares with the audit page (components/perdiem/evidence-actions.tsx).
 * `en` is the reference; the other languages are typed `typeof en`, so a missing key is a compile
 * error. File names (mandate-<id>.json), the verify command, env var names and code paths are data
 * and stay as they are in every language.
 *
 * Capture hooks (scripts/capture.ts), English only: the "Run checks now" button matches /run checks/i
 * and its result matches /checks? passed|could not run/i.
 */
export const en = {
  fab: {
    button: "Evidence",
    ariaLabel: (id: string) => `Evidence for ${id}`,
    /** Phones only: the in-flow row under the header says what the drawer holds. */
    hint: "Mandate records, downloads and checks",
  },
  drawer: {
    /** Sheet title, followed by " · <id>". */
    title: "Evidence",
    description: "Records for the whole mandate, and the decision you selected.",
    live: "Live records",
    mock: "Mock data",
    loading: "Loading evidence",
    loadError: "The records could not be loaded",
  },
  decision: {
    title: "This decision",
    none: "No decision selected",
    noneHint: "Select a decision in the ledger to see its reason, rule comparison and raw records.",
    notFound: (id: string) => `Decision ${id} is not in this mandate's records.`,
    loadError: "Couldn’t load this decision; see the error below.",
    amount: "Amount",
    view: "View this decision's evidence",
  },
  mandate: {
    title: "All records for this mandate",
    recorded: (n: number) => `${n} decision${n === 1 ? "" : "s"} recorded`,
    budget: "Budget summary",
    /** Under "Spent": pending money is inside spent and already out of remaining. */
    pendingIncluded: (usd: string) => `incl. ${usd} pending, already reserved`,
    nonePending: "none pending",
    counts: "Decisions and payments",
    decisions: "Decisions",
    payments: "Payments",
    paymentsHint: "Approved decisions only: a stop sends nothing.",
    failed: (n: number) => `${n} payment${n === 1 ? "" : "s"} failed: not counted against the budget.`,
  },
  download: {
    title: "Download all mandate records",
    explain:
      "The two files scripts/verify.ts reads: the mandate terms and every ledger entry, rebuilt in your browser.",
  },
  checks: {
    region: "Run checks",
    title: "Check these records",
    run: "Run checks now",
    running: "Running checks…",
    explain:
      "One request to the audit route: rehash the terms, compare the anchor, replay every decision, read each payment back from Sepolia.",
    last: (passed: number, total: number) => `last: ${passed} of ${total}`,
    error: (message: string) => `Checks could not run: ${message}`,
    passed: (passed: number, total: number) => `${passed} of ${total} checks passed`,
    at: (time: string) => `at ${time}`,
    scope: {
      anchor: "Mandate hash vs on-chain anchor",
      replay: "Recorded decisions vs policy replay",
      payments: "Payments vs Sepolia (memo, receipt, recipient, amount)",
    },
    detail: {
      notAnchored: "not anchored",
      /** Checks, not entries: the same wording and numbers as the audit page's areas. */
      count: (ok: number, n: number) => `${ok} of ${n} passed`,
      noDecisions: "no decisions yet",
      noPayments: "none broadcast",
    },
    totalNote: "The total also counts the payer and mined checks; the audit page lists every check.",
    /** Failed checks that belong to none of the three scopes above (sender / mined; no contract field). */
    other: (n: number) =>
      `${n} other check${n === 1 ? "" : "s"} did not pass (the anchor or payment sender, or a payment not mined yet).`,
    mock: "Mock data: these results come from fixtures with placeholder hashes, not from Sepolia.",
  },
  links: {
    region: "More evidence",
    audit: "Open the audit page",
    auditDecision: "Open this decision on the audit page",
    statement: "Open printable statement",
  },
  actions: {
    mockHint:
      "Mock data uses placeholder hashes (lib/api-client.ts:211-225) and will not verify. Set NEXT_PUBLIC_API_MODE=live.",
    downloadsDisabled: (hint: string) => `Downloads disabled: ${hint}`,
    both: "Download both",
    mockOff: "Mock mode: downloads are off (placeholder hashes would not verify).",
    loading: "Loading the records…",
    loadError: (message: string) => `Records could not be loaded: ${message}`,
    retry: "Retry",
    notAnchored: "Not anchored on-chain: verify will fail the anchor check.",
    stillPending: (n: number) =>
      `${n} payment${n === 1 ? "" : "s"} still pending on-chain: download again after ${n === 1 ? "it settles" : "they settle"}.`,
    command: "Verify it yourself",
    copyCommand: "Copy verify command",
    /** Wraps the <code>npm ci</code> element. */
    runFrom: {
      before: "Run from a clone after ",
      after: "; needs only a public Sepolia RPC. If your browser renamed a file to “… (1).json”, adjust the path.",
    },
  },
};

export const ko: typeof en = {
  fab: {
    button: "증빙",
    ariaLabel: (id) => `${id} 증빙`,
    hint: "위임 기록, 내려받기, 검증",
  },
  drawer: {
    title: "증빙",
    description: "위임 전체의 기록과, 선택한 결정의 증빙입니다.",
    live: "실제 기록",
    mock: "모의 데이터",
    loading: "증빙 불러오는 중",
    loadError: "기록을 불러오지 못했습니다",
  },
  decision: {
    title: "이 결정",
    none: "선택한 결정이 없습니다",
    noneHint: "장부에서 결정을 선택하면 사유, 규칙 대조, 원본 기록을 볼 수 있습니다.",
    notFound: (id) => `결정 ${id}은(는) 이 위임의 기록에 없습니다.`,
    loadError: "이 결정을 불러오지 못했습니다. 아래 오류를 확인하세요.",
    amount: "금액",
    view: "이 결정의 증빙 보기",
  },
  mandate: {
    title: "이 위임의 전체 기록",
    recorded: (n) => `기록된 결정 ${n}건`,
    budget: "예산 요약",
    pendingIncluded: (usd) => `대기 ${usd} 포함, 이미 예약됨`,
    nonePending: "대기 없음",
    counts: "결정과 결제",
    decisions: "결정",
    payments: "결제",
    paymentsHint: "승인된 결정만 해당합니다. 중단된 요청은 아무것도 전송하지 않습니다.",
    failed: (n) => `결제 ${n}건이 실패했습니다. 예산에서 차감되지 않습니다.`,
  },
  download: {
    title: "위임 전체 기록 내려받기",
    explain: "scripts/verify.ts가 읽는 두 파일입니다. 위임 조건과 모든 장부 항목을 브라우저에서 다시 만듭니다.",
  },
  checks: {
    region: "검증 실행",
    title: "이 기록 검증",
    run: "지금 검증",
    running: "검증 중…",
    explain:
      "감사 API에 요청 한 번으로 조건을 다시 해시하고, 앵커를 비교하고, 모든 결정을 다시 실행하고, 각 결제를 Sepolia에서 다시 읽어 옵니다.",
    last: (passed, total) => `이전: ${total}건 중 ${passed}건 통과`,
    error: (message) => `검증을 실행하지 못했습니다: ${message}`,
    passed: (passed, total) => `검증 ${total}건 중 ${passed}건 통과`,
    at: (time) => `${time} 기준`,
    scope: {
      anchor: "위임 해시와 온체인 앵커 대조",
      replay: "기록된 결정과 정책 재실행 결과 비교",
      payments: "결제와 Sepolia 기록 대조(메모, 영수증, 수취인, 금액)",
    },
    detail: {
      notAnchored: "앵커 없음",
      count: (ok, n) => `${n}건 중 ${ok}건 통과`,
      noDecisions: "아직 결정 없음",
      noPayments: "전송된 결제 없음",
    },
    totalNote: "합계에는 송신자와 채굴 확인도 포함됩니다. 감사 페이지에서 모든 검증 항목을 볼 수 있습니다.",
    other: (n) => `위 세 항목 밖의 검증 ${n}건이 통과하지 못했습니다(앵커·결제 송신자, 또는 아직 채굴되지 않은 결제).`,
    mock: "모의 데이터: 이 결과는 Sepolia가 아니라 임시 해시를 쓴 고정 데이터에서 나옵니다.",
  },
  links: {
    region: "추가 증빙",
    audit: "감사 페이지 열기",
    auditDecision: "감사 페이지에서 이 결정 열기",
    statement: "인쇄용 정산서 열기",
  },
  actions: {
    mockHint:
      "모의 데이터는 임시 해시(lib/api-client.ts:211-225)를 사용하므로 검증되지 않습니다. NEXT_PUBLIC_API_MODE=live로 설정하세요.",
    downloadsDisabled: (hint) => `내려받기 비활성: ${hint}`,
    both: "모두 내려받기",
    mockOff: "모의 데이터 모드에서는 내려받기가 꺼져 있습니다(임시 해시는 검증되지 않습니다).",
    loading: "기록을 불러오는 중…",
    loadError: (message) => `기록을 불러오지 못했습니다: ${message}`,
    retry: "다시 시도",
    notAnchored: "온체인에 앵커링되지 않았습니다. 검증하면 앵커 검사에서 실패합니다.",
    stillPending: (n) => `결제 ${n}건이 아직 온체인에서 대기 중입니다. 정산이 끝난 뒤 다시 내려받으세요.`,
    command: "직접 검증하기",
    copyCommand: "검증 명령 복사",
    runFrom: {
      before: "클론한 저장소에서 ",
      after:
        " 후 실행합니다. 공개 Sepolia RPC만 있으면 됩니다. 브라우저가 파일 이름을 “… (1).json”으로 바꿨다면 경로를 고쳐 주세요.",
    },
  },
};

export const ja: typeof en = {
  fab: {
    button: "証跡",
    ariaLabel: (id) => `${id} の証跡`,
    hint: "委任の記録・ダウンロード・検証",
  },
  drawer: {
    title: "証跡",
    description: "委任全体の記録と、選択した判定の証跡です。",
    live: "実データ",
    mock: "モックデータ",
    loading: "証跡を読み込み中",
    loadError: "記録を読み込めませんでした",
  },
  decision: {
    title: "この判定",
    none: "判定が選択されていません",
    noneHint: "台帳で判定を選択すると、理由、ルールの照合、元の記録を確認できます。",
    notFound: (id) => `判定 ${id} はこの委任の記録にありません。`,
    loadError: "この判定を読み込めませんでした。下のエラーを確認してください。",
    amount: "金額",
    view: "この判定の証跡を見る",
  },
  mandate: {
    title: "この委任のすべての記録",
    recorded: (n) => `記録された判定 ${n} 件`,
    budget: "予算の概要",
    pendingIncluded: (usd) => `保留中 ${usd} を含む（確保済み）`,
    nonePending: "保留中なし",
    counts: "判定と支払い",
    decisions: "判定",
    payments: "支払い",
    paymentsHint: "承認された判定のみが対象です。停止した依頼は何も送信しません。",
    failed: (n) => `${n} 件の支払いが失敗しました。予算には計上されません。`,
  },
  download: {
    title: "委任の全記録をダウンロード",
    explain:
      "scripts/verify.ts が読み込む2つのファイルです。委任の条件と台帳のすべての項目を、ブラウザで再構成します。",
  },
  checks: {
    region: "検証の実行",
    title: "この記録を検証",
    run: "今すぐ検証",
    running: "検証中…",
    explain:
      "監査ルートへのリクエスト1回で、条件を再ハッシュし、アンカーを照合し、すべての判定を再実行し、各支払いを Sepolia から読み戻します。",
    last: (passed, total) => `前回：${total} 件中 ${passed} 件合格`,
    error: (message) => `検証を実行できませんでした：${message}`,
    passed: (passed, total) => `検証 ${total} 件中 ${passed} 件合格`,
    at: (time) => `${time} 時点`,
    scope: {
      anchor: "委任ハッシュとオンチェーンのアンカーの照合",
      replay: "記録された判定とポリシー再実行の比較",
      payments: "支払いと Sepolia の照合（メモ、レシート、受取人、金額）",
    },
    detail: {
      notAnchored: "アンカーなし",
      count: (ok, n) => `${n} 件中 ${ok} 件合格`,
      noDecisions: "判定はまだありません",
      noPayments: "送信された支払いなし",
    },
    totalNote: "合計には送信元とマイニングの確認も含まれます。すべての検証項目は監査ページで確認できます。",
    other: (n) =>
      `上の3項目以外の検証 ${n} 件が合格しませんでした（アンカーや支払いの送信元、またはまだマイニングされていない支払い）。`,
    mock: "モックデータ：この結果は Sepolia ではなく、仮のハッシュを使った固定データから得たものです。",
  },
  links: {
    region: "その他の証跡",
    audit: "監査ページを開く",
    auditDecision: "監査ページでこの判定を開く",
    statement: "印刷用の精算書を開く",
  },
  actions: {
    mockHint:
      "モックデータは仮のハッシュ（lib/api-client.ts:211-225）を使うため、検証できません。NEXT_PUBLIC_API_MODE=live を設定してください。",
    downloadsDisabled: (hint) => `ダウンロード無効：${hint}`,
    both: "両方をダウンロード",
    mockOff: "モックモードではダウンロードはオフです（仮のハッシュは検証できません）。",
    loading: "記録を読み込み中…",
    loadError: (message) => `記録を読み込めませんでした：${message}`,
    retry: "再試行",
    notAnchored: "オンチェーンにアンカーされていません。検証するとアンカーの確認で失敗します。",
    stillPending: (n) =>
      `${n} 件の支払いがまだオンチェーンで保留中です。決済完了後にもう一度ダウンロードしてください。`,
    command: "自分で検証する",
    copyCommand: "検証コマンドをコピー",
    runFrom: {
      before: "クローンしたリポジトリで ",
      after:
        " の後に実行します。必要なのは公開 Sepolia RPC だけです。ブラウザがファイル名を「… (1).json」に変えた場合は、パスを修正してください。",
    },
  },
};

export const zh: typeof en = {
  fab: {
    button: "证据",
    ariaLabel: (id) => `${id} 的证据`,
    hint: "授权记录、下载与校验",
  },
  drawer: {
    title: "证据",
    description: "整个授权的记录，以及所选决策的证据。",
    live: "真实记录",
    mock: "模拟数据",
    loading: "正在加载证据",
    loadError: "无法加载记录",
  },
  decision: {
    title: "此决策",
    none: "未选择决策",
    noneHint: "在账本中选择一条决策，即可查看其原因、规则对照和原始记录。",
    notFound: (id) => `决策 ${id} 不在此授权的记录中。`,
    loadError: "无法加载此决策，请查看下方的错误。",
    amount: "金额",
    view: "查看此决策的证据",
  },
  mandate: {
    title: "此授权的全部记录",
    recorded: (n) => `已记录 ${n} 条决策`,
    budget: "预算概览",
    pendingIncluded: (usd) => `含待确认 ${usd}，已预留`,
    nonePending: "无待确认",
    counts: "决策与付款",
    decisions: "决策",
    payments: "付款",
    paymentsHint: "仅限已批准的决策；已拦截的请求不会发送任何内容。",
    failed: (n) => `${n} 笔付款失败：不计入预算。`,
  },
  download: {
    title: "下载授权的全部记录",
    explain: "scripts/verify.ts 读取的两个文件：授权条款和每条账本记录，在浏览器中重新生成。",
  },
  checks: {
    region: "运行校验",
    title: "校验这些记录",
    run: "立即校验",
    running: "正在校验…",
    explain: "向审计接口发送一次请求：重新哈希条款、比对锚点、重放每条决策，并从 Sepolia 读回每笔付款。",
    last: (passed, total) => `上次：${passed}/${total} 项通过`,
    error: (message) => `无法运行校验：${message}`,
    passed: (passed, total) => `${total} 项校验中 ${passed} 项通过`,
    at: (time) => `于 ${time}`,
    scope: {
      anchor: "授权哈希与链上锚点比对",
      replay: "已记录决策与策略重放比对",
      payments: "付款与 Sepolia 比对（备注、收据、收款方、金额）",
    },
    detail: {
      notAnchored: "未锚定",
      count: (ok, n) => `${n} 项中 ${ok} 项通过`,
      noDecisions: "尚无决策",
      noPayments: "无已广播付款",
    },
    totalNote: "总数还包括付款方与上链确认的校验；审计页面列出了每一项校验。",
    other: (n) => `上述三项之外有 ${n} 项校验未通过（锚点或付款的发送方，或尚未上链的付款）。`,
    mock: "模拟数据：这些结果来自使用占位哈希的固定数据，而非 Sepolia。",
  },
  links: {
    region: "更多证据",
    audit: "打开审计页面",
    auditDecision: "在审计页面打开此决策",
    statement: "打开打印版结算单",
  },
  actions: {
    mockHint: "模拟数据使用占位哈希（lib/api-client.ts:211-225），无法通过验证。请设置 NEXT_PUBLIC_API_MODE=live。",
    downloadsDisabled: (hint) => `下载已禁用：${hint}`,
    both: "全部下载",
    mockOff: "模拟模式：下载已关闭（占位哈希无法通过验证）。",
    loading: "正在加载记录…",
    loadError: (message) => `无法加载记录：${message}`,
    retry: "重试",
    notAnchored: "尚未锚定到链上：验证时锚点检查将失败。",
    stillPending: (n) => `${n} 笔付款仍在链上待确认：结算后请重新下载。`,
    command: "自行验证",
    copyCommand: "复制验证命令",
    runFrom: {
      before: "在克隆的仓库中先运行 ",
      after: "，再执行此命令；只需一个公共 Sepolia RPC。如果浏览器把文件重命名为“… (1).json”，请相应调整路径。",
    },
  },
};
