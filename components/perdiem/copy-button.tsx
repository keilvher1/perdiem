"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/provider";
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
  label,
  className,
  showText = false,
}: {
  value: string;
  /** Accessible name, e.g. "Copy transaction hash". */
  label?: string;
  className?: string;
  showText?: boolean;
}) {
  const t = useT();
  const name = label ?? t.common.copy.label;
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    const ok = await copyText(value);
    if (!ok) {
      toast.error(t.common.copy.failed);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={name}
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1 rounded-sm text-muted-ink transition-colors duration-150 outline-none hover:bg-line hover:text-ink focus-visible:ring-2 focus-visible:ring-ring",
        showText ? "h-7 px-2 text-xs font-medium" : "size-5",
        className,
      )}
    >
      {copied ? <Check aria-hidden className="size-3.5 text-approve" /> : <Copy aria-hidden className="size-3.5" />}
      {showText && <span>{copied ? t.common.copy.copied : t.common.copy.label}</span>}
      <span className="sr-only" aria-live="polite">
        {copied ? t.common.copy.copied : ""}
      </span>
    </button>
  );
}
