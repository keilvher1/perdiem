"use client";

import { fromUsd } from "@/lib/fx/convert";
import { formatMoney, formatRate } from "@/lib/fx/format";
import { useDisplayCurrency, useFxRates } from "@/hooks/use-fx";
import { useFmt, useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * A muted "≈ ₩16,300" beside a USD amount, in the viewer's display currency (header "Currency" menu).
 * Renders nothing when the display currency is USD, the amount is missing, or rates are not loaded
 * (and on the server and during hydration: the display currency is only known after mount). The
 * tooltip gives the rate, its source and date. Display only: what is stored, requested and paid stays USD.
 */
export function LocalAmount({
  usd,
  except,
  className,
}: {
  usd: number | null | undefined;
  /** Nothing when the display currency is this one (a bill's own currency is already on screen). */
  except?: string | null;
  className?: string;
}) {
  const code = useDisplayCurrency();
  const { rates } = useFxRates(code !== "USD" && code !== except);
  const t = useT().fx;
  const f = useFmt();
  if (code === "USD" || code === except || usd === null || usd === undefined || !Number.isFinite(usd) || !rates) return null;
  const value = fromUsd(usd, code, rates.rates);
  const rate = rates.rates[code];
  if (value === null || rate === undefined) return null;
  const line = t.rateLine(formatRate(rate, f.tag), code, rates.source.name, rates.date);
  return (
    <span
      className={cn("text-xs font-normal whitespace-nowrap text-muted-ink tabular-nums", className)}
      title={t.equivalentTitle(line)}
      data-local-amount={code}
    >
      ≈ {formatMoney(value, code, f.tag)}
    </span>
  );
}
