/**
 * "receipt" namespace: receipt cards, reason lists and settlement toasts. `en` is the reference.
 * The other languages are typed `typeof en`, so a missing key is a compile error.
 *
 * Not translated on purpose: merchant names and ids, memos and the traveler's own words, receipt
 * ids, hashes, amounts, STOP codes and the server's failure reason.
 */
export const en = {
  unknownCategory: "unknown category",
  /** Quotes a memo (data) inside the merchant line. */
  quoted: (s: string) => `“${s}”`,
  youSaid: (s: string) => `You said: “${s}”`,
  failedOnChain: "Transaction failed on-chain",
  broadcastUnconfirmed:
    "Broadcast did not confirm — no tx hash recorded; check Etherscan for the agent wallet before retrying",
  /** Next to the Stopped badge, where an approval shows its execution badge. */
  stoppedHeadline: "Nothing was sent",
  /** Caption under the requested amount. */
  requested: "Requested",
  /** English aria-labels start with "Receipt <id>: " (scripts/capture.ts selects on it). */
  aria: {
    approved: (id: string, status: string) =>
      `Receipt ${id}: approved, ${status}`,
    approvedFailed: (id: string, headline: string) =>
      `Receipt ${id}: approved, ${headline.toLowerCase()}`,
    stopped: (id: string, n: number) =>
      `Receipt ${id}: stopped, ${n} reason${n === 1 ? "" : "s"}`,
  },
  /** Execution status in the aria-label, after "approved, " (an approved entry reads "not sent yet"). */
  status: {
    approved: "not sent yet",
    pending: "pending",
    settled: "settled",
    failed: "failed",
    stopped: "stopped",
  } as Record<string, string>,
  why: "Why",
  allPassed: "All 12 rule checks passed when it was decided.",
  checksFailed: (n: number, total: number) =>
    `${n} of ${total} rule checks failed.`,
  /** Column captions of the rule rows. */
  rule: "Rule",
  /** The checked value as recorded with the decision (the request, or the mandate status / date). */
  asked: "At decision",
  allowed: "Allowed",
  /** Joins merchant names and categories. */
  listSep: ", ",
  /** What the failed check looked at, as the traveler would name it. */
  field: {
    amount: "Amount",
    merchant: "Merchant",
    category: "Category",
    wording: "What you asked for",
    status: "Mandate status",
    date: "Date",
    fee: "Network fee",
    total: "Amount + fee",
    repeat: "Earlier payment",
  },
  /** Who holds the input a failed check looked at. */
  where: {
    request: "In your request",
    principal: "Set by the principal",
    system: "Outside your request",
  },
  value: {
    perPayment: (v: string) => `up to ${v} per payment`,
    positive: "more than $0.00",
    noneOf: (list: string) => `no mention of ${list}`,
    from: (d: string) => `from ${d}`,
    until: (d: string) => `until ${d}`,
    remainingAtDecision: (v: string) =>
      `up to ${v}, the budget remaining at decision time`,
    feeUnknown: "no fee estimate",
    feeRequired: "a fee estimate",
    repeats: (id: string) => `same merchant and amount as ${id}`,
    noRepeat: "not the same merchant and amount within 5 minutes",
  },
  principalNote: {
    MANDATE_NOT_ACTIVE:
      "Only the principal can resume a paused mandate. Revoking is final.",
    EXPIRED:
      "The trip window has closed. Only a new mandate from the principal allows new payments.",
    BEFORE_START: "Requests before the trip window opens are stopped.",
  },
  systemNote:
    "The network fee could not be estimated when this was decided. Nothing in your request caused it.",
  duplicateNote: "Check that payment before asking again.",
  nextStop:
    "Nothing is resent automatically. To go ahead, send a new request that fits what is allowed: it is checked against all 12 rules again.",
  /** When no failed check is about the request itself (status, window, fee). */
  nextStopOutside:
    "Nothing is resent automatically. Changing your request does not help with this stop; see the note above.",
  payment: "Payment",
  rows: {
    amount: "Amount",
    networkFee: "Network fee",
    estimate: "estimate",
    fallbackEstimate: "fallback estimate",
    noFee: "none",
    actualFee: "Actual fee",
    afterMining: "after mining",
    paymentFailed: "payment failed",
    counted: "Counted against budget",
  },
  budget: {
    remainingNow: "Remaining now",
    remainingNowHint:
      "The mandate’s remaining budget right now, after every later decision. The ledger does not record it per decision.",
    atDecision: "Remaining at decision",
    atDecisionHint: "recorded in the stop reason",
    ofBudget: (v: string) => `of ${v}`,
  },
  checks: {
    show: (passed: number, failed: number, skipped: number) =>
      `Show the 12 rule checks (${passed} passed · ${failed} failed${skipped ? ` · ${skipped} not evaluated` : ""})`,
    hide: "Hide the 12 rule checks",
    note: "Read from the recorded decision. The audit replay re-runs the checks.",
  },
  hash: {
    tx: "tx",
    receipt: "receipt",
    mandate: "mandate",
    txWhat: "transaction hash",
    receiptWhat: "receipt hash",
    mandateWhat: "mandate hash",
    notBroadcast: "not broadcast",
  },
  /** Followed by the receipt id. */
  recordedAs: "Recorded as ",
  settledAt: (time: string) => `settled ${time}`,
  viewOnEtherscan: "View on Etherscan",
  noBroadcast: "no transaction broadcast",
  openEvidence: "Open evidence",
  /** Screen-reader note on the receipt whose evidence is selected. */
  selected: "Selected in the decision history",
  reasons: { observed: "Observed", limit: "Limit" },
  toast: {
    settled: (fee: string) => `Settled on Sepolia, fee ${fee}`,
    failed: "Transaction failed on Sepolia",
  },
};

