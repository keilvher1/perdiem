"use client";

import type { ComponentType, ReactNode, SVGProps } from "react";
import { Inbox, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiClientError } from "@/lib/api-client";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface/60 px-6 py-10 text-center",
        className,
      )}
    >
      <span className="grid size-10 place-items-center rounded-full bg-surface-2 text-muted-ink">
        <Icon aria-hidden className="size-5" />
      </span>
      <p className="font-medium text-ink">{title}</p>
      {description && <div className="max-w-md text-sm text-muted-ink">{description}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  title,
  onRetry,
  retrying = false,
  className,
}: {
  error: ApiClientError | Error | null;
  title?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  const t = useT();
  const code = error && "code" in error ? (error as ApiClientError).code : null;
  const status = error && "status" in error ? (error as ApiClientError).status : null;
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-start gap-3 rounded-lg border border-danger-line bg-danger-soft px-5 py-4 sm:flex-row sm:items-center", className)}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-danger">
        <TriangleAlert aria-hidden className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-danger">{title ?? t.common.error.title}</p>
        <p className="mt-0.5 text-sm break-words text-ink">
          {error?.message ?? t.common.error.unknown}
          {code && (
            <span className="ml-2 font-mono text-xs text-muted-ink">
              {code}
              {status ? ` · ${status}` : ""}
            </span>
          )}
        </p>
      </div>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={retrying} className="bg-surface">
          <RefreshCw aria-hidden className={cn(retrying && "animate-spin")} />
          {t.common.retry}
        </Button>
      )}
    </div>
  );
}

export function LoadingRows({ rows = 4, className }: { rows?: number; className?: string }) {
  const t = useT();
  return (
    <div className={cn("space-y-2.5", className)} aria-busy="true" aria-label={t.common.loading}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full rounded-md" style={{ opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
}
