"use client";

/**
 * /design/bills — development-only lab for BillDrop. Uses the fixture catalog (docs/fixtures,
 * mandate man_A) and never calls the API: "Pay this bill" and "Edit as request" are logged on the
 * page. The sample bills are in public/samples/ (lib/bills/sample-bills.mjs).
 */
import { useRef, useState } from "react";
import mandateAJson from "@/docs/fixtures/mandate-man_A.json";
import type { MandateDetailResponse } from "@/contracts/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BillDrop, type BillDropHandle, type MerchantLite } from "@/components/perdiem/bill-drop";
import { PageContainer, PageHeader } from "@/components/perdiem/page";
import { cn } from "@/lib/utils";

const A = mandateAJson as unknown as MandateDetailResponse;
const CATALOG: MerchantLite[] = A.mandate.catalog.map(({ id, name, category }) => ({ id, name, category }));

const SAMPLES = [
  { file: "bill-yangjae-kitchen.pdf", note: "APPROVE on man_A" },
  { file: "bill-yangjae-kitchen.png", note: "APPROVE on man_A (OCR)" },
  { file: "bill-wine-and-co.pdf", note: "STOP ×3 on man_A" },
  { file: "bill-wine-and-co.png", note: "STOP ×3 on man_A (OCR)" },
  { file: "bill-yangjae-kitchen-krw.pdf", note: "₩16,000 → USD at today’s rate" },
  { file: "bill-yangjae-kitchen-krw.png", note: "₩16,000 → USD (OCR)" },
];

type LogLine = { n: number; kind: "onSubmitText" | "onPrefill"; text: string; at: string };

export function BillsLab() {
  const [mandate, setMandate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toolbar, setToolbar] = useState<"top" | "bottom">("bottom");
  const [draft, setDraft] = useState("");
  const [log, setLog] = useState<LogLine[]>([]);
  const composer = useRef<HTMLTextAreaElement>(null);
  const standalone = useRef<BillDropHandle>(null);
  const push = (kind: LogLine["kind"], text: string) =>
    setLog((l) => [{ n: (l[0]?.n ?? 0) + 1, kind, text, at: new Date().toISOString().slice(11, 19) }, ...l]);
  const mandateId = mandate ? A.mandate.id : null;

  return (
    <PageContainer className="pt-5 pb-10">
      <PageHeader
        eyebrow="Design lab · development only"
        title="Bill drop"
        description="Drop a bill, receipt or invoice on the conversation (or use Attach bill). Nothing is sent: the request is logged below. Catalog: docs/fixtures/mandate-man_A.json."
        className="mb-4"
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <BillDrop
          mandateId={mandateId}
          catalog={CATALOG}
          disabled={busy}
          toolbar={toolbar}
          onSubmitText={(text) => push("onSubmitText", text)}
          onPrefill={(text) => {
            push("onPrefill", text);
            setDraft(text);
            composer.current?.focus();
          }}
        >
          {/* Stand-in for app/traveler/chat-panel.tsx: same frame and height. */}
          <section
            aria-label="Conversation (stand-in)"
            className="flex h-[calc(100dvh-14rem)] min-h-[30rem] flex-col overflow-hidden rounded-lg border border-line bg-surface lg:min-h-[36rem]"
          >
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
              <p className="font-medium text-ink">Conversation</p>
              <p className="max-w-sm text-sm text-muted-ink">Stand-in for the chat panel. Drop a bill anywhere on this area.</p>
            </div>
            <div className="shrink-0 border-t border-line bg-surface-2 px-4 py-3 sm:px-5">
              <label htmlFor="lab-composer" className="sr-only">
                Message to the agent
              </label>
              <Textarea
                id="lab-composer"
                ref={composer}
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Composer (Edit as request fills it)"
                className="max-h-40 min-h-11 resize-none bg-surface"
              />
            </div>
          </section>
        </BillDrop>

        <aside className="min-w-0 space-y-6">
          <section className="space-y-2">
            <h2 className="type-label text-muted-ink">Controls</h2>
            <div className="flex flex-wrap gap-2">
              <Toggle on={mandate} onClick={() => setMandate((v) => !v)}>
                mandateId: {mandate ? A.mandate.id : "null"}
              </Toggle>
              <Toggle on={busy} onClick={() => setBusy((v) => !v)}>
                disabled: {String(busy)}
              </Toggle>
              <Toggle on={toolbar === "top"} onClick={() => setToolbar((v) => (v === "top" ? "bottom" : "top"))}>
                toolbar: {toolbar}
              </Toggle>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="type-label text-muted-ink">Sample bills (public/samples)</h2>
            <ul className="space-y-1 text-sm">
              {SAMPLES.map((s) => (
                <li key={s.file} className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <a
                    href={`/samples/${s.file}`}
                    download
                    className="rounded-sm text-cobalt underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {s.file}
                  </a>
                  <span className="text-xs text-muted-ink">{s.note}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-2" aria-live="polite">
            <h2 className="type-label text-muted-ink">Log (nothing is sent)</h2>
            {log.length === 0 ? (
              <p className="text-sm text-muted-ink">No request yet.</p>
            ) : (
              <ol className="space-y-2" data-lab-log="">
                {log.map((l) => (
                  <li key={l.n} className="rounded-md border border-line bg-surface px-3 py-2 text-sm">
                    <p className="flex justify-between gap-2 text-xs text-muted-ink">
                      <span className="font-mono">{l.kind}</span>
                      <span className="tabular-nums">{l.at}</span>
                    </p>
                    <p className="mt-1 break-words text-ink" data-lab-text="">
                      {l.text}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>

      <section className="mt-10 max-w-xl space-y-2">
        <h2 className="type-section text-ink">Without children: a drop zone of its own</h2>
        <BillDrop
          ref={standalone}
          mandateId={mandateId}
          catalog={CATALOG}
          disabled={busy}
          onSubmitText={(text) => push("onSubmitText", text)}
          onPrefill={(text) => push("onPrefill", text)}
        />
        <Button type="button" variant="link" className="px-0" onClick={() => standalone.current?.openFilePicker()}>
          ref.openFilePicker()
        </Button>
      </section>
    </PageContainer>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center rounded-md border px-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring",
        on ? "border-cobalt-line bg-cobalt-soft text-ink" : "border-line-strong bg-surface text-muted-ink",
      )}
    >
      {children}
    </button>
  );
}
