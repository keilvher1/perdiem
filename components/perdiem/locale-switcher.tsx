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
        className="bg-surface text-xs text-ink"
      >
        <Languages aria-hidden className="size-3.5 text-muted-ink" />
        {/* Phones: the icon alone (the accessible name still says "Language"). Radix drops a
            className on SelectValue, so the visible label is its own span. */}
        <SelectValue>
          <span lang={HTML_LANG[locale]} className="max-sm:sr-only">
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
