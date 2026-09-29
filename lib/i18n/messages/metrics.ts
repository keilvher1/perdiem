/**
 * "metrics" namespace: app/metrics/page.tsx. `en` is the reference; the other languages are typed
 * `typeof en`, so a missing key is a compile error. Flow ids (status_fastpath), table names
 * (usage_records), env var names, model ids, commands, file paths and the measured prompts are data
 * and stay as they are in every language.
 *
 * Honesty rules for this page: energy is always called an estimate with its unit and source; the
 * thinking comparison states what was measured (a tool call returned) and what was not (whether the
 * proposed merchant and amount were right), and never calls a setting better on cost alone.
 */
import type { FlowName } from "@/contracts/api";

export const en = {
  header: {
    eyebrow: "Metrics",
    title: "Model usage and efficiency",
    description:
      "Is the model setting efficient while keeping the quality it needs? Tokens, cost, latency and energy per flow on one basis, next to what turning thinking off changed on the same prompts. All figures cover every mandate on this deployment.",
    updated: (rel: string) => `Updated ${rel}`,
    refresh: "Refresh",
    refreshing: "Refreshing…",
  },
  loading: "Loading metrics",
  loadError: "Couldn’t load usage",
  stale: (message: string) => `Showing the previous numbers — refresh failed: ${message}`,
  summary: {
    region: "Totals so far",
    cost: "Cost so far",
    costHint: "Kiln usage.cost, all flows",
    tokens: "Tokens",
    tokensHint: (prompt: string, completion: string) => `${prompt} prompt · ${completion} completion`,
    calls: "Recorded calls",
    callsHint: (inCode: string) => `incl. ${inCode} handled in code, 0 tokens`,
    energy: "Energy",
    estimate: "Estimate",
    energyHint: (j: string) => `at an assumed ${j} J per token`,
    energyNotSet: "Not set",
    energyNotSetHint: "No J-per-token assumption configured",
  },
  flows: {
    title: "By flow",
    description:
      "Grouped from usage_records, every flow on the same basis. Rows with 0 tokens were handled in code and never called the model.",
    emptyTitle: "No model usage recorded yet",
    emptyBody: "Send a request on the Traveler page; every flow is recorded, including 0-token ones.",
    cols: {
      flow: "Flow",
      calls: "Calls",
      prompt: "Prompt tokens",
      completion: "Completion tokens",
      total: "Total tokens",
      cost: "Cost",
      latency: "Avg latency",
      energy: "Energy (est.)",
    },
    noModel: "No model call",
    total: "Total",
    energyMissing: "Energy shows “—” until a J-per-token assumption is configured (see Energy estimate below).",
    /** One line under each flow id; keyed by FlowName (data), every flow listed. */
    info: {
      propose: "the model proposes one payment via a tool call",
      status_fastpath: "balance / status questions answered from the ledger",
      stop_template: "stop text templated from the stop reasons",
      compare: "thinking on vs off measurement script",
      explain: "model-written explanation",
      audit: "model-assisted audit",
      other: "other model calls",
    } satisfies Record<FlowName, string>,
  },
  comparison: {
    title: "Thinking on vs off",
    description:
      "The propose step measured with Qwen3 thinking on and off: same prompts, same system prompt, same propose_payment tool.",
    emptyTitle: "No comparison measured yet",
    /** Wraps the `npm run compare` command. */
    emptyBody: {
      before: "Run ",
      after: " to measure thinking on vs off on Kiln.",
    },
    conditions: {
      region: "Measurement conditions",
      measured: "Measured",
      model: "Model",
      sample: "Sample",
      sampleValue: (prompts: number, calls: number) => `${prompts} prompts × 1 call per setting (${calls} calls)`,
      off: "“Off” means",
      /** Wraps the /no_think switch. */
      offValue: { before: "", after: " appended to the user message" },
      appDefault: "App default",
      /** Wraps KILN_NO_THINK=0. */
      appDefaultValue: { before: "thinking off, unless ", after: "" },
    },
    side: {
      caption: "Both settings side by side",
      measure: "Measure",
      on: "Thinking on",
      off: "Thinking off",
      change: "Off vs on",
      toolCalls: "Tool call returned",
      ofN: (n: number, of: number) => `${n} of ${of}`,
      completion: "Completion tokens (avg)",
      prompt: "Prompt tokens (avg)",
      latency: "Latency (avg)",
      cost: (n: number) => `Cost (${n} calls)`,
      energy: (n: number) => `Est. energy (${n} calls)`,
      same: "same",
    },
    quality: {
      title: "What this says about quality",
      measured: (on: number, off: number, n: number) =>
        `Measured: whether each call returned a propose_payment tool call (thinking on ${on} of ${n}, off ${off} of ${n}).`,
      notMeasured:
        "Not measured: whether the merchant and amount in those calls were right. A matching tool-call rate does not show equal decision quality.",
      policy: "In both settings the policy code checks every proposal against the mandate before anything is sent.",
    },
    perPrompt: {
      title: "Per prompt",
      cols: {
        prompt: "Prompt",
        toolCall: "Tool call",
        completion: "Completion tokens",
        latency: "Latency",
        cost: "Cost",
      },
      onOff: "on / off",
      on: "on",
      off: "off",
    },
    yes: "yes",
    no: "no",
    /** Quotes a measured prompt (the prompt itself is data and stays English). */
    quote: (prompt: string) => `“${prompt}”`,
    /** Under the conditions strip: where the rows come from (live: the measurement file; mock: the fixture). */
    source: "Source: docs/reasoning-comparison.json, written by npm run compare.",
    sourceMock:
      "Mock data: sample rows from docs/fixtures/usage.json, not the measurement file (docs/reasoning-comparison.json).",
    derived:
      "Prompt-token averages, the cost and energy totals and the change column are worked out on this page from these rows. Energy here applies the flat per-token assumption, which ignores the longer decode time with thinking on, so the real saving is likely larger.",
  },
  energy: {
    title: "Energy estimate",
    estimate: "Estimate",
    total: (tokens: string) => `for ${tokens} tokens so far`,
    formulaLabel: "Formula",
    formula: "Wh = tokens × J per token ÷ 3,600",
    unit: "Unit",
    unitValue: "watt-hours (Wh)",
    assumption: "Assumption",
    assumptionValue: (j: string) => `${j} J per token`,
    source: "Source",
    noSource: "Not stated — treat as unverified",
    caveat: "An estimate, not a measurement: only as good as the J-per-token figure and its source.",
    notSetTitle: "No energy figure yet",
    /** Wraps ENERGY_J_PER_TOKEN, then ENERGY_SOURCE, then the token count. */
    notSet: {
      before: "Set ",
      and: " and ",
      middle: " (see README) to show an estimate. Tokens so far: ",
      after: ".",
    },
  },
  savings: {
    title: "Where tokens are saved",
    description: "Choices in the code that keep token use down.",
    statusFastpath: {
      title: "Status questions skip the model",
      body: "A rule fast path answers balance questions from the ledger: status_fastpath, 0 tokens.",
    },
    stopTemplate: {
      title: "Stop explanations are templated",
      body: "The stop text is built from the policy's reason codes: stop_template, 0 tokens, no extra call.",
    },
    thinking: {
      title: "Proposals run with thinking off",
      /** Values from the comparison above, already formatted by the page; "off" first. */
      measured: (x: {
        completionOff: string;
        completionOn: string;
        latencyOff: string;
        latencyOn: string;
        toolOff: number;
        toolOn: number;
        n: number;
      }) =>
        `In the comparison above, thinking off averaged ${x.completionOff} completion tokens (on: ${x.completionOn}) and ${x.latencyOff} latency (on: ${x.latencyOn}); a tool call came back for ${x.toolOff} of ${x.n} prompts (on: ${x.toolOn} of ${x.n}). Whether the proposed merchant and amount were right was not measured.`,
      notMeasured: "The app default (KILN_NO_THINK). Its effect has not been measured here yet: run npm run compare.",
    },
    compactPrompt: {
      title: "Compact prompt",
      body: "The catalog goes in as one short “id | name | category” line per merchant, never JSON; one tool, one call per request.",
    },
  },
};

