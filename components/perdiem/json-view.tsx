"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function Scalar({ value }: { value: Json }) {
  if (value === null) return <span className="text-zinc-400">null</span>;
  if (typeof value === "string") return <span className="break-all text-emerald-800">&quot;{value}&quot;</span>;
  if (typeof value === "number") return <span className="text-sky-800">{String(value)}</span>;
  if (typeof value === "boolean") return <span className="text-amber-700">{String(value)}</span>;
  return null;
}

function Node({
  name,
  value,
  depth,
  collapsed,
  last,
  note,
}: {
  name: string | null;
  value: Json;
  depth: number;
  collapsed: ReadonlySet<string>;
  last: boolean;
  note?: Record<string, string>;
}) {
  const t = useT();
  const container = value !== null && typeof value === "object";
  const [open, setOpen] = useState(!(name !== null && collapsed.has(name)));
  const pad = { paddingLeft: `${depth * 14}px` };
  const key = name !== null ? <span className="text-zinc-500">&quot;{name}&quot;: </span> : null;
  const comma = last ? "" : ",";
  const comment = name !== null && note?.[name] ? <span className="ml-2 text-zinc-400 italic">{`// ${note[name]}`}</span> : null;

  if (!container) {
    return (
      <div style={pad}>
        {key}
        <Scalar value={value} />
        {comma}
        {comment}
      </div>
    );
  }
  const isArray = Array.isArray(value);
  const entries: [string | null, Json][] = isArray ? (value as Json[]).map((v) => [null, v]) : Object.entries(value as Record<string, Json>);
  const [o, c] = isArray ? ["[", "]"] : ["{", "}"];
  // Short arrays of scalars stay on one line.
  if (isArray && entries.every(([, v]) => v === null || typeof v !== "object") && JSON.stringify(value).length < 60) {
    return (
      <div style={pad}>
        {key}
        {o}
        {entries.map(([, v], i) => (
          <span key={i}>
            <Scalar value={v} />
            {i < entries.length - 1 ? ", " : ""}
          </span>
        ))}
        {c}
        {comma}
        {comment}
      </div>
    );
  }
  return (
    <div>
      <div style={pad} className="flex items-center">
        <button
          type="button"
          onClick={() => setOpen((x) => !x)}
          aria-expanded={open}
          aria-label={t.common.json.toggle(open, name ?? t.common.json.value)}
          className="-ml-4 mr-0.5 grid size-4 place-items-center rounded text-zinc-400 outline-none hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <ChevronRight aria-hidden className={cn("size-3 transition-transform", open && "rotate-90")} />
        </button>
        <span>
          {key}
          {o}
          {!open && (
            <>
              <button type="button" onClick={() => setOpen(true)} className="mx-1 rounded bg-zinc-100 px-1.5 text-[11px] text-zinc-500 hover:bg-zinc-200">
                {t.common.json.count(entries.length, isArray)}
              </button>
              {c}
              {comma}
            </>
          )}
          {comment}
        </span>
      </div>
      {open && (
        <>
          {entries.map(([k, v], i) => (
            <Node key={k ?? i} name={k} value={v} depth={depth + 1} collapsed={collapsed} last={i === entries.length - 1} note={note} />
          ))}
          <div style={pad}>
            {c}
            {comma}
          </div>
        </>
      )}
    </div>
  );
}

/** Read-only pretty JSON with collapsible nodes (keys in `collapsed` start closed). */
export function JsonView({
  value,
  collapsed = [],
  note,
  className,
}: {
  value: unknown;
  collapsed?: string[];
  /** Inline comments after top-level keys, e.g. { status: "not hashed" }. */
  note?: Record<string, string>;
  className?: string;
}) {
  const set = new Set(collapsed);
  return (
    <div className={cn("overflow-auto rounded-lg bg-zinc-50 py-3 pr-3 pl-6 font-mono text-xs leading-5 text-zinc-800 ring-1 ring-zinc-200 ring-inset", className)}>
      <Node name={null} value={JSON.parse(JSON.stringify(value ?? null)) as Json} depth={0} collapsed={set} last note={note} />
    </div>
  );
}
