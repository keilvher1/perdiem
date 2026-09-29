import { CircleCheck, CircleX } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/** ✅ / ❌ as icon + text (color is never the only signal). */
export function CheckMark({
  ok,
  yes,
  no,
  className,
}: {
  ok: boolean;
  yes?: string;
  no?: string;
  className?: string;
}) {
  const t = useT();
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap", ok ? "text-emerald-700" : "text-rose-700", className)}>
      {ok ? <CircleCheck aria-hidden className="size-4" /> : <CircleX aria-hidden className="size-4" />}
      {ok ? (yes ?? t.common.check.match) : (no ?? t.common.check.mismatch)}
    </span>
  );
}
