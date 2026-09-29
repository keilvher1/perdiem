"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { LedgerEntryView, MandateDetail, MandateDetailResponse } from "@/contracts/api";
import chatResponsesJson from "@/docs/fixtures/chat-responses.json";
import mandateAJson from "@/docs/fixtures/mandate-man_A.json";
import mandateBJson from "@/docs/fixtures/mandate-man_B.json";
import mandateCJson from "@/docs/fixtures/mandate-man_C.json";
import { Button } from "@/components/ui/button";
import { AuthoritySummary } from "@/components/perdiem/authority-summary";
import { BudgetBreakdown, type BudgetFigures } from "@/components/perdiem/budget-breakdown";
import { DecisionLedger } from "@/components/perdiem/decision-ledger";
import { DecisionWorkspace } from "@/components/perdiem/decision-workspace";
import { EvidencePanel } from "@/components/perdiem/evidence-panel";
import { PageContainer } from "@/components/perdiem/page";
import { RuleSummary } from "@/components/perdiem/rule-summary";
import { StateBadge } from "@/components/perdiem/state-badge";
import { useT } from "@/lib/i18n/provider";
import { useNow } from "@/hooks/use-now";
import {
  AUTHORITY_STATES,
  DECISION_STATES,
  EXECUTION_STATES,
  VERIFICATION_STATES,
  type StateFamily,
} from "@/lib/ui-state";
import { cn } from "@/lib/utils";

// ---- Fixture data (docs/fixtures, read-only). Variants are labelled as such on the page. ----
const A = mandateAJson as unknown as MandateDetailResponse;
const B = mandateBJson as unknown as MandateDetailResponse;
const C = mandateCJson as unknown as MandateDetailResponse;
type ChatFixture = { rules: { response: { entry: LedgerEntryView | null } }[] };
const chatEntries = (chatResponsesJson as unknown as ChatFixture).rules
  .map((r) => r.response.entry)
  .filter((e): e is LedgerEntryView => e !== null);

const byId = (list: LedgerEntryView[], id: string) => list.find((e) => e.id === id)!;

/** A state variant of a fixture entry; the id says so (never mistaken for a recorded entry). */
function variant(e: LedgerEntryView, tag: string, patch: Partial<LedgerEntryView>): LedgerEntryView {
  const v: LedgerEntryView = { ...e, ...patch, id: `${e.id}~${tag}` };
  for (const k of Object.keys(patch) as (keyof LedgerEntryView)[]) if (patch[k] === undefined) delete v[k];
  return v;
}

/** man_A's ledger with led_007 as the chat fixture returns it (pending), plus labelled variants. */
const LEDGER: LedgerEntryView[] = [
  ...A.ledger.filter((e) => e.id !== "led_007"),
  byId(chatEntries, "led_007"),
  variant(byId(A.ledger, "led_001"), "failed", { status: "failed", settledAt: undefined, actualFeeUsd: undefined }),
  variant(byId(A.ledger, "led_001"), "approved", {
    status: "approved",
    txHash: undefined,
    explorerUrl: undefined,
    settledAt: undefined,
    actualFeeUsd: undefined,
  }),
];

/** Same rule as lib/view.ts: spent = Σ total of approved|pending|settled, pending ⊂ spent. */
function figures(m: MandateDetail, ledger: LedgerEntryView[]): BudgetFigures {
  let spentUsd = 0;
  let pendingUsd = 0;
  for (const e of ledger) {
    if (e.status === "approved" || e.status === "pending" || e.status === "settled") spentUsd += e.totalUsd;
    if (e.status === "pending") pendingUsd += e.totalUsd;
  }
  return { budgetUsd: m.budgetUsd, spentUsd, pendingUsd, remainingUsd: m.budgetUsd - spentUsd };
}

/** A stop the fixtures do not contain: unknown merchant + unknown fee (shows "not evaluated"). */
const UNKNOWN_MERCHANT_STOP: LedgerEntryView = variant(byId(A.ledger, "led_002"), "unknown-merchant", {
  proposal: { ...byId(A.ledger, "led_002").proposal, merchantId: "m99" },
  merchantName: undefined,
  merchantCategory: undefined,
  feeSource: "none",
  feeUsd: 0,
  totalUsd: 85,
  // What evaluate() returns for m99, $85 and a null fee: three failures, three skipped checks. (Live
  // records differ: lib/agent.ts passes fee 0 / feeSource "none" for an unknown merchant, so they
  // carry UNKNOWN_MERCHANT without FEE_UNAVAILABLE; the panel labels that fee as "none".)
  reasons: [
    { code: "UNKNOWN_MERCHANT", message: 'Merchant "m99" is not in the catalog.', observed: "m99" },
    { code: "OVER_PER_TX_CAP", message: "Single payment cap is $40.", observed: 85, limit: 40 },
    { code: "FEE_UNAVAILABLE", message: "Network fee could not be estimated; refusing rather than guessing." },
  ],
});

