/**
 * "bills" namespace: the bill drop on the traveler screen (components/perdiem/bill-drop.tsx).
 * Read directly by the component (`BILLS[useLocale()]`), not through lib/i18n/messages/index.ts.
 * `en` is the reference; the other languages are typed `typeof en`.
 *
 * Not translated on purpose: the request text "Pay this bill from …" (it is sent to the model, like
 * the scripted demo requests), merchant names, item lines and the raw text read from the file.
 */
export const en = {
  attach: "Attach bill",
  dropHint: "or drop a bill, receipt or invoice here",
  formats: "PDF, PNG, JPG, WEBP or TXT, up to 5 MB",
  local: "Read on this device; only the request is sent.",
  semantics:
    "PerDiem pays the merchant named on the bill, inside the mandate. It is not a reimbursement to you.",
  noMandate: "Choose a mandate to attach a bill",
  dropzoneTitle: "Drop a bill, receipt or invoice",
  or: "or",
  overlay: {
    title: "Drop the bill to read it",
    disabled: "Choose a mandate before dropping a bill",
    busy: "Wait until the current request is decided",
  },
  reading: {
    title: (name: string) => `Reading ${name}`,
    text: "Reading the text file.",
    pdf: "Reading the PDF’s text.",
    image:
      "Recognizing the text in the image. The first image takes a few seconds while the reader loads.",
    cancel: "Cancel",
  },
  preview: {
    eyebrow: "Bill read",
    source: {
      text: "Text file",
      pdf: "PDF text",
      image: "Image, English text recognition",
    },
    merchant: "Merchant",
    total: "Total",
    date: "Date",
    items: "Items",
    notFound: "Not found",
    moreItems: (n: number) => `+${n} more (included in the request)`,
    request: "Request sent to the agent",
    raw: "Text read from the file",
    pay: "Pay this bill",
    edit: "Edit as request",
    discard: "Discard",
    /** Under the actions; `id` = the mandate the request goes to. */
    decides: (id: string | null) =>
      `The agent proposes the payment; the policy approves or stops it, exactly as for a typed request.${id ? ` Pays under ${id}.` : ""}`,
    blockedTitle: "Not payable in one click",
    blockedBody:
      "One click needs a catalog merchant and a total in USD. Edit the request instead.",
    close: "Discard this bill",
  },
  /** Why one click is not offered. */
  missing: {
    merchant_not_found: "Merchant not found: no catalog merchant is named on the bill.",
    merchant_ambiguous: (names: string) =>
      `More than one catalog merchant is named on the bill (${names}).`,
    total_not_found: "Total not found.",
    subtotal_only: "Total not found: only a subtotal is printed.",
    total_not_usd: (currency: string) =>
      `Amount is in ${currency} — PerDiem pays in USD; edit the request.`,
    currency_unknown:
      "The bill doesn’t say which currency the total is in; edit the request.",
    total_negative: "The total is negative (a refund or credit), so there is nothing to pay.",
    nothing_due: "The bill shows nothing left to pay (amount due 0): it is already paid.",
    too_long:
      "The bill has too many item lines for one request; edit the request to shorten it.",
  },
  /** How a field was read (shown, not blocking). */
  notes: {
    merchant_approximate: (name: string) =>
      `Read as ${name}; the text on the bill differs slightly. Check it.`,
    totals_disagree:
      "The bill prints more than one total; the grand total or amount due was used.",
    date_ambiguous: "The date can be read two ways, so it is left out.",
  },
  errors: {
    title: "Couldn’t read this file",
    unsupported: "Only PDF, PNG, JPG, WEBP and TXT files can be read.",
    too_large: "The file is larger than 5 MB.",
    empty: "The file is empty.",
    no_text:
      "No text was found. For a scanned PDF, drop a photo or screenshot of the bill instead.",
    ocr_unavailable:
      "Text recognition isn’t available in this browser. Drop the bill as a PDF or text file.",
    read_failed: "The file couldn’t be read. It may be damaged or password-protected.",
    one_file: "Drop one bill at a time.",
    another: "Choose another file",
    dismiss: "Dismiss",
  },
  /** Live-region announcement once a bill is read. */
  announceRead: (name: string) => `${name} read. Check the bill before paying.`,
};

