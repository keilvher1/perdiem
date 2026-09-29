"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { LedgerEntryView } from "@/contracts/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DecisionWorkspace, type DecisionWorkspaceHandle } from "@/components/perdiem/decision-workspace";
import { PageContainer, PageHeader } from "@/components/perdiem/page";
import type { ReceiptBudget } from "@/components/perdiem/receipt-card";
import { EmptyState, ErrorState } from "@/components/perdiem/states";
import { clearChatSession, nothingWasSent, sendChat, useChatSession } from "@/hooks/use-chat-session";
import { useNow } from "@/hooks/use-now";
import { useResource } from "@/hooks/use-resource";
import { findByPrefix, useSelectedMandate } from "@/hooks/use-selected-mandate";
import { writeStoredMandateId } from "@/hooks/use-stored-mandate";
import { api, toApiClientError } from "@/lib/api-client";
import { useT } from "@/lib/i18n/provider";
import { ChatPanel } from "./chat-panel";
import { MandatePanel, MandatePanelSkeleton, MandateStrip, MandateStripSkeleton } from "./mandate-card";
import { SessionRail } from "./session-rail";

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * /traveler — "how was my request handled, and what do I do next?"
 * The conversation is the input; each decision comes back as a structured receipt. Beside it (below
 * on mobile) the mandate: authority, the budget remaining now, what may be asked for. Under both,
 * the mandate's decision history with the evidence panel. The selected decision is ?d= (next to
 * ?m=): the newest reply selects its decision, a receipt's "Open evidence" and the history select one.
 */