export const ko: typeof en = {
  unknownCategory: "알 수 없는 분류",
  quoted: (s: string) => `“${s}”`,
  youSaid: (s: string) => `입력한 요청: “${s}”`,
  failedOnChain: "온체인 트랜잭션 실패",
  broadcastUnconfirmed:
    "전송 미확인 — tx 해시 기록 없음. 다시 시도하기 전에 Etherscan에서 에이전트 지갑을 확인하세요",
  stoppedHeadline: "아무것도 전송되지 않았습니다",
  requested: "요청 금액",
  aria: {
    approved: (id: string, status: string) => `영수증 ${id}: 승인됨, ${status}`,
    approvedFailed: (id: string, headline: string) =>
      `영수증 ${id}: 승인됨, ${headline}`,
    stopped: (id: string, n: number) => `영수증 ${id}: 중단됨, 사유 ${n}건`,
  },
  status: {
    approved: "전송 전",
    pending: "대기 중",
    settled: "정산 완료",
    failed: "실패",
    stopped: "중단됨",
  },
  why: "사유",
  allPassed: "결정 시점에 12개 규칙 검사를 모두 통과했습니다.",
  checksFailed: (n: number, total: number) =>
    `규칙 검사 ${total}개 중 ${n}개를 통과하지 못했습니다.`,
  rule: "규칙",
  asked: "결정 시점 값",
  allowed: "허용 범위",
  listSep: ", ",
  field: {
    amount: "금액",
    merchant: "가맹점",
    category: "분류",
    wording: "요청 내용",
    status: "위임 상태",
    date: "날짜",
    fee: "네트워크 수수료",
    total: "금액 + 수수료",
    repeat: "이전 결제",
  },
  where: {
    request: "요청에서 바꿀 수 있음",
    principal: "위임자가 정함",
    system: "요청과 무관",
  },
  value: {
    perPayment: (v: string) => `1회 ${v} 이하`,
    positive: "$0.00 초과",
    noneOf: (list: string) => `${list} 언급 없음`,
    from: (d: string) => `${d}부터`,
    until: (d: string) => `${d}까지`,
    remainingAtDecision: (v: string) => `결정 시점 잔액 ${v} 이하`,
    feeUnknown: "수수료 추정 불가",
    feeRequired: "수수료 추정치",
    repeats: (id: string) => `${id}와 같은 가맹점·금액`,
    noRepeat: "5분 안에 같은 가맹점·금액 결제 없음",
  },
  principalNote: {
    MANDATE_NOT_ACTIVE:
      "일시정지된 위임은 위임자만 재개할 수 있습니다. 철회는 되돌릴 수 없습니다.",
    EXPIRED:
      "출장 기간이 끝났습니다. 새 결제는 위임자가 새 위임을 발급해야 가능합니다.",
    BEFORE_START: "출장 기간이 시작되기 전의 요청은 중단됩니다.",
  },
  systemNote:
    "결정 시점에 네트워크 수수료를 추정하지 못했습니다. 요청 내용 때문이 아닙니다.",
  duplicateNote: "다시 요청하기 전에 그 결제를 먼저 확인하세요.",
  nextStop:
    "자동으로 다시 보내지 않습니다. 진행하려면 허용 범위에 맞춰 새 요청을 보내세요. 새 요청도 12개 규칙으로 다시 검사합니다.",
  nextStopOutside:
    "자동으로 다시 보내지 않습니다. 요청을 바꿔도 이 중단은 해결되지 않습니다. 위의 안내를 확인하세요.",
  payment: "결제",
  rows: {
    amount: "금액",
    networkFee: "네트워크 수수료",
    estimate: "추정치",
    fallbackEstimate: "대체 추정치",
    noFee: "없음",
    actualFee: "실제 수수료",
    afterMining: "채굴 후",
    paymentFailed: "결제 실패",
    counted: "예산 차감액",
  },
  budget: {
    remainingNow: "현재 잔액",
    remainingNowHint:
      "이후의 모든 결정을 반영한 지금의 위임 잔액입니다. 장부는 결정별 잔액을 기록하지 않습니다.",
    atDecision: "결정 시점 잔액",
    atDecisionHint: "중단 사유에 기록된 값",
    ofBudget: (v: string) => `/ ${v}`,
  },
  checks: {
    show: (passed: number, failed: number, skipped: number) =>
      `12개 규칙 검사 보기 (통과 ${passed} · 실패 ${failed}${skipped ? ` · 미평가 ${skipped}` : ""})`,
    hide: "12개 규칙 검사 숨기기",
    note: "기록된 결정에서 읽은 결과입니다. 감사 재실행이 검사를 다시 수행합니다.",
  },
  hash: {
    tx: "tx",
    receipt: "영수증",
    mandate: "위임",
    txWhat: "트랜잭션 해시",
    receiptWhat: "영수증 해시",
    mandateWhat: "위임 해시",
    notBroadcast: "미전송",
  },
  recordedAs: "장부 기록: ",
  settledAt: (time: string) => `정산 완료 ${time}`,
  viewOnEtherscan: "Etherscan에서 보기",
  noBroadcast: "트랜잭션 미전송",
  openEvidence: "증빙 열기",
  selected: "결정 이력에서 선택됨",
  reasons: { observed: "실제", limit: "한도" },
  toast: {
    settled: (fee: string) => `Sepolia에서 정산 완료, 수수료 ${fee}`,
    failed: "Sepolia에서 트랜잭션 실패",
  },
};

