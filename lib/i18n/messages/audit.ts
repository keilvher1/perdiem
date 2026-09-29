/**
 * "audit" namespace: /audit, /audit/[mandateId] and the printable trip statement
 * (/audit/[mandateId]/report). `en` is the reference: its strings must equal the English UI copy
 * exactly. The other languages are typed `typeof en`, so a missing key is a compile error.
 * Data stays untranslated: mandate ids, hashes, amounts, STOP codes, APPROVE / STOP, file names,
 * the verify command and Etherscan's own menu labels (Input Data, View as UTF-8).
 */

type LedgerCounts = {
  total: number;
  settled: number;
  pending: number;
  stopped: number;
  failed: number;
  approved: number;
};

export const en = {
  /** /audit without an id. */
  index: {
    loadError: "Couldn’t load mandates",
    emptyTitle: "Nothing to audit yet",
    emptyDescription: "Grant a mandate on the Principal page first.",
  },
  /** Check groups: the audit banner and the statement's check line. */
  groups: {
    anchor: "Anchor",
    replay: "Replay",
    transactions: "Transactions",
    payerMined: "Payer & mined",
  },
  checksPassed: (passed: number, total: number) =>
    `${passed} of ${total} checks passed`,
  checksFailed: (failed: number, total: number) =>
    `${failed} of ${total} checks failed`,
  notFound: (id: string) => `Mandate ${id} was not found`,
  notAnchored: "not anchored",
  /** /audit/[mandateId] */
  page: {
    eyebrow: "Audit",
    /** "Verify <id> from records alone" — the id sits between the two parts. */
    titleBefore: "Verify ",
    titleAfter: " from records alone",
    description:
      "Recomputes the mandate hash, compares it with the on-chain anchor, replays every decision through the policy, and reads each payment back from Sepolia.",
    checked: (rel: string) => `Checked ${rel}`,
    printable: "Printable statement",
    rerun: "Re-run checks",
    runError: "The audit could not run",
    stale: (message: string) =>
      `Showing the previous result — re-run failed: ${message}`,
    loading: "Loading audit",
    recomputes:
      "This page does not trust the stored decisions — it recomputes them.",
    terms: {
      title: "1 · Mandate terms",
      description:
        "The hashed terms (catalog snapshot included). Status is stored beside them, so pausing never changes the hash.",
      statusNote: "mutable, not hashed",
      recomputedHash: "Recomputed hash (keccak256 of the canonical terms)",
      recomputedHashWhat: "recomputed mandate hash",
      equalsStored: "equals stored hash",
      differsStored: "differs from stored hash",
      anchorTx: "Anchor transaction",
      anchorTxWhat: "anchor transaction",
      memo: "Decoded anchor memo (calldata as UTF-8)",
      noMemo: "No memo found",
      anchorMatches: "Anchor matches the recomputed hash",
      anchorMismatch: "Anchor does NOT match the recomputed hash",
    },
    replay: {
      title: "2 · Replay",
      description:
        "Every ledger entry re-run through the same policy code, with spend rebuilt from earlier entries only.",
      emptyTitle: "No ledger entries to replay yet",
      emptyDescription:
        "Decisions appear here once the traveler has made a request.",
      entry: "Entry",
      stored: "Stored",
      recomputed: "Recomputed",
      consistent: "Consistent",
      mandateHash: "Mandate hash",
      reasons: "Recomputed reasons",
      same: "Same",
      differs: "Differs",
    },
    transactions: {
      title: "3 · Transactions",
      description:
        "Each approved payment read back from Sepolia: recipient, amount and the memo PERDIEM|mandateHash|receiptHash in calldata.",
      emptyTitle: "No on-chain payments yet",
      emptyDescription:
        "Stopped requests never reach the chain, so there is nothing to read back.",
      entry: "Entry",
      tx: "Tx",
      recipient: "Recipient",
      amount: "Amount",
      receiptHash: "Receipt hash",
      memo: "Memo",
      decodedMemo: "Decoded memo",
      txWhat: "transaction hash",
    },
    verify: {
      title: "Verify it yourself",
      body: "Download the two records, then run the script: it needs no app and no database, only the files plus a public Sepolia RPC. It recomputes every hash and decision and reads each transaction’s calldata.",
      byHand:
        "By hand: open any transaction on Etherscan → Input Data → View as UTF-8, and compare the two hashes with the tables above.",
    },
  },
  /** /audit/[mandateId]/report — the printable trip statement. */
  report: {
    /** Document title (and Chrome's default "Save as PDF" file name). */
    docTitle: (id: string) => `PerDiem trip statement ${id}`,
    back: "Back to the audit",
    printHint: "In the print dialog, turn off “Headers and footers”.",
    print: "Print / Save as PDF",
    buildError: "The statement could not be built",
    heading: "Trip statement",
    /** Inline labels: the trailing space separates them from the value. */
    generated: "Generated ",
    records: "Records ",
    recordsLive: "live · Sepolia testnet",
    recordsMock: "MOCK DATA · placeholder hashes, not evidence",
    mandateStatus: "Mandate status ",
    parties: {
      title: "Parties and terms",
      principal: "Principal (grants the budget)",
      traveler: "Traveler (acts under it)",
      budget: "Budget",
      perPaymentCap: "Per-payment cap",
      opens: "Trip window opens",
      closes: "Trip window closes",
      agentWallet: "Agent wallet (the only payer)",
      mandateHash: "Mandate hash (keccak256 of the terms)",
      anchorTx: "Anchor transaction (terms fixed on-chain)",
    },
    boundary: {
      title: "Boundary",
      catalogMerchant: "Catalog merchant",
      category: "Category",
      payments: "Payments",
      permitted: "permitted",
      notPermitted: "not permitted",
      notPermittedBoth: "not permitted (merchant, category)",
      notPermittedMerchant: "not permitted (merchant)",
      notPermittedCategory: "not permitted (category)",
      categories: "Categories",
      blockedWords: "Blocked words (request or memo)",
      none: "none",
      legend:
        "■ permitted · □ not permitted. A payment is also stopped outside the trip window, above the per-payment cap, over the remaining budget including the network fee, when the fee cannot be estimated, or as a duplicate within 5 minutes.",
    },
    checks: {
      title: "Checks recomputed from the records",
      failed: (n: number) => `(${n} failed)`,
      explanation:
        "Anchor: the recomputed mandate hash equals the memo of the anchor transaction. Replay: every entry re-run through the policy with spend rebuilt from earlier entries (2 checks each). Transactions: memo, receipt hash, recipient and amount read back from Sepolia (4 each). Payer & mined: the anchor and every payment were sent by the mandate's agent wallet, and each payment was mined and succeeded (1 + 2 per payment). Replay cannot show whether the mandate was paused when a payment was approved; pause and resume are in the server log.",
      couldNotRun: (error: string) => `Checks could not run: ${error}`,
      running: "Running the checks…",
    },
    ledger: {
      title: "Ledger annex · oldest first",
      summary: (c: LedgerCounts) =>
        `${c.total} decision${c.total === 1 ? "" : "s"}: ${c.settled} settled · ${c.pending} pending · ${c.stopped} stopped · ${c.failed} failed` +
        (c.approved > 0 ? ` · ${c.approved} approved, not broadcast` : ""),
      when: "When",
      merchantRequest: "Merchant · request",
      outcome: "Outcome",
      amount: "Amount",
      counted: "Counted",
      remaining: "Remaining",
      openingBudget: "Opening budget",
      empty: "No decisions recorded yet.",
      /** The traveler's own request text (data), quoted. */
      quote: (text: string) => `“${text}”`,
      status: {
        stopped: "stopped · nothing sent",
        settled: "settled on-chain",
        pendingTx: "pending · awaiting confirmation",
        pending: "pending",
        approved: "approved · not broadcast yet",
        failedTx: "failed on-chain · not counted",
        failed: "broadcast did not confirm · not counted",
      },
      requested: (usd: string) => `requested ${usd}`,
      sentZero: "sent $0.00",
      fee: (usd: string) => `+ fee ${usd}`,
      total: (budget: string, spent: string) =>
        `Budget ${budget} − Spent ${spent} = Remaining`,
      reconciled: (spent: string, remaining: string) =>
        `Sum of counted lines equals the recorded spend (${spent}) and remaining (${remaining}).`,
      mismatch: (sum: string, spent: string, remaining: string) =>
        `MISMATCH: counted lines sum to ${sum}, the record says spent ${spent} and remaining ${remaining}.`,
      /** Follows the reconciled / mismatch sentence directly, so it carries its own leading space. */
      countedNote:
        " Counted = amount + estimated network fee, for approved, pending and settled payments; stopped and failed lines count $0.00.",
      pendingNote: (usd: string) =>
        ` ${usd} of the spend is still pending on-chain.`,
    },
    signOff: {
      title: "Verify and sign off",
      /** "… at the demo rate <strong>1 ETH = $N</strong> — …" */
      rateBefore:
        "Amounts are USD. On-chain values are Sepolia test ETH converted at the demo rate ",
      rateAfter:
        " — the same rate scripts/verify.ts uses. No real money moves.",
      /** "… download <mandate file> and <ledger file> from the audit page …" */
      reconstructBefore: "Reconstruct from records alone: download ",
      reconstructMid: " and ",
      reconstructAfter:
        " from the audit page (Evidence → Download records), then run in a clone of the repository:",
      reviewedBy: "Reviewed by",
      date: "Date",
    },
  },
};

