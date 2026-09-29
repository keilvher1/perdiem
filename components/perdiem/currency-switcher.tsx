"use client";

import { useMemo } from "react";
import { Coins } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COMMON_CURRENCIES, currencyName, isCurrencyCode, orderCurrencies } from "@/lib/fx/currencies";
import { setDisplayCurrency, useDisplayCurrency, useFxRates } from "@/hooks/use-fx";
import { useFmt, useT } from "@/lib/i18n/provider";

/**
 * Header "Currency" menu, next to Language and Theme: the display currency for ≈ equivalents
 * (stored per browser in localStorage "perdiem-currency", default USD). Common currencies first,
 * then every other currency the day's rates cover. It changes what is shown next to USD amounts,
 * never what is requested or paid (PerDiem settles in USD).
 */
export function CurrencySwitcher() {
  const t = useT().fx.menu;
  const f = useFmt();
  const value = useDisplayCurrency();
  // Rates load on mount only when a non-USD currency is already chosen; opening the menu loads them too.
  const fx = useFxRates(value !== "USD");
  const { common, others } = useMemo(() => {
    const covered = fx.rates ? Object.keys(fx.rates.rates) : [];
    return orderCurrencies([...COMMON_CURRENCIES.filter((c) => c === "USD" || covered.includes(c)), ...covered, value]);
  }, [fx.rates, value]);

  const item = (code: string) => {
    const name = currencyName(code, f.tag);
    return (
      <SelectItem key={code} value={code} textValue={`${code} ${name}`} className="text-sm">
        <span className="w-9 shrink-0 font-medium tabular-nums">{code}</span>
        <span className="min-w-0 truncate text-muted-ink">{name}</span>
        {code === "USD" && <span className="ml-1 shrink-0 text-xs text-muted-ink">· {t.settlement}</span>}
      </SelectItem>
    );
  };

  return (
    <Select
      value={value}
      onValueChange={(v) => isCurrencyCode(v) && setDisplayCurrency(v)}
      onOpenChange={(open) => open && !fx.rates && fx.retry()}
    >
      <SelectTrigger
        size="sm"
        aria-label={t.label}
        className="bg-surface text-xs text-ink max-sm:gap-1 max-sm:px-2 max-sm:[&>svg:last-child]:hidden"
        data-currency-switcher=""
      >
        <Coins aria-hidden className="size-3.5 text-muted-ink max-sm:hidden" />
        <SelectValue>
          <span className="tabular-nums">{value}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="end" className="max-h-[min(24rem,var(--radix-select-content-available-height))] w-[min(20rem,calc(100vw-2rem))]">
        <p className="max-w-[18rem] px-2 pt-1.5 pb-2 text-xs text-muted-ink">{t.note}</p>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>{t.common}</SelectLabel>
          {common.map(item)}
        </SelectGroup>
        {others.length > 0 && (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>{t.all}</SelectLabel>
              {others.map(item)}
            </SelectGroup>
          </>
        )}
        <SelectSeparator />
        <p className="px-2 pt-1 pb-1.5 text-xs text-muted-ink" data-currency-source="">
          {fx.rates
            ? `${t.source(fx.rates.source.name, fx.rates.date)}${fx.rates.source.attribution ? ` · ${fx.rates.source.attribution}` : ""}`
            : fx.status === "error"
              ? t.unavailable
              : t.loading}
        </p>
      </SelectContent>
    </Select>
  );
}
