/**
 * tests/contract.check.ts — compile-time proof that the backend's domain types
 * (lib/*) are interchangeable with contracts/api.ts. If this file fails to
 * typecheck, the contract and the lib drifted apart. Run: npx tsc --noEmit
 */
import type * as C from "../contracts/api";
import type * as P from "../lib/policy";
import type { UsageRecord as KUsage, FlowName as KFlow } from "../lib/kiln";
import type { SettlementStatus as ChSettlement } from "../lib/chain";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

// Bidirectional structural equality for every shared type.
export type _1 = Assert<Equal<C.Mandate, P.Mandate>>;
export type _2 = Assert<Equal<C.Merchant, P.Merchant>>;
export type _3 = Assert<Equal<C.Proposal, P.Proposal>>;
export type _4 = Assert<Equal<C.StopCode, P.StopCode>>;
export type _5 = Assert<Equal<C.StopReason, P.StopReason>>;
export type _6 = Assert<Equal<C.LedgerStatus, P.LedgerStatus>>;
export type _7 = Assert<Equal<C.LedgerEntry, P.LedgerEntry>>;
export type _8 = Assert<Equal<C.MandateStatus, P.MandateStatus>>;
export type _9 = Assert<Equal<C.ReplayResult, P.ReplayResult>>;
export type _10 = Assert<Equal<C.UsageRecord, KUsage>>;
export type _11 = Assert<Equal<C.FlowName, KFlow>>;
export type _12 = Assert<Equal<C.SettlementStatus, ChSettlement>>;

// A LedgerEntryView must be constructible from a LedgerEntry plus display fields.
export const _view = (e: P.LedgerEntry): C.LedgerEntryView => ({ ...e, explorerUrl: e.txHash ? `https://sepolia.etherscan.io/tx/${e.txHash}` : undefined });
