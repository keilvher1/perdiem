"use client";

import { Fragment, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { Mandate } from "@/contracts/api";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { fmtUsd } from "@/lib/format";
import { useFmt, useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/** The mandate terms a rule display needs (MandateDetail and Mandate both fit). */
export type RuleMandate = Pick<
  Mandate,
  | "budgetUsd"
  | "perTxCapUsd"
  | "allowedMerchantIds"
  | "allowedCategories"
  | "blockedKeywords"
  | "startsAt"
  | "expiresAt"
  | "catalog"
>;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="type-label text-muted-ink sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 text-sm text-ink">{children}</dd>
    </div>
  );
}

/**
 * The mandate's rules in one line — budget, per-payment cap, N merchants, categories, window —
 * with the full list (merchants by name from the hashed catalog snapshot, blocked keywords)
 * behind a disclosure. Values are the mandate's own terms; nothing is derived.
 */
export function RuleSummary({
  mandate,
  defaultOpen = false,
  className,
}: {
  mandate: RuleMandate;
  defaultOpen?: boolean;
  className?: string;
}) {
  const t = useT();
  const f = useFmt();
  const r = t.ui.rules;
  const [open, setOpen] = useState(defaultOpen);
  const category = (c: string) => t.common.category[c] ?? c;
  const merchants = mandate.allowedMerchantIds.map((id) => ({
    id,
    name: mandate.catalog.find((m) => m.id === id)?.name ?? null,
  }));
  const windowText = t.ui.authority.range(f.date(mandate.startsAt), f.date(mandate.expiresAt, true));

  const summary = [
    r.budget(fmtUsd(mandate.budgetUsd)),
    r.perPayment(fmtUsd(mandate.perTxCapUsd)),
    r.merchants(mandate.allowedMerchantIds.length),
    mandate.allowedCategories.map(category).join(", ") || r.full.none,
    windowText,
  ];

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("@container rounded-lg border border-line bg-surface", className)}>
      {/* Narrow: title + toggle, then the summary on its own line. From 48rem: one line. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
        <h3 className="type-label text-muted-ink">{r.title}</h3>
        <p className="order-last min-w-0 basis-full text-sm leading-6 text-ink tabular-nums @3xl:order-none @3xl:flex-1 @3xl:basis-0">
          {/* Each item stays on one line; the space between items is outside the nowrap span so
              the summary wraps between items on narrow screens. */}
          {summary.map((s, i) => (
            <Fragment key={i}>
              {i > 0 && " "}
              <span className="whitespace-nowrap">
                {i > 0 && (
                  <span aria-hidden className="pr-2 text-line-strong">
                    ·
                  </span>
                )}
                {s}
                {i < summary.length - 1 && <span className="sr-only">;</span>}
              </span>
            </Fragment>
          ))}
        </p>
        <CollapsibleTrigger
          className="-mr-2 ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-cobalt outline-none transition-colors duration-150 hover:bg-cobalt-soft focus-visible:ring-2 focus-visible:ring-ring"
        >
          {open ? r.hide : r.show}
          <ChevronDown aria-hidden className={cn("size-3.5 transition-transform duration-150", open && "rotate-180")} />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <dl className="divide-y divide-line border-t border-line px-4 sm:px-5">
          <Row label={r.full.budget}>
            <span className="tabular-nums">{fmtUsd(mandate.budgetUsd)}</span>
          </Row>
          <Row label={r.full.perTxCap}>
            <span className="tabular-nums">{fmtUsd(mandate.perTxCapUsd)}</span>
          </Row>
          <Row label={r.full.merchants}>
            {merchants.length === 0 ? (
              r.full.none
            ) : (
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {merchants.map((m) => (
                  <li key={m.id} className="whitespace-nowrap">
                    {m.name ?? m.id} <span className="type-id text-muted-ink">{m.id}</span>
                  </li>
                ))}
              </ul>
            )}
          </Row>
          <Row label={r.full.categories}>
            {mandate.allowedCategories.map(category).join(", ") || r.full.none}
          </Row>
          <Row label={r.full.blocked}>
            {mandate.blockedKeywords.length === 0 ? (
              r.full.none
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {mandate.blockedKeywords.map((k) => (
                  <li key={k} className="rounded-sm border border-line bg-surface-2 px-1.5 text-xs text-ink">
                    {k}
                  </li>
                ))}
              </ul>
            )}
          </Row>
          <Row label={r.full.window}>
            <span className="tabular-nums">{windowText}</span>
          </Row>
        </dl>
        <p className="border-t border-line px-4 py-2 text-xs text-muted-ink sm:px-5">{r.catalogNote}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}
