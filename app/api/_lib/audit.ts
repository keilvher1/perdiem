import "server-only";
/**
 * app/api/_lib/audit.ts — the checks behind GET /api/audit/[mandateId]: the same boolean checks, in
 * the same order, as the ✅/❌ lines scripts/verify.ts prints for the exported records
 * (evidence/mandate-<id>.json + evidence/ledger-<id>.json), so summary.total == verify's line count:
 *
 *   1. anchor (if the mandate has an anchorTx)  anchor.memo    memo == `PERDIEM-MANDATE|<recomputed mandateHash>`
 *                                              anchor.sender  anchor tx sent by mandate.agentWallet
 *      (no anchorTx)                           anchor.memo    false ("cannot prove the terms were fixed")
 *   2. per ledger entry (replayLedger)          entry.mandateHash, entry.decision (stored == recomputed)
 *   3. per entry with a txHash, whatever its ledger status (pending/failed included):
 *        tx.receiptHash  receiptHash(entry) == stored            tx.memo      calldata == `PERDIEM|<hash>|<receiptHash>`
 *        tx.recipient    tx.to == catalog wallet of the merchant  tx.amount    |value USD - amountUsd| < 0.01
 *        tx.sender       tx.from == mandate.agentWallet           tx.mined     receipt shows the tx mined and succeeded
 *
 *   summary.total = (anchorTx ? 2 : 1) + 2 × ledger entries + 6 × ledger entries with a txHash
 *
 * Two deliberate differences, neither changes the count: tx.memo is compared against the hash
 * recomputed from the terms (verify.ts uses the entry's own copy; they are equal whenever
 * entry.mandateHash passes), and an RPC error fails that check instead of aborting the audit.
 * A reverted payment (ledger "failed") fails tx.mined, exactly as in verify.ts.
 *
 * contracts/api.ts has no field for anchor.sender, tx.sender or tx.mined (anchor.matches is the
 * memo check; TxCheck carries the other four tx checks), so they appear only in summary. Every
 * failed anchor/tx check is also logged as one {"kind":"audit_warning","check":<name>} line
 * (replay failures are visible in `replay`).
 *
 * Chain reads are injected (tests/audit.test.ts runs this offline). Read-only: never writes the DB.
 */
import type { AuditResponse, Hex, ReplayResult, TxCheck } from "@/contracts/api";
import { explorerTxUrl, getSettlementStatus, readMemo, type SettlementStatus } from "@/lib/chain";
import { findMerchant, mandateHash, receiptHash, replayLedger, type LedgerEntry, type Mandate } from "@/lib/policy";
import { errorMessage } from "./http";

export interface AuditChain {
  readMemo(txHash: Hex): Promise<{ from: Hex; to: Hex | null; valueUsd: number; memo: string }>;
  getSettlementStatus(txHash: Hex): Promise<SettlementStatus>;
}

export type AuditCheckName =
  | "anchor.memo"
  | "anchor.sender"
  | "entry.mandateHash"
  | "entry.decision"
  | "tx.receiptHash"
  | "tx.memo"
  | "tx.recipient"
  | "tx.amount"
  | "tx.sender"
  | "tx.mined";

export interface AuditCheck {
  check: AuditCheckName;
  entryId?: string;
  ok: boolean;
}

export interface AuditResult {
  mandateHash: Hex;
  anchor: AuditResponse["anchor"];
  replay: ReplayResult[];
  transactions: TxCheck[];
  /** One item per ✅/❌ line of scripts/verify.ts, in its order. */
  checks: AuditCheck[];
  summary: AuditResponse["summary"];
}

export interface AuditOptions {
  chain?: AuditChain;
  warn?: (line: string) => void;
}

const sameAddress = (a: string | null | undefined, b: string): boolean => !!a && a.toLowerCase() === b.toLowerCase();