export const ja: typeof en = {
  unknownCategory: "不明なカテゴリ",
  quoted: (s: string) => `「${s}」`,
  youSaid: (s: string) => `入力した依頼：「${s}」`,
  failedOnChain: "オンチェーンでトランザクションが失敗しました",
  broadcastUnconfirmed:
    "ブロードキャスト未確認 — tx ハッシュの記録なし。再試行する前に Etherscan でエージェントのウォレットを確認してください",
  stoppedHeadline: "何も送信されていません",
  requested: "依頼額",
  aria: {
    approved: (id: string, status: string) =>
      `レシート ${id}：承認済み、${status}`,
    approvedFailed: (id: string, headline: string) =>
      `レシート ${id}：承認済み、${headline}`,
    stopped: (id: string, n: number) => `レシート ${id}：停止、理由 ${n} 件`,
  },
  status: {
    approved: "未送信",
    pending: "保留中",
    settled: "決済完了",
    failed: "失敗",
    stopped: "停止",
  },
  why: "理由",
  allPassed: "判定時に 12 のルールチェックをすべて通過しました。",
  checksFailed: (n: number, total: number) =>
    `${total} 件のルールチェックのうち ${n} 件が不合格です。`,
  rule: "ルール",
  asked: "判定時の値",
  allowed: "許可範囲",
  listSep: "、",
  field: {
    amount: "金額",
    merchant: "加盟店",
    category: "カテゴリ",
    wording: "依頼内容",
    status: "委任の状態",
    date: "日時",
    fee: "ネットワーク手数料",
    total: "金額＋手数料",
    repeat: "以前の支払い",
  },
  where: {
    request: "依頼で変更できます",
    principal: "委任者が決めます",
    system: "依頼とは無関係です",
  },
  value: {
    perPayment: (v: string) => `1 回あたり ${v} まで`,
    positive: "$0.00 より大きい金額",
    noneOf: (list: string) => `${list} を含まないこと`,
    from: (d: string) => `${d} から`,
    until: (d: string) => `${d} まで`,
    remainingAtDecision: (v: string) => `判定時の残額 ${v} まで`,
    feeUnknown: "手数料の見積もりなし",
    feeRequired: "手数料の見積もり",
    repeats: (id: string) => `${id} と同じ加盟店・金額`,
    noRepeat: "5 分以内に同じ加盟店・金額の支払いがないこと",
  },
  principalNote: {
    MANDATE_NOT_ACTIVE:
      "一時停止した委任を再開できるのは委任者だけです。取り消しは元に戻せません。",
    EXPIRED:
      "出張期間は終了しました。新しい支払いには委任者による新しい委任が必要です。",
    BEFORE_START: "出張期間が始まる前の依頼は停止されます。",
  },
  systemNote:
    "判定時にネットワーク手数料を見積もれませんでした。依頼内容が原因ではありません。",
  duplicateNote: "再度依頼する前に、その支払いを確認してください。",
  nextStop:
    "自動では再送しません。進めるには、許可範囲に合わせて新しい依頼を送ってください。新しい依頼も 12 のルールで改めてチェックされます。",
  nextStopOutside:
    "自動では再送しません。依頼を変えてもこの停止は解消しません。上の説明を確認してください。",
  payment: "支払い",
  rows: {
    amount: "金額",
    networkFee: "ネットワーク手数料",
    estimate: "見積もり",
    fallbackEstimate: "予備の見積もり",
    noFee: "なし",
    actualFee: "実際の手数料",
    afterMining: "マイニング後",
    paymentFailed: "支払い失敗",
    counted: "予算への計上額",
  },
  budget: {
    remainingNow: "現在の残額",
    remainingNowHint:
      "その後のすべての判定を反映した、現時点の委任の残額です。台帳は判定ごとの残額を記録しません。",
    atDecision: "判定時の残額",
    atDecisionHint: "停止理由に記録された値",
    ofBudget: (v: string) => `/ ${v}`,
  },
  checks: {
    show: (passed: number, failed: number, skipped: number) =>
      `12 のルールチェックを表示（合格 ${passed}・不合格 ${failed}${skipped ? `・未評価 ${skipped}` : ""}）`,
    hide: "12 のルールチェックを隠す",
    note: "記録された判定から読み取った結果です。監査の再実行でチェックをやり直します。",
  },
  hash: {
    tx: "tx",
    receipt: "レシート",
    mandate: "委任",
    txWhat: "トランザクションハッシュ",
    receiptWhat: "レシートハッシュ",
    mandateWhat: "委任ハッシュ",
    notBroadcast: "未送信",
  },
  recordedAs: "台帳に記録：",
  settledAt: (time: string) => `決済完了 ${time}`,
  viewOnEtherscan: "Etherscan で表示",
  noBroadcast: "トランザクション未送信",
  openEvidence: "証跡を開く",
  selected: "判定履歴で選択中",
  reasons: { observed: "実際", limit: "上限" },
  toast: {
    settled: (fee: string) => `Sepolia で決済完了、手数料 ${fee}`,
    failed: "Sepolia でトランザクションが失敗しました",
  },
};

