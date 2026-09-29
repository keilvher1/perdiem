/**
 * "audit" namespace: /audit, /audit/[mandateId] and the printable trip statement
 * (/audit/[mandateId]/report). `en` is the reference: its strings must equal the English UI copy
 * exactly. The other languages are typed `typeof en`, so a missing key is a compile error.
 * Data stays untranslated: mandate ids, hashes, amounts, STOP codes, APPROVE / STOP, file names,
 * the verify command, the PERDIEM memo prefixes and Etherscan's own menu labels (Input Data,
 * View as UTF-8). State labels (Match, Mismatch, Approved, Stopped, …) come from the `ui` namespace.
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
  /** The headline. Keep "N of N checks passed": the verify script prints the same count. */
  checksPassed: (passed: number, total: number) =>
    `${passed} of ${total} checks passed`,
  checksFailed: (failed: number, total: number) =>
    `${failed} of ${total} checks failed`,
  notFound: (id: string) => `Mandate ${id} was not found`,
  notAnchored: "not anchored",
  /** The three named verification areas, plus the checks the API returns as a total only. */
  areas: {
    anchor: {
      title: "Mandate hash vs on-chain anchor",
      scope:
        "The hash recomputed from the mandate terms, compared with the memo of the anchor transaction.",
    },
    replay: {
      title: "Decision replay vs recorded decision",
      scope:
        "Each ledger entry re-run through the policy with spend rebuilt from earlier entries. Two checks per entry: the same decision, and this mandate’s hash.",
    },
    payments: {
      title: "Each payment’s chain record",
      scope:
        "Each broadcast payment read back from Sepolia: recipient, amount, memo and receipt hash. Four checks per payment.",
    },
    payerMined: {
      title: "Payer and mined",
      scope:
        "The anchor and every payment were sent by the agent wallet, and each payment was mined and succeeded. The API returns these as a total; the verify script prints each line.",
    },
  },
  /** Per-area count beside its state. */
  count: {
    passed: (ok: number, of: number) => `${ok} of ${of} passed`,
    failed: (bad: number, of: number) => `${bad} of ${of} failed`,
    none: "Nothing to check",
  },
  empty: {
    replay: "No ledger entries to replay yet.",
    payments:
      "No payment has been broadcast, so there is nothing to read back.",
  },
  notAnchoredNote:
    "No anchor transaction was recorded, so the hash cannot be compared on-chain. The audit counts this as a failed check.",
  /** /audit/[mandateId] */
  page: {
    eyebrow: "Audit",
    /** "Verify <id> from records alone" — the id sits between the two parts. */
    titleBefore: "Verify ",
    titleAfter: " from records alone",
    description:
      "Which records were checked, how, and what matches. Stored decisions are not trusted: each one is recomputed from the mandate terms and the ledger.",
    printable: "Printable statement",
    rerun: "Re-run checks",
    rerunning: "Running checks…",
    runError: "The audit could not run",
    stale: (message: string) =>
      `Showing the previous result. The re-run failed: ${message}`,
    loading: "Loading audit",
    summary: {
      title: "Verification result",
      running: "Running the checks…",
      notRun: "The checks have not run",
      recomputes:
        "Nothing here trusts a stored decision: every one is recomputed.",
      previous: (text: string) => `Previous result: ${text}`,
      records: "Records checked",
      checked: "Checked",
      source: "Source",
      live: "Live records · Sepolia testnet",
      mock: "Mock data · placeholder hashes, not evidence",
      mandate: "Mandate",
      recomputedHash: "Mandate hash (recomputed)",
      entries: "Ledger entries",
      payments: "Payments read back",
      newer: (now: number, audited: number) =>
        `The ledger now holds ${now} entries; this audit covered ${audited}. Re-run the checks to include the rest.`,
      areas: "What was checked",
    },
    attention: {
      title: "Needs attention",
      intro:
        "These checks do not match the records. Rule stops are not listed here: a stop that recomputes to the same result is consistent.",
      anchorUnread:
        "The anchor transaction could not be read from Sepolia, so its memo was not compared. The audit counts this as a failed check.",
      unread:
        "The transaction could not be read from Sepolia, so its recipient, amount and memo were not compared. The audit counts them as failed.",
      payerMinedHint: (n: number) =>
        `${n} of the payments read back ${n === 1 ? "is" : "are"} pending or failed in the ledger: a payment that has not been mined and succeeded fails the mined check.`,
      introUnverified:
        "These checks could not be completed: a record they need is missing or could not be read. The audit counts them as failed.",
      show: "Show decision",
      anchor: "The anchor memo does not carry the recomputed mandate hash.",
      notAnchored: "No anchor transaction was recorded.",
      decision: "The recomputed decision differs from the recorded one.",
      hash: "The entry carries a different mandate hash.",
      recipient:
        "The recipient on-chain is not the merchant’s catalog wallet.",
      amount: "The amount on-chain differs from the approved amount.",
      memo: "The memo in calldata differs from the expected memo.",
      receipt: "The recomputed receipt hash differs from the stored one.",
      payerMined: (bad: number, of: number) =>
        `${bad} of ${of} sender or mined checks failed. The API returns only the total; run the verify script to see which.`,
    },
    anchor: {
      rule: "The anchor transaction’s memo must equal PERDIEM-MANDATE|<hash recomputed from the terms>.",
      check: "Anchor memo carries the recomputed hash",
      expected: "Expected",
      observed: "Observed",
      source: "Source",
      expectedCaption: "Recomputed from the terms (keccak256)",
      observedCaption: "Memo decoded from the anchor transaction’s calldata",
      noMemo: "No memo found",
      sourceCaption: "Anchor transaction on Sepolia",
      storedHash: "Stored mandate hash",
      storedSame: "Same value as the recomputed hash (not counted)",
      storedDiffers: "Differs from the recomputed hash (not counted)",
      showTerms: "Show the hashed terms (JSON)",
      hideTerms: "Hide the hashed terms (JSON)",
      termsNote:
        "The hashed terms include the catalog snapshot. Status is stored beside them, so pausing never changes the hash.",
      statusNote: "mutable, not hashed",
      unread: "Could not read the anchor transaction",
      hashWhat: "recomputed mandate hash",
      storedWhat: "stored mandate hash",
      anchorWhat: "anchor transaction",
    },
    decisions: {
      title: "Decisions: replay and chain records",
      description:
        "Approvals and stops stay side by side in the ledger. Select a decision to see what was recomputed, from which record, and its evidence.",
      listLabel: "Audited decisions",
      keyboard: "Arrow keys move between decisions; Enter selects one.",
      replay: "Replay",
      hash: "Hash",
      chain: "Chain",
      noPayment: "No payment",
      notBroadcast: "Not broadcast",
      empty: "No decisions recorded yet",
      emptyHint: "Decisions appear here once the traveler has made a request.",
      loadError: "The ledger could not be loaded",
      loading: "Loading decisions",
    },
    payments: {
      description:
        "Every broadcast payment at a glance, as read back from Sepolia. Select an entry to open its decision above.",
      entry: "Entry",
      tx: "Transaction",
      recipient: "Recipient",
      amount: "Amount",
      memo: "Memo",
      receipt: "Receipt hash",
      decoded: "Decoded memo",
      unread: "Could not be read",
      open: (id: string) => `Show decision ${id}`,
      loading: "Loading payments",
    },
    card: {
      title: "Audit of this decision",
      back: "Back to decisions",
      /** Label before the source text; carries its own trailing space where the language uses one. */
      sourceLabel: "Source: ",
      openPrincipal: "Open in Principal",
      expected: "Expected",
      observed: "Observed",
      source: "Source",
      replay: {
        title: "Decision replay",
        recorded: "Recorded",
        recomputed: "Recomputed",
        source:
          "The ledger entry and the mandate terms: the policy re-run with spend rebuilt from earlier entries.",
        stopSame: "The stop reason recomputes to the same result.",
        stopCodesDiffer:
          "The stop recomputes, but with different stop codes than the recorded ones.",
        approveSame: "The approval recomputes to the same result.",
        differs: "The recomputed decision differs from the recorded one.",
        notAudited:
          "Recorded after this audit ran. Re-run the checks to include it.",
        pauseNote:
          "Replay reads a pause only from an entry’s own stop reason: it cannot show whether the mandate was paused when a payment was approved.",
      },
      hash: {
        title: "Mandate hash in the entry",
        expected: "Recomputed from the terms",
        observed: "Carried by the ledger entry",
      },
      chain: {
        title: "Chain record",
        stopped:
          "A stopped request is never sent, so there is no chain record to read.",
        notBroadcast:
          "Approved but not broadcast yet: there is no transaction to read.",
        notAudited:
          "Broadcast after this audit ran. Re-run the checks to include it.",
        recipient: "Recipient",
        recipientExpected: (merchantId: string) =>
          `Catalog wallet of ${merchantId}`,
        recipientWhat: "recipient wallet",
        amount: "Amount",
        amountExpected: "Approved amount",
        amountObserved: "Transaction value at the demo rate",
        memo: "Memo",
        memoExpected: "PERDIEM|mandate hash|receipt hash",
        receipt: "Receipt hash",
        receiptExpected: "Stored in the entry",
        receiptObserved:
          "Recomputed from the entry (the API returns the result, not the value)",
        receiptWhat: "receipt hash",
        payerMined:
          "The sender and mined checks are counted in the totals only.",
        tx: "Transaction on Sepolia",
        unread:
          "The transaction could not be read from Sepolia: recipient, amount and memo were not compared, and the audit counts them as failed. Re-run the checks to try again.",
        txWhat: "transaction",
      },
    },
    verify: {
      title: "Reproduce this audit from the files",
      body: "Download the two records, then run the script: it needs no app and no database, only the files plus a public Sepolia RPC. It recomputes every hash and decision and reads each transaction’s calldata.",
      byHand:
        "By hand: open any transaction on Etherscan → Input Data → View as UTF-8, and compare the two hashes with the records above.",
      tamper:
        "Tamper test: in the downloaded ledger, change one stopped entry’s \"decision\" from \"STOP\" to \"APPROVE\" and run the script again. That entry’s replay check fails (stored APPROVE, recomputed STOP).",
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
    generated: "Generated",
    records: "Records",
    recordsLive: "Live · Sepolia testnet",
    recordsMock: "Mock data · placeholder hashes, not evidence",
    authority: "Authority",
    terms: {
      title: "Mandate terms",
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
        "A payment is also stopped outside the trip window, above the per-payment cap, over the remaining budget including the network fee, when the fee cannot be estimated, or as a duplicate within 5 minutes.",
    },
    verification: {
      title: "Verification scope and result",
      scope: (entries: number, payments: number) =>
        `Recomputed from the records: the mandate terms, ${entries} ledger ${entries === 1 ? "entry" : "entries"} and ${payments} ${payments === 1 ? "payment" : "payments"} read back from Sepolia.`,
      checkedAt: (at: string) => `Checked ${at}.`,
      area: "Area",
      checks: "Checks",
      result: "Result",
      explanation:
        "Anchor: the recomputed mandate hash equals the memo of the anchor transaction. Replay: every entry re-run through the policy with spend rebuilt from earlier entries (2 checks each). Payments: memo, receipt hash, recipient and amount read back from Sepolia (4 each). Payer and mined: the anchor and every payment were sent by the mandate's agent wallet, and each payment was mined and succeeded (1 + 2 per payment).",
      limitation:
        "Replay cannot show whether the mandate was paused when a payment was approved; pause and resume are in the server log.",
      couldNotRun: (error: string) => `Checks could not run: ${error}`,
      running: "Running the checks…",
    },
    spend: {
      title: "Approved spend and stopped requests",
      note: "Kept apart: approved payments count against the budget; stopped requests were never sent and count $0.00.",
      approved: "Approved spend",
      approvedCount: (n: number) =>
        `${n} approved ${n === 1 ? "payment" : "payments"} (approved, pending or settled), network fees included`,
      budget: "Budget",
      spent: "Spent",
      pending: "Of which pending",
      pendingHint: "already counted in spent",
      remaining: "Remaining",
      failed: (n: number, usd: string) =>
        `${n} failed ${n === 1 ? "payment" : "payments"} (requested ${usd}) did not complete and ${n === 1 ? "is" : "are"} not counted.`,
      stopped: "Stopped requests",
      stoppedCount: (n: number) =>
        `${n} ${n === 1 ? "request" : "requests"} stopped by the rules; nothing was sent`,
      requested: "Requested",
      counted: "Counted against the budget",
      codes: "Stop codes",
      none: "None",
    },
    ledger: {
      title: "Ledger annex · oldest first",
      summary: (c: LedgerCounts) =>
        `${c.total} decision${c.total === 1 ? "" : "s"}: ${c.settled} settled · ${c.pending} pending · ${c.stopped} stopped · ${c.failed} failed` +
        (c.approved > 0 ? ` · ${c.approved} approved, not broadcast` : ""),
      when: "When",
      merchantRequest: "Merchant · request",
      outcome: "Decision",
      requested: "Requested",
      counted: "Counted",
      remaining: "Remaining",
      openingBudget: "Opening budget",
      empty: "No decisions recorded yet.",
      /** The traveler's own request text (data), quoted. */
      quote: (text: string) => `“${text}”`,
      status: {
        stopped: "nothing sent",
        settled: "settled on-chain",
        pendingTx: "pending · awaiting confirmation",
        pending: "pending",
        approved: "not broadcast yet",
        failedTx: "failed on-chain · not counted",
        failed: "broadcast did not confirm · not counted",
      },
      fee: (usd: string) => `incl. fee ${usd}`,
      feeNone: "no fee recorded",
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
        " from the audit page (Verify it yourself), then run in a clone of the repository:",
      reviewedBy: "Reviewed by",
      date: "Date",
    },
  },
};

