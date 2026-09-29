/**
 * "stop" namespace: the 12 boundary checks (titles and meanings) and the reason sentence shown
 * on a STOP. English keeps the server's own sentence, which is what the ledger stores; the other
 * languages rebuild it from the reason's code and its observed / limit values, falling back to
 * the check's meaning. Ledger data itself is never translated.
 */
import type { StopCode, StopReason } from "@/contracts/api";

export type CodeCopy = { title: string; meaning: string };
/** observed / limit already formatted for display (money, dates) — null when absent. */
export type ReasonValues = { observed: string | null; limit: string | null };
type MessageFn = (r: StopReason, v: ReasonValues) => string;

const MERCHANT_RE = /^(.*) is not on the permitted list\.$/;
const BUDGET_RE =
  /^Amount (\$\S+) \+ network fee (\$\S+) = (\$\S+) exceeds remaining budget (\$\S+?)\.$/;

function merchantName(r: StopReason): string {
  return MERCHANT_RE.exec(r.message)?.[1] ?? String(r.observed ?? "");
}

function localized(
  codes: Record<StopCode, CodeCopy>,
  templates: Partial<Record<StopCode, MessageFn>>,
): MessageFn {
  return (r, v) =>
    templates[r.code]?.(r, v) ?? codes[r.code]?.meaning ?? r.message;
}

const EN_CODES: Record<StopCode, CodeCopy> = {
  MANDATE_NOT_ACTIVE: {
    title: "Kill switch",
    meaning: "The principal paused or revoked the mandate.",
  },
  BEFORE_START: {
    title: "Too early",
    meaning: "The trip window has not opened yet.",
  },
  EXPIRED: {
    title: "Deadline passed",
    meaning: "The trip window has already closed.",
  },
  UNKNOWN_MERCHANT: {
    title: "Unknown merchant",
    meaning:
      "The merchant is not in the catalog snapshot hashed into the mandate.",
  },
  MERCHANT_NOT_ALLOWED: {
    title: "Merchant not permitted",
    meaning: "The merchant is not on the principal's permitted list.",
  },
  CATEGORY_NOT_ALLOWED: {
    title: "Category not permitted",
    meaning: "The merchant's category (e.g. alcohol, gift) is not allowed.",
  },
  BLOCKED_KEYWORD: {
    title: "Blocked item",
    meaning:
      "The request or memo mentions a blocked word such as wine or gift.",
  },
  INVALID_AMOUNT: {
    title: "Invalid amount",
    meaning: "The amount is zero, negative or not a number.",
  },
  OVER_PER_TX_CAP: {
    title: "Over per-payment cap",
    meaning: "A single payment above the per-transaction cap.",
  },
  FEE_UNAVAILABLE: {
    title: "Fee unknown",
    meaning:
      "The network fee could not be estimated, so it refuses instead of guessing (fail closed).",
  },
  OVER_BUDGET_WITH_FEES: {
    title: "Over budget with fees",
    meaning:
      "Amount plus the real network fee exceeds the remaining budget, compared unrounded.",
  },
  DUPLICATE: {
    title: "Duplicate",
    meaning: "Same merchant and amount within 5 minutes of an earlier payment.",
  },
};

export const en = {
  codes: EN_CODES,
  /** English shows the server's sentence unchanged. */
  message: ((r) => r.message) as MessageFn,
  detail: { observed: "observed", limit: "limit" },
  mandateStatus: {
    active: "active",
    paused: "paused",
    revoked: "revoked",
  } as Record<string, string>,
};

