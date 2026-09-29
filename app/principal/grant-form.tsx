"use client";

import { useCallback, useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { Anchor } from "lucide-react";
import { toast } from "sonner";
import type { CreateMandateRequest, CreateMandateResponse, Merchant } from "@/contracts/api";
import { api, toApiClientError } from "@/lib/api-client";
import { fmtUsd, toDatetimeLocal } from "@/lib/format";
import { useResource } from "@/hooks/use-resource";
import { useNow } from "@/hooks/use-now";
import { useT } from "@/lib/i18n/provider";
import type { Messages } from "@/lib/i18n/messages";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { LocalAmount } from "@/components/perdiem/local-amount";
import { ErrorState } from "@/components/perdiem/states";
import { StateGlyph } from "@/components/perdiem/state-glyph";
import { cn } from "@/lib/utils";

const DEFAULT_CATEGORIES = ["meal", "transport", "supplies"];
const DEFAULT_BLOCKED = "alcohol, wine, gift";
const loadMerchants = () => api.merchants();

type Field = "principal" | "traveler" | "budget" | "cap" | "categories" | "merchants" | "start" | "end";
/** Form order, for moving the focus to the first invalid field. */
const FIELD_ORDER: Field[] = ["principal", "traveler", "budget", "cap", "categories", "merchants", "start", "end"];

/** Focus field `f` (`g-<f>`; for a checkbox group, its first checkbox). */
function focusField(f: Field) {
  const el = document.getElementById(`g-${f}`);
  const target = el?.hasAttribute("data-checkbox-group") ? el.querySelector<HTMLElement>('[role="checkbox"]') : el;
  target?.focus();
}
/** A validation message, resolved at render time so it follows a language switch. */
type FieldMsg = (m: Messages["principal"]["grant"]["errors"]) => string;

function FieldError({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return (
    <p id={id} className="mt-1 flex items-start gap-1.5 text-xs text-danger">
      <StateGlyph glyph="triangle" className="mt-0.5 size-2.5 shrink-0" />
      {msg}
    </p>
  );
}

function Fieldset({
  legend,
  hint,
  errorId,
  children,
}: {
  legend: string;
  hint?: ReactNode;
  /** Id of the group's error message, when there is one (read when the group is entered). */
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="min-w-0" aria-describedby={errorId}>
      <legend className="mb-2 text-sm font-medium text-ink">{legend}</legend>
      {children}
      {hint && <div className="mt-2 text-xs text-muted-ink">{hint}</div>}
    </fieldset>
  );
}

/** Form body + footer. Needs `initialNow` so the default window (now → +2 days) is computed outside render. */
function GrantFormInner({
  merchants,
  initialNow,
  onCreated,
  onBusyChange,
}: {
  merchants: Merchant[];
  initialNow: number;
  onCreated: (res: CreateMandateResponse) => void;
  /** Lets the sheet refuse to close while the grant is anchoring (a closed sheet would lose `busy`). */
  onBusyChange?: (busy: boolean) => void;
}) {
  const t = useT();
  const tg = t.principal.grant;
  const catLabel = (c: string) => t.common.category[c] ?? c;
  const categories = useMemo(() => [...new Set(merchants.map((m) => m.category))], [merchants]);
  const [principal, setPrincipal] = useState("MICEMore Finance");
  const [traveler, setTraveler] = useState("Mingyu");
  const [budget, setBudget] = useState("150");
  const [cap, setCap] = useState("40");
  const [cats, setCats] = useState<string[]>(() => DEFAULT_CATEGORIES.filter((c) => categories.includes(c)));
  const [picked, setPicked] = useState<string[]>(() =>
    merchants.filter((m) => DEFAULT_CATEGORIES.includes(m.category)).map((m) => m.id),
  );
  const [blocked, setBlocked] = useState(DEFAULT_BLOCKED);
  const [start, setStart] = useState(() => toDatetimeLocal(new Date(initialNow)));
  const [end, setEnd] = useState(() => toDatetimeLocal(new Date(initialNow + 2 * 86_400_000)));
  const [errors, setErrors] = useState<Partial<Record<Field, FieldMsg>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (list: string[], v: string, on: boolean) => (on ? [...new Set([...list, v])] : list.filter((x) => x !== v));
  const offCategory = merchants.filter((m) => picked.includes(m.id) && !cats.includes(m.category));

  const validate = (): Partial<Record<Field, FieldMsg>> => {
    const e: Partial<Record<Field, FieldMsg>> = {};
    const b = Number(budget);
    const c = Number(cap);
    if (!principal.trim()) e.principal = (m) => m.principal;
    if (!traveler.trim()) e.traveler = (m) => m.traveler;
    if (!(b > 0) || !Number.isFinite(b)) e.budget = (m) => m.budget;
    if (!(c > 0) || !Number.isFinite(c)) e.cap = (m) => m.cap;
    else if (b > 0 && c > b) {
      const max = fmtUsd(b);
      e.cap = (m) => m.capOverBudget(max);
    }
    if (cats.length === 0) e.categories = (m) => m.categories;
    if (picked.length === 0) e.merchants = (m) => m.merchants;
    const s = new Date(start).getTime();
    const en = new Date(end).getTime();
    if (!start || !Number.isFinite(s)) e.start = (m) => m.start;
    if (!end || !Number.isFinite(en)) e.end = (m) => m.end;
    else if (Number.isFinite(s) && en <= s) e.end = (m) => m.endBeforeStart;
    return e;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (busy) return;
    const e = validate();
    setErrors(e);
    setSubmitError(null);
    const firstInvalid = FIELD_ORDER.find((f) => e[f]);
    if (firstInvalid) {
      // After the render that wires aria-invalid / aria-describedby, so the error is read out.
      requestAnimationFrame(() => focusField(firstInvalid));
      return;
    }
    const body: CreateMandateRequest = {
      principal: principal.trim(),
      traveler: traveler.trim(),
      budgetUsd: Number(budget),
      perTxCapUsd: Number(cap),
      allowedMerchantIds: merchants.filter((m) => picked.includes(m.id)).map((m) => m.id),
      allowedCategories: categories.filter((c) => cats.includes(c)),
      blockedKeywords: blocked
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean),
      startsAt: new Date(start).toISOString(),
      expiresAt: new Date(end).toISOString(),
    };
    setBusy(true);
    onBusyChange?.(true);
    try {
      const res = await api.createMandate(body);
      onCreated(res);
    } catch (err) {
      const apiErr = toApiClientError(err);
      setSubmitError(`${apiErr.message} (${apiErr.code})`);
      toast.error(tg.notCreated, { description: apiErr.message });
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  };

  const inputCls = "h-9 bg-surface";
  const err = (f: Field) => (errors[f] ? { "aria-invalid": true, "aria-describedby": `err-${f}` } : {});
  const errMsg = (f: Field) => errors[f]?.(tg.errors);

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="g-principal" className="mb-1.5">
              {tg.principal}
            </Label>
            <Input id="g-principal" className={inputCls} value={principal} onChange={(e) => setPrincipal(e.target.value)} {...err("principal")} />
            <FieldError id="err-principal" msg={errMsg("principal")} />
          </div>
          <div>
            <Label htmlFor="g-traveler" className="mb-1.5">
              {tg.traveler}
            </Label>
            <Input id="g-traveler" className={inputCls} value={traveler} onChange={(e) => setTraveler(e.target.value)} {...err("traveler")} />
            <FieldError id="err-traveler" msg={errMsg("traveler")} />
          </div>
          <div>
            <Label htmlFor="g-budget" className="mb-1.5">
              {tg.budget}
            </Label>
            <Input
              id="g-budget"
              className={cn(inputCls, "tabular-nums")}
              inputMode="decimal"
              type="number"
              min="0"
              step="0.01"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              {...err("budget")}
            />
            {/* Helper only: the budget is entered, stored and enforced in USD. */}
            <p className="mt-1 empty:hidden" data-budget-local="">
              <LocalAmount usd={Number(budget) > 0 ? Number(budget) : null} />
            </p>
            <FieldError id="err-budget" msg={errMsg("budget")} />
          </div>
          <div>
            <Label htmlFor="g-cap" className="mb-1.5">
              {tg.cap}
            </Label>
            <Input
              id="g-cap"
              className={cn(inputCls, "tabular-nums")}
              inputMode="decimal"
              type="number"
              min="0"
              step="0.01"
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              {...err("cap")}
            />
            <p className="mt-1 empty:hidden" data-cap-local="">
              <LocalAmount usd={Number(cap) > 0 ? Number(cap) : null} />
            </p>
            <FieldError id="err-cap" msg={errMsg("cap")} />
          </div>
        </div>

        <Fieldset legend={tg.categories} errorId={errors.categories ? "err-categories" : undefined}>
          <div
            id="g-categories"
            data-checkbox-group
            className="flex flex-wrap gap-x-5 gap-y-2"
          >
            {categories.map((c) => (
              <Label key={c} className="cursor-pointer font-normal text-ink">
                <Checkbox checked={cats.includes(c)} onCheckedChange={(v) => setCats((l) => toggle(l, c, v === true))} />
                {catLabel(c)}
              </Label>
            ))}
          </div>
          <FieldError id="err-categories" msg={errMsg("categories")} />
        </Fieldset>

        <Fieldset
          legend={tg.merchants}
          errorId={errors.merchants ? "err-merchants" : undefined}
          hint={
            offCategory.length > 0 ? (
              // Describes a future rule stop, so it wears the stop tone and square, not the error red.
              <span className="flex items-start gap-1.5 text-stop">
                <StateGlyph glyph="square" className="mt-0.5 size-2.5 shrink-0" />
                {tg.offCategory(offCategory.map((m) => m.name).join(t.principal.listSep), offCategory.length)}
              </span>
            ) : undefined
          }
        >
          <div
            id="g-merchants"
            data-checkbox-group
            className="grid gap-x-5 gap-y-2 sm:grid-cols-2"
          >
            {merchants.map((m) => (
              <Label key={m.id} className="min-w-0 cursor-pointer font-normal text-ink">
                <Checkbox checked={picked.includes(m.id)} onCheckedChange={(v) => setPicked((l) => toggle(l, m.id, v === true))} />
                <span className="truncate">{m.name}</span>
                <span className="ml-auto shrink-0 rounded-sm bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted-ink">{catLabel(m.category)}</span>
              </Label>
            ))}
          </div>
          <FieldError id="err-merchants" msg={errMsg("merchants")} />
        </Fieldset>

        <div>
          <Label htmlFor="g-blocked" className="mb-1.5">
            {tg.blocked}
          </Label>
          <Input id="g-blocked" className={inputCls} value={blocked} onChange={(e) => setBlocked(e.target.value)} placeholder={DEFAULT_BLOCKED} />
          <p className="mt-1.5 text-xs text-muted-ink">{tg.blockedHint}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="g-start" className="mb-1.5">
              {tg.start}
            </Label>
            <Input id="g-start" type="datetime-local" className={cn(inputCls, "tabular-nums")} value={start} onChange={(e) => setStart(e.target.value)} {...err("start")} />
            <FieldError id="err-start" msg={errMsg("start")} />
          </div>
          <div>
            <Label htmlFor="g-end" className="mb-1.5">
              {tg.end}
            </Label>
            <Input id="g-end" type="datetime-local" className={cn(inputCls, "tabular-nums")} value={end} onChange={(e) => setEnd(e.target.value)} {...err("end")} />
            <FieldError id="err-end" msg={errMsg("end")} />
          </div>
        </div>

        {submitError && (
          <p role="alert" className="flex items-start gap-2 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-ink">
            <StateGlyph glyph="triangle" className="mt-1 size-3 shrink-0 text-danger" />
            {submitError}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line bg-surface px-5 py-4">
        {/* aria-disabled while anchoring: `disabled` would drop the keyboard focus to <body>. */}
        <Button
          type="submit"
          size="lg"
          aria-disabled={busy || undefined}
          className="px-3.5 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
        >
          <Anchor aria-hidden />
          {busy ? tg.submitting : tg.submit}
        </Button>
        <SheetClose asChild>
          <Button
            type="button"
            variant="outline"
            size="lg"
            aria-disabled={busy || undefined}
            className="aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
            onClick={(e) => {
              // Cancelling cannot stop a grant already on its way to Sepolia: stay open until it lands.
              if (busy) e.preventDefault();
            }}
          >
            {tg.cancel}
          </Button>
        </SheetClose>
        <p className="basis-full text-xs text-muted-ink">{tg.footnote}</p>
      </div>
    </form>
  );
}

/** Loads the merchant catalog, then the form. */
function GrantFormBody({
  onCreated,
  onBusyChange,
}: {
  onCreated: (res: CreateMandateResponse) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const merchants = useResource(loadMerchants);
  const now = useNow(60_000);
  const tg = useT().principal.grant;
  if (merchants.error) {
    return (
      <div className="px-5 py-5">
        <ErrorState title={tg.loadMerchantsFailed} error={merchants.error} onRetry={merchants.refresh} />
      </div>
    );
  }
  if (merchants.data && now !== null) {
    return (
      <GrantFormInner merchants={merchants.data.merchants} initialNow={now} onCreated={onCreated} onBusyChange={onBusyChange} />
    );
  }
  return (
    <div className="space-y-5 px-5 py-5" aria-busy="true" aria-label={tg.loadingForm}>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
      <Skeleton className="h-12" />
      <Skeleton className="h-28" />
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
    </div>
  );
}

/**
 * "Grant a new mandate" as a right-hand sheet: the existing fields and demo defaults (MICEMore
 * Finance, Mingyu, $150, $40, meal / transport / supplies, the five merchants in those categories,
 * "alcohol, wine, gift", now → +2 days); submit hashes the terms and anchors them on Sepolia.
 */
export function GrantSheet({
  open,
  onOpenChange,
  onCreated,
  returnFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (res: CreateMandateResponse) => void;
  /**
   * The button that opened the sheet. The sheet is opened from state (no SheetTrigger), so Radix has
   * nothing to give the focus back to on close; this does, instead of dropping it to <body>.
   */
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const t = useT();
  const tg = t.principal.grant;
  // While the grant is anchoring the sheet stays open (Cancel, Esc and outside clicks are ignored):
  // closing would unmount the form, lose its busy state and allow a second grant and anchor.
  const busyRef = useRef(false);
  const setBusy = useCallback((busy: boolean) => {
    busyRef.current = busy;
  }, []);
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && busyRef.current) return;
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="right"
        closeLabel={t.common.close}
        className="gap-0 bg-surface p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
        onCloseAutoFocus={(e) => {
          const el = returnFocusRef?.current;
          if (!el?.isConnected) return;
          e.preventDefault();
          el.focus();
        }}
      >
        <SheetHeader className="border-b border-line px-5 pt-5 pb-4">
          <SheetTitle className="type-section pr-8 text-ink">{tg.title}</SheetTitle>
          <SheetDescription className="text-muted-ink">{tg.description}</SheetDescription>
        </SheetHeader>
        {/* SheetContent unmounts when closed, so every opening starts from fresh defaults. */}
        <GrantFormBody
          onCreated={(res) => {
            busyRef.current = false;
            onCreated(res);
          }}
          onBusyChange={setBusy}
        />
      </SheetContent>
    </Sheet>
  );
}
