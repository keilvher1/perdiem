/**
 * components/perdiem/evidence-records.ts — the two files an auditor feeds to scripts/verify.ts,
 * rebuilt in the browser from what the API already returns.
 *
 *   mandate-<id>.json  { mandate, anchorTx }  mandate = the 13 Mandate keys, in lib/db.ts order
 *   ledger-<id>.json   LedgerEntry[]          API order (oldest first), view-only fields removed
 *
 * Byte-identical to scripts/export.ts because MandateDetail spreads the pure Mandate first
 * (lib/view.ts toDetail) and LedgerEntryView is the pure entry plus merchantCategory and
 * explorerUrl appended (lib/view.ts toEntryView). components/perdiem/evidence-records.check.ts
 * proves it against the committed evidence files (npx tsx components/perdiem/evidence-records.check.ts).
 *
 * Pure except downloadJson() (DOM, only when called). Imports types only: never lib/policy.ts,
 * lib/view.ts (server-only) or viem.
 */
import type { Hex, LedgerEntry, LedgerEntryView, Mandate, MandateDetail, Merchant } from "@/contracts/api";

/** Exactly the Mandate keys, in the order lib/db.ts pureMandate() builds them. */
export const MANDATE_KEYS = [
  "id",
  "principal",
  "traveler",
  "agentWallet",
  "budgetUsd",
  "perTxCapUsd",
  "allowedMerchantIds",
  "allowedCategories",
  "blockedKeywords",
  "startsAt",
  "expiresAt",
  "catalog",
  "status",
] as const satisfies readonly (keyof Mandate)[];

/** Compile-time proof that MANDATE_KEYS lists every Mandate key (no more, no less). */
type MissingMandateKey = Exclude<keyof Mandate, (typeof MANDATE_KEYS)[number]>;
const _allMandateKeys: [MissingMandateKey] extends [never] ? true : never = true;
void _allMandateKeys;

/** What scripts/export.ts writes and scripts/verify.ts reads (`type Exported`). */
export interface ExportedMandateFile {
  mandate: Mandate;
  anchorTx: Hex | null;
}

function pickMerchant(c: Merchant): Merchant {
  return { id: c.id, name: c.name, category: c.category, wallet: c.wallet };
}

/** mandate-<id>.json: the 13 Mandate keys picked from the detail view, plus its anchorTx (may be null). */
export function toExportedMandate(d: MandateDetail): ExportedMandateFile {
  const mandate: Mandate = {
    id: d.id,
    principal: d.principal,
    traveler: d.traveler,
    agentWallet: d.agentWallet,
    budgetUsd: d.budgetUsd,
    perTxCapUsd: d.perTxCapUsd,
    allowedMerchantIds: [...d.allowedMerchantIds],
    allowedCategories: [...d.allowedCategories],
    blockedKeywords: [...d.blockedKeywords],
    startsAt: d.startsAt,
    expiresAt: d.expiresAt,
    catalog: d.catalog.map(pickMerchant),
    status: d.status,
  };
  return { mandate, anchorTx: d.anchorTx ?? null };
}

/** ledger-<id>.json: every entry in API order with only merchantCategory and explorerUrl removed. */
export function toExportedLedger(entries: readonly LedgerEntryView[]): LedgerEntry[] {
  return entries.map((v) => {
    const { merchantCategory, explorerUrl, ...entry } = v; // rest keeps the remaining key order
    void merchantCategory;
    void explorerUrl;
    return entry;
  });
}

/** Same serialization as scripts/export.ts. */
export function serializeRecord(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export const mandateFileName = (id: string) => `mandate-${id}.json`;
export const ledgerFileName = (id: string) => `ledger-${id}.json`;

/** The auditor's command for the two files as a browser saves them. */
export function verifyCommand(id: string): string {
  return `npx tsx scripts/verify.ts ~/Downloads/${mandateFileName(id)} ~/Downloads/${ledgerFileName(id)}`;
}

/** Saves `value` as a JSON file (browser only). */
export function downloadJson(fileName: string, value: unknown): void {
  const blob = new Blob([serializeRecord(value)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a tick to start the download before the URL is released.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
