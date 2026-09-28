"use client";

import { useEffect, useState } from "react";

/**
 * The current time, refreshed every `intervalMs`. Returns null until mounted so render stays
 * pure (no Date.now() during render) and server/client markup match.
 */
export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [intervalMs]);
  return now;
}
