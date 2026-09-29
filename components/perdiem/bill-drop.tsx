"use client";

/**
 * BillDrop — drop a bill, receipt or invoice; PerDiem reads the merchant and total; one click
 * ("Pay this bill") sends the request through the normal chat path, so the agent proposes and the
 * policy decides exactly as for a typed request. PerDiem pays the merchant named on the bill,
 * inside the mandate: it is not a reimbursement to the traveler.
 *
 * The file is read in the browser (lib/bills/extract.ts: text, PDF text layer, OCR in English plus
 * the UI language's script); only the request sentence leaves the device. The card shows what was
 * read and the exact sentence that will be sent. This is input, not a decision: no StateBadge, no
 * approve/stop colours.
 *
 * Any currency: the total is shown in the bill's own currency (a select fixes a misread or an
 * ambiguous ¥), and a total not in USD is converted with today's rate (GET /api/fx, hooks/use-fx.ts)
 * — the USD amount, the rate, its source and date are shown and go into the request. Settlement is
 * always USD. Without rates only "Edit as request" is offered.
 *
 *   <BillDrop mandateId={id} catalog={catalog} onSubmitText={send} onPrefill={setDraft}>
 *     {chatPanel}
 *   </BillDrop>
 *
 * With children, the whole area is the drop target (a full-area overlay while dragging) and the
 * read bill opens over it; the "Attach bill" button sits in a strip under it (`toolbar`). Without
 * children, BillDrop is a dashed drop zone of its own. `ref` exposes `openFilePicker()` for a
 * button placed elsewhere (with `toolbar="none"`).
 */
