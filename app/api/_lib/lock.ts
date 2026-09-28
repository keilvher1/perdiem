import "server-only";
/**
 * app/api/_lib/lock.ts — per-key async mutex (in-process).
 *
 * Chat requests and status changes of ONE mandate are serialized, so two concurrent purchases
 * cannot both read the same "spent so far" and overshoot the budget, and a Pause that returned
 * 200 cannot be overtaken by a purchase that read the old status. (Single Node process only —
 * the demo runs one; a multi-instance deploy would need a DB-side lock.)
 */
const tails = new Map<string, Promise<void>>();

export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((r) => {
    release = r;
  });
  const tail = prev.then(() => mine);
  tails.set(key, tail);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (tails.get(key) === tail) tails.delete(key);
  }
}
