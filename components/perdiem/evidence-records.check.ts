/**
 * components/perdiem/evidence-records.check.ts — proves the browser "Download records" files are
 * byte-identical to what scripts/export.ts wrote for the committed evidence mandate.
 *
 *   npx tsx components/perdiem/evidence-records.check.ts
 *
 * It rebuilds the API view shapes the way the backend does (lib/view.ts toDetail / toEntryView:
 * spread of the pure object + view-only fields), sends them through a JSON round trip (what the
 * browser receives from GET /api/mandates/[id]), applies toExportedMandate / toExportedLedger and
 * compares the serialized result with evidence/mandate-<id>.json and evidence/ledger-<id>.json.
 * No network, no database, no chain. Exit 0 = identical.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Hex, LedgerEntry, LedgerEntryView, Mandate, MandateDetail, MandateDetailResponse } from "@/contracts/api";
import {
  MANDATE_KEYS,
  ledgerFileName,
  mandateFileName,
  serializeRecord,
  toExportedLedger,
  toExportedMandate,
  verifyCommand,
} from "./evidence-records";

const ID = "man_A_mul19mde";
const ROOT = resolve(__dirname, "..", "..");
const EXPLORER_TX = "https://sepolia.etherscan.io/tx/";
const SPEND = new Set(["approved", "pending", "settled"]);

/** lib/view.ts toEntryView(): spread, then merchantCategory and explorerUrl appended. */
function toEntryView(entry: LedgerEntry, mandate: Mandate): LedgerEntryView {
  const view: LedgerEntryView = { ...entry, proposal: { ...entry.proposal }, reasons: entry.reasons.map((r) => ({ ...r })) };
  const category = mandate.catalog.find((c) => c.id === entry.proposal.merchantId)?.category;
  if (category !== undefined) view.merchantCategory = category;
  if (entry.txHash) view.explorerUrl = EXPLORER_TX + entry.txHash;
  return view;
}

/** lib/view.ts toDetail(): the pure Mandate spread first, then the view fields. */
function toDetail(mandate: Mandate, anchorTx: Hex | null, ledger: LedgerEntry[]): MandateDetail {
  let spentUsd = 0;
  let pendingUsd = 0;
  for (const e of ledger) {
    if (SPEND.has(e.status)) spentUsd += e.totalUsd;
    if (e.status === "pending") pendingUsd += e.totalUsd;
  }
  return {
    ...mandate,
    allowedMerchantIds: [...mandate.allowedMerchantIds],
    allowedCategories: [...mandate.allowedCategories],
    blockedKeywords: [...mandate.blockedKeywords],
    catalog: mandate.catalog.map((c) => ({ ...c })),
    hash: "0x647fb7e4b6697f1d56d791fe398d07464287190e3ea5e963c9b0a17a48a51a3c",
    anchorTx,
    anchorUrl: anchorTx ? EXPLORER_TX + anchorTx : null,
    spentUsd,
    pendingUsd,
    remainingUsd: mandate.budgetUsd - spentUsd,
    createdAt: "2026-09-28T09:16:00.000Z",
  };
}

async function main() {
  const mandatePath = resolve(ROOT, "evidence", mandateFileName(ID));
  const ledgerPath = resolve(ROOT, "evidence", ledgerFileName(ID));
  const mandateText = readFileSync(mandatePath, "utf8");
  const ledgerText = readFileSync(ledgerPath, "utf8");
  const exported = JSON.parse(mandateText) as { mandate: Mandate; anchorTx: Hex | null };
  const ledger = JSON.parse(ledgerText) as LedgerEntry[];

  // What GET /api/mandates/[id] sends, as the browser parses it.
  const response: MandateDetailResponse = JSON.parse(
    JSON.stringify({
      mandate: toDetail(exported.mandate, exported.anchorTx, ledger),
      ledger: ledger.map((e) => toEntryView(e, exported.mandate)),
    }),
  );
  assert.ok(response.ledger.some((v) => v.merchantCategory !== undefined), "fixture has merchantCategory");
  assert.ok(response.ledger.some((v) => v.explorerUrl !== undefined), "fixture has explorerUrl");
  assert.ok("hash" in response.mandate && "spentUsd" in response.mandate, "fixture has view-only mandate fields");

  let failures = 0;
  const check = (name: string, fn: () => void) => {
    try {
      fn();
      console.log(`ok - ${name}`);
    } catch (e) {
      failures++;
      console.log(`not ok - ${name}\n  ${(e as Error).message.split("\n").slice(0, 6).join("\n  ")}`);
    }
  };

  check(`mandate file is byte-identical to evidence/${mandateFileName(ID)}`, () => {
    assert.equal(serializeRecord(toExportedMandate(response.mandate)), mandateText);
  });
  check(`ledger file is byte-identical to evidence/${ledgerFileName(ID)}`, () => {
    assert.equal(serializeRecord(toExportedLedger(response.ledger)), ledgerText);
  });
  check("mandate keeps exactly the 13 Mandate keys, in order", () => {
    const file = toExportedMandate(response.mandate);
    assert.deepEqual(Object.keys(file), ["mandate", "anchorTx"]);
    assert.deepEqual(Object.keys(file.mandate), [...MANDATE_KEYS]);
    assert.equal(MANDATE_KEYS.length, 13);
  });
  check("ledger drops only merchantCategory and explorerUrl, keeps key order", () => {
    const out = toExportedLedger(response.ledger);
    response.ledger.forEach((v, i) => {
      const expected = Object.keys(v).filter((k) => k !== "merchantCategory" && k !== "explorerUrl");
      assert.deepEqual(Object.keys(out[i]!), expected);
    });
  });
  check("a null anchorTx is written as null (as scripts/export.ts does)", () => {
    const file = toExportedMandate({ ...response.mandate, anchorTx: null, anchorUrl: null });
    assert.equal(file.anchorTx, null);
    assert.match(serializeRecord(file), /"anchorTx": null\n}\n$/);
  });
  check("inputs are not mutated", () => {
    const before = JSON.stringify(response);
    toExportedMandate(response.mandate);
    toExportedLedger(response.ledger);
    assert.equal(JSON.stringify(response), before);
  });
  check("file names and verify command", () => {
    assert.equal(mandateFileName(ID), "mandate-man_A_mul19mde.json");
    assert.equal(ledgerFileName(ID), "ledger-man_A_mul19mde.json");
    assert.equal(
      verifyCommand(ID),
      "npx tsx scripts/verify.ts ~/Downloads/mandate-man_A_mul19mde.json ~/Downloads/ledger-man_A_mul19mde.json",
    );
  });

  if (failures > 0) {
    console.log(`\n${failures} evidence-records check(s) failed`);
    process.exit(1);
  }
  console.log("\nevidence-records: browser download == scripts/export.ts output (byte for byte)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
