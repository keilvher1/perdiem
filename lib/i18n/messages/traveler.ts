/**
 * "traveler" namespace. `en` is the reference; the other languages are typed `typeof en`, so a
 * missing key is a compile error.
 *
 * Not translated on purpose: the scripted demo request texts (sent to the model), agent replies,
 * server error messages and codes, mandate ids, flow ids, merchant names and blocked keywords.
 */
export const en = {
  page: {
    title: "Request a payment",
    description:
      "The agent proposes; policy code approves or stops each payment against your mandate and records why.",
    clear: "Clear conversation",
    loadError: "Couldn’t load mandates",
    emptyTitle: "No mandates yet",
    emptyDescription:
      "A principal has to grant a per-diem mandate before the agent can propose anything.",
    grantMandate: "Grant a mandate",
    toastUnreachable: "The agent could not be reached",
    toastOutcomeUnknown: "Outcome unknown: check the ledger before retrying",
    toastSwitched: (id: string) => `Switched to ${id}`,
    toastSwitchedDescription:
      "This scripted request belongs to another mandate.",
    historyTitle: "Decision history",
    historyDescription: (id: string) =>
      `Every approval and stop recorded under ${id}. Select one to see its reason, the 12 rule checks and the raw records.`,
    historyLabel: (id: string) => `Decisions under ${id}`,
    historyError: "Couldn’t load the decision history",
  },
  chat: {
    /** Localized one-line reply shown instead of the server's English text (not used for English). */
    replyHeadline: (decision: "APPROVE" | "STOP", failed: boolean, merchant: string, amount: string) =>
      decision === "STOP"
        ? `Stopped. Nothing was sent to ${merchant} for ${amount}.`
        : failed
          ? `Approved ${merchant} ${amount}, but the broadcast did not confirm. Check the ledger before retrying.`
          : `Approved. Paying ${merchant} ${amount}.`,
    ariaLabel: "Conversation with the agent",
    agent: "Agent",
    you: "You",
    emptyTitle: "No requests yet",
    emptyDescription:
      "Pick a scripted request below or type your own. Every decision comes back as a receipt: what was decided, why, and what the mandate allows.",
    thinking:
      "The agent is proposing a payment; the policy then checks it against the 12 rules.",
    composerLabel: "Message to the agent",
    placeholder: (id: string) => `Ask for a purchase under ${id}…`,
    placeholderNoMandate: "Choose a mandate first",
    send: "Send",
    keyHint: "Enter to send · Shift+Enter for a new line",
    /** Token count next to a flow name; `n` is already formatted. */
    tokens: (n: string) => `${n} tok`,
    noModel: "answered without the model",
    /** Divider when the conversation moves to another mandate: before + <mandate id> + after. */
    dividerBefore: "now acting under ",
    dividerAfter: "",
  },
  chips: {
    heading: "Scripted demo requests",
    fill: "Fill the composer",
    switchAndFill: (id: string) => `Switch to ${id} and fill the composer`,
    forMandate: (id: string) => `for ${id}`,
  },
  errors: {
    notSentTitle: "The request did not go through",
    notSentNote: "Nothing was proposed or paid.",
    tryAgain: "Try again",
    unconfirmedTitle: "The server did not confirm the outcome",
    /** `dropped`: no response arrived at all (HTTP status 0). */
    unconfirmedNote: (dropped: boolean) =>
      `${
        dropped
          ? "No response arrived (the connection dropped), so the outcome is unknown: a payment may have been sent."
          : "The server returned an error without confirming the outcome: a payment may have been sent."
      } Check the ledger before retrying.`,
    openLedger: "Open ledger",
    viewTx: "View tx on Etherscan",
    unrecorded: {
      thisTitle: "A payment may have been broadcast — do not retry",
      earlierTitle:
        "An earlier payment is not in the ledger yet — do not retry",
      thisBody:
        "This payment may already be on its way on Sepolia, but the ledger could not record it. Sending the request again could pay twice.",
      earlierBody:
        "A payment for this mandate may have been broadcast without being recorded. Until the server writes it to the ledger, it evaluates no new spend for this mandate; this request was refused before any evaluation. Do not resend the earlier request: it could pay twice.",
      note: "The server keeps the entry and records it before evaluating anything else for this mandate. Check the ledger or Etherscan instead of retrying.",
    },
  },
  mandate: {
    title: "Your mandate",
    /** Accessible name of the compact status strip (mobile). */
    stripLabel: "Mandate status and remaining budget",
    paused:
      "The principal paused this mandate. New requests are stopped and recorded until it is resumed. A payment already broadcast is not cancelled.",
    revoked:
      "The principal revoked this mandate. Revoking is final: every new request is stopped and recorded. A payment already broadcast is not cancelled.",
    expired: (date: string) =>
      `The trip window closed on ${date}. New requests are stopped and recorded.`,
    scheduled: (date: string) =>
      `The trip window opens on ${date}. Requests before then are stopped and recorded.`,
    remainingNow: "Remaining now",
    ofBudget: (budget: string) => `of ${budget} budget`,
    rulesTitle: "What you can ask for",
    perPayment: (v: string) => `up to ${v}`,
    termsError: "Couldn’t load the mandate terms",
    /** Joins translated category names. */
    listSep: ", ",
  },
  rail: {
    title: "This session",
    replies: "Replies",
    approved: "Approved",
    stopped: "Stopped",
    caption: "Tokens used per flow in this session",
    flow: "Flow",
    calls: "Calls",
    tokens: "Tokens",
    modelCalls: "Model calls",
    kilnCost: "Kiln cost",
    zeroTokenNote:
      "Refusals never call the model: stop reasons are templated from the policy’s codes, and balance questions are answered from the ledger. Both are recorded as 0-token flows.",
    metricsLink: "All flows on Metrics",
    howTitle: "How a request is decided",
    step1: {
      strong: "qwen3-32b on Kiln proposes",
      rest: " one payment through a tool call. It holds no keys.",
    },
    step2: {
      strong: "Policy code checks 12 rules",
      rest: " against the mandate: status, window, merchant, category, keywords, cap, fees, budget, duplicates.",
    },
    step3: {
      approved: "Approved",
      approvedRest:
        " payments go to Sepolia with the mandate and receipt hashes in calldata. ",
      stopped: "Stopped",
      stoppedRest: " ones are recorded with reasons; nothing is sent.",
    },
  },
};