const KO_CODES: Record<StopCode, CodeCopy> = {
  MANDATE_NOT_ACTIVE: {
    title: "킬 스위치",
    meaning: "위임자가 위임을 일시정지하거나 철회했습니다.",
  },
  BEFORE_START: {
    title: "시작 전",
    meaning: "출장 기간이 아직 시작되지 않았습니다.",
  },
  EXPIRED: { title: "기한 지남", meaning: "출장 기간이 이미 끝났습니다." },
  UNKNOWN_MERCHANT: {
    title: "알 수 없는 가맹점",
    meaning: "위임에 해시로 고정된 가맹점 목록에 없는 가맹점입니다.",
  },
  MERCHANT_NOT_ALLOWED: {
    title: "허용되지 않은 가맹점",
    meaning: "위임자가 허용한 가맹점 목록에 없습니다.",
  },
  CATEGORY_NOT_ALLOWED: {
    title: "허용되지 않은 분류",
    meaning: "가맹점의 분류(예: 주류, 선물)가 허용되지 않습니다.",
  },
  BLOCKED_KEYWORD: {
    title: "차단 항목",
    meaning: "요청이나 메모에 와인, 선물 같은 차단 키워드가 들어 있습니다.",
  },
  INVALID_AMOUNT: {
    title: "잘못된 금액",
    meaning: "금액이 0이거나 음수이거나 숫자가 아닙니다.",
  },
  OVER_PER_TX_CAP: {
    title: "1회 한도 초과",
    meaning: "1회 결제 한도를 넘는 결제입니다.",
  },
  FEE_UNAVAILABLE: {
    title: "수수료 확인 불가",
    meaning:
      "네트워크 수수료를 추정할 수 없어, 추측하지 않고 거절합니다(안전 우선).",
  },
  OVER_BUDGET_WITH_FEES: {
    title: "수수료 포함 예산 초과",
    meaning:
      "금액과 실제 네트워크 수수료의 합이 남은 예산을 넘습니다. 반올림하지 않고 비교합니다.",
  },
  DUPLICATE: {
    title: "중복",
    meaning:
      "5분 안에 이전 결제와 같은 가맹점, 같은 금액의 결제가 들어왔습니다.",
  },
};

const KO_STATUS: Record<string, string> = {
  active: "활성",
  paused: "일시정지",
  revoked: "철회",
};

export const ko: typeof en = {
  codes: KO_CODES,
  message: localized(KO_CODES, {
    MANDATE_NOT_ACTIVE: (r) =>
      `위임이 ${KO_STATUS[String(r.observed)] ?? String(r.observed ?? "")} 상태입니다. 위임자가 재개해야 에이전트가 결제할 수 있습니다.`,
    BEFORE_START: () => "출장이 아직 시작되지 않았습니다.",
    EXPIRED: () => "위임 기한이 지났습니다.",
    UNKNOWN_MERCHANT: (_r, v) =>
      `가맹점 "${v.observed ?? ""}"이(가) 가맹점 목록에 없습니다.`,
    MERCHANT_NOT_ALLOWED: (r) =>
      `${merchantName(r)}은(는) 허용된 가맹점 목록에 없습니다.`,
    CATEGORY_NOT_ALLOWED: (_r, v) =>
      `"${v.observed ?? ""}" 분류는 허용되지 않습니다.`,
    BLOCKED_KEYWORD: (_r, v) =>
      `요청에 차단된 항목("${v.observed ?? ""}")이 들어 있습니다.`,
    INVALID_AMOUNT: () => "금액은 0보다 큰 숫자여야 합니다.",
    OVER_PER_TX_CAP: (_r, v) =>
      v.limit
        ? `1회 결제 한도는 ${v.limit}입니다.`
        : KO_CODES.OVER_PER_TX_CAP.meaning,
    FEE_UNAVAILABLE: () =>
      "네트워크 수수료를 추정할 수 없어, 추측하지 않고 거절합니다.",
    OVER_BUDGET_WITH_FEES: (r, v) => {
      const m = BUDGET_RE.exec(r.message);
      if (m)
        return `금액 ${m[1]} + 네트워크 수수료 ${m[2]} = ${m[3]}로, 남은 예산 ${m[4]}을(를) 넘습니다.`;
      return v.observed && v.limit
        ? `금액과 수수료의 합 ${v.observed}이(가) 남은 예산 ${v.limit}을(를) 넘습니다.`
        : KO_CODES.OVER_BUDGET_WITH_FEES.meaning;
    },
    DUPLICATE: () =>
      "5분 안에 같은 가맹점, 같은 금액의 결제가 있어 중복으로 판단했습니다.",
  }),
  detail: { observed: "실제", limit: "한도" },
  mandateStatus: KO_STATUS,
};