export const ko: typeof en = {
  index: {
    loadError: "위임을 불러오지 못했습니다",
    emptyTitle: "아직 감사할 항목이 없습니다",
    emptyDescription: "위임자 페이지에서 먼저 위임을 발급해야 합니다.",
  },
  groups: {
    anchor: "앵커",
    replay: "재실행",
    transactions: "트랜잭션",
    payerMined: "송금자·채굴",
  },
  checksPassed: (passed, total) => `검증 ${total}건 중 ${passed}건 통과`,
  checksFailed: (failed, total) => `검증 ${total}건 중 ${failed}건 실패`,
  notFound: (id) => `위임 ${id}을(를) 찾을 수 없습니다`,
  notAnchored: "앵커링되지 않음",
  page: {
    eyebrow: "감사",
    titleBefore: "기록만으로 ",
    titleAfter: " 검증",
    description:
      "위임 해시를 다시 계산해 온체인 앵커와 비교하고, 모든 결정을 정책으로 다시 실행하며, 각 결제를 Sepolia에서 다시 읽어 옵니다.",
    checked: (rel) => `확인: ${rel}`,
    printable: "인쇄용 정산서",
    rerun: "다시 검증",
    runError: "감사를 실행할 수 없습니다",
    stale: (message) => `이전 결과를 표시합니다 — 재실행 실패: ${message}`,
    loading: "감사 불러오는 중",
    recomputes: "이 페이지는 저장된 결정을 신뢰하지 않고 직접 다시 계산합니다.",
    terms: {
      title: "1 · 위임 조건",
      description:
        "해시된 조건(카탈로그 스냅숏 포함)입니다. 상태는 조건과 따로 저장되므로 일시정지해도 해시는 바뀌지 않습니다.",
      statusNote: "변경 가능, 해시 대상 아님",
      recomputedHash: "재계산한 해시(정규화된 조건의 keccak256)",
      recomputedHashWhat: "재계산한 위임 해시",
      equalsStored: "저장된 해시와 일치",
      differsStored: "저장된 해시와 다름",
      anchorTx: "앵커 트랜잭션",
      anchorTxWhat: "앵커 트랜잭션",
      memo: "디코딩한 앵커 메모(calldata를 UTF-8로 표시)",
      noMemo: "메모 없음",
      anchorMatches: "앵커가 재계산한 해시와 일치합니다",
      anchorMismatch: "앵커가 재계산한 해시와 일치하지 않습니다",
    },
    replay: {
      title: "2 · 재실행",
      description:
        "모든 장부 항목을 같은 정책 코드로 다시 실행합니다. 사용액은 이전 항목만으로 다시 계산합니다.",
      emptyTitle: "아직 재실행할 장부 항목이 없습니다",
      emptyDescription: "출장자가 요청하면 여기에 결정이 표시됩니다.",
      entry: "항목",
      stored: "저장값",
      recomputed: "재계산",
      consistent: "일관성",
      mandateHash: "위임 해시",
      reasons: "재계산한 사유",
      same: "같음",
      differs: "다름",
    },
    transactions: {
      title: "3 · 트랜잭션",
      description:
        "승인된 각 결제를 Sepolia에서 다시 읽어 수취인, 금액, calldata 안의 메모 PERDIEM|mandateHash|receiptHash를 확인합니다.",
      emptyTitle: "아직 온체인 결제가 없습니다",
      emptyDescription:
        "중단된 요청은 체인에 도달하지 않으므로 다시 읽을 내용이 없습니다.",
      entry: "항목",
      tx: "Tx",
      recipient: "수취인",
      amount: "금액",
      receiptHash: "영수증 해시",
      memo: "메모",
      decodedMemo: "디코딩한 메모",
      txWhat: "트랜잭션 해시",
    },
    verify: {
      title: "직접 검증하기",
      body: "두 기록을 내려받은 뒤 스크립트를 실행합니다. 앱도 데이터베이스도 필요 없고, 파일과 공개 Sepolia RPC만 있으면 됩니다. 스크립트는 모든 해시와 결정을 다시 계산하고 각 트랜잭션의 calldata를 읽습니다.",
      byHand:
        "수동 확인: Etherscan에서 아무 트랜잭션이나 열고 Input Data → View as UTF-8을 선택한 뒤, 두 해시를 위 표와 비교합니다.",
    },
  },
  report: {
    docTitle: (id) => `PerDiem 출장 정산서 ${id}`,
    back: "감사로 돌아가기",
    printHint: "인쇄 대화상자에서 “머리글과 바닥글”을 해제하세요.",
    print: "인쇄 / PDF로 저장",
    buildError: "정산서를 만들 수 없습니다",
    heading: "출장 정산서",
    generated: "생성 ",
    records: "기록 ",
    recordsLive: "실제 기록 · Sepolia 테스트넷",
    recordsMock: "모의 데이터 · 임시 해시, 증빙 아님",
    mandateStatus: "위임 상태 ",
    parties: {
      title: "당사자와 조건",
      principal: "위임자(예산 부여)",
      traveler: "출장자(위임 범위 안에서 행동)",
      budget: "예산",
      perPaymentCap: "1회 결제 한도",
      opens: "출장 기간 시작",
      closes: "출장 기간 종료",
      agentWallet: "에이전트 지갑(유일한 지급 주체)",
      mandateHash: "위임 해시(조건의 keccak256)",
      anchorTx: "앵커 트랜잭션(조건을 온체인에 고정)",
    },
    boundary: {
      title: "허용 범위",
      catalogMerchant: "카탈로그 가맹점",
      category: "분류",
      payments: "결제",
      permitted: "허용",
      notPermitted: "불허",
      notPermittedBoth: "불허(가맹점, 분류)",
      notPermittedMerchant: "불허(가맹점)",
      notPermittedCategory: "불허(분류)",
      categories: "분류",
      blockedWords: "차단 키워드(요청 또는 메모)",
      none: "없음",
      legend:
        "■ 허용 · □ 불허. 출장 기간 밖이거나, 1회 결제 한도를 넘거나, 네트워크 수수료를 포함해 잔액을 넘거나, 수수료를 추정할 수 없거나, 5분 안의 중복 결제인 경우에도 결제는 중단됩니다.",
    },
    checks: {
      title: "기록으로 다시 계산한 검증",
      failed: (n) => `(${n}건 실패)`,
      explanation:
        "앵커: 재계산한 위임 해시가 앵커 트랜잭션의 메모와 같습니다. 재실행: 모든 항목을 정책으로 다시 실행하며, 사용액은 이전 항목으로 다시 계산합니다(항목당 2건). 트랜잭션: 메모, 영수증 해시, 수취인, 금액을 Sepolia에서 다시 읽습니다(트랜잭션당 4건). 송금자·채굴: 앵커와 모든 결제가 위임의 에이전트 지갑에서 전송되었고, 각 결제가 채굴되어 성공했습니다(1 + 결제당 2건). 재실행으로는 결제 승인 시점에 위임이 일시정지 상태였는지 알 수 없습니다. 일시정지와 재개는 서버 로그에 남습니다.",
      couldNotRun: (error) => `검증을 실행할 수 없습니다: ${error}`,
      running: "검증을 실행하는 중…",
    },
    ledger: {
      title: "장부 부록 · 오래된 순",
      summary: (c) =>
        `결정 ${c.total}건: 정산 완료 ${c.settled} · 대기 중 ${c.pending} · 중단됨 ${c.stopped} · 실패 ${c.failed}` +
        (c.approved > 0 ? ` · 승인됨(미전송) ${c.approved}` : ""),
      when: "일시",
      merchantRequest: "가맹점 · 요청",
      outcome: "결과",
      amount: "금액",
      counted: "집계액",
      remaining: "잔액",
      openingBudget: "시작 예산",
      empty: "아직 기록된 결정이 없습니다.",
      quote: (text) => `“${text}”`,
      status: {
        stopped: "중단됨 · 전송 없음",
        settled: "온체인 정산 완료",
        pendingTx: "대기 중 · 확인 대기",
        pending: "대기 중",
        approved: "승인됨 · 아직 전송 전",
        failedTx: "온체인 실패 · 미집계",
        failed: "전송 미확인 · 미집계",
      },
      requested: (usd) => `요청 ${usd}`,
      sentZero: "송금 $0.00",
      fee: (usd) => `+ 수수료 ${usd}`,
      total: (budget, spent) => `예산 ${budget} − 사용액 ${spent} = 잔액`,
      reconciled: (spent, remaining) =>
        `집계된 줄의 합계가 기록된 사용액(${spent}) 및 잔액(${remaining})과 일치합니다.`,
      mismatch: (sum, spent, remaining) =>
        `불일치: 집계된 줄의 합계는 ${sum}, 기록된 사용액은 ${spent}, 잔액은 ${remaining}입니다.`,
      countedNote:
        " 집계액 = 금액 + 추정 네트워크 수수료이며, 승인됨·대기 중·정산 완료 결제에 적용됩니다. 중단됨·실패 줄은 $0.00으로 집계합니다.",
      pendingNote: (usd) =>
        ` 사용액 중 아직 온체인에서 대기 중인 금액: ${usd}.`,
    },
    signOff: {
      title: "검증 및 서명",
      rateBefore:
        "금액 단위는 USD입니다. 온체인 값은 Sepolia 테스트 ETH를 데모 환율(",
      rateAfter:
        ")로 환산했으며, scripts/verify.ts와 같은 환율입니다. 실제 돈은 오가지 않습니다.",
      reconstructBefore:
        "기록만으로 재구성하려면 감사 페이지(증빙 → 기록 내려받기)에서 ",
      reconstructMid: " 및 ",
      reconstructAfter:
        " 파일을 내려받은 뒤, 저장소 클론에서 다음을 실행합니다:",
      reviewedBy: "검토자",
      date: "날짜",
    },
  },
};