export const ko: typeof en = {
  page: {
    title: "결제 요청",
    description:
      "에이전트가 제안하고, 정책 코드가 위임을 기준으로 결제를 승인하거나 중단한 뒤 그 이유를 기록합니다.",
    clear: "대화 지우기",
    loadError: "위임을 불러오지 못했습니다",
    emptyTitle: "아직 위임이 없습니다",
    emptyDescription:
      "위임자가 출장비 위임을 발급해야 에이전트가 결제를 제안할 수 있습니다.",
    grantMandate: "위임 발급",
    toastUnreachable: "에이전트에 연결할 수 없습니다",
    toastOutcomeUnknown: "결과 불명: 다시 시도하기 전에 장부를 확인하세요",
    toastSwitched: (id: string) => `${id} 위임으로 전환했습니다`,
    toastSwitchedDescription: "이 시나리오 요청은 다른 위임에 속합니다.",
    historyTitle: "결정 이력",
    historyDescription: (id: string) =>
      `${id} 위임에 기록된 모든 승인과 중단입니다. 하나를 선택하면 사유, 12개 규칙 검사, 원본 기록을 볼 수 있습니다.`,
    historyLabel: (id: string) => `${id} 위임의 결정`,
    historyError: "결정 이력을 불러오지 못했습니다",
  },
  chat: {
    replyHeadline: (decision: "APPROVE" | "STOP", failed: boolean, merchant: string, amount: string) =>
      decision === "STOP"
        ? `${merchant} ${amount} 결제를 중단했습니다. 아무것도 보내지 않았습니다.`
        : failed
          ? `${merchant} ${amount} 결제를 승인했지만 전송이 확인되지 않았습니다. 다시 보내기 전에 장부를 확인하세요.`
          : `${merchant} ${amount} 결제를 승인했습니다.`,
    ariaLabel: "에이전트와의 대화",
    agent: "에이전트",
    you: "나",
    emptyTitle: "아직 요청이 없습니다",
    emptyDescription:
      "아래에서 시나리오 요청을 고르거나 직접 입력하세요. 모든 결정은 영수증으로 돌아옵니다. 무엇이 결정되었는지, 왜 그런지, 위임이 무엇을 허용하는지 확인할 수 있습니다.",
    thinking:
      "에이전트가 결제를 제안하고 있습니다. 이어서 정책이 12개 규칙으로 검사합니다.",
    composerLabel: "에이전트에게 보낼 메시지",
    placeholder: (id: string) => `${id} 위임으로 구매 요청…`,
    placeholderNoMandate: "먼저 위임을 선택하세요",
    send: "보내기",
    keyHint: "Enter로 보내기 · Shift+Enter로 줄바꿈",
    tokens: (n: string) => `${n} 토큰`,
    noModel: "모델 호출 없이 응답",
    dividerBefore: "이제부터 ",
    dividerAfter: " 위임으로 진행",
  },
  chips: {
    heading: "시나리오 데모 요청",
    fill: "입력창에 채우기",
    switchAndFill: (id: string) => `${id} 위임으로 전환하고 입력창에 채우기`,
    forMandate: (id: string) => `${id}용`,
  },
  errors: {
    notSentTitle: "요청이 전달되지 않았습니다",
    notSentNote: "아무것도 제안되거나 결제되지 않았습니다.",
    tryAgain: "다시 시도",
    unconfirmedTitle: "서버에서 결과를 확인받지 못했습니다",
    unconfirmedNote: (dropped: boolean) =>
      `${
        dropped
          ? "응답이 오지 않아(연결 끊김) 결과를 알 수 없습니다. 결제가 전송되었을 수 있습니다."
          : "서버가 결과를 확인해 주지 않고 오류를 반환했습니다. 결제가 전송되었을 수 있습니다."
      } 다시 시도하기 전에 장부를 확인하세요.`,
    openLedger: "장부 열기",
    viewTx: "Etherscan에서 tx 보기",
    unrecorded: {
      thisTitle: "결제가 이미 전송되었을 수 있습니다 — 다시 시도하지 마세요",
      earlierTitle: "이전 결제가 아직 장부에 없습니다 — 다시 시도하지 마세요",
      thisBody:
        "이 결제는 이미 Sepolia에서 처리 중일 수 있지만, 장부에 기록하지 못했습니다. 요청을 다시 보내면 두 번 결제될 수 있습니다.",
      earlierBody:
        "이 위임의 결제가 기록되지 않은 채 전송되었을 수 있습니다. 서버는 그 결제를 장부에 기록할 때까지 이 위임의 새 지출을 평가하지 않으며, 이번 요청은 평가 전에 거부되었습니다. 이전 요청을 다시 보내지 마세요. 두 번 결제될 수 있습니다.",
      note: "서버는 이 항목을 보관하고, 이 위임의 다른 요청을 평가하기 전에 먼저 기록합니다. 다시 시도하는 대신 장부나 Etherscan을 확인하세요.",
    },
  },
  mandate: {
    title: "내 위임",
    stripLabel: "위임 상태와 남은 예산",
    paused:
      "위임자가 이 위임을 일시정지했습니다. 재개될 때까지 새 요청은 중단되고 기록됩니다. 이미 전송된 결제는 취소되지 않습니다.",
    revoked:
      "위임자가 이 위임을 철회했습니다. 철회는 되돌릴 수 없으며, 모든 새 요청은 중단되고 기록됩니다. 이미 전송된 결제는 취소되지 않습니다.",
    expired: (date: string) =>
      `출장 기간이 ${date}에 끝났습니다. 새 요청은 중단되고 기록됩니다.`,
    scheduled: (date: string) =>
      `출장 기간은 ${date}에 시작됩니다. 그 전의 요청은 중단되고 기록됩니다.`,
    remainingNow: "현재 잔액",
    ofBudget: (budget: string) => `예산 ${budget} 중`,
    rulesTitle: "요청할 수 있는 범위",
    perPayment: (v: string) => `${v} 이하`,
    termsError: "위임 조건을 불러오지 못했습니다",
    listSep: ", ",
  },
  rail: {
    title: "이번 세션",
    replies: "응답",
    approved: "승인",
    stopped: "중단",
    caption: "이번 세션의 흐름별 토큰 사용량",
    flow: "흐름",
    calls: "호출",
    tokens: "토큰",
    modelCalls: "모델 호출",
    kilnCost: "Kiln 비용",
    zeroTokenNote:
      "거절할 때는 모델을 호출하지 않습니다. 중단 사유는 정책의 사유 코드로 만든 템플릿 문구이고, 잔액 질문은 장부에서 바로 답합니다. 둘 다 0토큰 흐름으로 기록됩니다.",
    metricsLink: "지표에서 모든 흐름 보기",
    howTitle: "요청이 결정되는 방식",
    step1: {
      strong: "Kiln의 qwen3-32b",
      rest: "가 도구 호출로 결제 한 건을 제안합니다. 키는 보유하지 않습니다.",
    },
    step2: {
      strong: "정책 코드가 12개 규칙을 검사",
      rest: "합니다. 위임을 기준으로 상태, 기간, 가맹점, 분류, 키워드, 한도, 수수료, 예산, 중복을 확인합니다.",
    },
    step3: {
      approved: "승인된",
      approvedRest:
        " 결제는 위임 해시와 영수증 해시를 calldata에 담아 Sepolia로 전송됩니다. ",
      stopped: "중단된",
      stoppedRest: " 결제는 사유와 함께 기록되며, 아무것도 전송되지 않습니다.",
    },
  },
};