import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { flushSync } from "react-dom";
import { ChevronDown, FileUp, Info, Paperclip, Pencil, ReceiptText, RefreshCw, SendHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { LocalAmount } from "@/components/perdiem/local-amount";
import { StateGlyph } from "@/components/perdiem/state-glyph";
import { useFxRates, type FxState } from "@/hooks/use-fx";
import {
  assertBillFile,
  BILL_ACCEPT,
  BillFileError,
  fileToText,
  ocrLanguagesFor,
  type BillFileErrorCode,
  type BillFileKind,
} from "@/lib/bills/extract";
import { parseBill, type BillCatalogMerchant, type ParsedBill } from "@/lib/bills/parse";
import { billEditText, billHasNoItems, billPayText, billTooLong, billTotal, type BillPayOptions } from "@/lib/bills/request";
import { COMMON_CURRENCIES, currencyName, isCurrencyCode, orderCurrencies } from "@/lib/fx/currencies";
import { formatMoney, formatRate } from "@/lib/fx/format";
import { fmtUsd } from "@/lib/format";
import * as BILLS from "@/lib/i18n/messages/bills";
import { useFmt, useLocale, useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export type MerchantLite = BillCatalogMerchant;

export interface BillDropHandle {
  /** Opens the file chooser (for an "Attach bill" button placed outside BillDrop). */
  openFilePicker(): void;
}

type ErrorCode = BillFileErrorCode | "one_file";

type State =
  | { kind: "idle" }
  | { kind: "reading"; name: string; fileKind: BillFileKind; forMandate: string | null }
  | { kind: "preview"; name: string; fileKind: BillFileKind; text: string; forMandate: string | null }
  | { kind: "error"; name: string | null; code: ErrorCode };

type Copy = (typeof BILLS)["en"];

function errorCode(e: unknown): ErrorCode {
  return e instanceof BillFileError ? e.code : "read_failed";
}

function hasFiles(e: { dataTransfer: DataTransfer | null }): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes("Files");
}

export function BillDrop({
  mandateId,
  catalog,
  blockedKeywords,
  disabled = false,
  onSubmitText,
  onPrefill,
  children,
  toolbar = "bottom",
  className,
  ref,
}: {
  /** The mandate the request goes to; null disables attaching and dropping. */
  mandateId: string | null;
  /** The mandate's merchant catalog (id, name, category). */
  catalog: MerchantLite[];
  /** The mandate's blocked keywords: any found on the bill is named in the request (policy safety net). */
  blockedKeywords?: readonly string[];
  /** No new bill and no Pay / Edit while true (e.g. a request is in flight). */
  disabled?: boolean;
  /** "Pay this bill": the request sentence, sent like a typed request. */
  onSubmitText: (text: string) => void;
  /** "Edit as request": a readable request for the composer (the button is hidden without it). */
  onPrefill?: (text: string) => void;
  children?: ReactNode;
  /** Where the "Attach bill" strip goes when BillDrop wraps children. */
  toolbar?: "top" | "bottom" | "none";
  className?: string;
  ref?: Ref<BillDropHandle>;
}) {
  const locale = useLocale();
  const t = BILLS[locale];
  const [storedState, setState] = useState<State>({ kind: "idle" });
  // A bill read (or being read) under one mandate is never paid under another: after a mandate
  // switch it is treated as discarded.
  const state: State = useMemo(
    () =>
      (storedState.kind === "reading" || storedState.kind === "preview") && storedState.forMandate !== mandateId
        ? { kind: "idle" }
        : storedState,
    [storedState, mandateId],
  );
  /** A currency the traveler chose for the read bill (null: the one read off the bill). */
  const [currency, setCurrency] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  /** Time of the last dragover on the area (the overlay watchdog below). */
  const lastOver = useRef(0);
  const run = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  /** The wrapped conversation (children). */
  const areaRef = useRef<HTMLDivElement>(null);
  const hintId = useId();

  const wraps = children !== undefined && children !== null && children !== false;
  const blocked = mandateId === null || disabled;
  const open = state.kind !== "idle";

  const bill = useMemo(() => (state.kind === "preview" ? parseBill(state.text, catalog) : null), [state, catalog]);
  // Today's rates, loaded once a bill is read (the currency list and any conversion need them).
  const fx = useFxRates(state.kind === "preview");
  const payOpts: BillPayOptions = {
    currency,
    fx: fx.rates,
    blockedKeywords,
    sourceText: state.kind === "preview" ? state.text : undefined,
  };

  const readFile = useCallback(async (file: File) => {
    const id = ++run.current;
    setCurrency(null);
    let fileKind: BillFileKind;
    try {
      fileKind = assertBillFile(file);
    } catch (e) {
      setState({ kind: "error", name: file.name, code: errorCode(e) });
      return;
    }
    const forMandate = mandateId;
    setState({ kind: "reading", name: file.name, fileKind, forMandate });
    try {
      const { text } = await fileToText(file, { ocrLanguages: ocrLanguagesFor(locale) });
      if (run.current === id) setState({ kind: "preview", name: file.name, fileKind, text, forMandate });
    } catch (e) {
      if (run.current === id) setState({ kind: "error", name: file.name, code: errorCode(e) });
    }
  }, [locale, mandateId]);

  const openFilePicker = useCallback(() => {
    if (!blocked) inputRef.current?.click();
  }, [blocked]);
  useImperativeHandle(ref, () => ({ openFilePicker }), [openFilePicker]);

  /** Back to idle; keyboard focus returns to "Attach bill" unless something else took it. */
  const restoreFocus = useRef(false);
  const close = useCallback(() => {
    run.current += 1;
    restoreFocus.current = true;
    setState({ kind: "idle" });
  }, []);

  // A file dropped just outside the drop area would make the browser open it in place of PerDiem
  // (and lose the conversation). While BillDrop is on the page, a file dropped anywhere else does
  // nothing. Other drop targets are unaffected: they handle (and preventDefault) the event first.
  useEffect(() => {
    const over = (e: globalThis.DragEvent) => {
      if (e.defaultPrevented || !hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
    };
    const drop = (e: globalThis.DragEvent) => {
      if (!e.defaultPrevented && hasFiles(e)) e.preventDefault();
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, []);

  // A drag cancelled with Esc, dropped elsewhere or taken out of the window fast can end without a
  // dragleave on this area. dragover fires continuously while a file is over the area (at least
  // every 350 ± 200 ms, per the HTML spec), so a second without one means the file has left.
  useEffect(() => {
    if (!dragging) return;
    const end = () => {
      depth.current = 0;
      setDragging(false);
    };
    const watchdog = window.setInterval(() => {
      if (Date.now() - lastOver.current > 1000) end();
    }, 250);
    window.addEventListener("dragend", end);
    window.addEventListener("drop", end);
    return () => {
      window.clearInterval(watchdog);
      window.removeEventListener("dragend", end);
      window.removeEventListener("drop", end);
    };
  }, [dragging]);

  // The read bill (or the error) takes focus, so it is read out and Tab starts inside it.
  useEffect(() => {
    if (state.kind === "preview" || state.kind === "error") headingRef.current?.focus();
  }, [state]);
  // Closing removes the focused button: give focus back instead of dropping it on <body>.
  useEffect(() => {
    if (state.kind !== "idle" || !restoreFocus.current) return;
    restoreFocus.current = false;
    const active = document.activeElement;
    if (active === null || active === document.body) attachRef.current?.focus({ preventScroll: true });
  }, [state.kind]);

  // Close first and synchronously: the children stop being inert before the parent acts, so its
  // handler can focus its own composer.
  const pay = () => {
    const text = bill ? billPayText(bill, payOpts) : null;
    if (!text || blocked) return;
    flushSync(close);
    onSubmitText(text);
    // The request is now in flight, which disables "Attach bill" (where focus went back): keep
    // keyboard focus in the conversation, on its composer, as after a typed request.
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active !== null && active !== document.body && active !== attachRef.current) return;
      areaRef.current?.querySelector<HTMLElement>("textarea:not(:disabled)")?.focus({ preventScroll: true });
    });
  };
  const edit = () => {
    if (!bill || !onPrefill || blocked) return;
    const text = billEditText(bill, payOpts);
    flushSync(close);
    onPrefill(text);
  };

  const drag = {
    onDragEnter: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      lastOver.current = Date.now();
      setDragging(true);
    },
    onDragOver: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      lastOver.current = Date.now();
      e.dataTransfer.dropEffect = blocked ? "none" : "copy";
    },
    onDragLeave: (e: DragEvent) => {
      if (depth.current === 0) return;
      // Chrome and Firefox name where the pointer went: outside the area ends the drag at once.
      // Safari gives no relatedTarget: the enter/leave count decides.
      const to = e.relatedTarget;
      if (to instanceof Node && !e.currentTarget.contains(to)) depth.current = 1;
      depth.current -= 1;
      if (depth.current === 0) setDragging(false);
    },
    onDrop: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      if (blocked) return;
      const files = e.dataTransfer.files;
      if (files.length > 1) {
        run.current += 1;
        setState({ kind: "error", name: null, code: "one_file" });
      } else if (files[0]) void readFile(files[0]);
    },
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={BILL_ACCEPT}
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      data-bill-input=""
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = ""; // the same file can be chosen again
        if (file && !blocked) void readFile(file);
      }}
    />
  );

  const attachButton = (
    <Button
      ref={attachRef}
      type="button"
      variant="outline"
      size="sm"
      className="bg-surface"
      onClick={openFilePicker}
      disabled={blocked}
      aria-describedby={hintId}
    >
      <Paperclip aria-hidden />
      {t.attach}
    </Button>
  );

  const card =
    state.kind === "idle" ? null : (
      <BillCard
        t={t}
        state={state}
        bill={bill}
        fx={fx}
        currency={currency}
        onCurrencyChange={setCurrency}
        mandateId={mandateId}
        blocked={blocked}
        canEdit={onPrefill !== undefined}
        blockedKeywords={blockedKeywords}
        headingRef={headingRef}
        onPay={pay}
        onEdit={edit}
        onClose={close}
        onAnother={() => {
          close();
          openFilePicker();
        }}
      />
    );

  // Visible only to assistive tech: what is happening now (the card itself takes focus once read).
  const live = (
    <p role="status" aria-live="polite" className="sr-only">
      {state.kind === "reading" ? t.reading.title(state.name) : state.kind === "preview" ? t.announceRead(state.name) : ""}
    </p>
  );

  const overlay = dragging && (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 text-center",
        // Opaque: the conversation behind must not show through the drop message.
        blocked ? "border-line-strong bg-surface-2" : "border-cobalt bg-cobalt-soft",
      )}
    >
      <FileUp aria-hidden className={cn("size-8", blocked ? "text-muted-ink" : "text-cobalt")} />
      <p className="type-section text-ink">
        {mandateId === null ? t.overlay.disabled : disabled ? t.overlay.busy : t.overlay.title}
      </p>
      {!blocked && (
        <>
          <p className="text-sm text-muted-ink">
            {t.formats} · {t.local}
          </p>
          <p className="max-w-md text-sm text-ink">{t.semantics}</p>
        </>
      )}
    </div>
  );

  if (!wraps) {
    // A drop zone of its own: the prompt while idle, the card once a file arrives.
    return (
      <div className={cn("relative", className)} data-bill-drop="" {...drag}>
        {input}
        {live}
        {card ?? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong bg-surface px-6 py-8 text-center">
            <span className="grid size-10 place-items-center rounded-full bg-surface-2 text-muted-ink">
              <ReceiptText aria-hidden className="size-5" />
            </span>
            <p className="font-medium text-ink">{t.dropzoneTitle}</p>
            {attachButton}
            <p id={hintId} className="text-xs text-muted-ink">
              {mandateId === null ? t.noMandate : `${t.formats} · ${t.local}`}
            </p>
            <p className="max-w-md text-xs text-muted-ink">{t.semantics}</p>
          </div>
        )}
        {overlay}
      </div>
    );
  }

  const strip =
    toolbar === "none" ? (
      <p id={hintId} className="sr-only">
        {mandateId === null ? t.noMandate : `${t.dropHint} · ${t.formats}`}
      </p>
    ) : (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {attachButton}
        <p id={hintId} className="min-w-0 text-xs text-muted-ink">
          {mandateId === null ? t.noMandate : `${t.dropHint} · ${t.formats}`}
        </p>
      </div>
    );

  return (
    <div className={cn("relative flex flex-col gap-2", className)}>
      {input}
      {live}
      {toolbar === "top" && strip}
      <div className="relative min-h-0" data-bill-drop="" {...drag}>
        <div ref={areaRef} inert={open} className="min-h-0">
          {children}
        </div>
        {card && (
          <div className="absolute inset-0 z-20 overflow-y-auto overscroll-contain rounded-lg bg-page/90 p-3 sm:p-5">
            <div className="flex min-h-full items-start justify-center sm:items-center">{card}</div>
          </div>
        )}
        {overlay}
      </div>
      {toolbar !== "top" && strip}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// The card: reading → preview (or error)
// ---------------------------------------------------------------------------------------------

function BillCard({
  t,
  state,
  bill,
  fx,
  currency,
  onCurrencyChange,
  mandateId,
  blocked,
  canEdit,
  headingRef,
  onPay,
  onEdit,
  onClose,
  onAnother,
  blockedKeywords,
}: {
  t: Copy;
  state: Exclude<State, { kind: "idle" }>;
  bill: ParsedBill | null;
  fx: FxState & { retry: () => void };
  currency: string | null;
  onCurrencyChange: (code: string | null) => void;
  mandateId: string | null;
  blocked: boolean;
  canEdit: boolean;
  headingRef: Ref<HTMLHeadingElement>;
  onPay: () => void;
  onEdit: () => void;
  onClose: () => void;
  onAnother: () => void;
  blockedKeywords?: readonly string[];
}) {
  const headingId = useId();
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  };
  // overflow-clip (not hidden): the actions stay sticky at the bottom of a scrolling overlay.
  const frame = "w-full max-w-[36rem] overflow-clip rounded-xl border bg-surface text-left shadow-sm";
  // Focused by script so the card is read out (like EvidencePanel's heading); not a control.
  const heading = "outline-none";

  if (state.kind === "reading") {
    return (
      <section aria-labelledby={headingId} onKeyDown={onKeyDown} className={cn(frame, "border-line")} data-bill-card="reading">
        <div className="flex items-start gap-3 px-4 py-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-pending-soft text-pending">
            <ReceiptText aria-hidden className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id={headingId} className="truncate font-medium text-ink">
              {t.reading.title(state.name)}
            </h3>
            <p className="mt-1 flex items-start gap-2 text-sm text-pending">
              {/* Static glyph: no spinner. */}
              <StateGlyph glyph="half" className="mt-1 size-3" />
              {t.reading[state.fileKind]}
            </p>
            <p className="mt-2 text-xs text-muted-ink">{t.local}</p>
          </div>
        </div>
        <div className="flex justify-end border-t border-line bg-surface-2 px-4 py-2.5">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t.reading.cancel}
          </Button>
        </div>
      </section>
    );
  }

  if (state.kind === "error") {
    return (
      <section
        role="alert"
        aria-labelledby={headingId}
        onKeyDown={onKeyDown}
        className={cn(frame, "border-danger-line")}
        data-bill-card="error"
      >
        <div className="px-4 py-4">
          <h3 ref={headingRef} id={headingId} tabIndex={-1} className={cn("flex items-start gap-2 font-medium text-danger", heading)}>
            <StateGlyph glyph="triangle" className="mt-1 size-3" />
            {t.errors.title}
          </h3>
          <div className="mt-1 space-y-1 pl-5 text-sm text-ink">
            {state.name && <p className="truncate text-muted-ink">{state.name}</p>}
            <p>{t.errors[state.code]}</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-surface-2 px-4 py-2.5">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t.errors.dismiss}
          </Button>
          <Button type="button" variant="outline" size="sm" className="bg-surface" onClick={onAnother} disabled={blocked}>
            <Paperclip aria-hidden />
            {t.errors.another}
          </Button>
        </div>
      </section>
    );
  }

  if (!bill) return null;
  return (
    <BillPreview
      t={t}
      name={state.name}
      fileKind={state.fileKind}
      text={state.text}
      bill={bill}
      fx={fx}
      currency={currency}
      onCurrencyChange={onCurrencyChange}
      mandateId={mandateId}
      blocked={blocked}
      canEdit={canEdit}
      blockedKeywords={blockedKeywords}
      headingId={headingId}
      headingRef={headingRef}
      headingClass={heading}
      frameClass={frame}
      onKeyDown={onKeyDown}
      onPay={onPay}
      onEdit={onEdit}
      onClose={onClose}
    />
  );
}

