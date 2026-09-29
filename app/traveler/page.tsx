"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/perdiem/page";
import { EmptyState, ErrorState } from "@/components/perdiem/states";
import { useChatSession, sendChat, clearChatSession, nothingWasSent } from "@/hooks/use-chat-session";
import { toApiClientError } from "@/lib/api-client";
import { useNow } from "@/hooks/use-now";
import { findByPrefix, useSelectedMandate } from "@/hooks/use-selected-mandate";
import { useT } from "@/lib/i18n/provider";
import { ChatPanel } from "./chat-panel";
import { MandateCard, MandateCardSkeleton } from "./mandate-card";
import { SessionRail } from "./session-rail";

function TravelerInner() {
  const { id, summary, mandates, error, loading, refresh, select } = useSelectedMandate();
  const { messages, pending } = useChatSession();
  const now = useNow();
  const [draft, setDraft] = useState("");
  const t = useT();
  const tp = t.traveler.page;

  const send = async (text: string, mandateId: string | null = id) => {
    if (!mandateId) return;
    setDraft("");
    try {
      const res = await sendChat(mandateId, text);
      if (res) refresh();
    } catch (e) {
      const err = toApiClientError(e);
      if (nothingWasSent(err)) {
        setDraft(text);
        toast.error(tp.toastUnreachable, { description: err.message });
        return;
      }
      // A payment may have gone out before the error: no draft to resend, and reload the budget.
      refresh();
      toast.error(tp.toastOutcomeUnknown, { description: err.message });
    }
  };

  const onPickChip = (text: string, prefix: string, forSelected: boolean) => {
    setDraft(text);
    if (forSelected) return;
    const target = findByPrefix(mandates, prefix, id);
    if (target) {
      select(target.id);
      toast.info(tp.toastSwitched(target.id), { description: tp.toastSwitchedDescription });
    }
  };

  let top: React.ReactNode;
  if (loading) top = <MandateCardSkeleton />;
  else if (error && !mandates) top = <ErrorState title={tp.loadError} error={error} onRetry={refresh} />;
  else if (mandates && mandates.length === 0)
    top = (
      <EmptyState
        title={tp.emptyTitle}
        description={tp.emptyDescription}
        action={
          <Button asChild>
            <Link href="/principal">{tp.grantMandate}</Link>
          </Button>
        }
      />
    );
  else if (summary) top = <MandateCard key={summary.id} summary={summary} now={now} />;
  else top = <MandateCardSkeleton />;

  return (
    <PageContainer className="py-6">
      <h1 className="sr-only">{tp.heading}</h1>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-6 lg:col-start-2 lg:row-start-1">
          {top}
          <SessionRail messages={messages} />
        </div>
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <ChatPanel
            messages={messages}
            pending={pending}
            summary={summary}
            draft={draft}
            setDraft={setDraft}
            canSend={Boolean(summary)}
            onSend={(text) => void send(text)}
            onRetry={(text, mandateId) => void send(text, mandateId)}
            onPickChip={onPickChip}
            onClear={clearChatSession}
            onSettled={refresh}
          />
        </div>
      </div>
    </PageContainer>
  );
}

function TravelerFallback() {
  return (
    <PageContainer className="py-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-[560px] rounded-xl border border-zinc-200 bg-white" />
        <MandateCardSkeleton />
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