export const zh: typeof en = {
  unknownCategory: "未知类别",
  quoted: (s: string) => `“${s}”`,
  youSaid: (s: string) => `你的请求：“${s}”`,
  failedOnChain: "链上交易失败",
  broadcastUnconfirmed:
    "广播未确认 — 未记录 tx 哈希；重试前请在 Etherscan 上检查代理钱包",
  stoppedHeadline: "未发送任何款项",
  requested: "请求金额",
  aria: {
    approved: (id: string, status: string) => `收据 ${id}：已批准，${status}`,
    approvedFailed: (id: string, headline: string) =>
      `收据 ${id}：已批准，${headline}`,
    stopped: (id: string, n: number) => `收据 ${id}：已拦截，${n} 条原因`,
  },
  status: {
    approved: "尚未发送",
    pending: "待确认",
    settled: "已结算",
    failed: "失败",
    stopped: "已拦截",
  },
  why: "原因",
  allPassed: "判定时 12 项规则检查全部通过。",
  checksFailed: (n: number, total: number) =>
    `${total} 项规则检查中有 ${n} 项未通过。`,
  rule: "规则",
  asked: "判定时的值",
  allowed: "允许范围",
  listSep: "、",
  field: {
    amount: "金额",
    merchant: "商户",
    category: "类别",
    wording: "请求内容",
    status: "授权状态",
    date: "日期",
    fee: "网络手续费",
    total: "金额＋手续费",
    repeat: "之前的付款",
  },
  where: {
    request: "可在请求中修改",
    principal: "由委托方设定",
    system: "与请求无关",
  },
  value: {
    perPayment: (v: string) => `单笔不超过 ${v}`,
    positive: "大于 $0.00",
    noneOf: (list: string) => `不涉及 ${list}`,
    from: (d: string) => `${d} 起`,
    until: (d: string) => `至 ${d}`,
    remainingAtDecision: (v: string) => `不超过判定时的剩余预算 ${v}`,
    feeUnknown: "无手续费估算",
    feeRequired: "手续费估算",
    repeats: (id: string) => `与 ${id} 的商户和金额相同`,
    noRepeat: "5 分钟内没有相同商户和金额的付款",
  },
  principalNote: {
    MANDATE_NOT_ACTIVE: "只有委托方可以恢复已暂停的授权。撤销不可恢复。",
    EXPIRED: "差旅期间已结束。只有委托方授予新的授权后才能付款。",
    BEFORE_START: "差旅期间开始前的请求会被拦截。",
  },
  systemNote: "判定时无法估算网络手续费，与你的请求内容无关。",
  duplicateNote: "再次请求前，请先查看那笔付款。",
  nextStop:
    "不会自动重新发送。如需继续，请按允许范围发送新的请求；新请求同样会重新经过全部 12 项规则检查。",
  nextStopOutside: "不会自动重新发送。修改请求无法解决此次拦截，请查看上方说明。",
  payment: "付款",
  rows: {
    amount: "金额",
    networkFee: "网络手续费",
    estimate: "估算",
    fallbackEstimate: "备用估算",
    noFee: "无",
    actualFee: "实际手续费",
    afterMining: "出块后",
    paymentFailed: "付款失败",
    counted: "计入预算",
  },
  budget: {
    remainingNow: "当前剩余",
    remainingNowHint:
      "反映此后所有判定的授权当前剩余预算。账本不按每项判定记录剩余预算。",
    atDecision: "判定时剩余",
    atDecisionHint: "记录在拦截原因中",
    ofBudget: (v: string) => `/ ${v}`,
  },
  checks: {
    show: (passed: number, failed: number, skipped: number) =>
      `查看 12 项规则检查（通过 ${passed}，未通过 ${failed}${skipped ? `，未评估 ${skipped}` : ""}）`,
    hide: "收起 12 项规则检查",
    note: "根据已记录的判定读取。审计重放会重新运行这些检查。",
  },
  hash: {
    tx: "tx",
    receipt: "收据",
    mandate: "授权",
    txWhat: "交易哈希",
    receiptWhat: "收据哈希",
    mandateWhat: "授权哈希",
    notBroadcast: "未广播",
  },
  recordedAs: "已记入账本：",
  settledAt: (time: string) => `已结算 ${time}`,
  viewOnEtherscan: "在 Etherscan 查看",
  noBroadcast: "未广播交易",
  openEvidence: "打开证据",
  selected: "已在判定记录中选中",
  reasons: { observed: "实际", limit: "上限" },
  toast: {
    settled: (fee: string) => `已在 Sepolia 结算，手续费 ${fee}`,
    failed: "Sepolia 上的交易失败",
  },
};