function TravelerInner() {
  const { id, summary, mandates, error, loading, refresh } = useSelectedMandate();
  const { messages, pending } = useChatSession();
  const now = useNow(30_000);
  const [draft, setDraft] = useState("");
  const t = useT();
  const tp = t.traveler.page;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selectedId = params.get("d");
  const historyRef = useRef<HTMLElement>(null);
  const workspaceRef = useRef<DecisionWorkspaceHandle>(null);

  // Mandate terms and its ledger (oldest first) for the rules, the receipts and the history.
  const loadDetail = useMemo(() => (id ? () => api.mandate(id) : null), [id]);
  const detail = useResource(loadDetail);
  const terms = detail.data?.mandate ?? null;
  const ledger = detail.data?.ledger ?? null;
  const refreshDetail = detail.refresh;
  const refreshAll = useCallback(() => {
    refresh();
    refreshDetail();
  }, [refresh, refreshDetail]);

  /** Sets ?d= (and ?m= when given), keeping every other param. Reads the URL at call time. */
  const selectDecision = useCallback(
    (entryId: string, mandateId?: string) => {
      const sp = new URLSearchParams(window.location.search);
      sp.set("d", entryId);
      if (mandateId) sp.set("m", mandateId);
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [pathname, router],
  );

  const budgetFor = useCallback(
    (mandateId: string): ReceiptBudget | null => {
      const s = mandates?.find((x) => x.id === mandateId);
      return s ? { remainingUsd: s.remainingUsd, budgetUsd: s.budgetUsd } : null;
    },
    [mandates],
  );

  const send = async (text: string, mandateId: string | null = id) => {
    if (!mandateId) return;
    setDraft("");
    try {
      const res = await sendChat(mandateId, text);
      if (res) {
        refreshAll();
        // The current request's decision becomes the selected one (history, evidence drawer),
        // unless the traveler has moved to another mandate meanwhile.
        const shown = new URLSearchParams(window.location.search).get("m");
        if (res.entry && (shown === null || shown === res.entry.mandateId)) selectDecision(res.entry.id);
      }
    } catch (e) {
      const err = toApiClientError(e);
      if (nothingWasSent(err)) {
        setDraft(text);
        toast.error(tp.toastUnreachable, { description: err.message });
        return;
      }
      // A payment may have gone out before the error: no draft to resend, and reload the budget.
      refreshAll();
      toast.error(tp.toastOutcomeUnknown, { description: err.message });
    }
  };

  const onPickChip = (text: string, prefix: string, forSelected: boolean) => {
    setDraft(text);
    if (forSelected) return;
    const target = findByPrefix(mandates, prefix, id);
    if (target) {
      // Like select(), but ?d= goes: it names a decision of the mandate being left.
      writeStoredMandateId(target.id);
      const sp = new URLSearchParams(window.location.search);
      sp.set("m", target.id);
      sp.delete("d");
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
      toast.info(tp.toastSwitched(target.id), { description: tp.toastSwitchedDescription });
    }
  };

  /**
   * A receipt's "Open evidence": select it (?d=, and ?m= when the receipt is another mandate's),
   * scroll to the history, and once the history holds that decision open it there: the stacked
   * detail view on mobile, and keyboard focus on the evidence panel's heading.
   */
  const pendingOpen = useRef<string | null>(null);
  /** Bumped per click, so the effect below also runs when the decision is already the selected one. */
  const [openRequest, setOpenRequest] = useState(0);
  const openEvidence = (e: LedgerEntryView) => {
    pendingOpen.current = e.id;
    setOpenRequest((n) => n + 1);
    historyRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    selectDecision(e.id, e.mandateId !== id ? e.mandateId : undefined);
  };
  // Runs after the URL change has rendered (and after another mandate's ledger has loaded), so the
  // panel already shows the entry when its heading is focused.
  useEffect(() => {
    const want = pendingOpen.current;
    if (!want || want !== selectedId || !ledger?.some((x) => x.id === want)) return;
    pendingOpen.current = null;
    // The stacked detail view on mobile, focus on the panel heading everywhere.
    workspaceRef.current?.showDetail();
  }, [selectedId, ledger, openRequest]);

  const noMandates = mandates !== null && mandates.length === 0;

  return (
    <PageContainer className="pt-5 pb-10">
      <PageHeader
        eyebrow={t.shell.nav.traveler}
        title={tp.title}
        description={tp.description}
        className="mb-4"
        actions={
          messages.length > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={clearChatSession} disabled={pending !== null} className="bg-surface">
              <RotateCcw aria-hidden />
              {tp.clear}
            </Button>
          ) : undefined
        }
      />

      {error && !mandates ? (
        <ErrorState className="mb-4" title={tp.loadError} error={error} onRetry={refresh} />
      ) : noMandates ? (
        <EmptyState
          className="mb-4"
          title={tp.emptyTitle}
          description={tp.emptyDescription}
          action={
            <Button asChild>
              <Link href="/principal">{tp.grantMandate}</Link>
            </Button>
          }
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        {/* Mobile order: authority + remaining, the conversation (decision, reason, what to change),
            the request input; the mandate details after. */}
        {summary ? (
          <MandateStrip summary={summary} now={now} className="lg:hidden" />
        ) : loading ? (
          <MandateStripSkeleton className="lg:hidden" />
        ) : null}
        <ChatPanel
          className="min-w-0 lg:sticky lg:top-32 lg:col-start-1 lg:row-start-1"
          messages={messages}
          pending={pending}
          summary={summary}
          draft={draft}
          setDraft={setDraft}
          canSend={Boolean(summary)}
          onSend={(text) => void send(text)}
          onRetry={(text, mandateId) => void send(text, mandateId)}
          onPickChip={onPickChip}
          onSettled={refreshAll}
          onOpenEvidence={openEvidence}
          budgetFor={budgetFor}
          selectedId={selectedId}
        />
        <div className="min-w-0 space-y-4 lg:col-start-2 lg:row-start-1">
          {summary ? (
            <MandatePanel
              key={summary.id}
              summary={summary}
              terms={terms}
              termsError={detail.error !== null && detail.data === null}
              now={now}
            />
          ) : loading ? (
            <MandatePanelSkeleton />
          ) : null}
          <SessionRail messages={messages} mandateId={id} />
        </div>
      </div>

      {id && !noMandates && (
        <section ref={historyRef} aria-labelledby="traveler-history-title" className="mt-10">
          <div className="mb-4 max-w-3xl">
            <h2 id="traveler-history-title" className="type-section text-ink">
              {tp.historyTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-ink">{tp.historyDescription(id)}</p>
          </div>
          {detail.error && !detail.data ? (
            <ErrorState title={tp.historyError} error={detail.error} onRetry={detail.refresh} retrying={detail.refreshing} />
          ) : (
            <DecisionWorkspace
              ref={workspaceRef}
              entries={ledger ?? []}
              mandate={terms}
              selectedId={selectedId}
              onSelect={(entryId) => selectDecision(entryId)}
              now={now}
              ledgerProps={{ loading: ledger === null, label: tp.historyLabel(id), maxHeightClass: "lg:max-h-[36rem]" }}
            />
          )}
        </section>
      )}
    </PageContainer>
  );
}

function TravelerFallback() {
  return (
    <PageContainer className="pt-5 pb-10">
      <div className="mb-4 space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="h-[calc(100dvh-10rem)] min-h-[30rem] rounded-lg border border-line bg-surface lg:h-[calc(100dvh-14rem)] lg:min-h-[36rem]" />
        <MandatePanelSkeleton className="max-lg:hidden" />
      </div>
    </PageContainer>
  );
}

export default function TravelerPage() {
  return (
    <Suspense fallback={<TravelerFallback />}>
      <TravelerInner />
    </Suspense>
  );
}