export const ja: typeof en = {
  page: {
    title: "支払いを依頼",
    description:
      "エージェントが提案し、ポリシーコードが委任に照らして支払いを承認または停止し、その理由を記録します。",
    clear: "会話をクリア",
    loadError: "委任を読み込めませんでした",
    emptyTitle: "委任はまだありません",
    emptyDescription:
      "エージェントが提案できるようになるには、委任者が日当の委任を付与する必要があります。",
    grantMandate: "委任を付与",
    toastUnreachable: "エージェントに接続できませんでした",
    toastOutcomeUnknown: "結果不明：再試行する前に台帳を確認してください",
    toastSwitched: (id: string) => `${id} に切り替えました`,
    toastSwitchedDescription: "このシナリオの依頼は別の委任に属しています。",
    historyTitle: "判定履歴",
    historyDescription: (id: string) =>
      `${id} に記録されたすべての承認と停止です。1 件を選ぶと、理由、12 のルールチェック、元の記録を確認できます。`,
    historyLabel: (id: string) => `${id} の判定`,
    historyError: "判定履歴を読み込めませんでした",
  },
  chat: {
    replyHeadline: (decision: "APPROVE" | "STOP", failed: boolean, merchant: string, amount: string) =>
      decision === "STOP"
        ? `${merchant}への${amount}の支払いを停止しました。何も送金していません。`
        : failed
          ? `${merchant}への${amount}の支払いを承認しましたが、送信を確認できませんでした。再送する前に台帳を確認してください。`
          : `${merchant}への${amount}の支払いを承認しました。`,
    ariaLabel: "エージェントとの会話",
    agent: "エージェント",
    you: "自分",
    emptyTitle: "まだ依頼はありません",
    emptyDescription:
      "下のシナリオ依頼を選ぶか、自分で入力してください。すべての判定はレシートとして返ります。何が決まり、なぜそうなり、委任が何を許可しているかを確認できます。",
    thinking:
      "エージェントが支払いを提案しています。続いてポリシーが 12 のルールでチェックします。",
    composerLabel: "エージェントへのメッセージ",
    placeholder: (id: string) => `${id} の委任で購入を依頼…`,
    placeholderNoMandate: "先に委任を選択してください",
    send: "送信",
    keyHint: "Enter で送信・Shift+Enter で改行",
    tokens: (n: string) => `${n} トークン`,
    noModel: "モデルを使わずに応答",
    dividerBefore: "ここから ",
    dividerAfter: " の委任で実行",
  },
  chips: {
    heading: "シナリオのデモ依頼",
    fill: "入力欄に挿入",
    switchAndFill: (id: string) => `${id} に切り替えて入力欄に挿入`,
    forMandate: (id: string) => `${id} 用`,
  },
  errors: {
    notSentTitle: "依頼は送信されませんでした",
    notSentNote: "提案も支払いも行われていません。",
    tryAgain: "再試行",
    unconfirmedTitle: "サーバーから結果の確認が取れませんでした",
    unconfirmedNote: (dropped: boolean) =>
      `${
        dropped
          ? "応答が届かなかったため（接続が切断されました）、結果は不明です。支払いが送信された可能性があります。"
          : "サーバーは結果を通知しないままエラーを返しました。支払いが送信された可能性があります。"
      }再試行する前に台帳を確認してください。`,
    openLedger: "台帳を開く",
    viewTx: "Etherscan で tx を表示",
    unrecorded: {
      thisTitle:
        "支払いがすでにブロードキャストされた可能性があります — 再試行しないでください",
      earlierTitle:
        "以前の支払いがまだ台帳にありません — 再試行しないでください",
      thisBody:
        "この支払いはすでに Sepolia 上で処理中の可能性がありますが、台帳に記録できませんでした。依頼を再送すると二重に支払われるおそれがあります。",
      earlierBody:
        "この委任の支払いが、記録されないままブロードキャストされた可能性があります。サーバーはそれを台帳に書き込むまで、この委任の新しい支出を評価しません。今回の依頼は評価の前に拒否されました。以前の依頼を再送しないでください。二重に支払われるおそれがあります。",
      note: "サーバーはこのエントリを保持し、この委任について他の評価を行う前に記録します。再試行せず、台帳または Etherscan を確認してください。",
    },
  },
  mandate: {
    title: "あなたの委任",
    stripLabel: "委任の状態と残りの予算",
    paused:
      "委任者がこの委任を一時停止しました。再開されるまで、新しい依頼は停止され記録されます。すでに送信された支払いは取り消されません。",
    revoked:
      "委任者がこの委任を取り消しました。取り消しは元に戻せません。新しい依頼はすべて停止され記録されます。すでに送信された支払いは取り消されません。",
    expired: (date: string) =>
      `出張期間は ${date} に終了しました。新しい依頼は停止され記録されます。`,
    scheduled: (date: string) =>
      `出張期間は ${date} に始まります。それまでの依頼は停止され記録されます。`,
    remainingNow: "現在の残額",
    ofBudget: (budget: string) => `予算 ${budget} のうち`,
    rulesTitle: "依頼できる範囲",
    perPayment: (v: string) => `${v} まで`,
    termsError: "委任の条件を読み込めませんでした",
    listSep: "、",
  },
  rail: {
    title: "このセッション",
    replies: "応答",
    approved: "承認",
    stopped: "停止",
    caption: "このセッションのフロー別トークン使用量",
    flow: "フロー",
    calls: "呼び出し",
    tokens: "トークン",
    modelCalls: "モデル呼び出し",
    kilnCost: "Kiln コスト",
    zeroTokenNote:
      "拒否ではモデルを呼び出しません。停止理由はポリシーのコードからテンプレートで生成し、残額の質問には台帳から回答します。どちらも 0 トークンのフローとして記録されます。",
    metricsLink: "指標ですべてのフローを見る",
    howTitle: "依頼の判定方法",
    step1: {
      strong: "Kiln 上の qwen3-32b",
      rest: " がツール呼び出しで支払いを 1 件提案します。鍵は持ちません。",
    },
    step2: {
      strong: "ポリシーコードが 12 のルール",
      rest: "で提案を委任と照合します：状態、期間、加盟店、カテゴリ、キーワード、上限、手数料、予算、重複。",
    },
    step3: {
      approved: "承認済み",
      approvedRest:
        "の支払いは、委任とレシートのハッシュを calldata に含めて Sepolia に送られます。",
      stopped: "停止",
      stoppedRest: "された支払いは理由とともに記録され、何も送信されません。",
    },
  },
};

