/**
 * "shell" namespace: header, navigation, footer, language switcher. `en` is the reference: its
 * strings must equal the English UI copy exactly. The other languages are typed `typeof en`.
 */
export const en = {
  footer: {
    event: "Challenge B | FuriosaAI x Bricksum | GWDC 2026 Korea",
    testnet: "Sepolia testnet only · no real money moves",
  },
  language: {
    label: "Language",
  },
  /** Wordmark subtitle (large screens). */
  brand: {
    tagline: "delegated spend, kept inside the line",
  },
  /** Header role tabs; keys match the nav entries in app-shell.tsx. */
  nav: {
    label: "Roles",
    traveler: "Traveler",
    principal: "Principal",
    audit: "Audit",
    metrics: "Metrics",
  },
  /** Context bar under the header. */
  context: {
    mandate: "Mandate",
    mockData: "Mock data",
    mockTooltip:
      "Served from docs/fixtures in the browser. Set NEXT_PUBLIC_API_MODE=live to use the real backend.",
  },
  /** Network badge and its tooltip. */
  health: {
    unreachable: "Backend unreachable",
    checking: "Checking backend",
    degraded: "Degraded",
    nominal: "All systems nominal",
    aria: (state: string) => `Network status: ${state}. Sepolia testnet.`,
    testnet: "Testnet",
    /** `value` is "$4,000", "—" or "…". */
    demoRate: (value: string) => `1 ETH = ${value} demo rate`,
    model: (model: string, available: boolean) =>
      `Model ${model} ${available ? "available" : "NOT available"} on Kiln`,
    wallet: (address: string) => `Agent wallet ${address}`,
    /** `usd` is the formatted whole-dollar value, or null when unknown. */
    balance: (eth: string, usd: string | null) =>
      `Balance ${eth} ETH${usd !== null ? ` (≈ $${usd} at demo rate)` : ""}`,
    rpc: (publicnode: boolean) =>
      `RPC: ${publicnode ? "PublicNode (keyless)" : "custom"}`,
  },
  /** Global mandate picker. */
  mandateSelector: {
    loadFailed: (code: string) => `Couldn’t load mandates (${code}).`,
    loading: "Loading mandates",
    /** "No mandates yet — " + link + "." */
    emptyBefore: "No mandates yet — ",
    emptyLink: "grant one on Principal",
    emptyAfter: ".",
    label: "Selected mandate",
    unknown: (id: string) => `Unknown mandate ${id}`,
    placeholder: "Choose a mandate",
  },
};

export const ko: typeof en = {
  footer: {
    event: "Challenge B | FuriosaAI x Bricksum | GWDC 2026 Korea",
    testnet: "Sepolia 테스트넷 전용 · 실제 돈은 오가지 않습니다",
  },
  language: {
    label: "언어",
  },
  brand: {
    tagline: "위임한 지출, 선을 넘지 않게",
  },
  nav: {
    label: "역할",
    traveler: "출장자",
    principal: "위임자",
    audit: "감사",
    metrics: "지표",
  },
  context: {
    mandate: "위임",
    mockData: "모의 데이터",
    mockTooltip:
      "브라우저에서 docs/fixtures 데이터를 제공합니다. 실제 백엔드를 사용하려면 NEXT_PUBLIC_API_MODE=live로 설정하세요.",
  },
  health: {
    unreachable: "백엔드에 연결할 수 없음",
    checking: "백엔드 확인 중",
    degraded: "일부 기능 저하",
    nominal: "모든 시스템 정상",
    aria: (state: string) => `네트워크 상태: ${state}. Sepolia 테스트넷.`,
    testnet: "테스트넷",
    demoRate: (value: string) => `1 ETH = ${value} (데모 환율)`,
    model: (model: string, available: boolean) =>
      `모델 ${model}: Kiln에서 ${available ? "사용 가능" : "사용 불가"}`,
    wallet: (address: string) => `에이전트 지갑 ${address}`,
    balance: (eth: string, usd: string | null) =>
      `잔액 ${eth} ETH${usd !== null ? ` (데모 환율 기준 ≈ $${usd})` : ""}`,
    rpc: (publicnode: boolean) =>
      `RPC: ${publicnode ? "PublicNode (키 불필요)" : "사용자 지정"}`,
  },
  mandateSelector: {
    loadFailed: (code: string) => `위임 목록을 불러오지 못했습니다(${code}).`,
    loading: "위임 목록 불러오는 중",
    emptyBefore: "아직 위임이 없습니다. ",
    emptyLink: "위임자 화면에서 발급하세요",
    emptyAfter: ".",
    label: "선택된 위임",
    unknown: (id: string) => `알 수 없는 위임 ${id}`,
    placeholder: "위임 선택",
  },
};