export const ko: typeof en = {
  attach: "청구서 첨부",
  dropHint: "또는 청구서·영수증·인보이스를 여기에 끌어다 놓으세요",
  formats: "PDF, PNG, JPG, WEBP, TXT · 최대 5MB",
  local: "파일은 이 기기에서 읽고, 요청만 전송합니다.",
  semantics:
    "PerDiem은 청구서에 적힌 가맹점에 위임 범위 안에서 결제합니다. 출장자에게 돌려주는 환급이 아닙니다.",
  noMandate: "청구서를 첨부하려면 먼저 위임을 선택하세요",
  dropzoneTitle: "청구서·영수증·인보이스를 끌어다 놓으세요",
  or: "또는",
  overlay: {
    title: "놓으면 청구서를 읽습니다",
    disabled: "청구서를 놓기 전에 위임을 선택하세요",
    busy: "진행 중인 요청이 결정될 때까지 기다리세요",
  },
  reading: {
    title: (name: string) => `${name} 읽는 중`,
    text: "텍스트 파일을 읽고 있습니다.",
    pdf: "PDF의 텍스트를 읽고 있습니다.",
    image:
      "이미지의 글자를 인식하고 있습니다. 첫 이미지는 인식기를 불러오느라 몇 초 걸립니다.",
    cancel: "취소",
  },
  preview: {
    eyebrow: "읽은 청구서",
    source: {
      text: "텍스트 파일",
      pdf: "PDF 텍스트",
      image: "이미지 · 영어 문자 인식",
    },
    merchant: "가맹점",
    total: "합계",
    date: "날짜",
    items: "품목",
    notFound: "찾지 못함",
    moreItems: (n: number) => `외 ${n}개 (요청에 포함)`,
    request: "에이전트에게 보낼 요청",
    raw: "파일에서 읽은 텍스트",
    pay: "이 청구서 결제",
    edit: "요청으로 수정",
    discard: "버리기",
    decides: (id: string | null) =>
      `에이전트가 결제를 제안하고, 정책이 직접 입력한 요청과 똑같이 승인하거나 중단합니다.${id ? ` ${id} 위임으로 결제합니다.` : ""}`,
    blockedTitle: "한 번에 결제할 수 없습니다",
    blockedBody:
      "한 번에 결제하려면 카탈로그 가맹점과 USD 합계가 필요합니다. 요청으로 수정하세요.",
    close: "이 청구서 버리기",
  },
  missing: {
    merchant_not_found: "가맹점을 찾지 못했습니다. 청구서에 카탈로그 가맹점 이름이 없습니다.",
    merchant_ambiguous: (names: string) =>
      `청구서에 카탈로그 가맹점이 둘 이상 적혀 있습니다(${names}).`,
    total_not_found: "합계를 찾지 못했습니다.",
    subtotal_only: "합계를 찾지 못했습니다. 소계만 적혀 있습니다.",
    total_not_usd: (currency: string) =>
      `금액이 ${currency}입니다. PerDiem은 USD로 결제하니 요청을 수정하세요.`,
    currency_unknown: "청구서에 합계의 통화가 없습니다. 요청을 수정하세요.",
    total_negative: "합계가 음수(환불 또는 크레딧)라서 결제할 금액이 없습니다.",
    nothing_due: "청구서에 남은 결제 금액이 0입니다. 이미 결제된 청구서입니다.",
    too_long: "품목 줄이 너무 많아 한 번의 요청에 담을 수 없습니다. 요청을 수정해 줄이세요.",
  },
  notes: {
    merchant_approximate: (name: string) =>
      `${name}(으)로 읽었습니다. 청구서의 글자와 조금 다르니 확인하세요.`,
    totals_disagree:
      "청구서에 합계가 여러 개 있어 총합계 또는 청구 금액을 사용했습니다.",
    date_ambiguous: "날짜를 두 가지로 읽을 수 있어 비워 두었습니다.",
  },
  errors: {
    title: "이 파일을 읽을 수 없습니다",
    unsupported: "PDF, PNG, JPG, WEBP, TXT 파일만 읽을 수 있습니다.",
    too_large: "파일이 5MB보다 큽니다.",
    empty: "빈 파일입니다.",
    no_text:
      "텍스트를 찾지 못했습니다. 스캔한 PDF라면 청구서 사진이나 스크린샷을 놓으세요.",
    ocr_unavailable:
      "이 브라우저에서는 문자 인식을 쓸 수 없습니다. 청구서를 PDF나 텍스트 파일로 놓으세요.",
    read_failed: "파일을 읽을 수 없습니다. 손상되었거나 암호가 걸려 있을 수 있습니다.",
    one_file: "청구서는 한 번에 하나씩 놓으세요.",
    another: "다른 파일 선택",
    dismiss: "닫기",
  },
  announceRead: (name: string) => `${name}을(를) 읽었습니다. 결제 전에 내용을 확인하세요.`,
};

