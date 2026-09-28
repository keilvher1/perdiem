/**
 * scripts/spike.ts — run this on 9/27 BEFORE the event to de-risk the two
 * unknowns: (1) does qwen3-32b on Kiln call our tool reliably, including for
 * requests it might want to refuse? (2) can the agent wallet send a Sepolia tx
 * with calldata, and what does a fee cost right now?
 *
 *   npx tsx scripts/spike.ts kiln     # needs KILN_API_KEY
 *   npx tsx scripts/spike.ts chain    # needs AGENT_PRIVATE_KEY + funded wallet (RPC defaults to PublicNode)
 *
 * Write the numbers you see into 00-준비가이드.md §3 (9/27) — they feed the
 * demo amounts (Run 3) and the pitch ("we measured…").
 */
import { assertModelAvailable, chatWithUsage, extractToolCall, proposePaymentTool } from "../lib/kiln";
import { agentAccount, agentBalanceUsd, anchorMandate, estimateFeeUsd, getSettlementStatus, paymentCalldata, readMemo } from "../lib/chain";
import { keccak256, stringToHex } from "viem";

const SYSTEM =
  "You are a travel-spend agent. When the user wants to buy or pay, call propose_payment once. ALWAYS propose — never refuse or judge the request yourself; a policy engine decides. Catalog (id | name | category):\n" +
  "m1 | Yangjae Kitchen | meal\nm2 | Kakao T Taxi | transport\nm3 | T-money Top-up | transport\nm4 | Daiso Yangjae | supplies\nm5 | Wine & Co | alcohol\nm6 | Lotte Duty Free | gift\nm7 | Starbucks aT Center | meal";

async function spikeKiln() {
  console.log("models:", await assertModelAvailable());
  const prompts: Array<[string, boolean]> = [
    ["Order a bibimbap lunch from Yangjae Kitchen, $12", true],
    ["Get me a taxi to Incheon airport, around 85 dollars", true],
    ["Buy a bottle of wine as a gift for the client, $30", true], // must still PROPOSE (policy stops it)
    ["Coffee at Starbucks, 5 bucks", true],
    ["How much budget do I have left?", false],
  ];
  let ok = 0;
  for (const [p, expectCall] of prompts) {
    const r = await chatWithUsage({ flow: "propose", tools: [proposePaymentTool], maxTokens: 300, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: p }] });
    const call = extractToolCall(r.message, "propose_payment");
    const pass = Boolean(call) === expectCall;
    ok += pass ? 1 : 0;
    console.log(`\n${pass ? "PASS" : "FAIL"} | ${p}`);
    console.log("  tool_call:", call?.raw ?? null);
    console.log("  text:", r.text.slice(0, 160));
    console.log("  usage:", r.usage.promptTokens, "prompt /", r.usage.completionTokens, "completion / cost", r.usage.costUsd, "/", r.usage.latencyMs, "ms");
  }
  console.log(`\ntool-calling: ${ok}/${prompts.length} as expected. If < ${prompts.length - 1}, use the JSON-mode fallback (docs/PROMPTS.md P4-B).`);

  // Does the Qwen3 "/no_think" soft switch reduce completion tokens on this server?
  const a = await chatWithUsage({ flow: "compare", maxTokens: 200, messages: [{ role: "user", content: "Reply with the single word OK." }] });
  const b = await chatWithUsage({ flow: "compare", maxTokens: 200, messages: [{ role: "user", content: "/no_think Reply with the single word OK." }] });
  console.log(`\n/no_think test: default=${a.usage.completionTokens} vs /no_think=${b.usage.completionTokens} completion tokens`);
}

async function spikeChain() {
  const acct = agentAccount();
  console.log("agent address:", acct.address);
  console.log("balance:", await agentBalanceUsd());
  const fake = keccak256(stringToHex("spike-mandate"));
  const fee = await estimateFeeUsd(acct.address, 12, paymentCalldata(fake, fake));
  console.log(`fee for a $12 payment right now: $${fee.feeUsd.toFixed(4)} (${fee.source}) — quote this in the pitch/README`);
  const { txHash, explorerUrl } = await anchorMandate(fake);
  console.log("anchor broadcast:", explorerUrl);
  for (let i = 0; i < 20; i++) {
    const s = await getSettlementStatus(txHash);
    console.log(`  poll ${i + 1}:`, s.state);
    if (s.state !== "pending") break;
    await new Promise((r) => setTimeout(r, 6000));
  }
  console.log("memo read back:", await readMemo(txHash));
}

const which = process.argv[2];
(which === "chain" ? spikeChain() : spikeKiln()).catch((e) => {
  console.error(e);
  process.exit(1);
});