export const ko: typeof en = {
  header: {
    eyebrow: "지표",
    title: "모델 사용량과 효율",
    description:
      "현재 모델 설정이 필요한 품질을 유지하면서 효율적인지 확인합니다. 흐름별 토큰, 비용, 지연, 에너지를 같은 기준으로 보여 주고, 같은 프롬프트에서 사고 모드를 끈 결과와 나란히 비교합니다. 모든 수치는 이 배포의 전체 위임을 합친 값입니다.",
    updated: (rel) => `업데이트: ${rel}`,
    refresh: "새로고침",
    refreshing: "새로고침 중…",
  },
  loading: "지표 불러오는 중",
  loadError: "사용량을 불러오지 못했습니다",
  stale: (message) => `이전 수치를 표시하고 있습니다 — 새로고침 실패: ${message}`,
  summary: {
    region: "지금까지의 합계",
    cost: "누적 비용",
    costHint: "Kiln usage.cost, 전체 흐름",
    tokens: "토큰",
    tokensHint: (prompt, completion) => `프롬프트 ${prompt} · 출력 ${completion}`,
    calls: "기록된 호출",
    callsHint: (inCode) => `코드로 처리한 0토큰 호출 ${inCode}건 포함`,
    energy: "에너지",
    estimate: "추정",
    energyHint: (j) => `토큰당 ${j} J로 가정`,
    energyNotSet: "미설정",
    energyNotSetHint: "토큰당 J 가정값이 설정되지 않았습니다",
  },
  flows: {
    title: "흐름별",
    description:
      "usage_records에서 집계했으며, 모든 흐름을 같은 기준으로 보여 줍니다. 0토큰 행은 코드로 처리되어 모델을 호출하지 않았습니다.",
    emptyTitle: "아직 기록된 모델 사용량이 없습니다",
    emptyBody: "출장자 페이지에서 요청을 보내 보세요. 0토큰 흐름을 포함해 모든 흐름이 기록됩니다.",
    cols: {
      flow: "흐름",
      calls: "호출",
      prompt: "프롬프트 토큰",
      completion: "출력 토큰",
      total: "총 토큰",
      cost: "비용",
      latency: "평균 지연",
      energy: "에너지(추정)",
    },
    noModel: "모델 호출 없음",
    total: "합계",
    energyMissing: "토큰당 J 가정값을 설정하기 전에는 에너지가 “—”로 표시됩니다(아래 에너지 추정 참고).",
    info: {
      propose: "모델이 도구 호출로 결제 하나를 제안",
      status_fastpath: "잔액·상태 질문을 장부에서 바로 응답",
      stop_template: "중단 사유로 만든 템플릿 중단 문구",
      compare: "사고 모드 켬/끔 측정 스크립트",
      explain: "모델이 작성한 설명",
      audit: "모델 보조 감사",
      other: "기타 모델 호출",
    },
  },
  comparison: {
    title: "사고 모드 켬/끔 비교",
    description:
      "제안 단계를 Qwen3 사고 모드를 켠 상태와 끈 상태로 측정했습니다. 프롬프트, 시스템 프롬프트, propose_payment 도구는 같습니다.",
    emptyTitle: "아직 측정된 비교가 없습니다",
    emptyBody: {
      before: "",
      after: " 명령을 실행해 Kiln에서 사고 모드 켬/끔을 측정하세요.",
    },
    conditions: {
      region: "측정 조건",
      measured: "측정 시각",
      model: "모델",
      sample: "표본",
      sampleValue: (prompts, calls) => `프롬프트 ${prompts}개 × 설정별 1회 호출(총 ${calls}회)`,
      off: "“끔”의 의미",
      offValue: { before: "사용자 메시지에 ", after: " 추가" },
      appDefault: "앱 기본값",
      appDefaultValue: { before: "사고 모드 끔(", after: "이면 켬)" },
    },
    side: {
      caption: "두 설정 나란히 보기",
      measure: "항목",
      on: "사고 켬",
      off: "사고 끔",
      change: "켬 대비 끔",
      toolCalls: "도구 호출 반환",
      ofN: (n, of) => `${of}건 중 ${n}건`,
      completion: "출력 토큰(평균)",
      prompt: "프롬프트 토큰(평균)",
      latency: "지연(평균)",
      cost: (n) => `비용(${n}회 호출)`,
      energy: (n) => `에너지 추정(${n}회 호출)`,
      same: "같음",
    },
    quality: {
      title: "품질에 대해 알 수 있는 것",
      measured: (on, off, n) =>
        `측정한 것: 각 호출이 propose_payment 도구 호출을 반환했는지입니다(사고 켬 ${n}건 중 ${on}건, 끔 ${n}건 중 ${off}건).`,
      notMeasured:
        "측정하지 않은 것: 그 호출의 가맹점과 금액이 맞았는지입니다. 도구 호출 비율이 같다고 판단 품질이 같다는 뜻은 아닙니다.",
      policy: "두 설정 모두, 무엇이든 전송하기 전에 정책 코드가 모든 제안을 위임과 대조합니다.",
    },
    perPrompt: {
      title: "프롬프트별",
      cols: {
        prompt: "프롬프트",
        toolCall: "도구 호출",
        completion: "출력 토큰",
        latency: "지연",
        cost: "비용",
      },
      onOff: "켬 / 끔",
      on: "켬",
      off: "끔",
    },
    yes: "예",
    no: "아니요",
    quote: (prompt) => `“${prompt}”`,
    source: "출처: docs/reasoning-comparison.json(npm run compare로 생성).",
    sourceMock:
      "모의 데이터: 측정 파일(docs/reasoning-comparison.json)이 아니라 docs/fixtures/usage.json의 예시 행입니다.",
    derived: "프롬프트 토큰 평균, 비용·에너지 합계, 변화 열은 이 행들로 이 페이지에서 계산합니다. 여기서 에너지는 토큰당 고정 가정을 적용하므로 사고 모드를 켰을 때 늘어나는 디코딩 시간은 반영하지 않습니다. 실제 절감 폭은 이보다 클 가능성이 큽니다.",
  },
  energy: {
    title: "에너지 추정",
    estimate: "추정",
    total: (tokens) => `지금까지 토큰 ${tokens}개 기준`,
    formulaLabel: "계산식",
    formula: "Wh = 토큰 × 토큰당 J ÷ 3,600",
    unit: "단위",
    unitValue: "와트시(Wh)",
    assumption: "가정",
    assumptionValue: (j) => `토큰당 ${j} J`,
    source: "출처",
    noSource: "명시되지 않음 — 검증되지 않은 값으로 간주하세요",
    caveat: "측정값이 아니라 추정값입니다. 정확도는 토큰당 J 값과 그 출처에 달려 있습니다.",
    notSetTitle: "아직 에너지 수치가 없습니다",
    notSet: {
      before: "",
      and: " 값과 ",
      middle: " 값을 설정하면(README 참고) 추정값이 표시됩니다. 지금까지 사용한 토큰은 ",
      after: "개입니다.",
    },
  },
  savings: {
    title: "토큰을 아끼는 곳",
    description: "토큰 사용을 줄이는 코드상의 선택입니다.",
    statusFastpath: {
      title: "상태 질문은 모델을 건너뜁니다",
      body: "규칙 기반 빠른 경로가 잔액 질문에 장부로 답합니다: status_fastpath, 0토큰.",
    },
    stopTemplate: {
      title: "중단 설명은 템플릿으로 만듭니다",
      body: "중단 문구는 정책의 사유 코드로 만듭니다: stop_template, 0토큰, 추가 호출 없음.",
    },
    thinking: {
      title: "제안은 사고 모드를 끄고 실행합니다",
      measured: (x) =>
        `위 비교에서 사고 모드를 끄면 평균 출력 토큰은 ${x.completionOff}(켬: ${x.completionOn}), 평균 지연은 ${x.latencyOff}(켬: ${x.latencyOn})였고, 도구 호출은 프롬프트 ${x.n}개 중 ${x.toolOff}개에서 반환되었습니다(켬: ${x.toolOn}개). 제안한 가맹점과 금액이 맞았는지는 측정하지 않았습니다.`,
      notMeasured:
        "앱 기본값입니다(KILN_NO_THINK). 여기서는 아직 효과를 측정하지 않았습니다. npm run compare를 실행하세요.",
    },
    compactPrompt: {
      title: "간결한 프롬프트",
      body: "가맹점 목록은 JSON이 아니라 가맹점마다 짧은 “id | name | category” 한 줄로 들어갑니다. 요청마다 도구 하나, 호출 한 번입니다.",
    },
  },
};