export const ja: typeof en = {
  index: {
    loadError: "委任を読み込めませんでした",
    emptyTitle: "監査対象はまだありません",
    emptyDescription: "まず委任者ページで委任を付与してください。",
  },
  groups: {
    anchor: "アンカー",
    replay: "リプレイ",
    transactions: "トランザクション",
    payerMined: "送金元・マイニング",
  },
  checksPassed: (passed, total) => `検証 ${total} 件中 ${passed} 件合格`,
  checksFailed: (failed, total) => `検証 ${total} 件中 ${failed} 件失敗`,
  notFound: (id) => `委任 ${id} が見つかりません`,
  notAnchored: "未アンカー",
  page: {
    eyebrow: "監査",
    titleBefore: "記録だけで ",
    titleAfter: " を検証",
    description:
      "委任ハッシュを再計算してオンチェーンのアンカーと照合し、すべての判定をポリシーで再実行し、各支払いを Sepolia から読み戻します。",
    checked: (rel) => `確認：${rel}`,
    printable: "印刷用精算書",
    rerun: "再検証",
    runError: "監査を実行できませんでした",
    stale: (message) =>
      `前回の結果を表示しています — 再実行に失敗しました：${message}`,
    loading: "監査を読み込み中",
    recomputes: "このページは保存された判定を信用せず、すべて再計算します。",
    terms: {
      title: "1 · 委任条件",
      description:
        "ハッシュ化された条件（カタログのスナップショットを含む）です。ステータスは別に保存されるため、一時停止してもハッシュは変わりません。",
      statusNote: "変更可能、ハッシュ対象外",
      recomputedHash: "再計算したハッシュ（正規化した条件の keccak256）",
      recomputedHashWhat: "再計算した委任ハッシュ",
      equalsStored: "保存済みハッシュと一致",
      differsStored: "保存済みハッシュと不一致",
      anchorTx: "アンカートランザクション",
      anchorTxWhat: "アンカートランザクション",
      memo: "デコードしたアンカーメモ（calldata を UTF-8 で表示）",
      noMemo: "メモが見つかりません",
      anchorMatches: "アンカーは再計算したハッシュと一致します",
      anchorMismatch: "アンカーは再計算したハッシュと一致しません",
    },
    replay: {
      title: "2 · リプレイ",
      description:
        "台帳の各エントリを同じポリシーコードで再実行します。使用額はそれ以前のエントリだけから再構成します。",
      emptyTitle: "リプレイする台帳エントリはまだありません",
      emptyDescription: "出張者が依頼すると、ここに判定が表示されます。",
      entry: "エントリ",
      stored: "保存値",
      recomputed: "再計算",
      consistent: "整合",
      mandateHash: "委任ハッシュ",
      reasons: "再計算した理由",
      same: "一致",
      differs: "相違",
    },
    transactions: {
      title: "3 · トランザクション",
      description:
        "承認済みの各支払いを Sepolia から読み戻します：受取人、金額、calldata 内のメモ PERDIEM|mandateHash|receiptHash。",
      emptyTitle: "オンチェーンの支払いはまだありません",
      emptyDescription:
        "停止された依頼はチェーンに到達しないため、読み戻すものはありません。",
      entry: "エントリ",
      tx: "Tx",
      recipient: "受取人",
      amount: "金額",
      receiptHash: "レシートハッシュ",
      memo: "メモ",
      decodedMemo: "デコードしたメモ",
      txWhat: "トランザクションハッシュ",
    },
    verify: {
      title: "自分で検証する",
      body: "2 つの記録をダウンロードしてスクリプトを実行します。アプリもデータベースも不要で、ファイルと公開 Sepolia RPC だけで動きます。すべてのハッシュと判定を再計算し、各トランザクションの calldata を読み取ります。",
      byHand:
        "手動で確認：Etherscan で任意のトランザクションを開き、Input Data → View as UTF-8 を選んで、2 つのハッシュを上の表と照合します。",
    },
  },
  report: {
    docTitle: (id) => `PerDiem 出張精算書 ${id}`,
    back: "監査に戻る",
    printHint: "印刷ダイアログで「ヘッダーとフッター」をオフにしてください。",
    print: "印刷 / PDF に保存",
    buildError: "精算書を作成できませんでした",
    heading: "出張精算書",
    generated: "作成 ",
    records: "記録 ",
    recordsLive: "実データ · Sepolia テストネット",
    recordsMock: "モックデータ · 仮のハッシュ、証跡ではありません",
    mandateStatus: "委任ステータス ",
    parties: {
      title: "当事者と条件",
      principal: "委任者（予算を付与）",
      traveler: "出張者（その範囲内で行動）",
      budget: "予算",
      perPaymentCap: "1回あたりの上限",
      opens: "出張期間の開始",
      closes: "出張期間の終了",
      agentWallet: "エージェントウォレット（唯一の支払元）",
      mandateHash: "委任ハッシュ（条件の keccak256）",
      anchorTx: "アンカートランザクション（条件をオンチェーンに固定）",
    },
    boundary: {
      title: "許可範囲",
      catalogMerchant: "カタログの加盟店",
      category: "カテゴリ",
      payments: "支払い",
      permitted: "許可",
      notPermitted: "不許可",
      notPermittedBoth: "不許可（加盟店、カテゴリ）",
      notPermittedMerchant: "不許可（加盟店）",
      notPermittedCategory: "不許可（カテゴリ）",
      categories: "カテゴリ",
      blockedWords: "ブロックキーワード（依頼またはメモ）",
      none: "なし",
      legend:
        "■ 許可 · □ 不許可。出張期間外、1回あたりの上限超過、ネットワーク手数料込みでの残額超過、手数料を見積もれない場合、または 5 分以内の重複の場合も支払いは停止されます。",
    },
    checks: {
      title: "記録から再計算した検証",
      failed: (n) => `（${n} 件失敗）`,
      explanation:
        "アンカー：再計算した委任ハッシュとアンカートランザクションのメモが一致すること。リプレイ：各エントリを、それ以前のエントリから再構成した使用額でポリシーに再度通すこと（各 2 件）。トランザクション：メモ、レシートハッシュ、受取人、金額を Sepolia から読み戻すこと（各 4 件）。送金元・マイニング：アンカーとすべての支払いが委任のエージェントウォレットから送信され、各支払いがマイニングされて成功していること（1 + 支払いごとに 2 件）。リプレイでは、支払いの承認時に委任が一時停止中だったかどうかはわかりません。一時停止と再開はサーバーログに記録されます。",
      couldNotRun: (error) => `検証を実行できませんでした：${error}`,
      running: "検証を実行中…",
    },
    ledger: {
      title: "台帳付録 · 古い順",
      summary: (c) =>
        `判定 ${c.total} 件：決済完了 ${c.settled} · 保留中 ${c.pending} · 停止 ${c.stopped} · 失敗 ${c.failed}` +
        (c.approved > 0 ? ` · 承認済み（未送信）${c.approved}` : ""),
      when: "日時",
      merchantRequest: "加盟店 · 依頼",
      outcome: "結果",
      amount: "金額",
      counted: "計上額",
      remaining: "残額",
      openingBudget: "当初予算",
      empty: "記録された判定はまだありません。",
      quote: (text) => `「${text}」`,
      status: {
        stopped: "停止 · 送金なし",
        settled: "オンチェーンで決済完了",
        pendingTx: "保留中 · 確認待ち",
        pending: "保留中",
        approved: "承認済み · 未送信",
        failedTx: "オンチェーンで失敗 · 計上なし",
        failed: "送信が確認されず · 計上なし",
      },
      requested: (usd) => `依頼額 ${usd}`,
      sentZero: "送金 $0.00",
      fee: (usd) => `+ 手数料 ${usd}`,
      total: (budget, spent) => `予算 ${budget} − 使用額 ${spent} = 残額`,
      reconciled: (spent, remaining) =>
        `計上行の合計は、記録された使用額（${spent}）および残額（${remaining}）と一致します。`,
      mismatch: (sum, spent, remaining) =>
        `不一致：計上行の合計は ${sum} ですが、記録上の使用額は ${spent}、残額は ${remaining} です。`,
      countedNote:
        "計上額 = 金額 + 推定ネットワーク手数料で、承認済み・保留中・決済完了の支払いが対象です。停止・失敗の行は $0.00 として計上します。",
      pendingNote: (usd) =>
        `使用額のうち ${usd} はまだオンチェーンで保留中です。`,
    },
    signOff: {
      title: "検証と署名",
      rateBefore:
        "金額は USD です。オンチェーンの値は Sepolia テスト ETH をデモ用レート（",
      rateAfter:
        "）で換算しています。scripts/verify.ts と同じレートです。実際のお金は動きません。",
      reconstructBefore:
        "記録だけで再構成するには、監査ページ（証跡 → 記録をダウンロード）から ",
      reconstructMid: " と ",
      reconstructAfter:
        " をダウンロードし、リポジトリのクローンで次を実行します：",
      reviewedBy: "確認者",
      date: "日付",
    },
  },
};

