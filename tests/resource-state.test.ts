/**
 * tests/resource-state.test.ts — hooks/resource-state.ts, the pure state transitions of
 * useResource: a poll with unchanged JSON keeps the previous data reference, everything else
 * replaces it, and an older response never overwrites a newer one.
 * Run: npx tsx tests/resource-state.test.ts
 */
import assert from "node:assert/strict";
import { createRunOrder, failedState, loadedState, toJson, type ResourceState } from "../hooks/resource-state";

let passed = 0;
function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn()).then(() => {
    passed += 1;
    console.log(`ok - ${name}`);
  });
}

type Data = { items: { id: string; n: number }[] };
type Err = { message: string };
const source = () => Promise.resolve<Data>({ items: [] });
const otherSource = () => Promise.resolve<Data>({ items: [] });
const EMPTY: ResourceState<Data, Err> = { source: null, key: -1, data: null, json: null, error: null, updatedAt: null };

function loaded(prev: ResourceState<Data, Err>, data: Data, poll: boolean, updatedAt: number, key = 0, src: unknown = source) {
  return loadedState(prev, { source: src, key, data, json: toJson(data), poll, updatedAt });
}

async function main() {
  await test("toJson serializes, and returns null instead of throwing", () => {
    assert.equal(toJson({ a: 1 }), '{"a":1}');
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    assert.equal(toJson(cyclic), null);
    assert.equal(toJson({ big: 1n }), null);
    assert.equal(toJson(undefined), null);
  });

  await test("initial load sets data, json and updatedAt", () => {
    const d = { items: [{ id: "a", n: 1 }] };
    const s = loaded(EMPTY, d, false, 1000);
    assert.equal(s.data, d);
    assert.equal(s.json, JSON.stringify(d));
    assert.equal(s.updatedAt, 1000);
    assert.equal(s.error, null);
    assert.equal(s.source, source);
    assert.equal(s.key, 0);
  });

  await test("poll with the same JSON keeps the data reference, refreshes updatedAt and clears the error", () => {
    const d1 = { items: [{ id: "a", n: 1 }] };
    const s1 = loaded(EMPTY, d1, false, 1000);
    const withError = failedState(s1, { source, key: 0, error: { message: "boom" } });
    assert.equal(withError.data, d1);
    assert.deepEqual(withError.error, { message: "boom" });
    const d2 = structuredClone(d1);
    const s2 = loaded(withError, d2, true, 6000);
    assert.equal(s2.data, d1, "same reference as before");
    assert.notEqual(s2.data, d2);
    assert.equal(s2.updatedAt, 6000);
    assert.equal(s2.error, null);
    assert.equal(s2.json, withError.json);
    assert.notEqual(s2, withError, "a new state object (updatedAt changed)");
  });

  await test("poll with different JSON replaces the data", () => {
    const d1 = { items: [{ id: "a", n: 1 }] };
    const s1 = loaded(EMPTY, d1, false, 1000);
    const d2 = { items: [{ id: "a", n: 2 }] };
    const s2 = loaded(s1, d2, true, 6000);
    assert.equal(s2.data, d2);
    assert.equal(s2.json, JSON.stringify(d2));
    assert.equal(s2.updatedAt, 6000);
  });

  await test("non-poll load (initial or refresh) always replaces, even with the same JSON", () => {
    const d1 = { items: [{ id: "a", n: 1 }] };
    const s1 = loaded(EMPTY, d1, false, 1000);
    const d2 = structuredClone(d1);
    const same = loaded(s1, d2, false, 2000);
    assert.equal(same.data, d2);
    assert.equal(same.updatedAt, 2000);
    const refreshed = loaded(s1, structuredClone(d1), false, 3000, 1);
    assert.notEqual(refreshed.data, d1);
    assert.equal(refreshed.key, 1);
  });

  await test("poll keeps the reference only for the same source and refresh key", () => {
    const d1 = { items: [{ id: "a", n: 1 }] };
    const s1 = loaded(EMPTY, d1, false, 1000);
    const otherKey = loaded(s1, structuredClone(d1), true, 6000, 1);
    assert.notEqual(otherKey.data, d1);
    assert.equal(otherKey.key, 1);
    const otherSrc = loaded(s1, structuredClone(d1), true, 6000, 0, otherSource);
    assert.notEqual(otherSrc.data, d1);
    assert.equal(otherSrc.source, otherSource);
  });

  await test("stringify failure replaces the data (poll included)", () => {
    const d1 = { items: [{ id: "a", n: 1 }] };
    const s1 = loaded(EMPTY, d1, false, 1000);
    const d2 = { items: [{ id: "a", n: 1 }] } as Data & { big?: bigint };
    d2.big = 1n;
    const s2 = loaded(s1, d2, true, 6000);
    assert.equal(s2.data, d2);
    assert.equal(s2.json, null);
    const d3 = { items: [{ id: "a", n: 1 }] };
    const s3 = loaded(s2, d3, true, 11000);
    assert.equal(s3.data, d3, "a null json is never treated as unchanged");
  });

  await test("failure keeps data for the same source and clears it for another source", () => {
    const d1 = { items: [{ id: "a", n: 1 }] };
    const s1 = loaded(EMPTY, d1, false, 1000);
    const same = failedState(s1, { source, key: 0, error: { message: "x" } });
    assert.equal(same.data, d1);
    assert.equal(same.json, s1.json);
    assert.equal(same.updatedAt, 1000);
    const other = failedState(s1, { source: otherSource, key: 0, error: { message: "x" } });
    assert.equal(other.data, null);
    assert.equal(other.json, null);
    assert.equal(other.updatedAt, null);
  });

  await test("run order: an older result arriving after a newer one is ignored", () => {
    const order = createRunOrder();
    const t1 = order.issue();
    const t2 = order.issue();
    assert.equal(order.accept(t2), true);
    assert.equal(order.accept(t1), false);
    const t3 = order.issue();
    assert.equal(order.accept(t3), true);
  });

  await test("run order: in-order results all apply, and each issue gets a new ticket (polling never stalls)", () => {
    const order = createRunOrder();
    const tickets = [order.issue(), order.issue(), order.issue()];
    assert.deepEqual(tickets, [1, 2, 3]);
    assert.equal(order.accept(tickets[0]!), true);
    assert.equal(order.accept(tickets[1]!), true);
    assert.equal(order.accept(tickets[2]!), true);
    assert.equal(order.accept(tickets[2]!), false, "a ticket applies once");
  });

  await test("out-of-order responses through the hook's flow: the slow older poll never overwrites newer data", async () => {
    // Mirrors useResource's run(): issue a ticket, await the load, apply only if accepted.
    let state = EMPTY;
    const order = createRunOrder();
    const resolvers: ((d: Data) => void)[] = [];
    const run = async (poll: boolean) => {
      const ticket = order.issue();
      const data = await new Promise<Data>((r) => resolvers.push(r));
      if (!order.accept(ticket)) return;
      state = loaded(state, data, poll, ticket * 1000);
    };
    const first = run(false);
    const slowPoll = run(true);
    const fastPoll = run(true);
    const newest = { items: [{ id: "a", n: 3 }] };
    resolvers[0]!({ items: [{ id: "a", n: 1 }] });
    await first;
    resolvers[2]!(newest);
    await fastPoll;
    resolvers[1]!({ items: [{ id: "a", n: 2 }] });
    await slowPoll;
    assert.equal(state.data, newest);
    assert.equal(state.updatedAt, 3000);
  });

  console.log(`\n${passed} resource-state tests passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