export const ja: typeof en = {
  header: {
    eyebrow: "指標",
    title: "モデルの使用量と効率",
    description:
      "現在のモデル設定が、必要な品質を保ちながら効率的かを確認します。フローごとのトークン、コスト、レイテンシ、エネルギーを同じ基準で示し、同じプロンプトで思考をオフにした結果と並べて比較します。すべての数値は、このデプロイ上の全委任の合計です。",
    updated: (rel) => `更新：${rel}`,
    refresh: "更新",
    refreshing: "更新中…",
  },
  loading: "指標を読み込み中",
  loadError: "使用量を読み込めませんでした",
  stale: (message) => `前回の数値を表示しています — 更新に失敗しました：${message}`,
  summary: {
    region: "これまでの合計",
    cost: "累計コスト",
    costHint: "Kiln usage.cost、全フロー",
    tokens: "トークン",
    tokensHint: (prompt, completion) => `入力 ${prompt} · 出力 ${completion}`,
    calls: "記録された呼び出し",
    callsHint: (inCode) => `コードで処理した 0 トークンの ${inCode} 件を含む`,
    energy: "エネルギー",
    estimate: "推定",
    energyHint: (j) => `トークンあたり ${j} J と仮定`,
    energyNotSet: "未設定",
    energyNotSetHint: "トークンあたりの J の前提が設定されていません",
  },
  flows: {
    title: "フロー別",
    description:
      "usage_records から集計し、すべてのフローを同じ基準で示します。0 トークンの行はコードで処理され、モデルは呼び出されていません。",
    emptyTitle: "モデルの使用量はまだ記録されていません",
    emptyBody: "出張者ページで依頼を送信してください。0 トークンのものも含め、すべてのフローが記録されます。",
    cols: {
      flow: "フロー",
      calls: "呼び出し",
      prompt: "入力トークン",
      completion: "出力トークン",
      total: "合計トークン",
      cost: "コスト",
      latency: "平均レイテンシ",
      energy: "エネルギー（推定）",
    },
    noModel: "モデル呼び出しなし",
    total: "合計",
    energyMissing:
      "トークンあたりの J の前提を設定するまで、エネルギーは「—」と表示されます（下のエネルギー推定を参照）。",
    info: {
      propose: "モデルがツール呼び出しで支払いを1件提案",
      status_fastpath: "残額・状況確認の質問に台帳から回答",
      stop_template: "停止理由からテンプレートで作る停止の文面",
      compare: "思考オン／オフの測定スクリプト",
      explain: "モデルが書いた説明",
      audit: "モデル支援の監査",
      other: "その他のモデル呼び出し",
    },
  },
  comparison: {
    title: "思考オン／オフの比較",
    description:
      "提案ステップを Qwen3 の思考オンとオフで測定しました。プロンプト、システムプロンプト、propose_payment ツールは同じです。",
    emptyTitle: "比較はまだ測定されていません",
    emptyBody: {
      before: "",
      after: " を実行すると、Kiln で思考オン／オフを測定できます。",
    },
    conditions: {
      region: "測定条件",
      measured: "測定日時",
      model: "モデル",
      sample: "サンプル",
      sampleValue: (prompts, calls) => `プロンプト ${prompts} 件 × 設定ごとに 1 回（計 ${calls} 回）`,
      off: "「オフ」の意味",
      offValue: { before: "ユーザーメッセージに ", after: " を付加" },
      appDefault: "アプリの既定値",
      appDefaultValue: { before: "思考オフ（", after: " の場合を除く）" },
    },
    side: {
      caption: "2つの設定を並べて比較",
      measure: "項目",
      on: "思考オン",
      off: "思考オフ",
      change: "オンに対するオフ",
      toolCalls: "ツール呼び出しの返却",
      ofN: (n, of) => `${of} 件中 ${n} 件`,
      completion: "出力トークン（平均）",
      prompt: "入力トークン（平均）",
      latency: "レイテンシ（平均）",
      cost: (n) => `コスト（${n} 回）`,
      energy: (n) => `推定エネルギー（${n} 回）`,
      same: "同じ",
    },
    quality: {
      title: "品質についてわかること",
      measured: (on, off, n) =>
        `測定したこと：各呼び出しが propose_payment のツール呼び出しを返したかどうか（思考オン ${n} 件中 ${on} 件、オフ ${n} 件中 ${off} 件）。`,
      notMeasured:
        "測定していないこと：その呼び出しの加盟店と金額が正しかったかどうか。ツール呼び出しの割合が同じでも、判定の品質が同じとは言えません。",
      policy: "どちらの設定でも、何かを送信する前に、ポリシーのコードがすべての提案を委任と照合します。",
    },
    perPrompt: {
      title: "プロンプト別",
      cols: {
        prompt: "プロンプト",
        toolCall: "ツール呼び出し",
        completion: "出力トークン",
        latency: "レイテンシ",
        cost: "コスト",
      },
      onOff: "オン / オフ",
      on: "オン",
      off: "オフ",
    },
    yes: "はい",
    no: "いいえ",
    quote: (prompt) => `「${prompt}」`,
    source: "出典：docs/reasoning-comparison.json（npm run compare で生成）。",
    sourceMock:
      "モックデータ：測定ファイル（docs/reasoning-comparison.json）ではなく、docs/fixtures/usage.json のサンプル行です。",
    derived: "入力トークンの平均、コストとエネルギーの合計、変化の列は、これらの行からこのページで計算しています。ここでのエネルギーはトークン当たりの一定の仮定を当てはめたもので、思考モードをオンにしたときに長くなるデコード時間は含みません。実際の削減幅はこれより大きい可能性があります。",
  },
  energy: {
    title: "エネルギー推定",
    estimate: "推定",
    total: (tokens) => `これまでの ${tokens} トークン分`,
    formulaLabel: "計算式",
    formula: "Wh = トークン × トークンあたりの J ÷ 3,600",
    unit: "単位",
    unitValue: "ワット時（Wh）",
    assumption: "前提",
    assumptionValue: (j) => `トークンあたり ${j} J`,
    source: "出典",
    noSource: "記載なし — 未検証として扱ってください",
    caveat: "測定値ではなく推定値です。精度はトークンあたりの J の値とその出典次第です。",
    notSetTitle: "エネルギーの数値はまだありません",
    notSet: {
      before: "",
      and: " と ",
      middle: " を設定すると（README を参照）、推定値が表示されます。これまでのトークン数：",
      after: "。",
    },
  },
  savings: {
    title: "トークンを節約している箇所",
    description: "トークンの使用量を抑えるための、コード上の工夫です。",
    statusFastpath: {
      title: "状況確認の質問はモデルを使わない",
      body: "ルールによる高速パスが、残額の質問に台帳から回答します：status_fastpath、0 トークン。",
    },
    stopTemplate: {
      title: "停止の説明はテンプレート",
      body: "停止の文面はポリシーの理由コードから組み立てます：stop_template、0 トークン、追加の呼び出しなし。",
    },
    thinking: {
      title: "提案は思考オフで実行",
      measured: (x) =>
        `上の比較では、思考オフの平均出力トークンは ${x.completionOff}（オン：${x.completionOn}）、平均レイテンシは ${x.latencyOff}（オン：${x.latencyOn}）で、ツール呼び出しはプロンプト ${x.n} 件中 ${x.toolOff} 件で返りました（オン：${x.toolOn} 件）。提案した加盟店と金額が正しかったかどうかは測定していません。`,
      notMeasured:
        "アプリの既定値です（KILN_NO_THINK）。ここではまだ効果を測定していません。npm run compare を実行してください。",
    },
    compactPrompt: {
      title: "コンパクトなプロンプト",
      body: "加盟店カタログは JSON ではなく、加盟店ごとに短い「id | name | category」の1行で渡します。ツールは1つ、呼び出しはリクエストごとに1回です。",
    },
  },
};