export const zh: typeof en = {
  page: {
    title: "申请付款",
    description:
      "代理提出付款，策略代码对照你的授权批准或拦截每一笔付款，并记录原因。",
    clear: "清空对话",
    loadError: "无法加载授权",
    emptyTitle: "暂无授权",
    emptyDescription: "委托方需先授予差旅补贴授权，代理才能提出付款。",
    grantMandate: "授予授权",
    toastUnreachable: "无法连接代理",
    toastOutcomeUnknown: "结果未知：重试前请先查看账本",
    toastSwitched: (id: string) => `已切换到 ${id}`,
    toastSwitchedDescription: "该预设请求属于另一项授权。",
    historyTitle: "判定记录",
    historyDescription: (id: string) =>
      `${id} 下记录的所有批准和拦截。选择一条即可查看原因、12 项规则检查和原始记录。`,
    historyLabel: (id: string) => `${id} 下的判定`,
    historyError: "无法加载判定记录",
  },
  chat: {
    replyHeadline: (decision: "APPROVE" | "STOP", failed: boolean, merchant: string, amount: string) =>
      decision === "STOP"
        ? `已拦截向 ${merchant} 支付 ${amount}，未发送任何款项。`
        : failed
          ? `已批准向 ${merchant} 支付 ${amount}，但未能确认发送。重试前请先查看账本。`
          : `已批准向 ${merchant} 支付 ${amount}。`,
    ariaLabel: "与代理的对话",
    agent: "代理",
    you: "我",
    emptyTitle: "暂无请求",
    emptyDescription:
      "从下方选择预设请求，或自行输入。每项判定都会以收据形式返回：判定结果、原因，以及授权允许的范围。",
    thinking: "代理正在提出付款，随后策略会按 12 条规则进行检查。",
    composerLabel: "发给代理的消息",
    placeholder: (id: string) => `在 ${id} 授权下请求购买…`,
    placeholderNoMandate: "请先选择授权",
    send: "发送",
    keyHint: "Enter 发送，Shift+Enter 换行",
    tokens: (n: string) => `${n} token`,
    noModel: "未调用模型即作答",
    dividerBefore: "此后按 ",
    dividerAfter: " 授权执行",
  },
  chips: {
    heading: "预设演示请求",
    fill: "填入输入框",
    switchAndFill: (id: string) => `切换到 ${id} 并填入输入框`,
    forMandate: (id: string) => `用于 ${id}`,
  },
  errors: {
    notSentTitle: "请求未能送达",
    notSentNote: "未提议，也未付款。",
    tryAgain: "重试",
    unconfirmedTitle: "服务器未确认结果",
    unconfirmedNote: (dropped: boolean) =>
      `${
        dropped
          ? "未收到响应（连接已断开），结果未知：可能已发出付款。"
          : "服务器返回了错误但未确认结果：可能已发出付款。"
      }重试前请先查看账本。`,
    openLedger: "打开账本",
    viewTx: "在 Etherscan 查看 tx",
    unrecorded: {
      thisTitle: "付款可能已广播 — 请勿重试",
      earlierTitle: "之前的一笔付款尚未记入账本 — 请勿重试",
      thisBody:
        "这笔付款可能已在 Sepolia 上发出，但账本未能记录。再次发送请求可能导致重复付款。",
      earlierBody:
        "该授权下可能有一笔付款已广播但未被记录。在服务器将其写入账本之前，不会评估该授权的任何新支出；本次请求在评估前即被拒绝。请勿重新发送之前的请求：可能导致重复付款。",
      note: "服务器会保留该条目，并在评估该授权的其他任何请求之前先将其记录。请查看账本或 Etherscan，不要重试。",
    },
  },
  mandate: {
    title: "你的授权",
    stripLabel: "授权状态和剩余预算",
    paused: "委托方已暂停该授权。在恢复之前，新请求会被拦截并记录。已广播的付款不会被取消。",
    revoked: "委托方已撤销该授权。撤销不可恢复，所有新请求都会被拦截并记录。已广播的付款不会被取消。",
    expired: (date: string) =>
      `差旅期间已于 ${date} 结束。新请求会被拦截并记录。`,
    scheduled: (date: string) =>
      `差旅期间将于 ${date} 开始。在此之前的请求会被拦截并记录。`,
    remainingNow: "当前剩余",
    ofBudget: (budget: string) => `预算 ${budget}`,
    rulesTitle: "可申请的范围",
    perPayment: (v: string) => `不超过 ${v}`,
    termsError: "无法加载授权条款",
    listSep: "、",
  },
  rail: {
    title: "本次会话",
    replies: "回复",
    approved: "已批准",
    stopped: "已拦截",
    caption: "本次会话各流程的 token 用量",
    flow: "流程",
    calls: "调用",
    tokens: "token",
    modelCalls: "模型调用",
    kilnCost: "Kiln 费用",
    zeroTokenNote:
      "拒绝时从不调用模型：拦截原因根据策略的原因代码按模板生成，余额问题直接从账本回答。两者都记录为 0 token 流程。",
    metricsLink: "在指标页查看所有流程",
    howTitle: "请求如何判定",
    step1: {
      strong: "Kiln 上的 qwen3-32b",
      rest: " 通过工具调用提议一笔付款，不持有任何密钥。",
    },
    step2: {
      strong: "策略代码按 12 条规则",
      rest: "对照授权检查：状态、期间、商户、类别、关键词、上限、手续费、预算、重复。",
    },
    step3: {
      approved: "已批准",
      approvedRest:
        "的付款会在 calldata 中附上授权和收据哈希，发送到 Sepolia。",
      stopped: "已拦截",
      stoppedRest: "的付款会连同原因一起记录，不会发送任何内容。",
    },
  },
};