export const zh: typeof en = {
  index: {
    loadError: "无法加载授权",
    emptyTitle: "暂无可审计的内容",
    emptyDescription: "请先在委托方页面授予授权。",
  },
  groups: {
    anchor: "锚定",
    replay: "重放",
    transactions: "交易",
    payerMined: "付款方与上链",
  },
  checksPassed: (passed, total) => `${total} 项校验中 ${passed} 项通过`,
  checksFailed: (failed, total) => `${total} 项校验中 ${failed} 项失败`,
  notFound: (id) => `未找到授权 ${id}`,
  notAnchored: "未锚定",
  page: {
    eyebrow: "审计",
    titleBefore: "仅凭记录验证 ",
    titleAfter: "",
    description:
      "重新计算授权哈希并与链上锚定比对，用策略重放每项决策，并从 Sepolia 读回每笔付款。",
    checked: (rel) => `校验时间：${rel}`,
    printable: "打印版结算单",
    rerun: "重新校验",
    runError: "无法执行审计",
    stale: (message) => `正在显示上次结果 — 重新运行失败：${message}`,
    loading: "正在加载审计",
    recomputes: "本页不信任已存储的决策，而是全部重新计算。",
    terms: {
      title: "1 · 授权条款",
      description:
        "经过哈希的条款（含商户目录快照）。状态单独存放，因此暂停不会改变哈希。",
      statusNote: "可变，不计入哈希",
      recomputedHash: "重新计算的哈希（规范化条款的 keccak256）",
      recomputedHashWhat: "重新计算的授权哈希",
      equalsStored: "与存储的哈希一致",
      differsStored: "与存储的哈希不同",
      anchorTx: "锚定交易",
      anchorTxWhat: "锚定交易",
      memo: "解码后的锚定备注（calldata 按 UTF-8 显示）",
      noMemo: "未找到备注",
      anchorMatches: "锚定与重新计算的哈希一致",
      anchorMismatch: "锚定与重新计算的哈希不一致",
    },
    replay: {
      title: "2 · 重放",
      description:
        "每条账本记录都用同一套策略代码重新运行，已用金额仅由之前的记录重建。",
      emptyTitle: "暂无可重放的账本记录",
      emptyDescription: "出差人发出请求后，决策将显示在这里。",
      entry: "条目",
      stored: "存储值",
      recomputed: "重算值",
      consistent: "一致性",
      mandateHash: "授权哈希",
      reasons: "重算后的原因",
      same: "相同",
      differs: "不同",
    },
    transactions: {
      title: "3 · 交易",
      description:
        "从 Sepolia 读回每笔已批准的付款：收款方、金额，以及 calldata 中的备注 PERDIEM|mandateHash|receiptHash。",
      emptyTitle: "暂无链上付款",
      emptyDescription: "被拦截的请求不会上链，因此没有可读回的内容。",
      entry: "条目",
      tx: "Tx",
      recipient: "收款方",
      amount: "金额",
      receiptHash: "收据哈希",
      memo: "备注",
      decodedMemo: "解码后的备注",
      txWhat: "交易哈希",
    },
    verify: {
      title: "自行验证",
      body: "下载两份记录后运行脚本：无需应用，也无需数据库，只需这些文件和一个公共 Sepolia RPC。脚本会重新计算每个哈希和决策，并读取每笔交易的 calldata。",
      byHand:
        "手动核对：在 Etherscan 上打开任意交易 → Input Data → View as UTF-8，并将两个哈希与上方表格比对。",
    },
  },
  report: {
    docTitle: (id) => `PerDiem 差旅结算单 ${id}`,
    back: "返回审计",
    printHint: "请在打印对话框中关闭“页眉和页脚”。",
    print: "打印 / 另存为 PDF",
    buildError: "无法生成结算单",
    heading: "差旅结算单",
    generated: "生成于 ",
    records: "记录 ",
    recordsLive: "真实数据 · Sepolia 测试网",
    recordsMock: "模拟数据 · 占位哈希，不作为证据",
    mandateStatus: "授权状态 ",
    parties: {
      title: "当事方与条款",
      principal: "委托方（授予预算）",
      traveler: "出差人（在授权范围内行事）",
      budget: "预算",
      perPaymentCap: "单笔上限",
      opens: "差旅期间开始",
      closes: "差旅期间结束",
      agentWallet: "代理钱包（唯一付款方）",
      mandateHash: "授权哈希（条款的 keccak256）",
      anchorTx: "锚定交易（条款固定在链上）",
    },
    boundary: {
      title: "允许范围",
      catalogMerchant: "目录商户",
      category: "类别",
      payments: "付款",
      permitted: "允许",
      notPermitted: "不允许",
      notPermittedBoth: "不允许（商户、类别）",
      notPermittedMerchant: "不允许（商户）",
      notPermittedCategory: "不允许（类别）",
      categories: "类别",
      blockedWords: "屏蔽关键词（请求或备注）",
      none: "无",
      legend:
        "■ 允许 · □ 不允许。此外，超出差旅期间、超过单笔上限、含网络手续费后超出剩余预算、无法估算手续费，或 5 分钟内重复的付款也会被拦截。",
    },
    checks: {
      title: "由记录重新计算的校验",
      failed: (n) => `（${n} 项失败）`,
      explanation:
        "锚定：重新计算的授权哈希等于锚定交易的备注。重放：每条记录都重新通过策略运行，已用金额由之前的记录重建（每条 2 项）。交易：从 Sepolia 读回备注、收据哈希、收款方和金额（每笔 4 项）。付款方与上链：锚定交易和每笔付款均由该授权的代理钱包发出，且每笔付款均已上链并成功（1 + 每笔付款 2 项）。重放无法显示付款获批时授权是否处于暂停状态；暂停与恢复记录在服务器日志中。",
      couldNotRun: (error) => `无法执行校验：${error}`,
      running: "正在执行校验…",
    },
    ledger: {
      title: "账本附录 · 按时间先后",
      summary: (c) =>
        `共 ${c.total} 项决策：已结算 ${c.settled} · 待确认 ${c.pending} · 已拦截 ${c.stopped} · 失败 ${c.failed}` +
        (c.approved > 0 ? ` · 已批准（未广播）${c.approved}` : ""),
      when: "时间",
      merchantRequest: "商户 · 请求",
      outcome: "结果",
      amount: "金额",
      counted: "计入金额",
      remaining: "剩余",
      openingBudget: "期初预算",
      empty: "暂无决策记录。",
      quote: (text) => `“${text}”`,
      status: {
        stopped: "已拦截 · 未发送",
        settled: "已在链上结算",
        pendingTx: "待确认 · 等待区块确认",
        pending: "待确认",
        approved: "已批准 · 尚未广播",
        failedTx: "链上失败 · 不计入",
        failed: "广播未确认 · 不计入",
      },
      requested: (usd) => `申请 ${usd}`,
      sentZero: "已付 $0.00",
      fee: (usd) => `+ 手续费 ${usd}`,
      total: (budget, spent) => `预算 ${budget} − 已用 ${spent} = 剩余`,
      reconciled: (spent, remaining) =>
        `计入各行之和与记录的已用金额（${spent}）及剩余金额（${remaining}）一致。`,
      mismatch: (sum, spent, remaining) =>
        `不一致：计入各行合计 ${sum}，但记录显示已用 ${spent}、剩余 ${remaining}。`,
      countedNote:
        "计入金额 = 金额 + 预估网络手续费，适用于已批准、待确认和已结算的付款；已拦截和失败的行按 $0.00 计入。",
      pendingNote: (usd) => `已用金额中有 ${usd} 仍在链上待确认。`,
    },
    signOff: {
      title: "核验与签字",
      rateBefore: "金额单位为 USD。链上数值为 Sepolia 测试 ETH，按演示汇率（",
      rateAfter:
        "）换算，与 scripts/verify.ts 使用的汇率相同。不涉及真实资金。",
      reconstructBefore: "仅凭记录复现：从审计页面（证据 → 下载记录）下载 ",
      reconstructMid: " 和 ",
      reconstructAfter: "，然后在克隆的仓库中运行：",
      reviewedBy: "审核人",
      date: "日期",
    },
  },
};