export const ja: typeof en = {
  footer: {
    event: "Challenge B | FuriosaAI x Bricksum | GWDC 2026 Korea",
    testnet: "Sepolia テストネット専用 · 実際のお金は動きません",
  },
  language: {
    label: "言語",
  },
  brand: {
    tagline: "委任した支出を、枠の内側に",
  },
  nav: {
    label: "ロール",
    traveler: "出張者",
    principal: "委任者",
    audit: "監査",
    metrics: "指標",
  },
  context: {
    mandate: "委任",
    mockData: "モックデータ",
    mockTooltip:
      "ブラウザ内で docs/fixtures のデータを返しています。実際のバックエンドを使うには NEXT_PUBLIC_API_MODE=live を設定してください。",
  },
  health: {
    unreachable: "バックエンドに接続できません",
    checking: "バックエンドを確認中",
    degraded: "一部機能低下",
    nominal: "すべて正常",
    aria: (state: string) =>
      `ネットワーク状態：${state}。Sepolia テストネット。`,
    testnet: "テストネット",
    demoRate: (value: string) => `1 ETH = ${value}（デモレート）`,
    model: (model: string, available: boolean) =>
      `モデル ${model}：Kilnで${available ? "利用可能" : "利用不可"}`,
    wallet: (address: string) => `エージェントのウォレット ${address}`,
    balance: (eth: string, usd: string | null) =>
      `残高 ${eth} ETH${usd !== null ? `（デモレートで ≈ $${usd}）` : ""}`,
    rpc: (publicnode: boolean) =>
      `RPC：${publicnode ? "PublicNode（キー不要）" : "カスタム"}`,
  },
  mandateSelector: {
    loadFailed: (code: string) => `委任を読み込めませんでした（${code}）。`,
    loading: "委任を読み込み中",
    emptyBefore: "委任はまだありません。",
    emptyLink: "委任者の画面で付与してください",
    emptyAfter: "。",
    label: "選択中の委任",
    unknown: (id: string) => `不明な委任 ${id}`,
    placeholder: "委任を選択",
  },
};

export const zh: typeof en = {
  footer: {
    event: "Challenge B | FuriosaAI x Bricksum | GWDC 2026 Korea",
    testnet: "仅限 Sepolia 测试网 · 不涉及真实资金",
  },
  language: {
    label: "语言",
  },
  brand: {
    tagline: "委托支出，始终不越界",
  },
  nav: {
    label: "角色",
    traveler: "出差人",
    principal: "委托方",
    audit: "审计",
    metrics: "指标",
  },
  context: {
    mandate: "授权",
    mockData: "模拟数据",
    mockTooltip:
      "数据来自浏览器中的 docs/fixtures。设置 NEXT_PUBLIC_API_MODE=live 即可使用真实后端。",
  },
  health: {
    unreachable: "无法连接后端",
    checking: "正在检查后端",
    degraded: "部分降级",
    nominal: "所有系统正常",
    aria: (state: string) => `网络状态：${state}。Sepolia 测试网。`,
    testnet: "测试网",
    demoRate: (value: string) => `1 ETH = ${value}（演示汇率）`,
    model: (model: string, available: boolean) =>
      `模型 ${model}：Kiln 上${available ? "可用" : "不可用"}`,
    wallet: (address: string) => `代理钱包 ${address}`,
    balance: (eth: string, usd: string | null) =>
      `余额 ${eth} ETH${usd !== null ? `（按演示汇率 ≈ $${usd}）` : ""}`,
    rpc: (publicnode: boolean) =>
      `RPC：${publicnode ? "PublicNode（无需密钥）" : "自定义"}`,
  },
  mandateSelector: {
    loadFailed: (code: string) => `无法加载授权（${code}）。`,
    loading: "正在加载授权",
    emptyBefore: "暂无授权。",
    emptyLink: "请在委托方页面授予授权",
    emptyAfter: "。",
    label: "当前授权",
    unknown: (id: string) => `未知授权 ${id}`,
    placeholder: "选择授权",
  },
};
