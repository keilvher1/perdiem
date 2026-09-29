/**
 * "metrics" namespace: app/metrics/page.tsx. `en` is the reference: its strings must equal the
 * English UI copy exactly. The other languages are typed `typeof en`, so a missing key is a
 * compile error. Flow ids (status_fastpath), table names (usage_records), env var names, model
 * ids, commands and the measured prompts are data and stay as they are in every language.
 */
import type { FlowName } from "@/contracts/api";

export const en = {
  header: {
    eyebrow: "Metrics",
    title: "Tokens, cost and energy — by flow",
    description:
      "Every model call is recorded with its flow. Work done without the model is recorded too, as 0-token rows, so avoided inference is visible.",
    updated: (rel: string) => `Updated ${rel}`,
    refresh: "Refresh",
  },
  loading: "Loading metrics",
  loadError: "Couldn’t load usage",
  stale: (message: string) =>
    `Showing the previous numbers — refresh failed: ${message}`,
  tiles: {
    statusFastpath: "Status questions answered without the model",
    statusFastpathHint: "status_fastpath · 0 tokens each",
    stopTemplate: "Refusals explained without the model",
    stopTemplateHint: "stop_template · 0 tokens each",
    cost: "Cost so far",
    costHint: "Kiln usage.cost, all flows",
    tokens: "Tokens so far",
    tokensHint: (calls: string) => `${calls} recorded calls`,
  },
  flows: {
    title: "Tokens by flow",
    description:
      "Grouped from usage_records. Green rows were handled in code — the model was never called.",
    emptyTitle: "No model usage recorded yet",
    emptyBody:
      "Send a request on the Traveler page; every flow is recorded, including 0-token ones.",
    cols: {
      flow: "Flow",
      calls: "Calls",
      prompt: "Prompt",
      completion: "Completion",
      total: "Total tokens",
      cost: "Cost",
      latency: "Avg latency",
    },
    zero: "answered without the model",
    total: "Total",
    /** One line under each flow id; keyed by FlowName (data), every flow listed. */
    info: {
      propose: "qwen3-32b proposes one payment via a tool call",
      status_fastpath: "balance / status questions answered from the ledger",
      stop_template: "refusal text templated from the stop reasons",
      compare: "thinking on vs off measurement script",
      explain: "model-written explanation",
      audit: "model-assisted audit",
      other: "other model calls",
    } satisfies Record<FlowName, string>,
  },
  comparison: {
    title: "Thinking on vs off",
    description:
      "The propose step with Qwen3 thinking on vs off, same prompts, same tool.",
    emptyTitle: "No comparison measured yet",
    /** Wraps the `npm run compare` command. */
    emptyBody: {
      before: "Run ",
      after: " to measure thinking on vs off on Kiln.",
    },
    toolCalls: "Tool calls (on → off)",
    sameAccuracy: "same accuracy without thinking",
    fewerToolCalls: "fewer tool calls without thinking",
    saved: "Completion tokens saved",
    perProposal: (on: string, off: string) => `${on} → ${off} per proposal`,
    latency: "Avg latency (on → off)",
    measuredOn: "Measured on",
    measuredHint: (date: string, prompts: number) =>
      `${date} · ${prompts} prompts`,
    cols: {
      prompt: "Prompt",
      toolCall: "Tool call on / off",
      completionOn: "Completion on",
      completionOff: "Completion off",
      on: "on",
      off: "off",
      latencyOn: "Latency on",
      latencyOff: "Latency off",
    },
    yes: "yes",
    no: "no",
    /** Quotes a measured prompt (the prompt itself is data and stays English). */
    quote: (prompt: string) => `“${prompt}”`,
    /** Wraps the /no_think switch. */
    footnote: {
      before: "Same production prompt and tool; “off” appends Qwen3’s ",
      after:
        " switch to the user message. Numbers come from the measurement file, not from this page.",
    },
  },
  energy: {
    title: "Energy estimate",
    formula: "energy_Wh = total tokens × J per token ÷ 3600",
    /** Wraps "<n> J/token". */
    assuming: {
      before: "assuming ",
      after: (tokens: string) => ` × ${tokens} tokens`,
    },
    source: "Source of the assumption: ",
    noSource: "not stated — treat as unverified",
    caveat:
      "An estimate, not a measurement: it is only as good as the J/token figure above.",
    notSetTitle: "Assumption not set — see README",
    /** Wraps ENERGY_J_PER_TOKEN, then the token count. */
    notSet: {
      before: "No energy figure is shown until ",
      middle: " and its source are configured. Tokens so far: ",
      after: ".",
    },
  },
  savings: {
    title: "Where the tokens are saved",
    description: "Each one shows up in the numbers on this page.",
    items: [
      {
        title: "Status questions skip the model",
        body: "A rule fast-path answers balance questions from the ledger: status_fastpath, 0 tokens.",
      },
      {
        title: "Refusals are templated",
        body: "STOP text is built from the policy's reason codes: stop_template, 0 tokens, no extra call.",
      },
      {
        title: "Thinking off for proposals",
        body: "Picking a merchant and an amount needs no hidden reasoning; /no_think cuts completion tokens (table above).",
      },
      {
        title: "Compact prompt",
        body: "The catalog goes in as 7 short “id | name | category” lines, never JSON; one tool, one call per request.",
      },
    ],
  },
};

