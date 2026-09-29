"use client";

/**
 * The UI language for client components. The root layout reads the cookie on the server and
 * passes it as `initialLocale`, so the server HTML and the first client render agree (no
 * hydration mismatch, no English flash). Without a provider every hook falls back to English.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fmtDate, fmtInt, fmtRel, fmtTime } from "@/lib/format";
import {
  DEFAULT_LOCALE,
  HTML_LANG,
  LOCALE_COOKIE,
  LOCALE_TAGS,
  type Locale,
} from "./config";
import { MESSAGES, type Messages } from "./messages";

type LocaleState = { locale: Locale; setLocale: (next: Locale) => void };

const LocaleContext = createContext<LocaleState | null>(null);

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setState] = useState<Locale>(initialLocale);
  const setLocale = useCallback((next: Locale) => {
    setState(next);
    try {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = HTML_LANG[next];
    } catch {
      // Cookies blocked: the choice still applies until the page is reloaded.
    }
  }, []);
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(LocaleContext)?.locale ?? DEFAULT_LOCALE;
}

export function useSetLocale(): (next: Locale) => void {
  const ctx = useContext(LocaleContext);
  return ctx?.setLocale ?? (() => {});
}

/** All UI copy in the current language: `const t = useT(); t.traveler.send`. */
export function useT(): Messages {
  return MESSAGES[useLocale()];
}

/** lib/format helpers bound to the current language (money stays "$12.00" in every language). */
export function useFmt() {
  const locale = useLocale();
  return useMemo(() => {
    const tag = LOCALE_TAGS[locale];
    return {
      locale,
      tag,
      date: (iso: string | null | undefined, withZone = false) =>
        fmtDate(iso, withZone, tag),
      time: (iso: string | null | undefined) => fmtTime(iso, tag),
      rel: (iso: string | null | undefined, now: number | null) =>
        fmtRel(iso, now, tag),
      int: (n: number | null | undefined) => fmtInt(n, tag),
    };
  }, [locale]);
}
