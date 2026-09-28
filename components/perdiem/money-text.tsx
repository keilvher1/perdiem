import type { ComponentProps } from "react";
import { fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Right-aligned, tabular money in the backend's exact fmtUsd format. */
export function MoneyText({
  value,
  className,
  align = "right",
  ...props
}: { value: number | null | undefined; align?: "left" | "right" } & Omit<ComponentProps<"span">, "children">) {
  return (
    <span className={cn("tabular-nums whitespace-nowrap", align === "right" && "text-right", className)} {...props}>
      {fmtUsd(value)}
    </span>
  );
}