export const ko: typeof en = {
  index: {
    loadError: "위임을 불러오지 못했습니다",
    emptyTitle: "아직 감사할 항목이 없습니다",
    emptyDescription: "위임자 페이지에서 먼저 위임을 발급하세요.",
  },
  checksPassed: (passed, total) => `검증 ${total}건 중 ${passed}건 통과`,
  checksFailed: (failed, total) => `검증 ${total}건 중 ${failed}건 실패`,
  notFound: (id) => `위임 ${id}을(를) 찾을 수 없습니다`,
  notAnchored: "앵커링되지 않음",
  areas: {
    anchor: {
      title: "위임 해시 vs 온체인 앵커",
      scope:
        "위임 조건으로 다시 계산한 해시를 앵커 트랜잭션의 메모와 비교합니다.",
    },
    replay: {
      title: "결정 재실행 vs 기록된 결정",
      scope:
        "각 장부 항목을 정책으로 다시 실행하며, 사용액은 이전 항목만으로 다시 계산합니다. 항목당 검증 2건: 같은 결정인지, 이 위임의 해시를 담고 있는지 확인합니다.",
    },
    payments: {
      title: "각 결제의 체인 기록",
      scope:
        "전송된 각 결제를 Sepolia에서 다시 읽어 수취인, 금액, 메모, 영수증 해시를 확인합니다. 결제당 검증 4건입니다.",
    },
    payerMined: {
      title: "송금자·채굴",
      scope:
        "앵커와 모든 결제가 에이전트 지갑에서 전송되었고, 각 결제가 채굴되어 성공했는지 확인합니다. API는 합계만 반환하며, 검증 스크립트는 한 줄씩 출력합니다.",
    },
  },
  count: {
    passed: (ok, of) => `${of}건 중 ${ok}건 통과`,
    failed: (bad, of) => `${of}건 중 ${bad}건 실패`,
    none: "확인할 항목 없음",
  },
  empty: {
    replay: "아직 재실행할 장부 항목이 없습니다.",
    payments: "전송된 결제가 없어 다시 읽을 내용이 없습니다.",
  },
  notAnchoredNote:
    "앵커 트랜잭션이 기록되지 않아 해시를 온체인과 비교할 수 없습니다. 감사는 이를 실패한 검증 1건으로 집계합니다.",
  page: {
    eyebrow: "감사",
    titleBefore: "기록만으로 ",
    titleAfter: " 검증",
    description:
      "어떤 기록을 어떤 방식으로 검증했고 무엇이 일치하는지 보여 줍니다. 저장된 결정을 신뢰하지 않고, 위임 조건과 장부로 모두 다시 계산합니다.",
    printable: "인쇄용 정산서",
    rerun: "다시 검증",
    rerunning: "검증하는 중…",
    runError: "감사를 실행할 수 없습니다",
    stale: (message) => `이전 결과를 표시합니다. 재실행 실패: ${message}`,
    loading: "감사 불러오는 중",
    summary: {
      title: "검증 결과",
      running: "검증을 실행하는 중…",
      notRun: "검증이 실행되지 않았습니다",
      recomputes: "저장된 결정을 그대로 믿지 않고 모두 다시 계산합니다.",
      previous: (text) => `이전 결과: ${text}`,
      records: "검증한 기록",
      checked: "검증 시각",
      source: "출처",
      live: "실제 기록 · Sepolia 테스트넷",
      mock: "모의 데이터 · 임시 해시, 증빙 아님",
      mandate: "위임",
      recomputedHash: "위임 해시(재계산)",
      entries: "장부 항목",
      payments: "다시 읽은 결제",
      newer: (now, audited) =>
        `장부에는 이제 항목이 ${now}건 있지만 이 감사는 ${audited}건을 다뤘습니다. 나머지를 포함하려면 다시 검증하세요.`,
      areas: "검증 항목",
    },
    attention: {
      title: "확인 필요",
      intro:
        "아래 검증은 기록과 일치하지 않습니다. 규칙에 따른 중단은 여기에 표시하지 않습니다. 같은 결과로 다시 계산되는 중단은 일관된 기록입니다.",
      anchorUnread:
        "Sepolia에서 앵커 트랜잭션을 읽지 못해 메모를 비교하지 못했습니다. 감사는 이를 실패한 검증으로 집계합니다.",
      unread:
        "Sepolia에서 트랜잭션을 읽지 못해 수취인, 금액, 메모를 비교하지 못했습니다. 감사는 이를 실패한 검증으로 집계합니다.",
      payerMinedHint: (n) =>
        `다시 읽은 결제 중 ${n}건이 장부에서 대기 또는 실패 상태입니다. 채굴되어 성공하지 않은 결제는 채굴 검증에서 실패합니다.`,
      introUnverified:
        "필요한 기록이 없거나 읽지 못해 아래 검증을 완료하지 못했습니다. 감사는 이를 실패로 집계합니다.",
      show: "결정 보기",
      anchor: "앵커 메모에 재계산한 위임 해시가 없습니다.",
      notAnchored: "앵커 트랜잭션이 기록되지 않았습니다.",
      decision: "다시 계산한 결정이 기록된 결정과 다릅니다.",
      hash: "항목에 다른 위임 해시가 담겨 있습니다.",
      recipient: "온체인 수취인이 가맹점의 카탈로그 지갑이 아닙니다.",
      amount: "온체인 금액이 승인 금액과 다릅니다.",
      memo: "calldata의 메모가 예상 메모와 다릅니다.",
      receipt: "다시 계산한 영수증 해시가 저장된 값과 다릅니다.",
      payerMined: (bad, of) =>
        `송금자·채굴 검증 ${of}건 중 ${bad}건이 실패했습니다. API는 합계만 반환하므로, 어느 항목인지 보려면 검증 스크립트를 실행하세요.`,
    },
    anchor: {
      rule: "앵커 트랜잭션의 메모는 PERDIEM-MANDATE|<조건으로 다시 계산한 해시>와 같아야 합니다.",
      check: "앵커 메모에 재계산한 해시가 있음",
      expected: "예상값",
      observed: "관측값",
      source: "출처",
      expectedCaption: "조건으로 다시 계산(keccak256)",
      observedCaption: "앵커 트랜잭션 calldata에서 디코딩한 메모",
      noMemo: "메모 없음",
      sourceCaption: "Sepolia의 앵커 트랜잭션",
      storedHash: "저장된 위임 해시",
      storedSame: "재계산한 해시와 같은 값(집계 제외)",
      storedDiffers: "재계산한 해시와 다름(집계 제외)",
      showTerms: "해시된 조건 보기(JSON)",
      hideTerms: "해시된 조건 숨기기(JSON)",
      termsNote:
        "해시된 조건에는 카탈로그 스냅숏이 포함됩니다. 상태는 조건과 따로 저장되므로 일시정지해도 해시는 바뀌지 않습니다.",
      statusNote: "변경 가능, 해시 대상 아님",
      unread: "앵커 트랜잭션을 읽지 못함",
      hashWhat: "재계산한 위임 해시",
      storedWhat: "저장된 위임 해시",
      anchorWhat: "앵커 트랜잭션",
    },
    decisions: {
      title: "결정: 재실행과 체인 기록",
      description:
        "승인과 중단이 장부에 나란히 남습니다. 결정을 선택하면 무엇을 어떤 기록으로 다시 계산했는지와 그 증빙을 볼 수 있습니다.",
      listLabel: "감사한 결정",
      keyboard: "화살표 키로 결정 사이를 이동하고 Enter로 선택합니다.",
      replay: "재실행",
      hash: "해시",
      chain: "체인",
      noPayment: "결제 없음",
      notBroadcast: "전송 전",
      empty: "아직 기록된 결정이 없습니다",
      emptyHint: "출장자가 요청하면 여기에 결정이 표시됩니다.",
      loadError: "장부를 불러오지 못했습니다",
      loading: "결정 불러오는 중",
    },
    payments: {
      description:
        "Sepolia에서 다시 읽은 전송된 결제를 한눈에 보여 줍니다. 항목을 선택하면 위에서 해당 결정이 열립니다.",
      entry: "항목",
      tx: "트랜잭션",
      recipient: "수취인",
      amount: "금액",
      memo: "메모",
      receipt: "영수증 해시",
      decoded: "디코딩한 메모",
      unread: "읽지 못함",
      open: (id) => `결정 ${id} 보기`,
      loading: "결제 불러오는 중",
    },
    card: {
      title: "이 결정의 감사",
      back: "결정 목록으로",
      sourceLabel: "출처: ",
      openPrincipal: "위임자 화면에서 열기",
      expected: "예상값",
      observed: "관측값",
      source: "출처",
      replay: {
        title: "결정 재실행",
        recorded: "기록",
        recomputed: "재계산",
        source:
          "장부 항목과 위임 조건: 이전 항목으로 사용액을 다시 만든 뒤 정책을 다시 실행했습니다.",
        stopSame: "중단 사유가 같은 결과로 다시 계산됩니다.",
        stopCodesDiffer:
          "중단으로 다시 계산되지만 중단 코드가 기록과 다릅니다.",
        approveSame: "승인이 같은 결과로 다시 계산됩니다.",
        differs: "다시 계산한 결정이 기록된 결정과 다릅니다.",
        notAudited:
          "이 감사 이후에 기록되었습니다. 포함하려면 다시 검증하세요.",
        pauseNote:
          "재실행은 항목 자체의 중단 사유로만 일시정지를 읽습니다. 결제가 승인될 때 위임이 일시정지 상태였는지는 알 수 없습니다.",
      },
      hash: {
        title: "항목의 위임 해시",
        expected: "조건으로 다시 계산",
        observed: "장부 항목에 담긴 값",
      },
      chain: {
        title: "체인 기록",
        stopped:
          "중단된 요청은 전송되지 않으므로 읽을 체인 기록이 없습니다.",
        notBroadcast:
          "승인되었지만 아직 전송 전이라 읽을 트랜잭션이 없습니다.",
        notAudited:
          "이 감사 이후에 전송되었습니다. 포함하려면 다시 검증하세요.",
        recipient: "수취인",
        recipientExpected: (merchantId) => `${merchantId}의 카탈로그 지갑`,
        recipientWhat: "수취 지갑",
        amount: "금액",
        amountExpected: "승인 금액",
        amountObserved: "데모 환율로 환산한 트랜잭션 값",
        memo: "메모",
        memoExpected: "PERDIEM|위임 해시|영수증 해시",
        receipt: "영수증 해시",
        receiptExpected: "항목에 저장된 값",
        receiptObserved:
          "항목으로 다시 계산(API는 값이 아닌 결과만 반환합니다)",
        receiptWhat: "영수증 해시",
        payerMined: "송금자·채굴 검증은 합계에만 집계됩니다.",
        tx: "Sepolia의 트랜잭션",
        unread:
          "Sepolia에서 트랜잭션을 읽지 못했습니다. 수취인, 금액, 메모를 비교하지 못했고 감사는 이를 실패로 집계합니다. 다시 검증해 보세요.",
        txWhat: "트랜잭션",
      },
    },
    verify: {
      title: "파일로 이 감사 재현하기",
      body: "두 기록을 내려받은 뒤 스크립트를 실행합니다. 앱도 데이터베이스도 필요 없고, 파일과 공개 Sepolia RPC만 있으면 됩니다. 스크립트는 모든 해시와 결정을 다시 계산하고 각 트랜잭션의 calldata를 읽습니다.",
      byHand:
        "수동 확인: Etherscan에서 아무 트랜잭션이나 열고 Input Data → View as UTF-8을 선택한 뒤, 두 해시를 위 기록과 비교합니다.",
      tamper:
        "변조 테스트: 내려받은 장부에서 중단된 항목 하나의 \"decision\"을 \"STOP\"에서 \"APPROVE\"로 바꾼 뒤 스크립트를 다시 실행합니다. 그 항목의 재실행 검증이 실패합니다(저장값 APPROVE, 재계산 STOP).",
    },
  },
  report: {
    docTitle: (id) => `PerDiem 출장 정산서 ${id}`,
    back: "감사로 돌아가기",
    printHint: "인쇄 대화상자에서 “머리글과 바닥글”을 해제하세요.",
    print: "인쇄 / PDF로 저장",
    buildError: "정산서를 만들 수 없습니다",
    heading: "출장 정산서",
    generated: "생성",
    records: "기록",
    recordsLive: "실제 기록 · Sepolia 테스트넷",
    recordsMock: "모의 데이터 · 임시 해시, 증빙 아님",
    authority: "권한",
    terms: {
      title: "위임 조건",
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
        "출장 기간 밖이거나, 1회 결제 한도를 넘거나, 네트워크 수수료를 포함해 잔액을 넘거나, 수수료를 추정할 수 없거나, 5분 안의 중복 결제인 경우에도 결제는 중단됩니다.",
    },
    verification: {
      title: "검증 범위와 결과",
      scope: (entries, payments) =>
        `기록으로 다시 계산했습니다: 위임 조건, 장부 항목 ${entries}건, Sepolia에서 다시 읽은 결제 ${payments}건.`,
      checkedAt: (at) => `검증 시각 ${at}.`,
      area: "영역",
      checks: "검증",
      result: "결과",
      explanation:
        "앵커: 재계산한 위임 해시가 앵커 트랜잭션의 메모와 같습니다. 재실행: 모든 항목을 정책으로 다시 실행하며, 사용액은 이전 항목으로 다시 계산합니다(항목당 2건). 결제: 메모, 영수증 해시, 수취인, 금액을 Sepolia에서 다시 읽습니다(결제당 4건). 송금자·채굴: 앵커와 모든 결제가 위임의 에이전트 지갑에서 전송되었고, 각 결제가 채굴되어 성공했습니다(1 + 결제당 2건).",
      limitation:
        "재실행으로는 결제 승인 시점에 위임이 일시정지 상태였는지 알 수 없습니다. 일시정지와 재개는 서버 로그에 남습니다.",
      couldNotRun: (error) => `검증을 실행할 수 없습니다: ${error}`,
      running: "검증을 실행하는 중…",
    },
    spend: {
      title: "승인 지출과 중단된 요청",
      note: "따로 표시합니다. 승인된 결제는 예산에서 차감되고, 중단된 요청은 전송되지 않았으므로 $0.00으로 집계합니다.",
      approved: "승인 지출",
      approvedCount: (n) =>
        `승인된 결제 ${n}건(승인·대기·정산 완료), 네트워크 수수료 포함`,
      budget: "예산",
      spent: "사용액",
      pending: "그중 대기",
      pendingHint: "사용액에 이미 포함",
      remaining: "잔액",
      failed: (n, usd) =>
        `실패한 결제 ${n}건(요청 ${usd})은 완료되지 않아 집계하지 않습니다.`,
      stopped: "중단된 요청",
      stoppedCount: (n) => `규칙에 따라 중단된 요청 ${n}건, 전송 없음`,
      requested: "요청 금액",
      counted: "예산 차감액",
      codes: "중단 코드",
      none: "없음",
    },
    ledger: {
      title: "장부 부록 · 오래된 순",
      summary: (c) =>
        `결정 ${c.total}건: 정산 완료 ${c.settled} · 대기 중 ${c.pending} · 중단됨 ${c.stopped} · 실패 ${c.failed}` +
        (c.approved > 0 ? ` · 승인됨(미전송) ${c.approved}` : ""),
      when: "일시",
      merchantRequest: "가맹점 · 요청",
      outcome: "결정",
      requested: "요청 금액",
      counted: "집계액",
      remaining: "잔액",
      openingBudget: "시작 예산",
      empty: "아직 기록된 결정이 없습니다.",
      quote: (text) => `“${text}”`,
      status: {
        stopped: "전송 없음",
        settled: "온체인 정산 완료",
        pendingTx: "대기 중 · 확인 대기",
        pending: "대기 중",
        approved: "아직 전송 전",
        failedTx: "온체인 실패 · 미집계",
        failed: "전송 미확인 · 미집계",
      },
      fee: (usd) => `수수료 ${usd} 포함`,
      feeNone: "기록된 수수료 없음",
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
        "기록만으로 재구성하려면 감사 페이지(직접 검증하기)에서 ",
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
  checksPassed: (passed, total) => `検証 ${total} 件中 ${passed} 件合格`,
  checksFailed: (failed, total) => `検証 ${total} 件中 ${failed} 件失敗`,
  notFound: (id) => `委任 ${id} が見つかりません`,
  notAnchored: "未アンカー",
  areas: {
    anchor: {
      title: "委任ハッシュ vs オンチェーンのアンカー",
      scope:
        "委任条件から再計算したハッシュを、アンカートランザクションのメモと照合します。",
    },
    replay: {
      title: "判定のリプレイ vs 記録された判定",
      scope:
        "台帳の各エントリを、それ以前のエントリから再構成した使用額でポリシーに再度通します。エントリごとに 2 件：同じ判定であること、この委任のハッシュを持つことを確認します。",
    },
    payments: {
      title: "各支払いのチェーン記録",
      scope:
        "送信された各支払いを Sepolia から読み戻し、受取人、金額、メモ、レシートハッシュを確認します。支払いごとに 4 件です。",
    },
    payerMined: {
      title: "送金元・マイニング",
      scope:
        "アンカーとすべての支払いがエージェントウォレットから送信され、各支払いがマイニングされて成功したことを確認します。API は合計のみを返し、検証スクリプトは 1 行ずつ出力します。",
    },
  },
  count: {
    passed: (ok, of) => `${of} 件中 ${ok} 件合格`,
    failed: (bad, of) => `${of} 件中 ${bad} 件失敗`,
    none: "確認対象なし",
  },
  empty: {
    replay: "リプレイする台帳エントリはまだありません。",
    payments: "送信された支払いがないため、読み戻すものはありません。",
  },
  notAnchoredNote:
    "アンカートランザクションが記録されていないため、ハッシュをオンチェーンと照合できません。監査はこれを失敗した検証 1 件として数えます。",
  page: {
    eyebrow: "監査",
    titleBefore: "記録だけで ",
    titleAfter: " を検証",
    description:
      "どの記録をどう検証し、何が一致したかを示します。保存された判定は信用せず、委任条件と台帳からすべて再計算します。",
    printable: "印刷用精算書",
    rerun: "再検証",
    rerunning: "検証を実行中…",
    runError: "監査を実行できませんでした",
    stale: (message) =>
      `前回の結果を表示しています。再実行に失敗しました：${message}`,
    loading: "監査を読み込み中",
    summary: {
      title: "検証結果",
      running: "検証を実行中…",
      notRun: "検証はまだ実行されていません",
      recomputes: "保存された判定をそのまま信用せず、すべて再計算します。",
      previous: (text) => `前回の結果：${text}`,
      records: "検証した記録",
      checked: "検証日時",
      source: "出典",
      live: "実データ・Sepolia テストネット",
      mock: "モックデータ・仮のハッシュ、証跡ではありません",
      mandate: "委任",
      recomputedHash: "委任ハッシュ（再計算）",
      entries: "台帳エントリ",
      payments: "読み戻した支払い",
      newer: (now, audited) =>
        `台帳には現在 ${now} 件のエントリがありますが、この監査の対象は ${audited} 件です。残りを含めるには再検証してください。`,
      areas: "検証した内容",
    },
    attention: {
      title: "要確認",
      intro:
        "以下の検証は記録と一致しません。ルールによる停止はここに表示しません。同じ結果に再計算される停止は整合しています。",
      anchorUnread:
        "Sepolia からアンカートランザクションを読み取れなかったため、メモを照合していません。監査はこれを失敗した検証として数えます。",
      unread:
        "Sepolia からトランザクションを読み取れなかったため、受取人、金額、メモを照合していません。監査はこれらを失敗した検証として数えます。",
      payerMinedHint: (n) =>
        `読み戻した支払いのうち ${n} 件は台帳で保留中または失敗です。マイニングされて成功していない支払いは、マイニングの検証で不合格になります。`,
      introUnverified:
        "必要な記録がないか読み取れなかったため、以下の検証を完了できませんでした。監査はこれらを失敗として数えます。",
      show: "判定を表示",
      anchor: "アンカーのメモに再計算した委任ハッシュが含まれていません。",
      notAnchored: "アンカートランザクションが記録されていません。",
      decision: "再計算した判定が記録された判定と異なります。",
      hash: "エントリに別の委任ハッシュが含まれています。",
      recipient:
        "オンチェーンの受取人が加盟店のカタログウォレットではありません。",
      amount: "オンチェーンの金額が承認額と異なります。",
      memo: "calldata のメモが想定されるメモと異なります。",
      receipt: "再計算したレシートハッシュが保存値と異なります。",
      payerMined: (bad, of) =>
        `送金元・マイニングの検証 ${of} 件中 ${bad} 件が失敗しました。API は合計のみを返すため、どれかを確認するには検証スクリプトを実行してください。`,
    },
    anchor: {
      rule: "アンカートランザクションのメモは PERDIEM-MANDATE|<条件から再計算したハッシュ> と一致する必要があります。",
      check: "アンカーのメモに再計算したハッシュが含まれる",
      expected: "期待値",
      observed: "観測値",
      source: "出典",
      expectedCaption: "条件から再計算（keccak256）",
      observedCaption: "アンカートランザクションの calldata からデコードしたメモ",
      noMemo: "メモが見つかりません",
      sourceCaption: "Sepolia のアンカートランザクション",
      storedHash: "保存済みの委任ハッシュ",
      storedSame: "再計算したハッシュと同じ値（集計対象外）",
      storedDiffers: "再計算したハッシュと異なる（集計対象外）",
      showTerms: "ハッシュ化された条件を表示（JSON）",
      hideTerms: "ハッシュ化された条件を隠す（JSON）",
      termsNote:
        "ハッシュ化された条件にはカタログのスナップショットが含まれます。ステータスは別に保存されるため、一時停止してもハッシュは変わりません。",
      statusNote: "変更可能、ハッシュ対象外",
      unread: "アンカートランザクションを読み取れません",
      hashWhat: "再計算した委任ハッシュ",
      storedWhat: "保存済みの委任ハッシュ",
      anchorWhat: "アンカートランザクション",
    },
    decisions: {
      title: "判定：リプレイとチェーン記録",
      description:
        "承認と停止は台帳に並んで残ります。判定を選ぶと、何をどの記録から再計算したかと、その証跡を確認できます。",
      listLabel: "監査した判定",
      keyboard: "矢印キーで判定間を移動し、Enter で選択します。",
      replay: "リプレイ",
      hash: "ハッシュ",
      chain: "チェーン",
      noPayment: "支払いなし",
      notBroadcast: "未送信",
      empty: "記録された判定はまだありません",
      emptyHint: "出張者が依頼すると、ここに判定が表示されます。",
      loadError: "台帳を読み込めませんでした",
      loading: "判定を読み込み中",
    },
    payments: {
      description:
        "Sepolia から読み戻した送信済みの支払いを一覧にします。エントリを選ぶと、上でその判定が開きます。",
      entry: "エントリ",
      tx: "トランザクション",
      recipient: "受取人",
      amount: "金額",
      memo: "メモ",
      receipt: "レシートハッシュ",
      decoded: "デコードしたメモ",
      unread: "読み取れません",
      open: (id) => `判定 ${id} を表示`,
      loading: "支払いを読み込み中",
    },
    card: {
      title: "この判定の監査",
      back: "判定一覧に戻る",
      sourceLabel: "出典：",
      openPrincipal: "委任者画面で開く",
      expected: "期待値",
      observed: "観測値",
      source: "出典",
      replay: {
        title: "判定のリプレイ",
        recorded: "記録",
        recomputed: "再計算",
        source:
          "台帳エントリと委任条件：それ以前のエントリから使用額を再構成し、ポリシーを再実行しました。",
        stopSame: "停止理由は同じ結果に再計算されます。",
        stopCodesDiffer:
          "停止として再計算されますが、停止コードが記録と異なります。",
        approveSame: "承認は同じ結果に再計算されます。",
        differs: "再計算した判定が記録された判定と異なります。",
        notAudited:
          "この監査の後に記録されました。含めるには再検証してください。",
        pauseNote:
          "リプレイは一時停止をエントリ自身の停止理由からのみ読み取ります。支払いの承認時に委任が一時停止中だったかどうかはわかりません。",
      },
      hash: {
        title: "エントリの委任ハッシュ",
        expected: "条件から再計算",
        observed: "台帳エントリに含まれる値",
      },
      chain: {
        title: "チェーン記録",
        stopped:
          "停止された依頼は送信されないため、読み取るチェーン記録はありません。",
        notBroadcast:
          "承認済みですが未送信のため、読み取るトランザクションはありません。",
        notAudited:
          "この監査の後に送信されました。含めるには再検証してください。",
        recipient: "受取人",
        recipientExpected: (merchantId) =>
          `${merchantId} のカタログウォレット`,
        recipientWhat: "受取ウォレット",
        amount: "金額",
        amountExpected: "承認額",
        amountObserved: "デモ用レートで換算したトランザクションの値",
        memo: "メモ",
        memoExpected: "PERDIEM|委任ハッシュ|レシートハッシュ",
        receipt: "レシートハッシュ",
        receiptExpected: "エントリに保存された値",
        receiptObserved:
          "エントリから再計算（API は値ではなく結果のみを返します）",
        receiptWhat: "レシートハッシュ",
        payerMined: "送金元とマイニングの検証は合計にのみ計上されます。",
        tx: "Sepolia のトランザクション",
        unread:
          "Sepolia からトランザクションを読み取れませんでした。受取人、金額、メモは照合しておらず、監査はこれらを失敗として数えます。再検証してください。",
        txWhat: "トランザクション",
      },
    },
    verify: {
      title: "ファイルからこの監査を再現する",
      body: "2 つの記録をダウンロードしてスクリプトを実行します。アプリもデータベースも不要で、ファイルと公開 Sepolia RPC だけで動きます。すべてのハッシュと判定を再計算し、各トランザクションの calldata を読み取ります。",
      byHand:
        "手動で確認：Etherscan で任意のトランザクションを開き、Input Data → View as UTF-8 を選んで、2 つのハッシュを上の記録と照合します。",
      tamper:
        "改ざんテスト：ダウンロードした台帳で、停止されたエントリ 1 件の \"decision\" を \"STOP\" から \"APPROVE\" に変えて、スクリプトを再実行します。そのエントリのリプレイ検証が失敗します（保存値 APPROVE、再計算 STOP）。",
    },
  },
  report: {
    docTitle: (id) => `PerDiem 出張精算書 ${id}`,
    back: "監査に戻る",
    printHint: "印刷ダイアログで「ヘッダーとフッター」をオフにしてください。",
    print: "印刷 / PDF に保存",
    buildError: "精算書を作成できませんでした",
    heading: "出張精算書",
    generated: "作成",
    records: "記録",
    recordsLive: "実データ・Sepolia テストネット",
    recordsMock: "モックデータ・仮のハッシュ、証跡ではありません",
    authority: "権限",
    terms: {
      title: "委任条件",
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
        "出張期間外、1回あたりの上限超過、ネットワーク手数料込みでの残額超過、手数料を見積もれない場合、または 5 分以内の重複の場合も支払いは停止されます。",
    },
    verification: {
      title: "検証の範囲と結果",
      scope: (entries, payments) =>
        `記録から再計算しました：委任条件、台帳エントリ ${entries} 件、Sepolia から読み戻した支払い ${payments} 件。`,
      checkedAt: (at) => `検証日時 ${at}。`,
      area: "領域",
      checks: "検証",
      result: "結果",
      explanation:
        "アンカー：再計算した委任ハッシュとアンカートランザクションのメモが一致すること。リプレイ：各エントリを、それ以前のエントリから再構成した使用額でポリシーに再度通すこと（各 2 件）。支払い：メモ、レシートハッシュ、受取人、金額を Sepolia から読み戻すこと（各 4 件）。送金元・マイニング：アンカーとすべての支払いが委任のエージェントウォレットから送信され、各支払いがマイニングされて成功していること（1 + 支払いごとに 2 件）。",
      limitation:
        "リプレイでは、支払いの承認時に委任が一時停止中だったかどうかはわかりません。一時停止と再開はサーバーログに記録されます。",
      couldNotRun: (error) => `検証を実行できませんでした：${error}`,
      running: "検証を実行中…",
    },
    spend: {
      title: "承認済み支出と停止された依頼",
      note: "分けて記載します。承認された支払いは予算から差し引かれ、停止された依頼は送信されていないため $0.00 として計上します。",
      approved: "承認済み支出",
      approvedCount: (n) =>
        `承認された支払い ${n} 件（承認済み・保留中・決済完了）、ネットワーク手数料込み`,
      budget: "予算",
      spent: "使用額",
      pending: "うち保留中",
      pendingHint: "使用額に計上済み",
      remaining: "残額",
      failed: (n, usd) =>
        `失敗した支払い ${n} 件（依頼額 ${usd}）は完了しておらず、計上していません。`,
      stopped: "停止された依頼",
      stoppedCount: (n) => `ルールにより停止された依頼 ${n} 件、送金なし`,
      requested: "依頼額",
      counted: "予算への計上額",
      codes: "停止コード",
      none: "なし",
    },
    ledger: {
      title: "台帳付録・古い順",
      summary: (c) =>
        `判定 ${c.total} 件：決済完了 ${c.settled}・保留中 ${c.pending}・停止 ${c.stopped}・失敗 ${c.failed}` +
        (c.approved > 0 ? `・承認済み（未送信）${c.approved}` : ""),
      when: "日時",
      merchantRequest: "加盟店・依頼",
      outcome: "判定",
      requested: "依頼額",
      counted: "計上額",
      remaining: "残額",
      openingBudget: "当初予算",
      empty: "記録された判定はまだありません。",
      quote: (text) => `「${text}」`,
      status: {
        stopped: "送金なし",
        settled: "オンチェーンで決済完了",
        pendingTx: "保留中・確認待ち",
        pending: "保留中",
        approved: "未送信",
        failedTx: "オンチェーンで失敗・計上なし",
        failed: "送信が確認されず・計上なし",
      },
      fee: (usd) => `手数料 ${usd} を含む`,
      feeNone: "記録された手数料なし",
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
        "記録だけで再構成するには、監査ページ（自分で検証する）から ",
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
  checksPassed: (passed, total) => `${total} 项校验中 ${passed} 项通过`,
  checksFailed: (failed, total) => `${total} 项校验中 ${failed} 项失败`,
  notFound: (id) => `未找到授权 ${id}`,
  notAnchored: "未锚定",
  areas: {
    anchor: {
      title: "授权哈希 vs 链上锚定",
      scope: "由授权条款重新计算的哈希，与锚定交易的备注比对。",
    },
    replay: {
      title: "决策重放 vs 已记录的决策",
      scope:
        "每条账本记录都用策略重新运行，已用金额仅由之前的记录重建。每条 2 项：决策相同，且带有本授权的哈希。",
    },
    payments: {
      title: "每笔付款的链上记录",
      scope:
        "从 Sepolia 读回每笔已广播的付款：收款方、金额、备注和收据哈希。每笔 4 项。",
    },
    payerMined: {
      title: "付款方与上链",
      scope:
        "锚定交易和每笔付款均由代理钱包发出，且每笔付款均已上链并成功。API 只返回合计，校验脚本会逐行输出。",
    },
  },
  count: {
    passed: (ok, of) => `${of} 项中 ${ok} 项通过`,
    failed: (bad, of) => `${of} 项中 ${bad} 项失败`,
    none: "无需校验",
  },
  empty: {
    replay: "暂无可重放的账本记录。",
    payments: "尚无已广播的付款，因此没有可读回的内容。",
  },
  notAnchoredNote:
    "未记录锚定交易，因此无法在链上比对哈希。审计将此计为 1 项失败的校验。",
  page: {
    eyebrow: "审计",
    titleBefore: "仅凭记录验证 ",
    titleAfter: "",
    description:
      "显示校验了哪些记录、如何校验，以及哪些一致。不信任已存储的决策，而是由授权条款和账本全部重新计算。",
    printable: "打印版结算单",
    rerun: "重新校验",
    rerunning: "正在校验…",
    runError: "无法执行审计",
    stale: (message) => `正在显示上次结果。重新运行失败：${message}`,
    loading: "正在加载审计",
    summary: {
      title: "校验结果",
      running: "正在执行校验…",
      notRun: "尚未执行校验",
      recomputes: "不直接信任任何已存储的决策，而是全部重新计算。",
      previous: (text) => `上次结果：${text}`,
      records: "已校验的记录",
      checked: "校验时间",
      source: "来源",
      live: "真实记录 · Sepolia 测试网",
      mock: "模拟数据 · 占位哈希，不作为证据",
      mandate: "授权",
      recomputedHash: "授权哈希（重新计算）",
      entries: "账本记录",
      payments: "已读回的付款",
      newer: (now, audited) =>
        `账本现有 ${now} 条记录，本次审计覆盖 ${audited} 条。请重新校验以包含其余记录。`,
      areas: "校验内容",
    },
    attention: {
      title: "需要关注",
      intro:
        "以下校验与记录不一致。按规则拦截不会列在这里：重新计算后结果相同的拦截是一致的。",
      anchorUnread:
        "无法从 Sepolia 读取锚定交易，因此未比对其备注。审计将此计为一项未通过的校验。",
      unread:
        "无法从 Sepolia 读取该交易，因此未比对收款方、金额和备注。审计将这些计为未通过的校验。",
      payerMinedHint: (n) =>
        `已读回的付款中有 ${n} 笔在账本中为待确认或失败：未上链成功的付款无法通过上链校验。`,
      introUnverified:
        "由于所需记录缺失或无法读取，以下校验未能完成。审计将其计为未通过。",
      show: "查看决策",
      anchor: "锚定备注中没有重新计算的授权哈希。",
      notAnchored: "未记录锚定交易。",
      decision: "重新计算的决策与已记录的决策不同。",
      hash: "该记录带有不同的授权哈希。",
      recipient: "链上收款方不是该商户的目录钱包。",
      amount: "链上金额与批准金额不同。",
      memo: "calldata 中的备注与预期备注不同。",
      receipt: "重新计算的收据哈希与存储值不同。",
      payerMined: (bad, of) =>
        `付款方与上链校验 ${of} 项中 ${bad} 项失败。API 只返回合计；请运行校验脚本查看具体是哪几项。`,
    },
    anchor: {
      rule: "锚定交易的备注必须等于 PERDIEM-MANDATE|<由条款重新计算的哈希>。",
      check: "锚定备注包含重新计算的哈希",
      expected: "预期值",
      observed: "观测值",
      source: "来源",
      expectedCaption: "由条款重新计算（keccak256）",
      observedCaption: "从锚定交易 calldata 解码的备注",
      noMemo: "未找到备注",
      sourceCaption: "Sepolia 上的锚定交易",
      storedHash: "已存储的授权哈希",
      storedSame: "与重新计算的哈希相同（不计入）",
      storedDiffers: "与重新计算的哈希不同（不计入）",
      showTerms: "显示经过哈希的条款（JSON）",
      hideTerms: "隐藏经过哈希的条款（JSON）",
      termsNote:
        "经过哈希的条款包含商户目录快照。状态单独存放，因此暂停不会改变哈希。",
      statusNote: "可变，不计入哈希",
      unread: "无法读取锚定交易",
      hashWhat: "重新计算的授权哈希",
      storedWhat: "已存储的授权哈希",
      anchorWhat: "锚定交易",
    },
    decisions: {
      title: "决策：重放与链上记录",
      description:
        "批准和拦截并列保留在账本中。选择一项决策，可查看重新计算了什么、依据哪条记录，以及它的证据。",
      listLabel: "已审计的决策",
      keyboard: "用方向键在决策之间移动，按 Enter 选择。",
      replay: "重放",
      hash: "哈希",
      chain: "链上",
      noPayment: "无付款",
      notBroadcast: "未广播",
      empty: "暂无决策记录",
      emptyHint: "出差人发出请求后，决策将显示在这里。",
      loadError: "无法加载账本",
      loading: "正在加载决策",
    },
    payments: {
      description:
        "一览从 Sepolia 读回的每笔已广播付款。选择一条记录，即可在上方打开对应的决策。",
      entry: "条目",
      tx: "交易",
      recipient: "收款方",
      amount: "金额",
      memo: "备注",
      receipt: "收据哈希",
      decoded: "解码后的备注",
      unread: "无法读取",
      open: (id) => `查看决策 ${id}`,
      loading: "正在加载付款",
    },
    card: {
      title: "此决策的审计",
      back: "返回决策列表",
      sourceLabel: "来源：",
      openPrincipal: "在委托方页面打开",
      expected: "预期值",
      observed: "观测值",
      source: "来源",
      replay: {
        title: "决策重放",
        recorded: "已记录",
        recomputed: "重新计算",
        source:
          "账本记录和授权条款：由之前的记录重建已用金额，并重新运行策略。",
        stopSame: "拦截原因重新计算后结果相同。",
        stopCodesDiffer: "重新计算后仍为拦截，但拦截代码与记录不同。",
        approveSame: "批准重新计算后结果相同。",
        differs: "重新计算的决策与已记录的决策不同。",
        notAudited: "在本次审计之后记录。请重新校验以包含它。",
        pauseNote:
          "重放只能从记录自身的拦截原因读取暂停状态，无法显示付款获批时授权是否处于暂停状态。",
      },
      hash: {
        title: "记录中的授权哈希",
        expected: "由条款重新计算",
        observed: "账本记录中携带的值",
      },
      chain: {
        title: "链上记录",
        stopped: "被拦截的请求不会发送，因此没有可读取的链上记录。",
        notBroadcast: "已批准但尚未广播，暂无可读取的交易。",
        notAudited: "在本次审计之后广播。请重新校验以包含它。",
        recipient: "收款方",
        recipientExpected: (merchantId) => `${merchantId} 的目录钱包`,
        recipientWhat: "收款钱包",
        amount: "金额",
        amountExpected: "批准金额",
        amountObserved: "按演示汇率换算的交易金额",
        memo: "备注",
        memoExpected: "PERDIEM|授权哈希|收据哈希",
        receipt: "收据哈希",
        receiptExpected: "记录中存储的值",
        receiptObserved: "由记录重新计算（API 只返回结果，不返回数值）",
        receiptWhat: "收据哈希",
        payerMined: "付款方与上链校验只计入合计。",
        tx: "Sepolia 上的交易",
        unread:
          "无法从 Sepolia 读取该交易：未比对收款方、金额和备注，审计将其计为未通过。请重新校验。",
        txWhat: "交易",
      },
    },
    verify: {
      title: "用文件复现本次审计",
      body: "下载两份记录后运行脚本：无需应用，也无需数据库，只需这些文件和一个公共 Sepolia RPC。脚本会重新计算每个哈希和决策，并读取每笔交易的 calldata。",
      byHand:
        "手动核对：在 Etherscan 上打开任意交易 → Input Data → View as UTF-8，并将两个哈希与上方记录比对。",
      tamper:
        "篡改测试：在下载的账本中，把一条已拦截记录的 \"decision\" 从 \"STOP\" 改为 \"APPROVE\"，然后重新运行脚本。该记录的重放校验会失败（存储值 APPROVE，重新计算为 STOP）。",
    },
  },
  report: {
    docTitle: (id) => `PerDiem 差旅结算单 ${id}`,
    back: "返回审计",
    printHint: "请在打印对话框中关闭“页眉和页脚”。",
    print: "打印 / 另存为 PDF",
    buildError: "无法生成结算单",
    heading: "差旅结算单",
    generated: "生成于",
    records: "记录",
    recordsLive: "真实数据 · Sepolia 测试网",
    recordsMock: "模拟数据 · 占位哈希，不作为证据",
    authority: "权限",
    terms: {
      title: "授权条款",
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
        "此外，超出差旅期间、超过单笔上限、含网络手续费后超出剩余预算、无法估算手续费，或 5 分钟内重复的付款也会被拦截。",
    },
    verification: {
      title: "校验范围与结果",
      scope: (entries, payments) =>
        `由记录重新计算：授权条款、${entries} 条账本记录，以及从 Sepolia 读回的 ${payments} 笔付款。`,
      checkedAt: (at) => `校验时间 ${at}。`,
      area: "范围",
      checks: "校验",
      result: "结果",
      explanation:
        "锚定：重新计算的授权哈希等于锚定交易的备注。重放：每条记录都重新通过策略运行，已用金额由之前的记录重建（每条 2 项）。付款：从 Sepolia 读回备注、收据哈希、收款方和金额（每笔 4 项）。付款方与上链：锚定交易和每笔付款均由该授权的代理钱包发出，且每笔付款均已上链并成功（1 + 每笔付款 2 项）。",
      limitation:
        "重放无法显示付款获批时授权是否处于暂停状态；暂停与恢复记录在服务器日志中。",
      couldNotRun: (error) => `无法执行校验：${error}`,
      running: "正在执行校验…",
    },
    spend: {
      title: "批准支出与被拦截的请求",
      note: "分开列示：已批准的付款计入预算；被拦截的请求从未发送，按 $0.00 计入。",
      approved: "批准支出",
      approvedCount: (n) =>
        `已批准付款 ${n} 笔（已批准、待确认或已结算），含网络手续费`,
      budget: "预算",
      spent: "已用",
      pending: "其中待确认",
      pendingHint: "已计入已用金额",
      remaining: "剩余",
      failed: (n, usd) => `失败付款 ${n} 笔（申请 ${usd}）未完成，不计入。`,
      stopped: "被拦截的请求",
      stoppedCount: (n) => `按规则拦截的请求 ${n} 笔，未发送任何款项`,
      requested: "申请金额",
      counted: "计入预算",
      codes: "拦截代码",
      none: "无",
    },
    ledger: {
      title: "账本附录 · 按时间先后",
      summary: (c) =>
        `共 ${c.total} 项决策：已结算 ${c.settled} · 待确认 ${c.pending} · 已拦截 ${c.stopped} · 失败 ${c.failed}` +
        (c.approved > 0 ? ` · 已批准（未广播）${c.approved}` : ""),
      when: "时间",
      merchantRequest: "商户 · 请求",
      outcome: "决策",
      requested: "申请金额",
      counted: "计入金额",
      remaining: "剩余",
      openingBudget: "期初预算",
      empty: "暂无决策记录。",
      quote: (text) => `“${text}”`,
      status: {
        stopped: "未发送",
        settled: "已在链上结算",
        pendingTx: "待确认 · 等待区块确认",
        pending: "待确认",
        approved: "尚未广播",
        failedTx: "链上失败 · 不计入",
        failed: "广播未确认 · 不计入",
      },
      fee: (usd) => `含手续费 ${usd}`,
      feeNone: "未记录手续费",
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
      reconstructBefore: "仅凭记录复现：从审计页面（自行验证）下载 ",
      reconstructMid: " 和 ",
      reconstructAfter: "，然后在克隆的仓库中运行：",
      reviewedBy: "审核人",
      date: "日期",
    },
  },
};
