/**
 * lib/chain.ts — settlement and records on Ethereum Sepolia (testnet) with viem.
 *
 * What goes on-chain (satisfies "at least one on-chain transaction — a payment,
 * a settlement, or a record"):
 *  1. anchorMandate(): a 0-value self-transaction whose calldata is the mandate
 *     hash. Proves the mandate terms existed, unchanged, before any payment.
 *  2. sendPaymentNoWait(): a test-ETH transfer to the merchant wallet whose
 *     calldata carries `PERDIEM|<mandateHash>|<receiptHash>`. Anyone can open
 *     the tx on Etherscan, decode the input as UTF-8, and link it to the ledger.
 *
 * Server-side only (uses a private key). Never import from client components.
 * Nothing here waits for a receipt inside a request handler (Vercel timeouts):
 * broadcast → return hash → poll getSettlementStatus() from the client.
 *
 * Demo economics: the mandate is in USD; we settle in test ETH at a FIXED,
 * clearly labeled demo rate (DEMO_ETH_USD). Network fee is the REAL gas
 * estimate converted at the same rate, so "budget exceeded once fees are
 * added" is a real check, not a mock.
 *
 * All exported results use strings/numbers (no bigint) so they can go straight
 * into Response.json().
 */
import {
  createPublicClient,
  createWalletClient,
  fallback,
  http,
  formatEther,
  parseEther,
  stringToHex,
  hexToString,
  nonceManager,
  TransactionReceiptNotFoundError,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

/**
 * RPC: PublicNode's keyless Sepolia endpoint by default (checked 2026-09-26:
 * chainId, gasPrice, estimateGas all OK, no sign-up). Set SEPOLIA_RPC_URL
 * (e.g. Alchemy) to override. Reads fall back to PublicNode and then viem's
 * built-in endpoint; writes use ONE endpoint so a retry can't double-broadcast.
 * NOTE: sepolia.drpc.org now answers "chain is not available on free plan".
 */
export const PUBLICNODE_SEPOLIA = "https://ethereum-sepolia-rpc.publicnode.com";
const PRIMARY_RPC = process.env.SEPOLIA_RPC_URL || PUBLICNODE_SEPOLIA;
export const DEMO_ETH_USD = Number(process.env.DEMO_ETH_USD ?? "4000");

function requireKey(): Hex {
  const k = process.env.AGENT_PRIVATE_KEY;
  if (!k || !k.startsWith("0x")) throw new Error("AGENT_PRIVATE_KEY missing (0x-prefixed hex)");
  return k as Hex;
}

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: fallback([
    http(PRIMARY_RPC, { timeout: 15_000 }),
    ...(PRIMARY_RPC !== PUBLICNODE_SEPOLIA ? [http(PUBLICNODE_SEPOLIA, { timeout: 15_000 })] : []),
    http(undefined, { timeout: 15_000 }), // viem's built-in Sepolia RPC
  ]),
});

let cachedAccount: ReturnType<typeof privateKeyToAccount> | null = null;
/** One account instance per process so viem's nonce manager can serialize back-to-back sends. */
export function agentAccount() {
  if (!cachedAccount) cachedAccount = privateKeyToAccount(requireKey(), { nonceManager });
  return cachedAccount;
}

function walletClient() {
  return createWalletClient({ account: agentAccount(), chain: sepolia, transport: http(PRIMARY_RPC, { timeout: 20_000 }) });
}

export function usdToWei(usd: number): bigint {
  // 12 decimals is plenty for demo amounts and avoids float noise in parseEther
  return parseEther((usd / DEMO_ETH_USD).toFixed(12));
}

export function weiToUsd(wei: bigint): number {
  return Number(formatEther(wei)) * DEMO_ETH_USD;
}

export function explorerTxUrl(hash: Hex): string {
  return `${sepolia.blockExplorers.default.url}/tx/${hash}`;
}

export function explorerAddressUrl(addr: Hex): string {
  return `${sepolia.blockExplorers.default.url}/address/${addr}`;
}

export async function agentBalanceUsd(): Promise<{ address: Hex; eth: string; usd: number }> {
  const wei = await publicClient.getBalance({ address: agentAccount().address });
  return { address: agentAccount().address, eth: formatEther(wei), usd: weiToUsd(wei) };
}