export const zh: typeof en = {
  header: {
    eyebrow: "指标",
    title: "模型用量与效率",
    description:
      "当前模型设置能否在保持所需质量的同时保持高效？按相同口径列出各流程的 token、成本、延迟与能耗，并与同一组提示下关闭思考的结果并列对比。所有数字均为本部署中全部授权的合计。",
    updated: (rel) => `更新：${rel}`,
    refresh: "刷新",
    refreshing: "正在刷新…",
  },
  loading: "正在加载指标",
  loadError: "无法加载用量",
  stale: (message) => `正在显示之前的数据 — 刷新失败：${message}`,
  summary: {
    region: "截至目前的合计",
    cost: "累计成本",
    costHint: "Kiln usage.cost，全部流程",
    tokens: "token",
    tokensHint: (prompt, completion) => `提示 ${prompt} · 补全 ${completion}`,
    calls: "已记录调用",
    callsHint: (inCode) => `含 ${inCode} 次由代码处理的 0 token 调用`,
    energy: "能耗",
    estimate: "估算",
    energyHint: (j) => `假设每 token ${j} J`,
    energyNotSet: "未设置",
    energyNotSetHint: "尚未配置每 token 焦耳数假设",
  },
  flows: {
    title: "按流程",
    description: "由 usage_records 汇总，所有流程采用相同口径。0 token 的行由代码处理，未调用模型。",
    emptyTitle: "尚无模型用量记录",
    emptyBody: "请在出差人页面发送请求；所有流程都会被记录，包括 0 token 的流程。",
    cols: {
      flow: "流程",
      calls: "调用",
      prompt: "提示 token",
      completion: "补全 token",
      total: "总 token",
      cost: "成本",
      latency: "平均延迟",
      energy: "能耗（估算）",
    },
    noModel: "未调用模型",
    total: "合计",
    energyMissing: "在配置每 token 焦耳数假设之前，能耗显示为“—”（见下方能耗估算）。",
    info: {
      propose: "模型通过工具调用提议一笔付款",
      status_fastpath: "余额 / 状态问题直接由账本回答",
      stop_template: "根据拦截原因以模板生成拦截说明",
      compare: "思考开 / 关测量脚本",
      explain: "模型撰写的说明",
      audit: "模型辅助审计",
      other: "其他模型调用",
    },
  },
  comparison: {
    title: "思考开启与关闭对比",
    description: "在开启与关闭 Qwen3 思考的情况下测量提议步骤：提示、系统提示和 propose_payment 工具均相同。",
    emptyTitle: "尚未测量对比",
    emptyBody: {
      before: "运行 ",
      after: " 即可在 Kiln 上测量思考开启与关闭的差异。",
    },
    conditions: {
      region: "测量条件",
      measured: "测量时间",
      model: "模型",
      sample: "样本",
      sampleValue: (prompts, calls) => `${prompts} 条提示 × 每种设置 1 次调用（共 ${calls} 次）`,
      off: "“关闭”的含义",
      offValue: { before: "在用户消息后追加 ", after: "" },
      appDefault: "应用默认值",
      appDefaultValue: { before: "关闭思考（除非设置 ", after: "）" },
    },
    side: {
      caption: "两种设置并列",
      measure: "项目",
      on: "开启思考",
      off: "关闭思考",
      change: "关闭相对开启",
      toolCalls: "返回工具调用",
      ofN: (n, of) => `${n}/${of}`,
      completion: "补全 token（平均）",
      prompt: "提示 token（平均）",
      latency: "延迟（平均）",
      cost: (n) => `成本（${n} 次调用）`,
      energy: (n) => `估算能耗（${n} 次调用）`,
      same: "相同",
    },
    quality: {
      title: "关于质量能说明什么",
      measured: (on, off, n) =>
        `已测量：每次调用是否返回了 propose_payment 工具调用（开启思考 ${on}/${n}，关闭 ${off}/${n}）。`,
      notMeasured: "未测量：这些调用中的商户和金额是否正确。工具调用率相同，并不代表决策质量相同。",
      policy: "两种设置下，策略代码都会在发送任何内容之前，将每个提议与授权进行核对。",
    },
    perPrompt: {
      title: "逐条提示",
      cols: {
        prompt: "提示",
        toolCall: "工具调用",
        completion: "补全 token",
        latency: "延迟",
        cost: "成本",
      },
      onOff: "开 / 关",
      on: "开",
      off: "关",
    },
    yes: "是",
    no: "否",
    quote: (prompt) => `“${prompt}”`,
    source: "来源：docs/reasoning-comparison.json（由 npm run compare 生成）。",
    sourceMock: "模拟数据：示例行来自 docs/fixtures/usage.json，而非测量文件（docs/reasoning-comparison.json）。",
    derived: "提示 token 平均值、成本与能耗合计以及变化列，均由本页根据这些行计算。此处能耗按每 token 固定假设计算，未计入开启思考模式时更长的解码时间，因此实际节省可能更大。",
  },
  energy: {
    title: "能耗估算",
    estimate: "估算",
    total: (tokens) => `基于目前的 ${tokens} 个 token`,
    formulaLabel: "公式",
    formula: "Wh = token 数 × 每 token 焦耳数 ÷ 3,600",
    unit: "单位",
    unitValue: "瓦时（Wh）",
    assumption: "假设",
    assumptionValue: (j) => `每 token ${j} J`,
    source: "来源",
    noSource: "未注明 — 请视为未经验证",
    caveat: "这是估算而非测量，其准确度取决于每 token 焦耳数及其来源。",
    notSetTitle: "暂无能耗数据",
    notSet: {
      before: "配置 ",
      and: " 和 ",
      middle: "（见 README）后即可显示估算值。目前的 token 数：",
      after: "。",
    },
  },
  savings: {
    title: "token 省在哪里",
    description: "代码中减少 token 用量的设计。",
    statusFastpath: {
      title: "状态问题跳过模型",
      body: "规则快速路径直接用账本回答余额问题：status_fastpath，0 token。",
    },
    stopTemplate: {
      title: "拦截说明使用模板",
      body: "拦截文本由策略的原因代码生成：stop_template，0 token，无额外调用。",
    },
    thinking: {
      title: "提议时关闭思考",
      measured: (x) =>
        `在上面的对比中，关闭思考时平均补全 token 为 ${x.completionOff}（开启：${x.completionOn}），平均延迟为 ${x.latencyOff}（开启：${x.latencyOn}）；${x.n} 条提示中有 ${x.toolOff} 条返回了工具调用（开启：${x.toolOn} 条）。提议的商户和金额是否正确未作测量。`,
      notMeasured: "这是应用默认值（KILN_NO_THINK）。此处尚未测量其效果：请运行 npm run compare。",
    },
    compactPrompt: {
      title: "精简提示",
      body: "商户目录按每个商户一行简短的“id | name | category”传入，从不使用 JSON；每个请求只用一个工具、调用一次。",
    },
  },
};
