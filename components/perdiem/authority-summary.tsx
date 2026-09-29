"use client";

import type { ReactNode } from "react";
import type { MandateSummary } from "@/contracts/api";
import { windowState } from "@/lib/format";
import { useFmt, useT } from "@/lib/i18n/provider";
import { authorityState } from "@/lib/ui-state";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";
import { StateBadge } from "./state-badge";

export type AuthorityMandate = Pick<
  MandateSummary,
  "id" | "traveler" | "principal" | "status" | "startsAt" | "expiresAt"
>;

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="type-label text-muted-ink">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-ink">{children}</dd>
    </div>
  );
}

/**
 * Who granted what to whom, and whether it is in force right now: mandate id, traveler,
 * principal, authority badge (paused / revoked win, then the trip window), window and deadline.
 * `actions` renders on the right (pause / resume / revoke on /principal). `now` null (before
 * mount) reads as inside the window, so server and client markup agree.
 */
export function AuthoritySummary({
  mandate,
  now,
  actions,
  headingLevel = 2,
  className,
}: {
  mandate: AuthorityMandate;
  now: number | null;
  actions?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const t = useT();
  const f = useFmt();
  const a = t.ui.authority;
  const state = authorityState(mandate, now);
  const w = windowState(mandate.startsAt, mandate.expiresAt, now);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const deadline =
    w === "before"
      ? a.opens(f.rel(mandate.startsAt, now))
      : w === "expired"
        ? a.closed(f.rel(mandate.expiresAt, now))
        : a.closes(f.rel(mandate.expiresAt, now));

  return (
    <section
      aria-label={`${a.mandate} ${mandate.id}`}
      className={cn("@container rounded-lg border border-line bg-surface", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <p className="type-label text-muted-ink">{a.mandate}</p>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
            <Heading className="truncate font-mono text-base font-semibold text-ink">{mandate.id}</Heading>
            <CopyButton value={mandate.id} label={t.common.hash.copy(mandate.id)} />
            <StateBadge family="authority" state={state} size="md" />
          </div>
        </div>
        {actions && (
          <div role="group" aria-label={a.actions} className="flex flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      {/* Columns follow the summary's own width (container queries), not the viewport. */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line px-4 py-3 sm:px-5 @3xl:grid-cols-4">
        <Field label={a.traveler}>{mandate.traveler}</Field>
        <Field label={a.principal}>{mandate.principal}</Field>
        <Field label={a.window} className="col-span-2 @3xl:col-span-1">
          <span className="tabular-nums">{a.range(f.date(mandate.startsAt), f.date(mandate.expiresAt, true))}</span>
        </Field>
        <Field label={a.deadline} className="col-span-2 @3xl:col-span-1">
          <span className={cn("tabular-nums", w === "expired" ? "text-muted-ink" : "text-ink")}>{deadline}</span>
        </Field>
      </dl>
    </section>
  );
}