export function paymentCalldata(mandateHash: Hex, receiptHash: Hex): Hex {
  return stringToHex(`PERDIEM|${mandateHash}|${receiptHash}`);
}

/** Intrinsic gas for a plain transfer plus calldata (16 gas per non-zero byte, 4 per zero byte). */
function intrinsicGas(data: Hex): bigint {
  const bytes = Buffer.from(data.slice(2), "hex");
  let g = 21_000n;
  for (const b of bytes) g += b === 0 ? 4n : 16n;
  return g;
}

export interface FeeEstimate {
  feeWei: string;
  feeUsd: number;
  source: "estimate" | "fallback";
}

/**
 * Real fee estimate for the exact transfer we would send. If estimateGas
 * fails (e.g. insufficient funds for the value), fall back to intrinsic gas ×
 * current gas price so the policy still has a real number. If even the gas
 * price is unavailable, throw — the caller must STOP (fail closed).
 */
export async function estimateFeeUsd(to: Hex, amountUsd: number, data: Hex): Promise<FeeEstimate> {
  const account = agentAccount();
  const gasPrice = await publicClient.getGasPrice();
  try {
    const gas = await publicClient.estimateGas({ account, to, value: usdToWei(amountUsd), data });
    const feeWei = gas * gasPrice;
    return { feeWei: feeWei.toString(), feeUsd: weiToUsd(feeWei), source: "estimate" };
  } catch {
    const feeWei = intrinsicGas(data) * gasPrice;
    return { feeWei: feeWei.toString(), feeUsd: weiToUsd(feeWei), source: "fallback" };
  }
}

/** Step 1: broadcast the payment and return immediately. Call ONLY after evaluate() returned APPROVE. */
export async function sendPaymentNoWait(args: {
  to: Hex;
  amountUsd: number;
  mandateHash: Hex;
  receiptHash: Hex;
}): Promise<{ txHash: Hex; explorerUrl: string }> {
  const txHash = await walletClient().sendTransaction({
    to: args.to,
    value: usdToWei(args.amountUsd),
    data: paymentCalldata(args.mandateHash, args.receiptHash),
  });
  return { txHash, explorerUrl: explorerTxUrl(txHash) };
}

export type SettlementStatus =
  | { state: "pending" }
  | { state: "settled"; blockNumber: string; gasUsed: string; actualFeeUsd: number }
  | { state: "failed"; reason: string };

/** Step 2: poll from the client until mined. Only "receipt not found" means pending; other errors surface. */
export async function getSettlementStatus(txHash: Hex): Promise<SettlementStatus> {
  try {
    const r = await publicClient.getTransactionReceipt({ hash: txHash });
    if (r.status !== "success") return { state: "failed", reason: "reverted" };
    return {
      state: "settled",
      blockNumber: r.blockNumber.toString(),
      gasUsed: r.gasUsed.toString(),
      actualFeeUsd: weiToUsd(r.gasUsed * r.effectiveGasPrice),
    };
  } catch (err) {
    if (err instanceof TransactionReceiptNotFoundError) return { state: "pending" };
    throw err; // RPC outage etc. — let the route return 502 instead of "pending forever"
  }
}

/** Write the mandate hash on-chain (0-value self-transfer) when the principal grants a budget. Broadcast only. */
export async function anchorMandate(mandateHash: Hex): Promise<{ txHash: Hex; explorerUrl: string }> {
  const account = agentAccount();
  const txHash = await walletClient().sendTransaction({
    to: account.address,
    value: 0n,
    data: stringToHex(`PERDIEM-MANDATE|${mandateHash}`),
  });
  return { txHash, explorerUrl: explorerTxUrl(txHash) };
}

/** Auditor helper: read a tx back and decode the memo, independent of our DB. */
export async function readMemo(txHash: Hex): Promise<{ from: Hex; to: Hex | null; valueUsd: number; memo: string }> {
  const tx = await publicClient.getTransaction({ hash: txHash });
  return { from: tx.from, to: tx.to ?? null, valueUsd: weiToUsd(tx.value), memo: hexToString(tx.input) };
}
