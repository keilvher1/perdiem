"use client";

import { useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { Bot, CornerDownLeft, LoaderCircle, RotateCcw, SendHorizontal, TriangleAlert } from "lucide-react";
import type { LedgerEntryView, MandateSummary, UsageRecord } from "@/contracts/api";
import { DEMO_SCRIPT } from "@/lib/api-client";
import { fmtInt, fmtTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/perdiem/states";
import { ReceiptCard } from "@/components/perdiem/receipt-card";
import { useConfirmPolling } from "@/hooks/use-confirm-polling";
import { updateChatEntry, type ChatMessage } from "@/hooks/use-chat-session";
import { cn } from "@/lib/utils";

/** Receipt that polls confirm while pending and writes the result back into the session. */
function LiveReceiptCard({ entry }: { entry: LedgerEntryView }) {
  useConfirmPolling(entry, updateChatEntry);
  return <ReceiptCard entry={entry} />;
}

/** The card carries reasons and the tx link, so the text keeps only the sentence. */
function displayReply(text: string, entry: LedgerEntryView | null): string {
  if (!entry) return text;
  return text
    .split("\n")
    .filter((line) => !line.trim().startsWith("•"))
    .join("\n")
    .replace(/\s*Tx:\s*\S+\s*$/, "")
    .trim();
}

function UsageLine({ usage }: { usage: UsageRecord[] }) {
  if (usage.length === 0) return null;
  const zeroOnly = usage.every((u) => u.totalTokens === 0);
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-400">
      {usage.map((u, i) => (
        <span key={`${u.flow}-${i}`} className={cn("rounded px-1.5 py-0.5 font-mono", u.totalTokens === 0 ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500")}>
          {u.flow} · {fmtInt(u.totalTokens)} tok
        </span>
      ))}
      {zeroOnly && <span>answered without the model</span>}
    </p>
  );
}

function Divider({ mandate }: { mandate: string }) {
  return (
    <div className="flex items-center gap-3 py-1 text-[11px] text-zinc-400" role="separator">
      <span className="h-px flex-1 bg-zinc-200" />
      now acting under <span className="font-mono text-zinc-500">{mandate}</span>
      <span className="h-px flex-1 bg-zinc-200" />
    </div>
  );
}

function AgentAvatar() {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200">
      <Bot aria-hidden className="size-4" />
    </span>
  );
}

function Message({ m, onRetry, busy }: { m: ChatMessage; onRetry: (text: string, mandateId: string) => void; busy: boolean }) {
  if (m.kind === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%]">
          <div className="rounded-2xl rounded-br-md bg-zinc-900 px-4 py-2.5 text-sm whitespace-pre-line text-white">{m.text}</div>
          <p className="mt-1 text-right text-[11px] text-zinc-400 tabular-nums">{fmtTime(m.at)}</p>
        </div>
      </div>
    );
  }
  if (m.kind === "error") {
    return (
      <div className="flex gap-3">
        <AgentAvatar />
        <div role="alert" className="max-w-[85%] rounded-2xl rounded-tl-md border border-rose-200 bg-rose-50/70 px-4 py-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-rose-900">
            <TriangleAlert aria-hidden className="size-4" /> The request did not go through
          </p>
          <p className="mt-1 text-rose-800/90">
            {m.text} <span className="font-mono text-xs text-rose-700/80">{m.code}</span>
          </p>
          <p className="mt-1 text-xs text-rose-800/70">Nothing was proposed or paid.</p>
          <Button type="button" size="sm" variant="outline" className="mt-2 bg-white" disabled={busy} onClick={() => onRetry(m.request, m.mandateId)}>
            <RotateCcw aria-hidden /> Try again
          </Button>
        </div>
      </div>
    );
  }
  const text = displayReply(m.text, m.entry);
  return (
    <div className="flex gap-3">
      <AgentAvatar />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="w-fit max-w-full rounded-2xl rounded-tl-md border border-zinc-200 bg-white px-4 py-2.5 text-sm whitespace-pre-line text-zinc-800">
          {text}
        </div>
        {m.entry && (
          <div className="max-w-[560px]">
            <LiveReceiptCard entry={m.entry} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-zinc-400 tabular-nums">{fmtTime(m.at)}</span>
          <UsageLine usage={m.usage} />
        </div>
      </div>
    </div>
  );
}

interface Chip {
  key: string;
  prefix: string;
  text: string;
  steps: number[];
}

function buildChips(): Chip[] {
  const out: Chip[] = [];
  for (const s of DEMO_SCRIPT) {
    const hit = out.find((c) => c.prefix === s.mandateId && c.text === s.text);
    if (hit) hit.steps.push(s.n);
    else out.push({ key: `${s.mandateId}|${s.text}`, prefix: s.mandateId, text: s.text, steps: [s.n] });
  }
  return out;
}

const CHIPS = buildChips();

export function QuickChips({
  selectedId,
  onPick,
  disabled,
}: {
  selectedId: string | null;
  onPick: (text: string, prefix: string, forSelected: boolean) => void;
  disabled?: boolean;
}) {
  const chips = CHIPS;
  const mine = chips.filter((c) => selectedId?.startsWith(c.prefix));
  const others = chips.filter((c) => !selectedId?.startsWith(c.prefix));
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Scripted demo requests</p>
      <div className="flex flex-wrap gap-2">
        {[...mine, ...others].map((c) => {
          const forSelected = selectedId?.startsWith(c.prefix) ?? false;
          return (
            <button
              key={c.key}
              type="button"
              disabled={disabled}
              onClick={() => onPick(c.text, c.prefix, forSelected)}
              title={forSelected ? "Fill the composer" : `Switch to ${c.prefix} and fill the composer`}
              className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-left text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50",
                forSelected
                  ? "border-zinc-300 bg-white text-zinc-800 hover:border-indigo-300 hover:bg-indigo-50/50"
                  : "border-dashed border-zinc-300 bg-transparent text-zinc-500 hover:border-zinc-400 hover:text-zinc-700",
              )}
            >
              <span className="font-mono text-[10px] text-zinc-400">#{c.steps.join("/")}</span>
              <span className="truncate">{c.text}</span>
              {!forSelected && <span className="shrink-0 rounded bg-zinc-100 px-1 font-mono text-[10px] text-zinc-500">for {c.prefix}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ChatPanel({
  messages,
  pending,
  summary,
  draft,
  setDraft,
  onSend,
  onRetry,
  onPickChip,
  onClear,
  canSend,
}: {
  messages: ChatMessage[];
  pending: { mandateId: string; text: string } | null;
  summary: MandateSummary | null;
  draft: string;
  setDraft: (v: string) => void;
  onSend: (text: string) => void;
  onRetry: (text: string, mandateId: string) => void;
  onPickChip: (text: string, prefix: string, forSelected: boolean) => void;
  onClear: () => void;
  canSend: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = pending !== null;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, busy]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy || !canSend) return;
    onSend(text);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <section aria-label="Conversation with the agent" className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Ask the agent to pay</h2>
          <p className="text-xs text-zinc-500">
            The agent only proposes. Policy code approves or stops every payment before anything reaches the chain, and records why.
          </p>
        </div>
        {messages.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={busy} className="text-zinc-500">
            <RotateCcw aria-hidden /> Clear
          </Button>
        )}
      </div>

      <div ref={listRef} className="h-[calc(100dvh-460px)] min-h-[340px] space-y-5 overflow-y-auto px-5 py-5" aria-live="polite">
        {messages.length === 0 && !busy ? (
          <EmptyState
            className="h-full border-0 bg-transparent"
            title="No requests yet — try a quick prompt"
            description="Pick a scripted request below or type your own, e.g. “Order a bibimbap lunch from Yangjae Kitchen, $12”."
          />
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const showDivider = m.kind === "user" && prev !== undefined && prev.mandateId !== m.mandateId;
            return (
              <div key={m.id} className="space-y-5">
                {showDivider && <Divider mandate={m.mandateId} />}
                <Message m={m} onRetry={onRetry} busy={busy} />
              </div>
            );
          })
        )}
        {busy && (
          <div className="flex gap-3" role="status">
            <AgentAvatar />
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-500">
              <LoaderCircle aria-hidden className="size-4 animate-spin text-zinc-400" />
              Proposing, then checking the mandate…
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-zinc-100 bg-zinc-50/60 px-5 py-4">
        <QuickChips
          selectedId={summary?.id ?? null}
          disabled={busy}
          onPick={(text, prefix, forSelected) => {
            onPickChip(text, prefix, forSelected);
            inputRef.current?.focus();
          }}
        />
        <form onSubmit={submit} className="flex items-end gap-2">
          <label htmlFor="traveler-composer" className="sr-only">
            Message to the agent
          </label>
          <Textarea
            id="traveler-composer"
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder={summary ? `Ask for a purchase under ${summary.id}…` : "Choose a mandate first"}
            disabled={!canSend}
            className="max-h-40 min-h-11 resize-none bg-white"
          />
          <Button type="submit" size="lg" disabled={!canSend || busy || draft.trim() === ""} className="h-11 px-4">
            {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : <SendHorizontal aria-hidden />}
            Send
          </Button>
        </form>
        <p className="flex items-center gap-1 text-[11px] text-zinc-400">
          <CornerDownLeft aria-hidden className="size-3" /> Enter to send · Shift+Enter for a new line
        </p>
      </div>
    </section>
  );
}