/** Notes that stop one click (the currency and the rate are checked separately, with the traveler's choice). */
const MISSING = [
  "merchant_not_found",
  "merchant_ambiguous",
  "subtotal_only",
  "total_not_found",
  "total_negative",
  "nothing_due",
] as const;
type MissingCode = (typeof MISSING)[number];
const NOTES = ["merchant_approximate", "totals_disagree", "date_ambiguous"] as const;
type NoteCode = (typeof NOTES)[number];

function BillPreview({
  t,
  name,
  fileKind,
  text,
  bill,
  fx,
  currency: chosenCurrency,
  onCurrencyChange,
  mandateId,
  blocked,
  canEdit,
  headingId,
  headingRef,
  headingClass,
  frameClass,
  onKeyDown,
  onPay,
  onEdit,
  onClose,
  blockedKeywords,
}: {
  t: Copy;
  name: string;
  fileKind: BillFileKind;
  text: string;
  bill: ParsedBill;
  fx: FxState & { retry: () => void };
  currency: string | null;
  onCurrencyChange: (code: string | null) => void;
  mandateId: string | null;
  blocked: boolean;
  canEdit: boolean;
  headingId: string;
  headingRef: Ref<HTMLHeadingElement>;
  headingClass: string;
  frameClass: string;
  onKeyDown: (e: KeyboardEvent) => void;
  onPay: () => void;
  onEdit: () => void;
  onClose: () => void;
  blockedKeywords?: readonly string[];
}) {
  const { common, fx: tf } = useT();
  const f = useFmt();
  // The same options as the Pay action, so the sentence shown is exactly the one sent.
  const opts: BillPayOptions = { currency: chosenCurrency, fx: fx.rates, blockedKeywords, sourceText: text };
  const total = billTotal(bill, opts);
  const payText = billPayText(bill, opts);
  const payable = payText !== null;
  const allItems = bill.items.length + bill.moreItems.length;
  const noItems = billHasNoItems(bill);
  const currency = total.currency;
  const listFormat = (codes: string[]) =>
    new Intl.ListFormat(f.tag, { type: "disjunction" }).format(codes.map((c) => `${currencyName(c, f.tag)} (${c})`));
  // The rate is still loading: not a reason to refuse, just not ready.
  const rateLoading = total.problem === "no_rate" && !fx.rates && (fx.status === "loading" || fx.status === "idle");
  const rateProblem =
    total.problem === "no_rate" && !rateLoading
      ? fx.rates && currency
        ? tf.bill.notCovered(currency)
        : tf.bill.unavailable
      : total.problem === "below_cent"
        ? tf.bill.belowCent
        : null;
  const currencyProblem =
    total.problem === "no_currency"
      ? bill.ambiguousWith.length > 0
        ? tf.bill.ambiguous(listFormat(bill.ambiguousWith))
        : tf.bill.unknown
      : null;

  const missing = bill.notes.filter((n): n is { code: MissingCode; detail?: string } => (MISSING as readonly string[]).includes(n.code));
  const notes = bill.notes.filter((n): n is { code: NoteCode; detail?: string } => (NOTES as readonly string[]).includes(n.code));
  const missingText = (n: { code: MissingCode; detail?: string }) => {
    switch (n.code) {
      case "merchant_ambiguous":
        return t.missing.merchant_ambiguous(n.detail ?? "");
      default:
        return t.missing[n.code];
    }
  };
  const noteText = (n: { code: NoteCode; detail?: string }) =>
    n.code === "merchant_approximate" ? t.notes.merchant_approximate(n.detail ?? "") : t.notes[n.code];
  // Why one click is not offered (the currency problem shows under the total instead).
  const reasons = [
    ...missing.map(missingText),
    ...(rateProblem ? [rateProblem] : []),
    ...(noItems ? [t.missing.no_items] : []),
    ...(billTooLong(bill, opts) ? [t.missing.too_long] : []),
  ];
  // Only the rate is missing: "Pay this bill" shows (disabled) while it loads.
  const waitingForRate = rateLoading && missing.length === 0 && bill.merchant !== null && !noItems;

  const date = bill.date
    ? new Intl.DateTimeFormat(f.tag, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${bill.date}T00:00:00Z`))
    : null;
  const notFound = (
    <span className="inline-flex items-center gap-1.5 text-unverified">
      <StateGlyph glyph="dashed" className="size-3" />
      {t.preview.notFound}
    </span>
  );

  // The total as printed, in its own currency ("₩16,000"); USD in the policy's format.
  let printed: ReactNode = notFound;
  if (bill.totalAmount !== null) {
    printed = (
      <span className={cn("type-amount-sm", total.amount === null ? "text-muted-ink" : "text-ink")} data-bill-total="">
        {currency === "USD"
          ? fmtUsd(bill.totalAmount)
          : currency
            ? formatMoney(bill.totalAmount, currency, f.tag)
            : bill.totalAmount.toLocaleString(f.tag, { maximumFractionDigits: 3 })}
      </span>
    );
  }
  const conversion = total.conversion && total.conversion.currency !== "USD" ? total.conversion : null;
  const rates = total.fx ?? fx.rates;
  // The select: the bill's own candidates first, then the common currencies, then every other one
  // the day's rates cover (only common ones while rates are not loaded).
  const fromBill = [...new Set([...(bill.currency ? [bill.currency] : []), ...bill.ambiguousWith])];
  const covered = rates ? Object.keys(rates.rates) : [];
  const { common: commonCodes, others } = orderCurrencies(
    [...(covered.length > 0 ? covered : COMMON_CURRENCIES), ...(currency ? [currency] : [])].filter((c) => !fromBill.includes(c)),
  );
  const currencyStatus = chosenCurrency
    ? tf.bill.chosen
    : bill.currency && bill.notes.some((n) => n.code === "currency_inferred")
      ? tf.bill.inferred(bill.currency)
      : bill.currency
        ? tf.bill.detected
        : currencyProblem;

  return (
    <section aria-labelledby={headingId} onKeyDown={onKeyDown} className={cn(frameClass, "border-line")} data-bill-card="preview">
      <header className="flex items-start gap-3 border-b border-line px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-cobalt-soft text-cobalt">
          <ReceiptText aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="type-label text-muted-ink">
            {t.preview.eyebrow} · {t.preview.source[fileKind]}
          </p>
          <h3 ref={headingRef} id={headingId} tabIndex={-1} className={cn("truncate font-medium text-ink", headingClass)}>
            {name}
          </h3>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label={t.preview.close} title={t.preview.close}>
          <X aria-hidden />
        </Button>
      </header>

      <div className="space-y-4 px-4 py-4">
        <p className="flex items-start gap-2 text-sm text-muted-ink">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-cobalt" />
          {t.semantics}
        </p>

        <dl className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] items-baseline gap-x-4 gap-y-3 text-sm">
          <dt className="type-label text-muted-ink">{t.preview.merchant}</dt>
          <dd className="min-w-0">
            {bill.merchant ? (
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-medium text-ink">{bill.merchant.name}</span>
                <span className="rounded-md border border-line bg-surface-2 px-1.5 py-px text-xs text-muted-ink">
                  {common.category[bill.merchant.category] ?? bill.merchant.category}
                </span>
              </span>
            ) : (
              notFound
            )}
          </dd>

          <dt className="type-label text-muted-ink">{t.preview.total}</dt>
          <dd className="min-w-0 tabular-nums">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {printed}
              {bill.totalAmount !== null && (
                <Select
                  value={currency ?? ""}
                  onValueChange={(v) => isCurrencyCode(v) && onCurrencyChange(v === bill.currency ? null : v)}
                >
                  <SelectTrigger size="sm" aria-label={tf.bill.currencyLabel} className="bg-surface text-xs text-ink" data-bill-currency="">
                    <SelectValue placeholder={tf.bill.choose}>{currency ?? undefined}</SelectValue>
                  </SelectTrigger>
                  <SelectContent position="popper" align="start" className="max-h-[min(20rem,var(--radix-select-content-available-height))]">
                    {fromBill.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>{tf.bill.detected}</SelectLabel>
                        {fromBill.map((c) => (
                          <CurrencyOption key={c} code={c} tag={f.tag} />
                        ))}
                      </SelectGroup>
                    )}
                    {fromBill.length > 0 && <SelectSeparator />}
                    <SelectGroup>
                      <SelectLabel>{tf.menu.common}</SelectLabel>
                      {commonCodes.map((c) => (
                        <CurrencyOption key={c} code={c} tag={f.tag} />
                      ))}
                    </SelectGroup>
                    {others.length > 0 && (
                      <>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel>{tf.menu.all}</SelectLabel>
                          {others.map((c) => (
                            <CurrencyOption key={c} code={c} tag={f.tag} />
                          ))}
                        </SelectGroup>
                      </>
                    )}
                  </SelectContent>
                </Select>
              )}
              {currency === "USD" && total.conversion && <LocalAmount usd={total.conversion.usd} />}
            </span>
            {bill.totalAmount !== null && currencyStatus && (
              <span
                className={cn(
                  "mt-1 flex items-start gap-1.5 text-xs",
                  currencyProblem && !chosenCurrency ? "text-ink" : "text-muted-ink",
                )}
              >
                {currencyProblem && !chosenCurrency ? (
                  <StateGlyph glyph="dashed" className="mt-0.5 size-3 shrink-0 text-unverified" />
                ) : (
                  <Info aria-hidden className="mt-px size-3.5 shrink-0" />
                )}
                {currencyStatus}
                {chosenCurrency && bill.currency && (
                  <button
                    type="button"
                    onClick={() => onCurrencyChange(null)}
                    className="rounded-sm text-cobalt underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {bill.currency}
                  </button>
                )}
              </span>
            )}
          </dd>

          {currency !== null && currency !== "USD" && total.amount !== null && (
            <>
              <dt className="type-label text-muted-ink">{tf.bill.usd}</dt>
              <dd className="min-w-0" data-bill-usd="">
                {conversion && rates ? (
                  <>
                    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="type-amount-sm text-ink tabular-nums">{fmtUsd(conversion.usd)}</span>
                      <LocalAmount usd={conversion.usd} except={conversion.currency} />
                    </span>
                    <span className="mt-1 block text-xs text-muted-ink tabular-nums" data-bill-rate="">
                      {tf.rateLine(formatRate(conversion.rate, f.tag), conversion.currency, rates.source.name, rates.date)}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-ink">
                      {tf.bill.rounding}{" "}
                      <a
                        href={rates.source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-sm text-cobalt underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        lang="en"
                      >
                        {rates.source.attribution ?? rates.source.name}
                      </a>
                    </span>
                  </>
                ) : rateLoading ? (
                  <span className="flex items-start gap-1.5 text-sm text-pending">
                    <StateGlyph glyph="half" className="mt-1 size-3" />
                    {tf.bill.loading}
                  </span>
                ) : (
                  // Why is in the "Not payable in one click" box below; here only the gap and a retry.
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-ink">
                    <span className="text-muted-ink">—</span>
                    {!fx.rates && (
                      <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={fx.retry}>
                        <RefreshCw aria-hidden />
                        {tf.bill.retry}
                      </Button>
                    )}
                  </span>
                )}
              </dd>
            </>
          )}

          <dt className="type-label text-muted-ink">{t.preview.date}</dt>
          <dd className="min-w-0 text-ink tabular-nums">
            {date ? <time dateTime={bill.date ?? undefined}>{date}</time> : <span className="text-muted-ink">—</span>}
          </dd>

          <dt className="type-label text-muted-ink">{t.preview.items}</dt>
          <dd className="min-w-0 text-ink">
            {allItems === 0 ? (
              <span className="text-muted-ink">—</span>
            ) : (
              <>
                <ul className="space-y-0.5">
                  {bill.items.map((item, i) => (
                    <li key={i} className="break-words">
                      {item}
                    </li>
                  ))}
                </ul>
                {bill.moreItems.length > 0 && <p className="mt-0.5 text-xs text-muted-ink">{t.preview.moreItems(bill.moreItems.length)}</p>}
              </>
            )}
          </dd>
        </dl>

        {notes.length > 0 && (
          <ul className="space-y-1 text-xs text-muted-ink">
            {notes.map((n) => (
              <li key={n.code} className="flex items-start gap-1.5">
                <Info aria-hidden className="mt-px size-3.5 shrink-0" />
                {noteText(n)}
              </li>
            ))}
          </ul>
        )}

        {payable && payText ? (
          <div>
            <p className="type-label text-muted-ink">{t.preview.request}</p>
            <p className="mt-1 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm break-words text-ink" lang="en">
              {payText}
            </p>
          </div>
        ) : waitingForRate ? (
          <p className="flex items-start gap-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-pending">
            <StateGlyph glyph="half" className="mt-1 size-3" />
            {tf.bill.loading}
          </p>
        ) : (
          <div className="rounded-lg border border-dashed border-unverified-line bg-unverified-soft px-3 py-2.5 text-sm">
            <p className="flex items-start gap-2 font-medium text-ink">
              <StateGlyph glyph="dashed" className="mt-1 size-3 text-unverified" />
              {t.preview.blockedTitle}
            </p>
            {/* The currency problem is not repeated here: it sits under the total, next to its select. */}
            {reasons.length > 0 && (
              <ul className="mt-1 space-y-0.5 pl-5 text-ink">
                {reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
            <p className="mt-1 pl-5 text-xs text-muted-ink">{t.preview.blockedBody}</p>
          </div>
        )}

        <details className="group">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-sm text-xs font-medium text-cobalt outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <ChevronDown aria-hidden className="size-3.5 -rotate-90 transition-transform duration-150 group-open:rotate-0" />
            {t.preview.raw}
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-line bg-surface-2 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink">
            {text}
          </pre>
        </details>
      </div>

      <footer className="sticky bottom-0 z-10 space-y-2 border-t border-line bg-surface-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {(payable || waitingForRate) && (
            <Button type="button" size="lg" onClick={onPay} disabled={blocked || !payable} data-bill-pay="">
              <SendHorizontal aria-hidden />
              {t.preview.pay}
            </Button>
          )}
          {canEdit && (
            <Button type="button" variant="outline" size={payable ? "lg" : "default"} className="bg-surface" onClick={onEdit} disabled={blocked}>
              <Pencil aria-hidden />
              {t.preview.edit}
            </Button>
          )}
          <Button type="button" variant="ghost" size={payable ? "lg" : "default"} onClick={onClose}>
            {t.preview.discard}
          </Button>
        </div>
        <p className="text-xs text-muted-ink">{t.preview.decides(mandateId)}</p>
      </footer>
    </section>
  );
}

/** One currency in a select: the code, then its name in the UI language. */
function CurrencyOption({ code, tag }: { code: string; tag: string }) {
  const name = currencyName(code, tag);
  return (
    <SelectItem value={code} textValue={`${code} ${name}`} className="text-sm">
      <span className="w-9 shrink-0 font-medium tabular-nums">{code}</span>
      <span className="min-w-0 truncate text-muted-ink">{name}</span>
    </SelectItem>
  );
}
