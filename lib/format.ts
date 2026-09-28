/**
 * lib/format.ts — display-only formatting for the frontend.
 *
 * Pure functions, no I/O, safe in client components. Never round money before a
 * comparison; these helpers exist only to print values.
 */

/**
 * Same algorithm as lib/policy.ts fmtUsd (re-implemented because client code must not
 * import lib/policy.ts). Two decimals unless sub-cent digits matter, then up to six
 * decimals with trailing zeros trimmed; below $0.01 use two significant digits.
 */
function policyFmtUsd(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (Math.abs(n) >= 0.01 || n === 0) {
    const exact = n.toFixed(6).replace(/0+$/, "");
    const cents = n.toFixed(2);
    return exact.length > cents.length ? exact : cents;
  }
  return n.toPrecision(2);
}

/** `$12.00`, `$10.1006`, `$0.0989`, `$0.00004428` → "$" + lib/policy.ts fmtUsd. */
export function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return "$" + policyFmtUsd(n);
}

/** Money with thousands separators for large, whole-cent values (tiles). Falls back to fmtUsd. */
export function fmtUsdTile(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const s = policyFmtUsd(n);
  const [int, dec] = s.split(".");
  if (!/^-?\d+$/.test(int ?? "")) return "$" + s;
  const grouped = Number(int).toLocaleString("en-US");
  return "$" + grouped + (dec !== undefined ? "." + dec : "");
}

/** `0x6f83…af6e`. Does not validate hex (fixture hashes contain placeholder characters). */
export function fmtHash(h: string | null | undefined, head = 6, tail = 4): string {
  if (!h) return "—";
  if (h.length <= head + tail + 1) return h;
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

/** "just now", "12 s ago", "2 min ago", "3 h ago", "in 2 d". `now` comes from useNow(). */
export function fmtRel(iso: string | null | undefined, now: number | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  if (now === null) return fmtDate(iso);
  const diff = now - t;
  const abs = Math.abs(diff);
  const future = diff < 0;
  let out: string;
  if (abs < 5_000) return "just now";
  if (abs < 60_000) out = `${Math.round(abs / 1000)} s`;
  else if (abs < 3_600_000) out = `${Math.round(abs / 60_000)} min`;
  else if (abs < 86_400_000) out = `${Math.round(abs / 3_600_000)} h`;
  else out = `${Math.round(abs / 86_400_000)} d`;
  return future ? `in ${out}` : `${out} ago`;
}

const DATE_FMT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
};

/**
 * Date + time in the viewer's time zone. English month names on purpose (UI copy is
 * English for international judges) — the time zone is still the viewer's own.
 */
export function fmtDate(iso: string | null | undefined, withZone = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString("en-US", withZone ? { ...DATE_FMT, timeZoneName: "short" } : DATE_FMT);
}

/** Time of day only, e.g. "14:03:12". */
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
}

/** 7957 → "7,957". */
export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

/** 1064 → "1.06 s", 980 → "980 ms", 0 → "0 ms". */
export function fmtMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
}

/** 71 → "71%", 70.6 → "70.6%". */
export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
}

/** Date → value for <input type="datetime-local"> in the viewer's local time ("2026-09-28T20:00"). */
export function toDatetimeLocal(d: Date): string {
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Where a mandate is relative to its window. */
export type WindowState = "before" | "open" | "expired";

export function windowState(startsAt: string, expiresAt: string, now: number | null): WindowState {
  if (now === null) return "open";
  if (now < new Date(startsAt).getTime()) return "before";
  if (now > new Date(expiresAt).getTime()) return "expired";
  return "open";
}