export async function auditRecords(
  mandate: Mandate,
  anchorTx: Hex | null,
  ledger: LedgerEntry[],
  { chain = { readMemo, getSettlementStatus }, warn = (l) => console.warn(l) }: AuditOptions = {},
): Promise<AuditResult> {
  // Only the pure Mandate and pure LedgerEntry objects are hashed/replayed — never a view.
  const hash = mandateHash(mandate);
  const agent = mandate.agentWallet;
  const warnCheck = (fields: Record<string, unknown>) => warn(JSON.stringify({ kind: "audit_warning", mandateId: mandate.id, ...fields }));

  async function auditAnchor(): Promise<{ anchor: AuditResponse["anchor"]; checks: AuditCheck[] }> {
    if (!anchorTx) {
      warnCheck({ check: "anchor.memo", message: "no anchorTx: cannot prove the terms were fixed before spending" });
      return { anchor: { txHash: null, explorerUrl: null, memo: null, matches: false }, checks: [{ check: "anchor.memo", ok: false }] };
    }
    const base = { txHash: anchorTx, explorerUrl: explorerTxUrl(anchorTx) };
    try {
      const tx = await chain.readMemo(anchorTx);
      const matches = tx.memo === `PERDIEM-MANDATE|${hash}`;
      const sender = sameAddress(tx.from, agent);
      if (!matches) warnCheck({ check: "anchor.memo", txHash: anchorTx, memo: tx.memo });
      if (!sender) warnCheck({ check: "anchor.sender", txHash: anchorTx, from: tx.from, expected: agent });
      return {
        anchor: { ...base, memo: tx.memo, matches },
        checks: [
          { check: "anchor.memo", ok: matches },
          { check: "anchor.sender", ok: sender },
        ],
      };
    } catch (err) {
      warnCheck({ check: "anchor", txHash: anchorTx, message: errorMessage(err) });
      return {
        anchor: { ...base, memo: null, matches: false },
        checks: [
          { check: "anchor.memo", ok: false },
          { check: "anchor.sender", ok: false },
        ],
      };
    }
  }

  async function auditTx(e: LedgerEntry & { txHash: Hex }): Promise<{ tx: TxCheck; checks: AuditCheck[] }> {
    const [memoRes, statusRes] = await Promise.allSettled([chain.readMemo(e.txHash), chain.getSettlementStatus(e.txHash)]);
    const rh = receiptHash(e);
    const receiptHashMatches = rh === e.receiptHash; // from the records alone: no RPC needed
    const merchant = findMerchant(mandate, e.proposal.merchantId);
    const at = { entryId: e.id, txHash: e.txHash };

    let tx: TxCheck = {
      entryId: e.id,
      txHash: e.txHash,
      explorerUrl: explorerTxUrl(e.txHash),
      memo: "",
      memoMatches: false,
      receiptHashMatches,
      recipientMatches: false,
      amountMatches: false,
      valueUsd: 0,
      to: null,
    };
    let sender = false;
    if (memoRes.status === "fulfilled") {
      const t = memoRes.value;
      tx = {
        ...tx,
        memo: t.memo,
        // Against the hash recomputed from the terms (stricter than the entry's own copy).
        memoMatches: t.memo === `PERDIEM|${hash}|${rh}`,
        recipientMatches: !!merchant && sameAddress(t.to, merchant.wallet),
        amountMatches: Math.abs(t.valueUsd - e.proposal.amountUsd) < 0.01,
        valueUsd: t.valueUsd,
        to: t.to,
      };
      sender = sameAddress(t.from, agent);
      if (!sender) warnCheck({ check: "tx.sender", ...at, from: t.from, expected: agent });
    } else {
      warnCheck({ check: "tx", ...at, message: errorMessage(memoRes.reason) });
    }

    let mined = false;
    if (statusRes.status === "fulfilled") {
      mined = statusRes.value.state === "settled";
      if (!mined) warnCheck({ check: "tx.mined", ...at, ledgerStatus: e.status, chainState: statusRes.value.state });
    } else {
      warnCheck({ check: "tx.mined", ...at, message: errorMessage(statusRes.reason) });
    }

    return {
      tx,
      checks: [
        { check: "tx.receiptHash", entryId: e.id, ok: tx.receiptHashMatches },
        { check: "tx.memo", entryId: e.id, ok: tx.memoMatches },
        { check: "tx.recipient", entryId: e.id, ok: tx.recipientMatches },
        { check: "tx.amount", entryId: e.id, ok: tx.amountMatches },
        { check: "tx.sender", entryId: e.id, ok: sender },
        { check: "tx.mined", entryId: e.id, ok: mined },
      ],
    };
  }

  // Every broadcast payment, whatever its ledger status (pending ones included), in ledger order.
  const paid = ledger.filter((e): e is LedgerEntry & { txHash: Hex } => !!e.txHash);
  const [anchorPart, txParts] = await Promise.all([auditAnchor(), Promise.all(paid.map(auditTx))]);
  const replay = replayLedger(mandate, ledger);

  const checks: AuditCheck[] = [
    ...anchorPart.checks,
    ...replay.flatMap((r): AuditCheck[] => [
      { check: "entry.mandateHash", entryId: r.entryId, ok: r.mandateHashMatches },
      { check: "entry.decision", entryId: r.entryId, ok: r.consistent },
    ]),
    ...txParts.flatMap((p) => p.checks),
  ];
  const passed = checks.filter((c) => c.ok).length;
  return {
    mandateHash: hash,
    anchor: anchorPart.anchor,
    replay,
    transactions: txParts.map((p) => p.tx),
    checks,
    summary: { passed, total: checks.length, allVerified: passed === checks.length },
  };
}
