"use client";

import { useCallback, useEffect, useId, useRef, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, Bot, CornerDownLeft, RotateCcw, SendHorizontal } from "lucide-react";
import type { LedgerEntryView, MandateSummary, UsageRecord } from "@/contracts/api";
import { DEMO_SCRIPT } from "@/lib/api-client";
import { fmtUsd } from "@/lib/format";
import { useFmt, useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/perdiem/states";
import { ReceiptCard, type ReceiptBudget } from "@/components/perdiem/receipt-card";
import { StateGlyph } from "@/components/perdiem/state-glyph";
import { useConfirmPolling } from "@/hooks/use-confirm-polling";
import {
  errorTxHash,
  nothingWasSent,
  unrecordedPaymentCode,
  updateChatEntry,
  useMandateTerms,
  type ChatMessage,
} from "@/hooks/use-chat-session";
import { cn } from "@/lib/utils";

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Receipt that polls confirm while pending and writes the result back into the session. It reads
 * its own mandate's terms (the conversation can span mandates); the card uses them only when their
 * hash is the entry's.
 */
function LiveReceiptCard({
  entry,
  onSettled,
  budgetNow,
  onOpenEvidence,
  selected,
}: {
  entry: LedgerEntryView;
  onSettled?: () => void;
  budgetNow: ReceiptBudget | null;
  onOpenEvidence: (entry: LedgerEntryView) => void;
  selected: boolean;
}) {
  const onUpdate = useCallback(
    (e: LedgerEntryView) => {
      updateChatEntry(e);
      onSettled?.();
    },
    [onSettled],
  );
  useConfirmPolling(entry, onUpdate);
  const terms = useMandateTerms(entry.mandateId);
  return (
    <ReceiptCard entry={entry} terms={terms} budgetNow={budgetNow} onOpenEvidence={onOpenEvidence} selected={selected} />
  );
}

/** The receipt carries reasons and the tx link, so the text keeps only the sentence. */
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
  const t = useT();
  const f = useFmt();
  if (usage.length === 0) return null;
  const zeroOnly = usage.every((u) => u.totalTokens === 0);
  return (
    <>
      {usage.map((u, i) => (
        <span key={`${u.flow}-${i}`} className="inline-flex items-center gap-1 tabular-nums">
          <span aria-hidden className="text-line-strong">
            ·
          </span>
          <span className="font-mono text-[11px]">{u.flow}</span>
          {t.traveler.chat.tokens(f.int(u.totalTokens))}
        </span>
      ))}
      {zeroOnly && (
        <span>
          <span aria-hidden className="text-line-strong">
            ·{" "}
          </span>
          {t.traveler.chat.noModel}
        </span>
      )}
    </>
  );
}

function Divider({ mandate }: { mandate: string }) {
  const t = useT();
  return (
    // Not role="separator": a separator's text is not read out, and this line says which mandate
    // the following requests go to.
    <div className="flex items-center gap-3 text-xs text-muted-ink">
      <span aria-hidden className="h-px flex-1 bg-line" />
      <p>
        {t.traveler.chat.dividerBefore}
        <span className="type-id text-ink">{mandate}</span>
        {t.traveler.chat.dividerAfter}
      </p>
      <span aria-hidden className="h-px flex-1 bg-line" />
    </div>
  );
}

function AgentLabel({ at, usage }: { at?: string; usage?: UsageRecord[] }) {
  const t = useT();
  const f = useFmt();
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-ink">
      <span className="inline-flex items-center gap-1.5 font-medium text-ink">
        <Bot aria-hidden className="size-3.5 text-muted-ink" />
        {t.traveler.chat.agent}
      </span>
      {at && (
        <time dateTime={at} className="tabular-nums">
          {f.time(at)}
        </time>
      )}
      {usage && <UsageLine usage={usage} />}
    </p>
  );
}

/** An error is not a decision: red, triangle and text (a rule stop is the amber receipt). */
function ErrorBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="alert" className="max-w-[40rem] rounded-lg border border-danger-line bg-danger-soft px-4 py-3 text-sm">
      <p className="flex items-start gap-2 font-medium text-danger">
        <StateGlyph glyph="triangle" className="mt-1 size-3 shrink-0" />
        {title}
      </p>
      <div className="mt-1 space-y-1 pl-5 text-ink">{children}</div>
    </div>
  );
}

