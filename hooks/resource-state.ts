/**
 * Pure state transitions of useResource (hooks/use-resource.ts), kept free of React so
 * tests/resource-state.test.ts can check them directly.
 */

export interface ResourceState<T, E> {
  source: unknown;
  key: number;
  data: T | null;
  /** JSON of `data` (null until loaded or when it cannot be serialized). */
  json: string | null;
  error: E | null;
  updatedAt: number | null;
}

/** JSON.stringify that never throws; null means "not comparable", so the data is replaced. */
export function toJson(data: unknown): string | null {
  try {
    const json = JSON.stringify(data);
    return typeof json === "string" ? json : null;
  } catch {
    return null;
  }
}

/**
 * State after a successful load. A poll whose JSON equals the current JSON for the same source
 * and refresh key keeps the previous `data` object (same reference, so consumers comparing by
 * reference skip work) and only refreshes updatedAt and clears the error. Initial loads and
 * refreshes (poll = false), different JSON and unserializable data always replace `data`.
 */
export function loadedState<T, E>(
  prev: ResourceState<T, E>,
  next: { source: unknown; key: number; data: T; json: string | null; poll: boolean; updatedAt: number },
): ResourceState<T, E> {
  if (next.poll && next.json !== null && prev.source === next.source && prev.key === next.key && prev.json === next.json) {
    return { ...prev, error: null, updatedAt: next.updatedAt };
  }
  return { source: next.source, key: next.key, data: next.data, json: next.json, error: null, updatedAt: next.updatedAt };
}

/** State after a failed load: the same source keeps its last data (shown as stale), another source starts empty. */
export function failedState<T, E>(prev: ResourceState<T, E>, next: { source: unknown; key: number; error: E }): ResourceState<T, E> {
  const same = prev.source === next.source;
  return {
    source: next.source,
    key: next.key,
    data: same ? prev.data : null,
    json: same ? prev.json : null,
    error: next.error,
    updatedAt: same ? prev.updatedAt : null,
  };
}

/**
 * Latest-wins ordering of one effect's runs. Every run takes a ticket when issued (polling never
 * waits for an earlier run); its result may be applied only if no newer run's result was applied
 * already, so an older, slower response never overwrites a newer one.
 */
export function createRunOrder() {
  let issued = 0;
  let applied = 0;
  return {
    issue: (): number => ++issued,
    /** True when the result of `ticket` may be applied (and records it as the latest applied). */
    accept: (ticket: number): boolean => {
      if (ticket <= applied) return false;
      applied = ticket;
      return true;
    },
  };
}
