"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/perdiem/page";
import { EmptyState, ErrorState } from "@/components/perdiem/states";
import { useChatSession, sendChat, clearChatSession } from "@/hooks/use-chat-session";
import { useNow } from "@/hooks/use-now";
import { findByPrefix, useSelectedMandate } from "@/hooks/use-selected-mandate";
import { ChatPanel } from "./chat-panel";
import { MandateCard, MandateCardSkeleton } from "./mandate-card";
import { SessionRail } from "./session-rail";

function TravelerInner() {
  const { id, summary, mandates, error, loading, refresh, select } = useSelectedMandate();
  const { messages, pending } = useChatSession();
  const now = useNow();
  const [draft, setDraft] = useState("");

  const send = async (text: string, mandateId: string | null = id) => {
    if (!mandateId) return;
    setDraft("");
    try {
      const res = await sendChat(mandateId, text);
      if (res) refresh();
    } catch (e) {
      setDraft(text);
      toast.error("The agent could not be reached", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  const onPickChip = (text: string, prefix: string, forSelected: boolean) => {
    setDraft(text);
    if (forSelected) return;
    const target = findByPrefix(mandates, prefix);
    if (target) {
      select(target.id);
      toast.info(`Switched to ${target.id}`, { description: "This scripted request belongs to another mandate." });
    }
  };

  let top: React.ReactNode;
  if (loading) top = <MandateCardSkeleton />;
  else if (error && !mandates) top = <ErrorState title="Couldn’t load mandates" error={error} onRetry={refresh} />;
  else if (mandates && mandates.length === 0)
    top = (
      <EmptyState
        title="No mandates yet"
        description="A principal has to grant a per-diem mandate before the agent can propose anything."
        action={
          <Button asChild>
            <Link href="/principal">Grant a mandate</Link>
          </Button>
        }
      />
    );
  else if (summary) top = <MandateCard key={summary.id} summary={summary} now={now} />;
  else top = <MandateCardSkeleton />;

  return (
    <PageContainer className="py-6">
      <h1 className="sr-only">Traveler — ask the agent to pay, inside the mandate</h1>
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
