"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Anchor, LoaderCircle, TriangleAlert } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Panel, PanelTitle } from "@/components/perdiem/page";
import { ErrorState } from "@/components/perdiem/states";
import { cn } from "@/lib/utils";

const DEFAULT_CATEGORIES = ["meal", "transport", "supplies"];
const DEFAULT_BLOCKED = "alcohol, wine, gift";
const loadMerchants = () => api.merchants();

type Field = "principal" | "traveler" | "budget" | "cap" | "categories" | "merchants" | "start" | "end";
/** A validation message, resolved at render time so it follows a language switch. */
type FieldMsg = (m: Messages["principal"]["grant"]["errors"]) => string;

function FieldError({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return (
    <p id={id} className="mt-1 text-xs text-rose-700">
      {msg}
    </p>
  );
}

function Fieldset({ legend, hint, children }: { legend: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium text-zinc-900">{legend}</legend>
      {children}
      {hint && <div className="mt-1.5 text-xs text-zinc-500">{hint}</div>}
    </fieldset>
  );
}

/** Grant form. Needs `initialNow` so the default window (now → +2 days) is computed outside render. */
function GrantFormInner({
  merchants,
  initialNow,
  onCreated,
}: {
  merchants: Merchant[];
  initialNow: number;
  onCreated: (res: CreateMandateResponse) => void;
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
    const e = validate();
    setErrors(e);
    setSubmitError(null);
    if (Object.keys(e).length > 0) return;
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
    try {
      const res = await api.createMandate(body);
      onCreated(res);
    } catch (err) {
      const apiErr = toApiClientError(err);
      setSubmitError(`${apiErr.message} (${apiErr.code})`);
      toast.error(tg.notCreated, { description: apiErr.message });
    } finally {
      setBusy(false);
    }
  };

  const inputCls = "h-9 bg-white";
  const err = (f: Field) => (errors[f] ? { "aria-invalid": true, "aria-describedby": `err-${f}` } : {});
  const errMsg = (f: Field) => errors[f]?.(tg.errors);

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
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
          <FieldError id="err-cap" msg={errMsg("cap")} />
        </div>
      </div>

      <Fieldset legend={tg.categories}>
        <div className="flex flex-wrap gap-x-4 gap-y-2" {...(errors.categories ? { "aria-describedby": "err-categories" } : {})}>
          {categories.map((c) => (
            <Label key={c} className="cursor-pointer font-normal text-zinc-700">
              <Checkbox checked={cats.includes(c)} onCheckedChange={(v) => setCats((l) => toggle(l, c, v === true))} />
              {catLabel(c)}
            </Label>
          ))}
        </div>
        <FieldError id="err-categories" msg={errMsg("categories")} />
      </Fieldset>

      <Fieldset
        legend={tg.merchants}
        hint={
          offCategory.length > 0 ? (
            <span className="flex items-start gap-1.5 text-amber-800">
              <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {tg.offCategory(offCategory.map((m) => m.name).join(t.principal.listSep), offCategory.length)}
            </span>
          ) : undefined
        }
      >
        <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
          {merchants.map((m) => (
            <Label key={m.id} className="cursor-pointer font-normal text-zinc-700">
              <Checkbox checked={picked.includes(m.id)} onCheckedChange={(v) => setPicked((l) => toggle(l, m.id, v === true))} />
              <span className="truncate">{m.name}</span>
              <span className="ml-auto rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">{catLabel(m.category)}</span>
            </Label>
          ))}
        </div>
        <FieldError id="err-merchants" msg={errMsg("merchants")} />
      </Fieldset>

      <div>
        <Label htmlFor="g-blocked" className="mb-1.5">
          {tg.blocked}
        </Label>
        <Input id="g-blocked" className={inputCls} value={blocked} onChange={(e) => setBlocked(e.target.value)} placeholder="alcohol, wine, gift" />
        <p className="mt-1 text-xs text-zinc-500">{tg.blockedHint}</p>
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
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200 ring-inset">
          {submitError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4">
        <Button type="submit" size="lg" disabled={busy} className="h-9 px-4">
          {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : <Anchor aria-hidden />}
          {busy ? tg.submitting : tg.submit}
        </Button>
        <p className="text-xs text-zinc-500">{tg.footnote}</p>
      </div>
    </form>
  );
}

export function GrantForm({ onCreated }: { onCreated: (res: CreateMandateResponse) => void }) {
  const merchants = useResource(loadMerchants);
  const now = useNow(60_000);
  const tg = useT().principal.grant;
  return (
    <Panel>
      <PanelTitle description={tg.description}>
        {tg.title}
      </PanelTitle>
      {merchants.error ? (
        <ErrorState title={tg.loadMerchantsFailed} error={merchants.error} onRetry={merchants.refresh} />
      ) : merchants.data && now !== null ? (
        <GrantFormInner merchants={merchants.data.merchants} initialNow={now} onCreated={onCreated} />
      ) : (
        <div className="space-y-4" aria-busy="true" aria-label={tg.loadingForm}>
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
      )}
    </Panel>
  );
}
