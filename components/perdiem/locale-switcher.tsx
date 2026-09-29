"use client";

import { Languages } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HTML_LANG, isLocale, LOCALE_LABELS, LOCALES } from "@/lib/i18n/config";
import { useLocale, useSetLocale, useT } from "@/lib/i18n/provider";

/** Header language menu. Each language is listed in its own script. */
export function LocaleSwitcher() {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const t = useT();
  return (
    <Select value={locale} onValueChange={(v) => isLocale(v) && setLocale(v)}>
      <SelectTrigger
        size="sm"
        aria-label={t.shell.language.label}
        // Below lg: no chevron and tighter padding, so the header's top row stays one row (phones in
        // every language, tablets beside the nav) and the sticky header stays short.
        className="bg-surface text-xs text-ink max-lg:gap-1 max-lg:px-2 max-lg:[&>svg:last-child]:hidden"
      >
        <Languages aria-hidden className="size-3.5 text-muted-ink" />
        {/* Below lg: the icon alone (the accessible name still says "Language"). Radix drops a
            className on SelectValue, so the visible label is its own span. */}
        <SelectValue>
          <span lang={HTML_LANG[locale]} className="max-lg:sr-only">
            {LOCALE_LABELS[locale]}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        {LOCALES.map((l) => (
          <SelectItem key={l} value={l} lang={HTML_LANG[l]} className="text-sm">
            {LOCALE_LABELS[l]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
