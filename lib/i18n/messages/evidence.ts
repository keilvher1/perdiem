/**
 * "evidence" namespace: the floating Evidence button and drawer (components/perdiem/evidence-fab.tsx)
 * and the record downloads it shares with the audit page (components/perdiem/evidence-actions.tsx).
 * `en` is the reference: its strings must equal the English UI copy exactly. The other languages
 * are typed `typeof en`, so a missing key is a compile error. File names (mandate-<id>.json), the
 * verify command, env var names and code paths are data and stay as they are in every language.
 */
export const en = {
  fab: {
    button: "Evidence",
    ariaLabel: (id: string) => `Evidence for ${id}`,
  },
  drawer: {
    /** Sheet title, followed by " · <id>". */
    title: "Evidence",
    description: "The records an auditor needs, and a way to check them.",
    live: "Live records",
    mock: "Mock data",
    loading: "Loading evidence",
    loadError: "The records could not be loaded",
  },
  money: {
    budget: "Budget",
    spent: "Spent",
    remaining: "Remaining",
    inclPending: (usd: string) => `incl. ${usd} pending`,
    nonePending: "none pending",
  },
  decisions: {
    region: "Decisions",
    recorded: (n: number) => `${n} decision${n === 1 ? "" : "s"} recorded`,
    /** Shown after a bold count: "3 settled". */
    status: {
      settled: "settled",
      pending: "pending",
      stopped: "stopped",
      failed: "failed",
    },
    approvedOnly: "approved, not broadcast yet",
    failed: (n: number) =>
      `${n} payment${n === 1 ? "" : "s"} failed: not counted against budget.`,
  },
  receipts: {
    region: "Receipts",
    showLatest: "Show latest only",
    showAll: (n: number) => `Show all (${n})`,
    all: "All receipts, newest first",
    latest: "Latest receipt",
    emptyTitle: "No decisions yet",
    emptyBody:
      "Downloads still work: the mandate plus an empty ledger. Verify then checks only the anchor.",
  },
  download: {
    title: "Download records",
  },
  checks: {
    region: "Run checks",
    title: "Recompute from records",
    run: "Run checks now",
    running: "Running checks…",
    explain:
      "One request to the audit route: rehash the terms, compare the anchor, replay every decision, read each payment back from Sepolia.",
    last: (passed: number, total: number) => `last: ${passed} of ${total}`,
    error: (message: string) => `Checks could not run: ${message}`,
    passed: (passed: number, total: number) =>
      `${passed} of ${total} checks passed`,
  },
  links: {
    region: "More evidence",
    audit: "Open the audit page",
    statement: "Open printable statement",
  },
  actions: {
    mockHint:
      "Mock data uses placeholder hashes (lib/api-client.ts:211-225) and will not verify. Set NEXT_PUBLIC_API_MODE=live.",
    downloadsDisabled: (hint: string) => `Downloads disabled: ${hint}`,
    both: "Download both",
    mockOff:
      "Mock mode: downloads are off (placeholder hashes would not verify).",
    loading: "Loading the records…",
    loadError: (message: string) => `Records could not be loaded: ${message}`,
    retry: "Retry",
    notAnchored: "Not anchored on-chain: verify will fail the anchor check.",
    stillPending: (n: number) =>
      `${n} payment${n === 1 ? "" : "s"} still pending on-chain: download again after ${n === 1 ? "it settles" : "they settle"}.`,
    copyCommand: "Copy verify command",
    /** Wraps the <code>npm ci</code> element. */
    runFrom: {
      before: "Run from a clone after ",
      after:
        "; needs only a public Sepolia RPC. If your browser renamed a file to “… (1).json”, adjust the path.",
    },
  },
};