function Block({ title, note, children, className }: { title: string; note?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("border-t border-line pt-6", className)}>
      <h2 className="type-section text-ink">{title}</h2>
      {note && <p className="mt-1 text-xs text-muted-ink">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Caption({ children }: { children: ReactNode }) {
  return <p className="mb-2 font-mono text-[11px] text-muted-ink">{children}</p>;
}

const SWATCHES: { name: string; cls: string }[][] = [
  [
    { name: "page / background", cls: "bg-page" },
    { name: "surface", cls: "bg-surface" },
    { name: "surface-2", cls: "bg-surface-2" },
    { name: "line", cls: "bg-line" },
    { name: "line-strong", cls: "bg-line-strong" },
    { name: "muted-ink", cls: "bg-muted-ink" },
    { name: "ink", cls: "bg-ink" },
  ],
  [
    { name: "cobalt", cls: "bg-cobalt" },
    { name: "cobalt-soft", cls: "bg-cobalt-soft" },
    { name: "approve", cls: "bg-approve" },
    { name: "approve-soft", cls: "bg-approve-soft" },
    { name: "stop", cls: "bg-stop" },
    { name: "stop-soft", cls: "bg-stop-soft" },
    { name: "pending", cls: "bg-pending" },
  ],
  [
    { name: "pending-soft", cls: "bg-pending-soft" },
    { name: "danger", cls: "bg-danger" },
    { name: "danger-soft", cls: "bg-danger-soft" },
    { name: "unverified", cls: "bg-unverified" },
    { name: "unverified-soft", cls: "bg-unverified-soft" },
    { name: "primary", cls: "bg-primary" },
    { name: "ring", cls: "bg-ring" },
  ],
];

const FAMILIES: { family: StateFamily; states: ReadonlyArray<string> }[] = [
  { family: "authority", states: AUTHORITY_STATES },
  { family: "decision", states: DECISION_STATES },
  { family: "execution", states: EXECUTION_STATES },
  { family: "verification", states: VERIFICATION_STATES },
];

export function DesignGallery() {
  const t = useT();
  const g = t.ui.gallery;
  const now = useNow(30_000);
  const [selected, setSelected] = useState<string | null>("led_003");

  // Authority variants of man_A around the viewer's clock (null before mount = inside the window).
  const authority = useMemo(() => {
    const day = 86_400_000;
    const base = A.mandate;
    const at = (ms: number) => (now === null ? base.startsAt : new Date(now + ms).toISOString());
    const inside = { startsAt: at(-day), expiresAt: at(day) };
    return [
      // The window is moved around "now" so the badge reads active whenever the gallery is opened:
      // a variant, labelled as one (the fixture's own window is in the rule summary below).
      { tag: g.variant("man_A") + " · status active", m: { ...base, ...inside } },
      { tag: g.variant("man_A") + " · status paused", m: { ...base, ...inside, status: "paused" as const } },
      { tag: g.variant("man_A") + " · status revoked", m: { ...base, ...inside, status: "revoked" as const } },
      { tag: "man_C · window closed", m: C.mandate },
      { tag: g.variant("man_A") + " · window opens later", m: { ...base, startsAt: at(2 * day), expiresAt: at(4 * day) } },
    ];
  }, [now, g]);

  return (
    <PageContainer className="space-y-8">
      <header>
        <p className="type-label text-muted-ink">PerDiem</p>
        <h1 className="type-page-title mt-1 text-ink">{g.title}</h1>
        <p className="type-body mt-2 max-w-3xl text-muted-ink">{g.intro}</p>
      </header>

      <Block title={g.sections.tokens} note="app/globals.css · docs/DESIGN-SYSTEM.md">
        <div className="space-y-3">
          {SWATCHES.map((row, i) => (
            <div key={i} className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {row.map((s) => (
                <div key={s.name} className="min-w-0">
                  <div className={cn("h-10 rounded-md border border-line", s.cls)} />
                  <p className="mt-1 truncate font-mono text-[11px] text-muted-ink">{s.name}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Block>

      <Block title={g.sections.type}>
        <div className="grid gap-6 rounded-lg border border-line bg-surface p-5 lg:grid-cols-2">
          <div className="min-w-0 space-y-3">
            <Caption>type-page-title</Caption>
            <p className="type-page-title text-ink">{g.sample.title}</p>
            <Caption>type-section</Caption>
            <p className="type-section text-ink">{t.ui.ledger.title}</p>
            <Caption>type-body</Caption>
            <p className="type-body text-ink">{g.sample.body}</p>
            <Caption>type-label · type-id</Caption>
            <p className="type-label text-muted-ink">{t.ui.authority.mandate}</p>
            <p className="type-id break-all text-ink">{A.mandate.hash}</p>
          </div>
          <div className="min-w-0 space-y-3">
            <Caption>type-amount</Caption>
            <p className="type-amount text-ink">$132.7988</p>
            <Caption>type-amount-sm · tabular-nums</Caption>
            <p className="type-amount-sm text-ink">$12.1006</p>
            <p className="type-amount-sm text-ink">$85.00</p>
          </div>
        </div>
      </Block>

      <Block title={g.sections.states}>
        <div className="grid gap-4 lg:grid-cols-2">
          {FAMILIES.map(({ family, states }) => (
            <div key={family} className="rounded-lg border border-line bg-surface p-4">
              <p className="type-label text-muted-ink">{t.ui.family[family]}</p>
              {(["sm", "md"] as const).map((size) => (
                <div key={size} className="mt-3 flex flex-wrap gap-2">
                  {states.map((s) => (
                    <StateBadge key={s} family={family} state={s as never} size={size} />
                  ))}
                </div>
              ))}
              <div className="mt-3 flex flex-wrap gap-3">
                {states.map((s) => (
                  <StateBadge key={s} family={family} state={s as never} variant="plain" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Block>

      <Block title={g.sections.authority}>
        <div className="space-y-4">
          {authority.map(({ tag, m }) => (
            <div key={tag}>
              <Caption>{tag}</Caption>
              <AuthoritySummary
                mandate={m}
                now={now}
                actions={
                  tag.includes("active") ? (
                    // The actions slot, as /principal fills it (inert here: the gallery changes nothing).
                    <>
                      <Button type="button" variant="outline" size="sm" disabled>
                        {t.principal.controls.pause}
                      </Button>
                      <Button type="button" variant="outline" size="sm" disabled className="text-danger">
                        {t.principal.controls.revoke}
                      </Button>
                    </>
                  ) : undefined
                }
              />
            </div>
          ))}
        </div>
      </Block>

      <Block title={g.sections.rules}>
        <div className="space-y-4">
          <div>
            <Caption>man_A · collapsed</Caption>
            <RuleSummary mandate={A.mandate} />
          </div>
          <div>
            <Caption>man_A · defaultOpen</Caption>
            <RuleSummary mandate={A.mandate} defaultOpen />
          </div>
        </div>
      </Block>

      <Block title={g.sections.budget}>
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <Caption>man_A</Caption>
            <BudgetBreakdown budget={A.mandate} />
          </div>
          <div>
            <Caption>{g.variant("man_A")} · led_007 pending</Caption>
            <BudgetBreakdown budget={figures(A.mandate, LEDGER.filter((e) => !e.id.includes("~")))} />
          </div>
          <div>
            <Caption>man_B</Caption>
            <BudgetBreakdown budget={B.mandate} />
          </div>
        </div>
      </Block>

      <Block title={g.sections.ledger} note={`man_A · led_007 = chat-responses.json (pending) · "~" = ${g.variant("led_001")}`}>
        <DecisionWorkspace
          entries={LEDGER}
          mandate={A.mandate}
          selectedId={selected}
          onSelect={setSelected}
          now={now}
        />
      </Block>

      <Block title={g.sections.panels}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <Caption>man_B · led_004 · OVER_BUDGET_WITH_FEES</Caption>
            <EvidencePanel entry={byId(B.ledger, "led_004")} mandate={B.mandate} />
          </div>
          <div>
            <Caption>man_C · led_006 · EXPIRED</Caption>
            <EvidencePanel entry={byId(C.ledger, "led_006")} mandate={C.mandate} />
          </div>
          <div>
            <Caption>{g.variant("led_002")} · UNKNOWN_MERCHANT + FEE_UNAVAILABLE → 3 not evaluated</Caption>
            <EvidencePanel entry={UNKNOWN_MERCHANT_STOP} mandate={A.mandate} />
          </div>
          <div>
            <Caption>man_A · led_001 (settled) · without mandate prop</Caption>
            <EvidencePanel entry={byId(A.ledger, "led_001")} />
          </div>
        </div>
      </Block>

      <Block title={g.sections.empty}>
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <Caption>entries=[]</Caption>
            <DecisionLedger entries={[]} selectedId={null} onSelect={() => {}} />
          </div>
          <div>
            <Caption>loading</Caption>
            <DecisionLedger entries={[]} selectedId={null} onSelect={() => {}} loading />
          </div>
          <div>
            <Caption>entry=null</Caption>
            <EvidencePanel entry={null} />
          </div>
        </div>
      </Block>
    </PageContainer>
  );
}
