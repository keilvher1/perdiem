/**
 * "receipt" namespace: receipt cards, reason lists and settlement toasts. `en` is the reference:
 * its strings must equal the English UI copy exactly. The other languages are typed `typeof en`,
 * so a missing key is a compile error.
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
  approvedHeadline: "Approved — inside the mandate",
  stoppedHeadline: "Stopped — nothing was sent",
  /** English aria-labels start with "Receipt <id>: " (scripts/capture.ts selects on it). */
  aria: {
    approved: (id: string, status: string) =>
      `Receipt ${id}: approved, ${status}`,
    approvedFailed: (id: string, headline: string) =>
      `Receipt ${id}: approved, ${headline.toLowerCase()}`,
    stopped: (id: string, n: number) =>
      `Receipt ${id}: stopped, ${n} reason${n === 1 ? "" : "s"}`,
  },
  /** Ledger statuses (data ids) in the aria-label; English shows the id itself. */
  status: {
    approved: "approved",
    pending: "pending",
    settled: "settled",
    failed: "failed",
    stopped: "stopped",
  } as Record<string, string>,
  rows: {
    amount: "Amount",
    networkFee: "Network fee",
    estimate: "estimate",
    fallbackEstimate: "fallback estimate",
    actualFee: "Actual fee",
    afterMining: "after mining",
    notCounted: "Not counted against budget",
    paymentFailed: "payment failed",
    counted: "Counted against budget",
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
  recordedAs: "Recorded in ledger as ",
  settledAt: (time: string) => `settled ${time}`,
  viewOnEtherscan: "View on Etherscan",
  requestedNoneSent: "requested · $0.00 sent",
  checksFailed: (n: number, total: number) =>
    `${n} of ${total} boundary checks failed`,
  noBroadcast: "no transaction broadcast",
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
  approvedHeadline: "승인됨 — 위임 범위 내",
  stoppedHeadline: "중단됨 — 아무것도 전송되지 않음",
  aria: {
    approved: (id: string, status: string) => `영수증 ${id}: 승인됨, ${status}`,
    approvedFailed: (id: string, headline: string) =>
      `영수증 ${id}: 승인됨, ${headline}`,
    stopped: (id: string, n: number) => `영수증 ${id}: 중단됨, 사유 ${n}건`,
  },
  status: {
    approved: "승인됨",
    pending: "대기 중",
    settled: "정산 완료",
    failed: "실패",
    stopped: "중단됨",
  },
  rows: {
    amount: "금액",
    networkFee: "네트워크 수수료",
    estimate: "추정치",
    fallbackEstimate: "대체 추정치",
    actualFee: "실제 수수료",
    afterMining: "채굴 후",
    notCounted: "예산 미차감",
    paymentFailed: "결제 실패",
    counted: "예산 차감액",
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
  requestedNoneSent: "요청액 · 송금액 $0.00",
  checksFailed: (n: number, total: number) =>
    `경계 검사 ${total}개 중 ${n}개 실패`,
  noBroadcast: "트랜잭션 미전송",
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
  approvedHeadline: "承認済み — 委任の範囲内",
  stoppedHeadline: "停止 — 何も送信されていません",
  aria: {
    approved: (id: string, status: string) =>
      `レシート ${id}：承認済み、${status}`,
    approvedFailed: (id: string, headline: string) =>
      `レシート ${id}：承認済み、${headline}`,
    stopped: (id: string, n: number) => `レシート ${id}：停止、理由 ${n} 件`,
  },
  status: {
    approved: "承認済み",
    pending: "保留中",
    settled: "決済完了",
    failed: "失敗",
    stopped: "停止",
  },
  rows: {
    amount: "金額",
    networkFee: "ネットワーク手数料",
    estimate: "見積もり",
    fallbackEstimate: "予備の見積もり",
    actualFee: "実際の手数料",
    afterMining: "マイニング後",
    notCounted: "予算への計上なし",
    paymentFailed: "支払い失敗",
    counted: "予算への計上額",
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
  requestedNoneSent: "依頼額 · 送金 $0.00",
  checksFailed: (n: number, total: number) =>
    `境界チェック ${total} 件中 ${n} 件が不合格`,
  noBroadcast: "トランザクション未送信",
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
  approvedHeadline: "已批准 — 在授权范围内",
  stoppedHeadline: "已拦截 — 未发送任何款项",
  aria: {
    approved: (id: string, status: string) => `收据 ${id}：已批准，${status}`,
    approvedFailed: (id: string, headline: string) =>
      `收据 ${id}：已批准，${headline}`,
    stopped: (id: string, n: number) => `收据 ${id}：已拦截，${n} 条原因`,
  },
  status: {
    approved: "已批准",
    pending: "待确认",
    settled: "已结算",
    failed: "失败",
    stopped: "已拦截",
  },
  rows: {
    amount: "金额",
    networkFee: "网络手续费",
    estimate: "估算",
    fallbackEstimate: "备用估算",
    actualFee: "实际手续费",
    afterMining: "出块后",
    notCounted: "不计入预算",
    paymentFailed: "付款失败",
    counted: "计入预算",
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
  requestedNoneSent: "请求金额 · 已发送 $0.00",
  checksFailed: (n: number, total: number) =>
    `${total} 项边界检查中有 ${n} 项未通过`,
  noBroadcast: "未广播交易",
  reasons: { observed: "实际", limit: "上限" },
  toast: {
    settled: (fee: string) => `已在 Sepolia 结算，手续费 ${fee}`,
    failed: "Sepolia 上的交易失败",
  },
};
