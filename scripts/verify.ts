/**
 * scripts/verify.ts — the auditor's tool. Works from RECORDS ALONE:
 * an exported mandate JSON, an exported ledger JSON, and a Sepolia RPC.
 * It never touches the app's database or API.
 *
 *   npx tsx scripts/verify.ts evidence/mandate-A.json evidence/ledger-A.json
 *
 * Checks, per the challenge's "Approval & Evidence" criterion:
 *  1. mandate hash recomputed from the JSON == hash anchored on-chain (anchorTx memo)
 *  2. every ledger entry replayed through policy.evaluate() == stored decision
 *  3. every settled entry's tx exists, went to the merchant in the catalog,
 *     and its calldata carries the same mandateHash + receiptHash as the ledger
 * Exit code 0 = all good, 1 = at least one ❌.
 */
import { readFileSync } from "node:fs";
import { mandateHash, receiptHash, replayLedger, findMerchant, type LedgerEntry, type Mandate } from "../lib/policy";
import { readMemo } from "../lib/chain";

type Exported = { mandate: Mandate; anchorTx?: `0x${string}` };

async function main() {
  const [mandatePath, ledgerPath] = process.argv.slice(2);
  if (!mandatePath || !ledgerPath) {
    console.error("usage: verify.ts <mandate.json> <ledger.json>");
    process.exit(2);
  }
  const { mandate, anchorTx } = JSON.parse(readFileSync(mandatePath, "utf8")) as Exported;
  const ledger = JSON.parse(readFileSync(ledgerPath, "utf8")) as LedgerEntry[];
  let bad = 0;
  const mark = (ok: boolean, msg: string) => {
    if (!ok) bad++;
    console.log(`${ok ? "✅" : "❌"} ${msg}`);
  };

  // 1. Mandate terms vs on-chain anchor
  const h = mandateHash(mandate);
  console.log(`mandate ${mandate.id} — recomputed hash ${h}`);
  if (anchorTx) {
    const memo = await readMemo(anchorTx);
    mark(memo.memo === `PERDIEM-MANDATE|${h}`, `anchor ${anchorTx} memo matches recomputed hash`);
  } else {
    mark(false, "no anchorTx in export — cannot prove the terms were fixed before spending");
  }

  // 2. Replay every decision
  const replay = replayLedger(mandate, ledger);
  for (const r of replay) {
    mark(r.mandateHashMatches, `${r.entryId}: entry carries the mandate hash`);
    mark(r.consistent, `${r.entryId}: stored ${r.storedDecision} == recomputed ${r.recomputedDecision}${r.recomputedReasons.length ? " (" + r.recomputedReasons.map((x) => x.code).join(", ") + ")" : ""}`);
  }

  // 3. On-chain evidence for every settled/pending payment
  for (const e of ledger) {
    if (!e.txHash) continue;
    const tx = await readMemo(e.txHash);
    const merchant = findMerchant(mandate, e.proposal.merchantId);
    mark(receiptHash(e) === e.receiptHash, `${e.id}: receipt hash recomputed from the entry == stored`);
    mark(tx.memo === `PERDIEM|${e.mandateHash}|${receiptHash(e)}`, `${e.id}: calldata memo == recomputed hashes`);
    mark(!!merchant && tx.to?.toLowerCase() === merchant.wallet.toLowerCase(), `${e.id}: paid to the catalog wallet of ${merchant?.name ?? e.proposal.merchantId}`);
    mark(Math.abs(tx.valueUsd - e.proposal.amountUsd) < 0.01, `${e.id}: on-chain value $${tx.valueUsd.toFixed(2)} == ledger amount $${e.proposal.amountUsd.toFixed(2)}`);
  }

  console.log(bad === 0 ? "\nALL RECORDS VERIFIED" : `\n${bad} CHECK(S) FAILED`);
  process.exit(bad === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
