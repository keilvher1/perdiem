import { CircleCheck, CircleX } from "lucide-react";
import { cn } from "@/lib/utils";

/** ✅ / ❌ as icon + text (color is never the only signal). */
export function CheckMark({
  ok,
  yes = "Match",
  no = "Mismatch",
  className,
}: {
  ok: boolean;
  yes?: string;
  no?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap", ok ? "text-emerald-700" : "text-rose-700", className)}>
      {ok ? <CircleCheck aria-hidden className="size-4" /> : <CircleX aria-hidden className="size-4" />}
      {ok ? yes : no}
    </span>
  );
}
