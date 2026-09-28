"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({
  value,
  label = "Copy",
  className,
  showText = false,
}: {
  value: string;
  /** Accessible name, e.g. "Copy transaction hash". */
  label?: string;
  className?: string;
  showText?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    const ok = await copyText(value);
    if (!ok) {
      toast.error("Copy failed — select the text instead.");
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1 rounded text-zinc-500 transition-colors outline-none hover:bg-zinc-200/70 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-indigo-500",
        showText ? "h-7 px-2 text-xs font-medium" : "size-5",
        className,
      )}
    >
      {copied ? <Check aria-hidden className="size-3.5 text-emerald-600" /> : <Copy aria-hidden className="size-3.5" />}
      {showText && <span>{copied ? "Copied" : "Copy"}</span>}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}
