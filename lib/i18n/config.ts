/**
 * lib/i18n/config.ts — the UI languages. English is the default and the reference copy: every
 * screenshot, the demo video and the capture script use it, so an English visitor sees exactly
 * the pre-i18n text. The choice is a cookie (no URL prefix), so every existing link keeps working.
 * No Accept-Language detection on purpose: a Korean browser still opens in English until the
 * viewer picks a language.
 */
export const LOCALES = ["en", "ko", "ja", "zh"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "perdiem-locale";

/** Each language in its own script, so a viewer can find theirs without reading the others. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ko: "한국어",
  ja: "日本語",
  zh: "简体中文",
};

/** BCP 47 tags for Intl (dates, numbers, relative time). */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: "en-US",
  ko: "ko-KR",
  ja: "ja-JP",
  zh: "zh-CN",
};

/** Value for <html lang>. */
export const HTML_LANG: Record<Locale, string> = {
  en: "en",
  ko: "ko",
  ja: "ja",
  zh: "zh-CN",
};

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

export function toLocale(v: unknown): Locale {
  return isLocale(v) ? v : DEFAULT_LOCALE;
}