const JA_CODES: Record<StopCode, CodeCopy> = {
  MANDATE_NOT_ACTIVE: {
    title: "キルスイッチ",
    meaning: "委任者が委任を一時停止または取り消しました。",
  },
  BEFORE_START: {
    title: "開始前",
    meaning: "出張期間がまだ始まっていません。",
  },
  EXPIRED: { title: "期限切れ", meaning: "出張期間はすでに終了しています。" },
  UNKNOWN_MERCHANT: {
    title: "不明な加盟店",
    meaning: "委任時にハッシュで固定した加盟店リストにない加盟店です。",
  },
  MERCHANT_NOT_ALLOWED: {
    title: "許可されていない加盟店",
    meaning: "委任者が許可した加盟店リストにありません。",
  },
  CATEGORY_NOT_ALLOWED: {
    title: "許可されていないカテゴリ",
    meaning: "加盟店のカテゴリ（例：酒類、ギフト）が許可されていません。",
  },
  BLOCKED_KEYWORD: {
    title: "ブロック対象",
    meaning:
      "依頼またはメモに、ワインやギフトなどのブロック語が含まれています。",
  },
  INVALID_AMOUNT: {
    title: "無効な金額",
    meaning: "金額がゼロ、負の値、または数値ではありません。",
  },
  OVER_PER_TX_CAP: {
    title: "1回の上限超過",
    meaning: "1回あたりの支払い上限を超える支払いです。",
  },
  FEE_UNAVAILABLE: {
    title: "手数料不明",
    meaning:
      "ネットワーク手数料を見積もれないため、推測せずに拒否します（フェイルクローズ）。",
  },
  OVER_BUDGET_WITH_FEES: {
    title: "手数料込みで予算超過",
    meaning:
      "金額と実際のネットワーク手数料の合計が残りの予算を超えています。丸めずに比較します。",
  },
  DUPLICATE: {
    title: "重複",
    meaning: "以前の支払いと同じ加盟店・同じ金額の支払いが5分以内に来ました。",
  },
};

const JA_STATUS: Record<string, string> = {
  active: "有効",
  paused: "一時停止中",
  revoked: "取り消し済み",
};

export const ja: typeof en = {
  codes: JA_CODES,
  message: localized(JA_CODES, {
    MANDATE_NOT_ACTIVE: (r) =>
      `委任は${JA_STATUS[String(r.observed)] ?? String(r.observed ?? "")}です。エージェントが支払うには、委任者が再開する必要があります。`,
    BEFORE_START: () => "出張はまだ始まっていません。",
    EXPIRED: () => "委任の期限が過ぎています。",
    UNKNOWN_MERCHANT: (_r, v) =>
      `加盟店「${v.observed ?? ""}」は加盟店リストにありません。`,
    MERCHANT_NOT_ALLOWED: (r) => `${merchantName(r)}は許可リストにありません。`,
    CATEGORY_NOT_ALLOWED: (_r, v) =>
      `カテゴリ「${v.observed ?? ""}」は許可されていません。`,
    BLOCKED_KEYWORD: (_r, v) =>
      `依頼にブロック対象の項目（「${v.observed ?? ""}」）が含まれています。`,
    INVALID_AMOUNT: () => "金額は正の数でなければなりません。",
    OVER_PER_TX_CAP: (_r, v) =>
      v.limit
        ? `1回の支払い上限は${v.limit}です。`
        : JA_CODES.OVER_PER_TX_CAP.meaning,
    FEE_UNAVAILABLE: () =>
      "ネットワーク手数料を見積もれないため、推測せずに拒否します。",
    OVER_BUDGET_WITH_FEES: (r, v) => {
      const m = BUDGET_RE.exec(r.message);
      if (m)
        return `金額 ${m[1]} + ネットワーク手数料 ${m[2]} = ${m[3]} で、残りの予算 ${m[4]} を超えています。`;
      return v.observed && v.limit
        ? `金額と手数料の合計 ${v.observed} が残りの予算 ${v.limit} を超えています。`
        : JA_CODES.OVER_BUDGET_WITH_FEES.meaning;
    },
    DUPLICATE: () =>
      "5分以内に同じ加盟店・同じ金額の支払いがあるため、重複と判断しました。",
  }),
  detail: { observed: "実際", limit: "上限" },
  mandateStatus: JA_STATUS,
};

