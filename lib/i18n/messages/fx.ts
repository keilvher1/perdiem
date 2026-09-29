/**
 * "fx" namespace: display currency (header menu, ≈ equivalents) and bill conversion to USD
 * (components/perdiem/currency-switcher.tsx, local-amount.tsx, bill-drop.tsx). `en` is the
 * reference; the other languages are typed `typeof en`. Registered in ./index.ts (`t.fx`).
 *
 * Not translated on purpose: ISO codes, the rate line's source name and the attribution
 * "Rates By Exchange Rate API" (the wording the rate provider's terms ask for).
 */
export const en = {
  menu: {
    /** Accessible name of the header trigger. */
    label: "Currency",
    common: "Common currencies",
    all: "All currencies",
    /** Tag on the USD item. */
    settlement: "settles in USD",
    note: "PerDiem settles in USD. Other currencies are shown as approximate equivalents.",
    loading: "Loading exchange rates…",
    unavailable: "Exchange rates are unavailable right now, so amounts show in USD only.",
    source: (source: string, date: string) => `Rates: ${source}, ${date}`,
  },
  /** "1 USD = 1,358.97 KRW · ExchangeRate-API · 2026-09-29" */
  rateLine: (rate: string, code: string, source: string, date: string) => `1 USD = ${rate} ${code} · ${source} · ${date}`,
  /** Tooltip of a ≈ equivalent; `rateLine` as above. */
  equivalentTitle: (rateLine: string) => `Approximate, at ${rateLine}. PerDiem settles in USD.`,
  bill: {
    /** Accessible name of the bill currency select. */
    currencyLabel: "Currency of the bill total",
    choose: "Choose currency",
    /** The USD row of a bill in another currency. */
    usd: "Pays (USD)",
    detected: "Read from the bill",
    chosen: "Chosen by you",
    ambiguous: (list: string) => `The bill’s currency could be ${list}. Choose it.`,
    unknown: "The bill doesn’t say which currency the total is in. Choose it.",
    inferred: (code: string) => `Currency read as ${code} from the rest of the bill. Check it.`,
    rounding: "Converted at today’s rate and rounded to the cent. Settlement is in USD.",
    loading: "Loading today’s exchange rate…",
    unavailable: "Exchange rates are unavailable, so this bill can’t be converted to USD. Edit it as a request instead.",
    notCovered: (code: string) => `There is no exchange rate for ${code}. Edit it as a request instead.`,
    belowCent: "The converted amount is less than one cent.",
    retry: "Try again",
    attribution: "Rates By Exchange Rate API",
  },
};

export const ko: typeof en = {
  menu: {
    label: "통화",
    common: "주요 통화",
    all: "모든 통화",
    settlement: "USD로 결제",
    note: "PerDiem은 USD로 결제합니다. 다른 통화는 참고용 환산 금액으로만 표시합니다.",
    loading: "환율을 불러오는 중입니다…",
    unavailable: "지금은 환율을 불러올 수 없어 금액을 USD로만 표시합니다.",
    source: (source: string, date: string) => `환율: ${source}, ${date}`,
  },
  rateLine: (rate: string, code: string, source: string, date: string) => `1 USD = ${rate} ${code} · ${source} · ${date}`,
  equivalentTitle: (rateLine: string) => `참고용 환산 금액입니다(${rateLine}). PerDiem은 USD로 결제합니다.`,
  bill: {
    currencyLabel: "청구서 합계의 통화",
    choose: "통화 선택",
    usd: "결제 금액(USD)",
    detected: "청구서에서 읽음",
    chosen: "직접 선택함",
    ambiguous: (list: string) => `청구서의 통화가 ${list}일 수 있습니다. 통화를 선택하세요.`,
    unknown: "청구서에 합계의 통화가 적혀 있지 않습니다. 통화를 선택하세요.",
    inferred: (code: string) => `청구서의 다른 내용을 보고 통화를 ${code}(으)로 읽었습니다. 확인하세요.`,
    rounding: "오늘 환율로 환산해 센트 단위로 반올림했습니다. 결제는 USD로 합니다.",
    loading: "오늘 환율을 불러오는 중입니다…",
    unavailable: "환율을 불러올 수 없어 이 청구서를 USD로 환산할 수 없습니다. 요청으로 수정하세요.",
    notCovered: (code: string) => `${code} 환율이 없습니다. 요청으로 수정하세요.`,
    belowCent: "환산 금액이 1센트보다 적습니다.",
    retry: "다시 시도",
    attribution: "Rates By Exchange Rate API",
  },
};