export const ja: typeof en = {
  attach: "請求書を添付",
  dropHint: "または請求書・領収書・インボイスをここにドロップしてください",
  formats: "PDF・PNG・JPG・WEBP・TXT、5MBまで",
  local: "ファイルはこの端末で読み取り、送信するのはリクエストだけです。",
  semantics:
    "PerDiemは請求書に記載された加盟店へ、委任の範囲内で支払います。出張者への立替精算ではありません。",
  noMandate: "請求書を添付するには、先に委任を選んでください",
  dropzoneTitle: "請求書・領収書・インボイスをドロップしてください",
  or: "または",
  overlay: {
    title: "ドロップすると請求書を読み取ります",
    disabled: "請求書をドロップする前に委任を選んでください",
    busy: "処理中のリクエストが決まるまでお待ちください",
  },
  reading: {
    title: (name: string) => `${name}を読み取り中`,
    text: "テキストファイルを読み取っています。",
    pdf: "PDFのテキストを読み取っています。",
    image:
      "画像の文字を認識しています。最初の画像は認識エンジンの読み込みに数秒かかります。",
    cancel: "キャンセル",
  },
  preview: {
    eyebrow: "読み取った請求書",
    source: {
      text: "テキストファイル",
      pdf: "PDFのテキスト",
      image: "画像・英語の文字認識",
    },
    merchant: "加盟店",
    total: "合計",
    date: "日付",
    items: "品目",
    notFound: "見つかりません",
    moreItems: (n: number) => `ほか${n}件（リクエストに含みます）`,
    request: "エージェントに送るリクエスト",
    raw: "ファイルから読み取ったテキスト",
    pay: "この請求書を支払う",
    edit: "リクエストとして編集",
    discard: "破棄",
    decides: (id: string | null) =>
      `エージェントが支払いを提案し、入力したリクエストと同じようにポリシーが承認または停止します。${id ? `${id}で支払います。` : ""}`,
    blockedTitle: "ワンクリックでは支払えません",
    blockedBody:
      "ワンクリックで支払うには、カタログの加盟店とUSDの合計が必要です。リクエストとして編集してください。",
    close: "この請求書を破棄",
  },
  missing: {
    merchant_not_found: "加盟店が見つかりません。請求書にカタログの加盟店名がありません。",
    merchant_ambiguous: (names: string) =>
      `請求書にカタログの加盟店が複数記載されています（${names}）。`,
    total_not_found: "合計が見つかりません。",
    subtotal_only: "合計が見つかりません。小計しか記載されていません。",
    total_not_usd: (currency: string) =>
      `金額は${currency}です。PerDiemはUSDで支払うため、リクエストを編集してください。`,
    currency_unknown: "合計の通貨が請求書に記載されていません。リクエストを編集してください。",
    total_negative: "合計がマイナス（返金またはクレジット）のため、支払う金額はありません。",
    nothing_due: "請求書の未払い額が0です。支払い済みの請求書です。",
    too_long:
      "品目の行が多すぎて1件のリクエストに収まりません。リクエストを編集して短くしてください。",
  },
  notes: {
    merchant_approximate: (name: string) =>
      `${name}として読み取りました。請求書の文字とわずかに異なるため、確認してください。`,
    totals_disagree:
      "請求書に合計が複数あるため、総合計または請求額を使いました。",
    date_ambiguous: "日付が2通りに読めるため、空欄にしました。",
  },
  errors: {
    title: "このファイルは読み取れません",
    unsupported: "読み取れるのはPDF・PNG・JPG・WEBP・TXTファイルだけです。",
    too_large: "ファイルが5MBを超えています。",
    empty: "ファイルが空です。",
    no_text:
      "テキストが見つかりません。スキャンしたPDFの場合は、請求書の写真かスクリーンショットをドロップしてください。",
    ocr_unavailable:
      "このブラウザでは文字認識を使えません。請求書をPDFかテキストファイルでドロップしてください。",
    read_failed:
      "ファイルを読み取れませんでした。破損しているか、パスワードで保護されている可能性があります。",
    one_file: "請求書は1件ずつドロップしてください。",
    another: "別のファイルを選ぶ",
    dismiss: "閉じる",
  },
  announceRead: (name: string) => `${name}を読み取りました。支払う前に内容を確認してください。`,
};