export const ko: typeof en = {
  header: {
    eyebrow: "지표",
    title: "토큰, 비용, 에너지 — 흐름별",
    description:
      "모든 모델 호출은 흐름과 함께 기록됩니다. 모델 없이 처리한 작업도 0토큰 행으로 기록되므로, 생략한 추론이 그대로 보입니다.",
    updated: (rel) => `업데이트: ${rel}`,
    refresh: "새로고침",
  },
  loading: "지표 불러오는 중",
  loadError: "사용량을 불러오지 못했습니다",
  stale: (message) =>
    `이전 수치를 표시하고 있습니다 — 새로고침 실패: ${message}`,
  tiles: {
    statusFastpath: "모델 없이 답한 상태 질문",
    statusFastpathHint: "status_fastpath · 건당 0토큰",
    stopTemplate: "모델 없이 설명한 거절",
    stopTemplateHint: "stop_template · 건당 0토큰",
    cost: "누적 비용",
    costHint: "Kiln usage.cost, 전체 흐름",
    tokens: "누적 토큰",
    tokensHint: (calls) => `기록된 호출 ${calls}건`,
  },
  flows: {
    title: "흐름별 토큰",
    description:
      "usage_records에서 집계했습니다. 초록색 행은 코드로 처리되어 모델을 한 번도 호출하지 않았습니다.",
    emptyTitle: "아직 기록된 모델 사용량이 없습니다",
    emptyBody:
      "출장자 페이지에서 요청을 보내 보세요. 0토큰 흐름을 포함해 모든 흐름이 기록됩니다.",
    cols: {
      flow: "흐름",
      calls: "호출",
      prompt: "프롬프트",
      completion: "출력",
      total: "총 토큰",
      cost: "비용",
      latency: "평균 지연",
    },
    zero: "모델 없이 응답",
    total: "합계",
    info: {
      propose: "qwen3-32b가 도구 호출로 결제 하나를 제안",
      status_fastpath: "잔액·상태 질문을 장부에서 바로 응답",
      stop_template: "중단 사유로 만든 템플릿 거절 문구",
      compare: "사고 모드 켬/끔 측정 스크립트",
      explain: "모델이 작성한 설명",
      audit: "모델 보조 감사",
      other: "기타 모델 호출",
    },
  },
  comparison: {
    title: "사고 모드 켬/끔 비교",
    description:
      "Qwen3 사고 모드를 켰을 때와 껐을 때의 제안 단계를 같은 프롬프트, 같은 도구로 비교합니다.",
    emptyTitle: "아직 측정된 비교가 없습니다",
    emptyBody: {
      before: "",
      after: " 명령을 실행해 Kiln에서 사고 모드 켬/끔을 측정하세요.",
    },
    toolCalls: "도구 호출 (켬 → 끔)",
    sameAccuracy: "사고 모드 없이도 정확도 동일",
    fewerToolCalls: "사고 모드 없이 도구 호출 감소",
    saved: "절감된 출력 토큰",
    perProposal: (on, off) => `제안당 ${on} → ${off}`,
    latency: "평균 지연 (켬 → 끔)",
    measuredOn: "측정 모델",
    measuredHint: (date, prompts) => `${date} · 프롬프트 ${prompts}개`,
    cols: {
      prompt: "프롬프트",
      toolCall: "도구 호출 켬 / 끔",
      completionOn: "출력 (켬)",
      completionOff: "출력 (끔)",
      on: "켬",
      off: "끔",
      latencyOn: "지연 (켬)",
      latencyOff: "지연 (끔)",
    },
    yes: "예",
    no: "아니요",
    quote: (prompt) => `“${prompt}”`,
    footnote: {
      before:
        "운영 환경과 같은 프롬프트와 도구를 씁니다. “끔”은 사용자 메시지에 Qwen3의 ",
      after:
        " 스위치를 덧붙입니다. 수치는 이 페이지가 아니라 측정 파일에서 가져옵니다.",
    },
  },
  energy: {
    title: "에너지 추정",
    formula: "energy_Wh = 총 토큰 × 토큰당 J ÷ 3600",
    assuming: {
      before: "가정: ",
      after: (tokens) => ` × ${tokens} 토큰`,
    },
    source: "가정의 출처: ",
    noSource: "명시되지 않음 — 검증되지 않은 값으로 간주하세요",
    caveat:
      "측정값이 아니라 추정값입니다. 정확도는 위의 J/token 수치에 달려 있습니다.",
    notSetTitle: "가정값 미설정 — README 참고",
    notSet: {
      before: "",
      middle:
        " 값과 그 출처를 설정하기 전에는 에너지 수치를 표시하지 않습니다. 지금까지 토큰 ",
      after: "개를 사용했습니다.",
    },
  },
  savings: {
    title: "토큰을 아끼는 방법",
    description: "각 항목은 이 페이지의 수치에 그대로 나타납니다.",
    items: [
      {
        title: "상태 질문은 모델을 건너뜁니다",
        body: "규칙 기반 빠른 경로가 잔액 질문에 장부로 답합니다: status_fastpath, 0토큰.",
      },
      {
        title: "거절 문구는 템플릿",
        body: "STOP 문구는 정책의 사유 코드로 만듭니다: stop_template, 0토큰, 추가 호출 없음.",
      },
      {
        title: "제안에는 사고 모드 끔",
        body: "가맹점과 금액을 고르는 데는 숨은 추론이 필요 없습니다. /no_think로 출력 토큰을 줄입니다(위 표 참고).",
      },
      {
        title: "간결한 프롬프트",
        body: "가맹점 목록은 JSON이 아니라 짧은 “id | name | category” 7줄로 들어갑니다. 요청마다 도구 하나, 호출 한 번입니다.",
      },
    ],
  },
};

