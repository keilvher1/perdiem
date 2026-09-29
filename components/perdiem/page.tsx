import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 py-8 sm:px-6", className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="type-label mb-1 text-muted-ink">{eyebrow}</p>}
        <h1 className="type-page-title text-ink">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-sm text-muted-ink sm:text-[15px] sm:leading-6">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Surface panel (6 px radius, hairline border, no shadow: structure comes from lines and alignment). */
export function Panel({ children, className, as: As = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "aside" }) {
  return <As className={cn("rounded-lg border border-line bg-surface p-6", className)}>{children}</As>;
}

export function PanelTitle({ children, description, actions, className }: { children: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink">{children}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-ink">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  icon,
  className,
  labelClassName,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "emerald" | "amber" | "rose" | "indigo";
  icon?: ReactNode;
  className?: string;
  labelClassName?: string;
}) {
  // Legacy tone names map onto the state tokens (app/globals.css): amber = rule stop, rose = error.
  const toneCls = {
    default: "text-ink",
    emerald: "text-approve",
    amber: "text-stop",
    rose: "text-danger",
    indigo: "text-cobalt",
  }[tone];
  return (
    <div className={cn("rounded-lg border border-line bg-surface px-4 py-3.5", className)}>
      <div className={cn("flex items-start gap-1.5 text-xs font-medium text-muted-ink [&>svg]:mt-0.5 [&>svg]:shrink-0", labelClassName)}>
        {icon}
        <span>{label}</span>
      </div>
      <div className={cn("mt-1 text-2xl font-semibold tracking-tight tabular-nums", toneCls)}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-ink">{hint}</div>}
    </div>
  );
}
