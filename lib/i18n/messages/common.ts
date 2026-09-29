/**
 * "common" namespace: copy shared by several screens. `en` is the reference: its strings must
 * equal the English UI copy exactly. The other languages are typed `typeof en`.
 */
export const en = {
  /** Merchant categories are data ids; show `t.common.category[c] ?? c`. English shows the id itself. */
  category: {
    meal: "meal",
    transport: "transport",
    supplies: "supplies",
    alcohol: "alcohol",
    gift: "gift",
  } as Record<string, string>,
  /**
   * Status labels (StatusPill): ledger statuses, mandate statuses, and two derived trip-window
   * states. Keyed by the status id, so any screen can show `t.common.status[s]`.
   */
  status: {
    approved: "Approved",
    settled: "Settled",
    pending: "Pending",
    stopped: "Stopped",
    failed: "Failed",
    active: "Active",
    paused: "Paused",
    revoked: "Revoked",
    expired: "Expired",
    scheduled: "Not started",
  },
  /** Button that re-runs a failed load. */
  retry: "Retry",
  close: "Close",
  /** Accessible name of a loading skeleton. */
  loading: "Loading",
  /** ErrorState defaults. */
  error: {
    title: "Something went wrong",
    unknown: "Unknown error.",
  },
  /** CopyButton. */
  copy: {
    label: "Copy",
    copied: "Copied",
    failed: "Copy failed — select the text instead.",
  },
  /** HashChip: `what` names the hash in accessible names ("transaction hash"). */
  hash: {
    what: "hash",
    copy: (what: string) => `Copy ${what}`,
    openOnEtherscan: (what: string) => `Open ${what} on Etherscan (new tab)`,
    openTitle: "Open on Etherscan",
  },
  /** CheckMark default labels. */
  check: {
    match: "Match",
    mismatch: "Mismatch",
  },
  /** JsonView: collapse toggle and the "3 items" / "5 keys" badge on a closed node. */
  json: {
    value: "value",
    toggle: (open: boolean, name: string) =>
      `${open ? "Collapse" : "Expand"} ${name}`,
    count: (n: number, isArray: boolean) =>
      `${n} ${isArray ? "items" : "keys"}`,
  },
};

export const ko: typeof en = {
  category: {
    meal: "식사",
    transport: "교통",
    supplies: "소모품",
    alcohol: "주류",
    gift: "선물",
  },
  status: {
    approved: "승인됨",
    settled: "정산 완료",
    pending: "대기 중",
    stopped: "중단됨",
    failed: "실패",
    active: "활성",
    paused: "일시정지",
    revoked: "철회됨",
    expired: "만료됨",
    scheduled: "시작 전",
  },
  retry: "다시 시도",
  close: "닫기",
  loading: "불러오는 중",
  error: {
    title: "문제가 발생했습니다",
    unknown: "알 수 없는 오류입니다.",
  },
  copy: {
    label: "복사",
    copied: "복사됨",
    failed: "복사하지 못했습니다. 텍스트를 직접 선택하세요.",
  },
  hash: {
    what: "해시",
    copy: (what: string) => `${what} 복사`,
    openOnEtherscan: (what: string) => `Etherscan에서 ${what} 열기(새 탭)`,
    openTitle: "Etherscan에서 열기",
  },
  check: {
    match: "일치",
    mismatch: "불일치",
  },
  json: {
    value: "값",
    toggle: (open: boolean, name: string) =>
      `${name} ${open ? "접기" : "펼치기"}`,
    count: (n: number, isArray: boolean) =>
      isArray ? `항목 ${n}개` : `키 ${n}개`,
  },
};

export const ja: typeof en = {
  category: {
    meal: "食事",
    transport: "交通",
    supplies: "消耗品",
    alcohol: "酒類",
    gift: "ギフト",
  },
  status: {
    approved: "承認済み",
    settled: "決済完了",
    pending: "保留中",
    stopped: "停止",
    failed: "失敗",
    active: "有効",
    paused: "一時停止中",
    revoked: "取り消し済み",
    expired: "期限切れ",
    scheduled: "開始前",
  },
  retry: "再試行",
  close: "閉じる",
  loading: "読み込み中",
  error: {
    title: "問題が発生しました",
    unknown: "不明なエラーです。",
  },
  copy: {
    label: "コピー",
    copied: "コピー済み",
    failed: "コピーできませんでした。テキストを選択してください。",
  },
  hash: {
    what: "ハッシュ",
    copy: (what: string) => `${what}をコピー`,
    openOnEtherscan: (what: string) => `Etherscanで${what}を開く（新しいタブ）`,
    openTitle: "Etherscanで開く",
  },
  check: {
    match: "一致",
    mismatch: "不一致",
  },
  json: {
    value: "値",
    toggle: (open: boolean, name: string) =>
      `${name}を${open ? "折りたたむ" : "展開する"}`,
    count: (n: number, isArray: boolean) =>
      isArray ? `${n} 項目` : `${n} 個のキー`,
  },
};

export const zh: typeof en = {
  category: {
    meal: "餐饮",
    transport: "交通",
    supplies: "日用品",
    alcohol: "酒类",
    gift: "礼品",
  },
  status: {
    approved: "已批准",
    settled: "已结算",
    pending: "待确认",
    stopped: "已拦截",
    failed: "失败",
    active: "生效中",
    paused: "已暂停",
    revoked: "已撤销",
    expired: "已过期",
    scheduled: "未开始",
  },
  retry: "重试",
  close: "关闭",
  loading: "加载中",
  error: {
    title: "出错了",
    unknown: "未知错误。",
  },
  copy: {
    label: "复制",
    copied: "已复制",
    failed: "复制失败，请手动选择文本。",
  },
  hash: {
    what: "哈希",
    copy: (what: string) => `复制${what}`,
    openOnEtherscan: (what: string) => `在 Etherscan 上打开${what}（新标签页）`,
    openTitle: "在 Etherscan 上打开",
  },
  check: {
    match: "一致",
    mismatch: "不一致",
  },
  json: {
    value: "值",
    toggle: (open: boolean, name: string) => `${open ? "折叠" : "展开"}${name}`,
    count: (n: number, isArray: boolean) => (isArray ? `${n} 项` : `${n} 个键`),
  },
};