function Message({
  m,
  onRetry,
  busy,
  onSettled,
  budgetFor,
  onOpenEvidence,
  selectedId,
}: {
  m: ChatMessage;
  onRetry: (text: string, mandateId: string) => void;
  busy: boolean;
  onSettled?: () => void;
  budgetFor: (mandateId: string) => ReceiptBudget | null;
  onOpenEvidence: (entry: LedgerEntryView) => void;
  selectedId: string | null;
}) {
  const t = useT();
  const f = useFmt();
  const locale = f.locale;
  const te = t.traveler.errors;
  if (m.kind === "user") {
    return (
      <div data-msg="user" className="flex justify-end">
        <div className="max-w-[85%] sm:max-w-[70%]">
          <p className="rounded-lg border border-line-strong bg-surface-2 px-3.5 py-2 text-sm whitespace-pre-line text-ink">
            <span className="sr-only">{t.traveler.chat.you}: </span>
            {m.text}
          </p>
          <p className="mt-1 text-right text-xs text-muted-ink tabular-nums">
            <time dateTime={m.at}>{f.time(m.at)}</time>
          </p>
        </div>
      </div>
    );
  }
  if (m.kind === "error") {
    if (nothingWasSent(m)) {
      return (
        <div data-msg="error" className="space-y-2">
          <AgentLabel at={m.at} />
          <ErrorBox title={te.notSentTitle}>
            <p>
              {m.text} <span className="font-mono text-xs text-muted-ink">{m.code}</span>
            </p>
            <p className="text-xs text-muted-ink">{te.notSentNote}</p>
            <Button type="button" size="sm" variant="outline" className="mt-1 bg-surface" disabled={busy} onClick={() => onRetry(m.request, m.mandateId)}>
              <RotateCcw aria-hidden /> {te.tryAgain}
            </Button>
          </ErrorBox>
        </div>
      );
    }
    // The failure may have come after a broadcast: never claim nothing was paid, never offer a retry.
    const txHash = errorTxHash(m.details);
    const unrecorded = unrecordedPaymentCode(m.code);
    const thisRequest = unrecorded === "PAYMENT_NOT_RECORDED";
    return (
      <div data-msg="error" className="space-y-2">
        <AgentLabel at={m.at} />
        <ErrorBox
          title={unrecorded ? (thisRequest ? te.unrecorded.thisTitle : te.unrecorded.earlierTitle) : te.unconfirmedTitle}
        >
          {unrecorded ? (
            <>
              <p>{thisRequest ? te.unrecorded.thisBody : te.unrecorded.earlierBody}</p>
              <p className="text-xs font-medium">{te.unrecorded.note}</p>
              <p className="text-xs text-muted-ink">
                {m.text}{" "}
                <span className="font-mono">
                  {m.code}
                  {m.status > 0 ? ` · HTTP ${m.status}` : ""}
                </span>
              </p>
            </>
          ) : (
            <>
              <p>
                {m.text}{" "}
                <span className="font-mono text-xs text-muted-ink">
                  {m.code}
                  {m.status > 0 && m.code !== `HTTP_${m.status}` ? ` · HTTP ${m.status}` : ""}
                </span>
              </p>
              <p className="text-xs font-medium">{te.unconfirmedNote(m.status === 0)}</p>
            </>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {txHash && (
              <Button asChild size="sm" variant="outline" className="bg-surface">
                <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer">
                  {te.viewTx}
                  <ArrowUpRight aria-hidden />
                </a>
              </Button>
            )}
            <Button asChild size="sm" variant="outline" className="bg-surface">
              <Link href={`/principal?m=${encodeURIComponent(m.mandateId)}`}>{te.openLedger}</Link>
            </Button>
          </div>
        </ErrorBox>
      </div>
    );
  }
  const serverText = displayReply(m.text, m.entry);
  // The agent's reply is English server text. Other languages get a headline built from the
  // recorded decision instead; plain answers without a decision stay English (marked lang="en").
  const localized = locale !== "en" && m.entry;
  const text = localized && m.entry
    ? t.traveler.chat.replyHeadline(
        m.entry.decision,
        m.entry.status === "failed",
        m.entry.merchantName ?? m.entry.proposal.merchantId,
        fmtUsd(m.entry.proposal.amountUsd),
      )
    : serverText;
  return (
    <div data-msg="agent" className="space-y-2">
      <AgentLabel at={m.at} usage={m.usage} />
      {text && (
        <p
          lang={localized || locale === "en" ? undefined : "en"}
          title={localized ? serverText : undefined}
          className={cn("max-w-prose text-sm whitespace-pre-line", m.entry ? "text-muted-ink" : "text-ink")}
        >
          {text}
        </p>
      )}
      {m.entry && (
        <div className="max-w-[40rem]">
          <LiveReceiptCard
            entry={m.entry}
            onSettled={onSettled}
            budgetNow={budgetFor(m.entry.mandateId)}
            onOpenEvidence={onOpenEvidence}
            selected={m.entry.id === selectedId}
          />
        </div>
      )}
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

/**
 * The scripted demo requests (texts unchanged: they are sent to the model). The selected mandate's
 * chips come first; another set's chip is dashed, says which mandate it is for, and switches to it.
 */
export function QuickChips({
  selectedId,
  onPick,
  disabled,
  trailing,
}: {
  selectedId: string | null;
  onPick: (text: string, prefix: string, forSelected: boolean) => void;
  disabled?: boolean;
  /** Rendered at the end of the heading row (the composer's key hint). */
  trailing?: React.ReactNode;
}) {
  const t = useT();
  const tc = t.traveler.chips;
  const headingId = useId();
  const mine = CHIPS.filter((c) => selectedId?.startsWith(c.prefix));
  const others = CHIPS.filter((c) => !selectedId?.startsWith(c.prefix));
  return (
    <div role="group" aria-labelledby={headingId} className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p id={headingId} className="type-label text-muted-ink">
          {tc.heading}
        </p>
        {trailing}
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {[...mine, ...others].map((c) => {
          const forSelected = selectedId?.startsWith(c.prefix) ?? false;
          return (
            <button
              key={c.key}
              type="button"
              disabled={disabled}
              onClick={() => onPick(c.text, c.prefix, forSelected)}
              title={forSelected ? tc.fill : tc.switchAndFill(c.prefix)}
              className={cn(
                "inline-flex h-7 max-w-full shrink-0 items-center gap-1.5 rounded-md border px-2 text-left text-xs whitespace-nowrap outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                forSelected
                  ? "border-line-strong bg-surface text-ink hover:border-cobalt-line hover:bg-cobalt-soft"
                  : "border-dashed border-line-strong bg-transparent text-muted-ink hover:bg-surface hover:text-ink",
              )}
            >
              <span className="text-[11px] text-muted-ink tabular-nums">#{c.steps.join("/")}</span>
              {/* The scripted requests are English (they are sent to the model as written). */}
              <span lang="en" className="truncate">
                {c.text}
              </span>
              {!forSelected && (
                <span className="shrink-0 rounded-sm border border-line bg-surface-2 px-1 text-[10px] text-muted-ink">
                  {tc.forMandate(c.prefix)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The conversation: the chat is the input; every decision comes back as a structured receipt
 * under the agent's sentence. The newest exchange is scrolled into view from its start, so a
 * receipt's decision is read before its details. The composer (scripted chips, text, Send) sits
 * under the list; English "Send" is the capture script's button.
 */
export function ChatPanel({
  messages,
  pending,
  summary,
  draft,
  setDraft,
  onSend,
  onRetry,
  onPickChip,
  onSettled,
  onOpenEvidence,
  budgetFor,
  selectedId,
  canSend,
  className,
}: {
  messages: ChatMessage[];
  pending: { mandateId: string; text: string } | null;
  summary: MandateSummary | null;
  draft: string;
  setDraft: (v: string) => void;
  onSend: (text: string) => void;
  onRetry: (text: string, mandateId: string) => void;
  onPickChip: (text: string, prefix: string, forSelected: boolean) => void;
  /** Called when a receipt leaves "pending" (e.g. to refresh the budget). */
  onSettled?: () => void;
  onOpenEvidence: (entry: LedgerEntryView) => void;
  /** The mandate's budget right now, for the receipts' "Remaining now". */
  budgetFor: (mandateId: string) => ReceiptBudget | null;
  /** The decision selected in the history (?d=). */
  selectedId: string | null;
  canSend: boolean;
  className?: string;
}) {
  const t = useT();
  const tc = t.traveler.chat;
  const listRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pinnedRef = useRef(true);
  const hintId = useId();
  const titleId = useId();
  const busy = pending !== null;

  // Stay pinned to the newest message while content grows (a receipt flipping to settled, the
  // checks opening), unless the reader has scrolled up.
  useEffect(() => {
    const el = listRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    const onScroll = () => {
      pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => {
      if (pinnedRef.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(content);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);

  // A new message: show the bottom when the newest exchange fits; otherwise the newest reply from
  // its start, so the receipt's decision is read before its details (while waiting, the request).
  useEffect(() => {
    const el = listRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    const bottom = el.scrollHeight - el.clientHeight;
    const items = content.querySelectorAll<HTMLElement>("[data-msg]");
    const users = content.querySelectorAll<HTMLElement>('[data-msg="user"]');
    const last = items[items.length - 1];
    const lastUser = users[users.length - 1];
    const exchangeFits = lastUser ? el.scrollHeight - lastUser.offsetTop + 16 <= el.clientHeight : true;
    const anchor =
      !last || exchangeFits || last.dataset.msg === "thinking" || last.dataset.msg === "user" ? lastUser : last;
    const target = anchor ? Math.min(bottom, Math.max(0, anchor.offsetTop - 16)) : bottom;
    pinnedRef.current = target >= bottom - 2;
    el.scrollTo({ top: target, behavior: prefersReducedMotion() ? "auto" : "smooth" });
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

  const empty = messages.length === 0 && !busy;

  return (
    // lg: the height left under the header and the page title (≈ 14.25rem) minus the "Attach bill"
    // strip BillDrop puts under the panel (≈ 2.25rem) and a 1rem margin, so the composer and the
    // strip are both on screen at first load (1920×1080, 1440×900, 1024×768).
    <section
      aria-labelledby={titleId}
      className={cn(
        "flex h-[calc(100dvh-10rem)] min-h-[30rem] flex-col overflow-hidden rounded-lg border border-line bg-surface lg:h-[calc(100dvh-17.5rem)] lg:min-h-[30rem]",
        className,
      )}
    >
      <h2 id={titleId} className="sr-only">
        {tc.ariaLabel}
      </h2>
      <div ref={listRef} role="log" className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div ref={contentRef} className={cn("space-y-6 px-4 py-5 sm:px-5", empty && "flex h-full flex-col justify-center")}>
          {empty ? (
            <EmptyState className="border-0 bg-transparent" title={tc.emptyTitle} description={tc.emptyDescription} />
          ) : (
            messages.map((m, i) => {
              const prev = messages[i - 1];
              const showDivider = m.kind === "user" && prev !== undefined && prev.mandateId !== m.mandateId;
              return (
                <div key={m.id} className="space-y-6">
                  {showDivider && <Divider mandate={m.mandateId} />}
                  <Message
                    m={m}
                    onRetry={onRetry}
                    busy={busy}
                    onSettled={onSettled}
                    budgetFor={budgetFor}
                    onOpenEvidence={onOpenEvidence}
                    selectedId={selectedId}
                  />
                </div>
              );
            })
          )}
          {busy && (
            <div data-msg="thinking" role="status" className="space-y-2">
              <AgentLabel />
              <p className="flex items-center gap-2 text-sm text-pending">
                {/* Static glyph: no spinner. */}
                <StateGlyph glyph="half" className="size-3 shrink-0" />
                {tc.thinking}
              </p>
              <Skeleton className="h-28 w-full max-w-[40rem] rounded-lg" />
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 space-y-2.5 border-t border-line bg-surface-2 px-4 py-3 sm:px-5">
        <QuickChips
          selectedId={summary?.id ?? null}
          disabled={busy}
          trailing={
            <p id={hintId} className="flex items-center gap-1 text-xs text-muted-ink max-sm:sr-only">
              <CornerDownLeft aria-hidden className="size-3" /> {tc.keyHint}
            </p>
          }
          onPick={(text, prefix, forSelected) => {
            onPickChip(text, prefix, forSelected);
            inputRef.current?.focus();
          }}
        />
        {/* Send beside the text at every width: the Evidence tab sits in the right gutter, mid-height. */}
        <form onSubmit={submit} className="flex items-end gap-2">
          <label htmlFor="traveler-composer" className="sr-only">
            {tc.composerLabel}
          </label>
          <Textarea
            id="traveler-composer"
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            aria-describedby={hintId}
            placeholder={summary ? tc.placeholder(summary.id) : tc.placeholderNoMandate}
            disabled={!canSend}
            className="max-h-40 min-h-11 min-w-0 resize-none bg-surface"
          />
          <Button type="submit" size="lg" disabled={!canSend || busy || draft.trim() === ""} className="h-11 shrink-0 px-4">
            <SendHorizontal aria-hidden />
            {tc.send}
          </Button>
        </form>
      </div>
    </section>
  );
}
