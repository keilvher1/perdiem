/**
 * scripts/export.ts — export the records an auditor needs, straight from the database.
 *
 *   npm run export -- <mandateId> [<mandateId> ...]
 *   → evidence/mandate-<id>.json  { mandate, anchorTx }   (pure Mandate, status column merged)
 *   → evidence/ledger-<id>.json   LedgerEntry[]           (oldest first, no view fields)
 *
 * Then: npm run verify -- evidence/mandate-<id>.json evidence/ledger-<id>.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { mandateHash } from "../lib/policy";
import { getMandate, listLedger } from "../lib/db";

const ROOT = resolve(__dirname, "..");

async function exportOne(id: string): Promise<void> {
  const row = await getMandate(id);
  if (!row) throw new Error(`no mandate ${id}`);
  const ledger = await listLedger(id);

  const recomputed = mandateHash(row.mandate);
  if (recomputed !== row.hash) {
    console.warn(`warning: ${id} stored hash ${row.hash} != recomputed ${recomputed} (verify will fail)`);
  }

  const dir = resolve(ROOT, "evidence");
  mkdirSync(dir, { recursive: true });
  const mandatePath = resolve(dir, `mandate-${id}.json`);
  const ledgerPath = resolve(dir, `ledger-${id}.json`);
  writeFileSync(mandatePath, `${JSON.stringify({ mandate: row.mandate, anchorTx: row.anchorTx }, null, 2)}\n`);
  writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);

  const count = (s: string) => ledger.filter((e) => e.status === s).length;
  console.log(
    `${id}: hash ${recomputed}, anchor ${row.anchorTx ?? "none"}, ${ledger.length} entries ` +
      `(settled ${count("settled")}, pending ${count("pending")}, stopped ${count("stopped")}, failed ${count("failed")})`,
  );
  console.log(`  wrote evidence/mandate-${id}.json`);
  console.log(`  wrote evidence/ledger-${id}.json`);
  if (count("pending") > 0) console.warn("  note: pending entries are not verified on-chain until confirmed (poll /api/ledger/<id>/confirm)");
}

async function main() {
  const ids = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (ids.length === 0) {
    console.error("usage: npm run export -- <mandateId> [<mandateId> ...]");
    process.exit(2);
  }
  for (const id of ids) await exportOne(id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