const ZH_CODES: Record<StopCode, CodeCopy> = {
  MANDATE_NOT_ACTIVE: {
    title: "紧急停止",
    meaning: "委托方已暂停或撤销该授权。",
  },
  BEFORE_START: { title: "尚未开始", meaning: "差旅期间尚未开始。" },
  EXPIRED: { title: "已过期限", meaning: "差旅期间已经结束。" },
  UNKNOWN_MERCHANT: {
    title: "未知商户",
    meaning: "该商户不在授权时以哈希固定的商户目录中。",
  },
  MERCHANT_NOT_ALLOWED: {
    title: "商户未获许可",
    meaning: "该商户不在委托方许可的名单上。",
  },
  CATEGORY_NOT_ALLOWED: {
    title: "类别未获许可",
    meaning: "该商户的类别（如酒类、礼品）不被允许。",
  },
  BLOCKED_KEYWORD: {
    title: "屏蔽项目",
    meaning: "请求或备注中包含葡萄酒、礼品等屏蔽词。",
  },
  INVALID_AMOUNT: { title: "金额无效", meaning: "金额为零、负数或不是数字。" },
  OVER_PER_TX_CAP: {
    title: "超出单笔上限",
    meaning: "单笔付款超过了单笔上限。",
  },
  FEE_UNAVAILABLE: {
    title: "手续费未知",
    meaning: "无法估算网络手续费，因此直接拒绝而不去猜测（出错时默认拒绝）。",
  },
  OVER_BUDGET_WITH_FEES: {
    title: "含手续费超出预算",
    meaning: "金额加上实际网络手续费超过剩余预算，比较时不做四舍五入。",
  },
  DUPLICATE: {
    title: "重复",
    meaning: "5 分钟内出现了与之前付款相同商户、相同金额的付款。",
  },
};

const ZH_STATUS: Record<string, string> = {
  active: "生效",
  paused: "已暂停",
  revoked: "已撤销",
};

export const zh: typeof en = {
  codes: ZH_CODES,
  message: localized(ZH_CODES, {
    MANDATE_NOT_ACTIVE: (r) =>
      `授权当前为“${ZH_STATUS[String(r.observed)] ?? String(r.observed ?? "")}”状态；委托方恢复后，代理才能付款。`,
    BEFORE_START: () => "差旅尚未开始。",
    EXPIRED: () => "授权期限已过。",
    UNKNOWN_MERCHANT: (_r, v) => `商户“${v.observed ?? ""}”不在商户目录中。`,
    MERCHANT_NOT_ALLOWED: (r) => `${merchantName(r)} 不在许可名单上。`,
    CATEGORY_NOT_ALLOWED: (_r, v) => `类别“${v.observed ?? ""}”不被允许。`,
    BLOCKED_KEYWORD: (_r, v) => `请求中包含屏蔽项目（“${v.observed ?? ""}”）。`,
    INVALID_AMOUNT: () => "金额必须是正数。",
    OVER_PER_TX_CAP: (_r, v) =>
      v.limit
        ? `单笔付款上限为 ${v.limit}。`
        : ZH_CODES.OVER_PER_TX_CAP.meaning,
    FEE_UNAVAILABLE: () => "无法估算网络手续费，因此拒绝而不是猜测。",
    OVER_BUDGET_WITH_FEES: (r, v) => {
      const m = BUDGET_RE.exec(r.message);
      if (m)
        return `金额 ${m[1]} + 网络手续费 ${m[2]} = ${m[3]}，超过剩余预算 ${m[4]}。`;
      return v.observed && v.limit
        ? `金额与手续费合计 ${v.observed}，超过剩余预算 ${v.limit}。`
        : ZH_CODES.OVER_BUDGET_WITH_FEES.meaning;
    },
    DUPLICATE: () => "5 分钟内已有相同商户、相同金额的付款，判定为重复。",
  }),
  detail: { observed: "实际", limit: "上限" },
  mandateStatus: ZH_STATUS,
};