export const ja: typeof en = {
  header: {
    eyebrow: "指標",
    title: "トークン・コスト・エネルギー — フロー別",
    description:
      "すべてのモデル呼び出しはフローとともに記録されます。モデルを使わずに処理した作業も 0 トークンの行として記録されるため、省いた推論が見えます。",
    updated: (rel) => `更新：${rel}`,
    refresh: "更新",
  },
  loading: "指標を読み込み中",
  loadError: "使用量を読み込めませんでした",
  stale: (message) =>
    `前回の数値を表示しています — 更新に失敗しました：${message}`,
  tiles: {
    statusFastpath: "モデルを使わずに答えた状況確認の質問",
    statusFastpathHint: "status_fastpath · 1件あたり 0 トークン",
    stopTemplate: "モデルを使わずに説明した拒否",
    stopTemplateHint: "stop_template · 1件あたり 0 トークン",
    cost: "累計コスト",
    costHint: "Kiln usage.cost、全フロー",
    tokens: "累計トークン",
    tokensHint: (calls) => `記録された呼び出し ${calls} 件`,
  },
  flows: {
    title: "フロー別トークン",
    description:
      "usage_records から集計しています。緑の行はコードで処理され、モデルは一度も呼び出されていません。",
    emptyTitle: "モデルの使用量はまだ記録されていません",
    emptyBody:
      "出張者ページで依頼を送信してください。0 トークンのものも含め、すべてのフローが記録されます。",
    cols: {
      flow: "フロー",
      calls: "呼び出し",
      prompt: "プロンプト",
      completion: "出力",
      total: "合計トークン",
      cost: "コスト",
      latency: "平均レイテンシ",
    },
    zero: "モデルを使わずに応答",
    total: "合計",
    info: {
      propose: "qwen3-32b がツール呼び出しで支払いを1件提案",
      status_fastpath: "残額・状況確認の質問に台帳から回答",
      stop_template: "停止理由からテンプレートで作る拒否文",
      compare: "思考オン／オフの測定スクリプト",
      explain: "モデルが書いた説明",
      audit: "モデル支援の監査",
      other: "その他のモデル呼び出し",
    },
  },
  comparison: {
    title: "思考オン／オフの比較",
    description:
      "Qwen3 の思考をオンにした場合とオフにした場合の提案ステップを、同じプロンプト・同じツールで比較します。",
    emptyTitle: "比較はまだ測定されていません",
    emptyBody: {
      before: "",
      after: " を実行すると、Kiln で思考オン／オフを測定できます。",
    },
    toolCalls: "ツール呼び出し（オン → オフ）",
    sameAccuracy: "思考なしでも精度は同じ",
    fewerToolCalls: "思考なしではツール呼び出しが減少",
    saved: "削減された出力トークン",
    perProposal: (on, off) => `提案あたり ${on} → ${off}`,
    latency: "平均レイテンシ（オン → オフ）",
    measuredOn: "測定モデル",
    measuredHint: (date, prompts) => `${date} · プロンプト ${prompts} 件`,
    cols: {
      prompt: "プロンプト",
      toolCall: "ツール呼び出し オン / オフ",
      completionOn: "出力（オン）",
      completionOff: "出力（オフ）",
      on: "オン",
      off: "オフ",
      latencyOn: "レイテンシ（オン）",
      latencyOff: "レイテンシ（オフ）",
    },
    yes: "はい",
    no: "いいえ",
    quote: (prompt) => `「${prompt}」`,
    footnote: {
      before:
        "本番と同じプロンプトとツールを使います。「オフ」はユーザーメッセージに Qwen3 の ",
      after:
        " スイッチを付け加えます。数値はこのページではなく、測定ファイルから取得しています。",
    },
  },
  energy: {
    title: "エネルギー推定",
    formula: "energy_Wh = 合計トークン × トークンあたりの J ÷ 3600",
    assuming: {
      before: "前提：",
      after: (tokens) => ` × ${tokens} トークン`,
    },
    source: "前提の出典：",
    noSource: "記載なし — 未検証として扱ってください",
    caveat: "測定値ではなく推定値です。精度は上記の J/token の値次第です。",
    notSetTitle: "前提が未設定 — README を参照",
    notSet: {
      before: "",
      middle:
        " とその出典が設定されるまで、エネルギーの数値は表示されません。これまでのトークン数：",
      after: "。",
    },
  },
  savings: {
    title: "トークンを節約している箇所",
    description: "どれもこのページの数値に表れています。",
    items: [
      {
        title: "状況確認の質問はモデルを使わない",
        body: "ルールによる高速パスが、残額の質問に台帳から回答します：status_fastpath、0 トークン。",
      },
      {
        title: "拒否文はテンプレート",
        body: "STOP の文面はポリシーの理由コードから組み立てます：stop_template、0 トークン、追加の呼び出しなし。",
      },
      {
        title: "提案では思考をオフ",
        body: "加盟店と金額を選ぶのに隠れた推論は不要です。/no_think で出力トークンを削減します（上の表を参照）。",
      },
      {
        title: "コンパクトなプロンプト",
        body: "加盟店カタログは JSON ではなく、短い「id | name | category」の 7 行で渡します。ツールは1つ、呼び出しはリクエストごとに1回です。",
      },
    ],
  },
};

