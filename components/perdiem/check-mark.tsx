import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { StateGlyph } from "./state-glyph";

/**
 * A verification result as glyph + text (colour is never the only signal): match = approve tone,
 * ● with a check; mismatch = danger tone, ▲ (never the rule-stop amber). See lib/ui-state.ts.
 */
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
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap", ok ? "text-approve" : "text-danger", className)}>
      <StateGlyph glyph={ok ? "circle-check" : "triangle"} className="size-3" />
      {ok ? (yes ?? t.common.check.match) : (no ?? t.common.check.mismatch)}
    </span>
  );
}