export const zh: typeof en = {
  attach: "附加账单",
  dropHint: "或将账单、收据或发票拖放到此处",
  formats: "PDF、PNG、JPG、WEBP 或 TXT，最大 5 MB",
  local: "文件在本设备上读取，只发送请求。",
  semantics: "PerDiem 在授权范围内向账单上的商户付款，不是向你报销。",
  noMandate: "请先选择授权，再附加账单",
  dropzoneTitle: "拖放账单、收据或发票",
  or: "或",
  overlay: {
    title: "松开即可读取账单",
    disabled: "拖放账单前请先选择授权",
    busy: "请等待当前请求处理完毕",
  },
  reading: {
    title: (name: string) => `正在读取 ${name}`,
    text: "正在读取文本文件。",
    pdf: "正在读取 PDF 中的文字。",
    image: "正在识别图片中的文字。首次识别需要几秒钟加载识别引擎。",
    cancel: "取消",
  },
  preview: {
    eyebrow: "已读取的账单",
    source: {
      text: "文本文件",
      pdf: "PDF 文字",
      image: "图片 · 英文文字识别",
    },
    merchant: "商户",
    total: "合计",
    date: "日期",
    items: "明细",
    notFound: "未找到",
    moreItems: (n: number) => `另有 ${n} 项（已包含在请求中）`,
    request: "发送给代理的请求",
    raw: "从文件中读取的文字",
    pay: "支付此账单",
    edit: "编辑为请求",
    discard: "放弃",
    decides: (id: string | null) =>
      `代理提出付款，策略会像处理手动输入的请求一样批准或拦截。${id ? `使用授权 ${id} 付款。` : ""}`,
    blockedTitle: "无法一键支付",
    blockedBody: "一键支付需要目录中的商户和以 USD 计价的合计。请编辑为请求。",
    close: "放弃此账单",
  },
  missing: {
    merchant_not_found: "未找到商户：账单上没有目录中的商户名称。",
    merchant_ambiguous: (names: string) => `账单上出现了多个目录商户（${names}）。`,
    total_not_found: "未找到合计。",
    subtotal_only: "未找到合计：账单上只有小计。",
    total_not_usd: (currency: string) =>
      `金额以 ${currency} 计价。PerDiem 以 USD 付款，请编辑请求。`,
    currency_unknown: "账单未注明合计的币种，请编辑请求。",
    total_negative: "合计为负数（退款或抵扣），没有需要支付的金额。",
    nothing_due: "账单显示应付金额为 0，已经付清。",
    too_long: "账单明细行过多，无法放入一条请求。请编辑请求并缩短。",
  },
  notes: {
    merchant_approximate: (name: string) =>
      `识别为 ${name}（与账单上的文字略有不同），请核对。`,
    totals_disagree: "账单上有多个合计，已采用总计或应付金额。",
    date_ambiguous: "日期有两种读法，因此留空。",
  },
  errors: {
    title: "无法读取此文件",
    unsupported: "只能读取 PDF、PNG、JPG、WEBP 和 TXT 文件。",
    too_large: "文件超过 5 MB。",
    empty: "文件为空。",
    no_text: "未找到文字。如果是扫描的 PDF，请改为拖放账单的照片或截图。",
    ocr_unavailable: "此浏览器不支持文字识别。请以 PDF 或文本文件拖放账单。",
    read_failed: "无法读取文件，文件可能已损坏或设有密码。",
    one_file: "请一次拖放一张账单。",
    another: "选择其他文件",
    dismiss: "关闭",
  },
  announceRead: (name: string) => `已读取 ${name}。付款前请核对内容。`,
};