export const ko: typeof en = {
  fab: {
    button: "증빙",
    ariaLabel: (id) => `${id} 증빙`,
  },
  drawer: {
    title: "증빙",
    description: "감사자에게 필요한 기록과, 그 기록을 검증하는 방법입니다.",
    live: "실제 기록",
    mock: "모의 데이터",
    loading: "증빙 불러오는 중",
    loadError: "기록을 불러오지 못했습니다",
  },
  money: {
    budget: "예산",
    spent: "사용액",
    remaining: "잔액",
    inclPending: (usd) => `대기 중 ${usd} 포함`,
    nonePending: "대기 중 없음",
  },
  decisions: {
    region: "결정",
    recorded: (n) => `결정 ${n}건 기록됨`,
    status: {
      settled: "정산 완료",
      pending: "대기 중",
      stopped: "중단됨",
      failed: "실패",
    },
    approvedOnly: "승인됨, 아직 전송 전",
    failed: (n) => `결제 ${n}건이 실패했습니다. 예산에서 차감되지 않습니다.`,
  },
  receipts: {
    region: "영수증",
    showLatest: "최신만 보기",
    showAll: (n) => `모두 보기 (${n})`,
    all: "모든 영수증, 최신순",
    latest: "최신 영수증",
    emptyTitle: "아직 결정이 없습니다",
    emptyBody:
      "그래도 내려받을 수 있습니다. 위임과 빈 장부가 저장되며, 이 경우 검증은 앵커만 확인합니다.",
  },
  download: {
    title: "기록 내려받기",
  },
  checks: {
    region: "검증 실행",
    title: "기록으로 다시 계산",
    run: "지금 검증",
    running: "검증 중…",
    explain:
      "감사 API에 요청 한 번으로 조건을 다시 해시하고, 앵커를 비교하고, 모든 결정을 다시 실행하고, 각 결제를 Sepolia에서 다시 읽어 옵니다.",
    last: (passed, total) => `이전: ${total}건 중 ${passed}건 통과`,
    error: (message) => `검증을 실행하지 못했습니다: ${message}`,
    passed: (passed, total) => `검증 ${total}건 중 ${passed}건 통과`,
  },
  links: {
    region: "추가 증빙",
    audit: "감사 페이지 열기",
    statement: "인쇄용 정산서 열기",
  },
  actions: {
    mockHint:
      "모의 데이터는 임시 해시(lib/api-client.ts:211-225)를 사용하므로 검증되지 않습니다. NEXT_PUBLIC_API_MODE=live로 설정하세요.",
    downloadsDisabled: (hint) => `내려받기 비활성: ${hint}`,
    both: "모두 내려받기",
    mockOff:
      "모의 데이터 모드에서는 내려받기가 꺼져 있습니다(임시 해시는 검증되지 않습니다).",
    loading: "기록을 불러오는 중…",
    loadError: (message) => `기록을 불러오지 못했습니다: ${message}`,
    retry: "다시 시도",
    notAnchored:
      "온체인에 앵커링되지 않았습니다. 검증하면 앵커 검사에서 실패합니다.",
    stillPending: (n) =>
      `결제 ${n}건이 아직 온체인에서 대기 중입니다. 정산이 끝난 뒤 다시 내려받으세요.`,
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
  },
  drawer: {
    title: "証跡",
    description: "監査担当者に必要な記録と、それを検証する方法です。",
    live: "実データ",
    mock: "モックデータ",
    loading: "証跡を読み込み中",
    loadError: "記録を読み込めませんでした",
  },
  money: {
    budget: "予算",
    spent: "使用額",
    remaining: "残額",
    inclPending: (usd) => `保留中 ${usd} を含む`,
    nonePending: "保留中なし",
  },
  decisions: {
    region: "判定",
    recorded: (n) => `${n}件の判定を記録`,
    status: {
      settled: "決済完了",
      pending: "保留中",
      stopped: "停止",
      failed: "失敗",
    },
    approvedOnly: "承認済み・未送信",
    failed: (n) => `${n}件の支払いが失敗しました。予算には計上されません。`,
  },
  receipts: {
    region: "レシート",
    showLatest: "最新のみ表示",
    showAll: (n) => `すべて表示（${n}）`,
    all: "すべてのレシート（新しい順）",
    latest: "最新のレシート",
    emptyTitle: "まだ判定はありません",
    emptyBody:
      "ダウンロードは引き続き使えます。委任と空の台帳が保存され、検証ではアンカーのみを確認します。",
  },
  download: {
    title: "記録をダウンロード",
  },
  checks: {
    region: "検証の実行",
    title: "記録から再計算",
    run: "今すぐ検証",
    running: "検証中…",
    explain:
      "監査ルートへのリクエスト1回で、条件を再ハッシュし、アンカーを照合し、すべての判定を再実行し、各支払いを Sepolia から読み戻します。",
    last: (passed, total) => `前回：${total} 件中 ${passed} 件合格`,
    error: (message) => `検証を実行できませんでした：${message}`,
    passed: (passed, total) => `検証 ${total} 件中 ${passed} 件合格`,
  },
  links: {
    region: "その他の証跡",
    audit: "監査ページを開く",
    statement: "印刷用の精算書を開く",
  },
  actions: {
    mockHint:
      "モックデータは仮のハッシュ（lib/api-client.ts:211-225）を使うため、検証できません。NEXT_PUBLIC_API_MODE=live を設定してください。",
    downloadsDisabled: (hint) => `ダウンロード無効：${hint}`,
    both: "両方をダウンロード",
    mockOff:
      "モックモードではダウンロードはオフです（仮のハッシュは検証できません）。",
    loading: "記録を読み込み中…",
    loadError: (message) => `記録を読み込めませんでした：${message}`,
    retry: "再試行",
    notAnchored:
      "オンチェーンにアンカーされていません。検証するとアンカーの確認で失敗します。",
    stillPending: (n) =>
      `${n}件の支払いがまだオンチェーンで保留中です。決済完了後にもう一度ダウンロードしてください。`,
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
  },
  drawer: {
    title: "证据",
    description: "审计人员所需的记录，以及核对这些记录的方法。",
    live: "真实记录",
    mock: "模拟数据",
    loading: "正在加载证据",
    loadError: "无法加载记录",
  },
  money: {
    budget: "预算",
    spent: "已用",
    remaining: "剩余",
    inclPending: (usd) => `含待确认 ${usd}`,
    nonePending: "无待确认",
  },
  decisions: {
    region: "决策",
    recorded: (n) => `已记录 ${n} 条决策`,
    status: {
      settled: "已结算",
      pending: "待确认",
      stopped: "已拦截",
      failed: "失败",
    },
    approvedOnly: "已批准，尚未广播",
    failed: (n) => `${n} 笔付款失败：不计入预算。`,
  },
  receipts: {
    region: "收据",
    showLatest: "仅显示最新",
    showAll: (n) => `全部显示（${n}）`,
    all: "全部收据（最新在前）",
    latest: "最新收据",
    emptyTitle: "尚无决策",
    emptyBody: "仍可下载：授权文件加一个空账本。此时验证只检查锚点。",
  },
  download: {
    title: "下载记录",
  },
  checks: {
    region: "运行校验",
    title: "根据记录重新计算",
    run: "立即校验",
    running: "正在校验…",
    explain:
      "向审计接口发送一次请求：重新哈希条款、比对锚点、重放每条决策，并从 Sepolia 读回每笔付款。",
    last: (passed, total) => `上次：${passed}/${total} 项通过`,
    error: (message) => `无法运行校验：${message}`,
    passed: (passed, total) => `${total} 项校验中 ${passed} 项通过`,
  },
  links: {
    region: "更多证据",
    audit: "打开审计页面",
    statement: "打开打印版结算单",
  },
  actions: {
    mockHint:
      "模拟数据使用占位哈希（lib/api-client.ts:211-225），无法通过验证。请设置 NEXT_PUBLIC_API_MODE=live。",
    downloadsDisabled: (hint) => `下载已禁用：${hint}`,
    both: "全部下载",
    mockOff: "模拟模式：下载已关闭（占位哈希无法通过验证）。",
    loading: "正在加载记录…",
    loadError: (message) => `无法加载记录：${message}`,
    retry: "重试",
    notAnchored: "尚未锚定到链上：验证时锚点检查将失败。",
    stillPending: (n) => `${n} 笔付款仍在链上待确认：结算后请重新下载。`,
    copyCommand: "复制验证命令",
    runFrom: {
      before: "在克隆的仓库中先运行 ",
      after:
        "，再执行此命令；只需一个公共 Sepolia RPC。如果浏览器把文件重命名为“… (1).json”，请相应调整路径。",
    },
  },
};