export const ja: typeof en = {
  menu: {
    label: "通貨",
    common: "主要な通貨",
    all: "すべての通貨",
    settlement: "USDで決済",
    note: "PerDiemはUSDで決済します。ほかの通貨は参考の換算額として表示します。",
    loading: "為替レートを読み込んでいます…",
    unavailable: "現在、為替レートを取得できないため、金額はUSDのみで表示します。",
    source: (source: string, date: string) => `レート：${source}、${date}`,
  },
  rateLine: (rate: string, code: string, source: string, date: string) => `1 USD = ${rate} ${code} · ${source} · ${date}`,
  equivalentTitle: (rateLine: string) => `参考の換算額です（${rateLine}）。PerDiemはUSDで決済します。`,
  bill: {
    currencyLabel: "請求書の合計の通貨",
    choose: "通貨を選択",
    usd: "支払額（USD）",
    detected: "請求書から読み取り",
    chosen: "手動で選択",
    ambiguous: (list: string) => `請求書の通貨は${list}の可能性があります。通貨を選んでください。`,
    unknown: "請求書に合計の通貨が書かれていません。通貨を選んでください。",
    inferred: (code: string) => `請求書のほかの記載から、通貨を${code}と読み取りました。確認してください。`,
    rounding: "本日のレートで換算し、セント単位に四捨五入しました。決済はUSDです。",
    loading: "本日の為替レートを読み込んでいます…",
    unavailable: "為替レートを取得できないため、この請求書をUSDに換算できません。リクエストとして編集してください。",
    notCovered: (code: string) => `${code}の為替レートがありません。リクエストとして編集してください。`,
    belowCent: "換算額が1セント未満です。",
    retry: "再試行",
    attribution: "Rates By Exchange Rate API",
  },
};

export const zh: typeof en = {
  menu: {
    label: "货币",
    common: "常用货币",
    all: "全部货币",
    settlement: "以 USD 结算",
    note: "PerDiem 以 USD 结算。其他货币仅显示为参考折算金额。",
    loading: "正在加载汇率…",
    unavailable: "暂时无法获取汇率，金额仅以 USD 显示。",
    source: (source: string, date: string) => `汇率：${source}，${date}`,
  },
  rateLine: (rate: string, code: string, source: string, date: string) => `1 USD = ${rate} ${code} · ${source} · ${date}`,
  equivalentTitle: (rateLine: string) => `参考折算金额（${rateLine}）。PerDiem 以 USD 结算。`,
  bill: {
    currencyLabel: "账单合计的货币",
    choose: "选择货币",
    usd: "支付金额（USD）",
    detected: "从账单读取",
    chosen: "手动选择",
    ambiguous: (list: string) => `账单的货币可能是${list}。请选择货币。`,
    unknown: "账单没有注明合计的货币。请选择货币。",
    inferred: (code: string) => `根据账单的其他内容，货币读取为 ${code}。请核对。`,
    rounding: "按今日汇率折算，并四舍五入到美分。以 USD 结算。",
    loading: "正在加载今日汇率…",
    unavailable: "无法获取汇率，因此无法将此账单折算为 USD。请改为编辑请求。",
    notCovered: (code: string) => `没有 ${code} 的汇率。请改为编辑请求。`,
    belowCent: "折算金额不足 1 美分。",
    retry: "重试",
    attribution: "Rates By Exchange Rate API",
  },
};