export const zh: typeof en = {
  header: {
    eyebrow: "指标",
    title: "token、成本与能耗 — 按流程",
    description:
      "每次模型调用都会连同其流程一起记录。不调用模型完成的工作也会记录为 0 token 的行，因此省下的推理一目了然。",
    updated: (rel) => `更新：${rel}`,
    refresh: "刷新",
  },
  loading: "正在加载指标",
  loadError: "无法加载用量",
  stale: (message) => `正在显示之前的数据 — 刷新失败：${message}`,
  tiles: {
    statusFastpath: "未调用模型即回答的状态问题",
    statusFastpathHint: "status_fastpath · 每次 0 token",
    stopTemplate: "未调用模型即说明的拒绝",
    stopTemplateHint: "stop_template · 每次 0 token",
    cost: "累计成本",
    costHint: "Kiln usage.cost，全部流程",
    tokens: "累计 token",
    tokensHint: (calls) => `已记录 ${calls} 次调用`,
  },
  flows: {
    title: "按流程统计 token",
    description: "由 usage_records 汇总。绿色行由代码处理，从未调用模型。",
    emptyTitle: "尚无模型用量记录",
    emptyBody:
      "请在出差人页面发送请求；所有流程都会被记录，包括 0 token 的流程。",
    cols: {
      flow: "流程",
      calls: "调用",
      prompt: "提示",
      completion: "补全",
      total: "总 token",
      cost: "成本",
      latency: "平均延迟",
    },
    zero: "未调用模型即回答",
    total: "合计",
    info: {
      propose: "qwen3-32b 通过工具调用提议一笔付款",
      status_fastpath: "余额 / 状态问题直接由账本回答",
      stop_template: "根据拦截原因以模板生成拒绝文本",
      compare: "思考开 / 关测量脚本",
      explain: "模型撰写的说明",
      audit: "模型辅助审计",
      other: "其他模型调用",
    },
  },
  comparison: {
    title: "思考开启与关闭对比",
    description:
      "在相同提示、相同工具下，比较提议步骤开启与关闭 Qwen3 思考的结果。",
    emptyTitle: "尚未测量对比",
    emptyBody: {
      before: "运行 ",
      after: " 即可在 Kiln 上测量思考开启与关闭的差异。",
    },
    toolCalls: "工具调用（开 → 关）",
    sameAccuracy: "关闭思考后准确度不变",
    fewerToolCalls: "关闭思考后工具调用减少",
    saved: "节省的补全 token",
    perProposal: (on, off) => `每次提议 ${on} → ${off}`,
    latency: "平均延迟（开 → 关）",
    measuredOn: "测量模型",
    measuredHint: (date, prompts) => `${date} · ${prompts} 条提示`,
    cols: {
      prompt: "提示",
      toolCall: "工具调用 开 / 关",
      completionOn: "补全（开）",
      completionOff: "补全（关）",
      on: "开",
      off: "关",
      latencyOn: "延迟（开）",
      latencyOff: "延迟（关）",
    },
    yes: "是",
    no: "否",
    quote: (prompt) => `“${prompt}”`,
    footnote: {
      before: "使用相同的生产提示和工具；“关”即在用户消息后追加 Qwen3 的 ",
      after: " 开关。数据来自测量文件，而非本页面计算。",
    },
  },
  energy: {
    title: "能耗估算",
    formula: "energy_Wh = 总 token 数 × 每 token 焦耳数 ÷ 3600",
    assuming: {
      before: "假设 ",
      after: (tokens) => ` × ${tokens} token`,
    },
    source: "假设来源：",
    noSource: "未注明 — 请视为未经验证",
    caveat: "这是估算而非测量，其准确度取决于上面的 J/token 数值。",
    notSetTitle: "未设置假设 — 请参阅 README",
    notSet: {
      before: "在配置 ",
      middle: " 及其来源之前，不显示能耗数值。目前的 token 数：",
      after: "。",
    },
  },
  savings: {
    title: "token 省在哪里",
    description: "每一项都体现在本页的数据中。",
    items: [
      {
        title: "状态问题跳过模型",
        body: "规则快速路径直接用账本回答余额问题：status_fastpath，0 token。",
      },
      {
        title: "拒绝文本使用模板",
        body: "STOP 文本由策略的原因代码生成：stop_template，0 token，无额外调用。",
      },
      {
        title: "提议时关闭思考",
        body: "选择商户和金额无需隐藏推理；/no_think 可减少补全 token（见上表）。",
      },
      {
        title: "精简提示",
        body: "商户目录以 7 行简短的“id | name | category”传入，从不使用 JSON；每个请求只用一个工具、调用一次。",
      },
    ],
  },
};
