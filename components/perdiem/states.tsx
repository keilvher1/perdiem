"use client";

import type { ComponentType, ReactNode, SVGProps } from "react";
import { Inbox, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiClientError } from "@/lib/api-client";
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
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white/60 px-6 py-10 text-center",
        className,
      )}
    >
      <span className="grid size-10 place-items-center rounded-full bg-zinc-100 text-zinc-500">
        <Icon aria-hidden className="size-5" />
      </span>
      <p className="font-medium text-zinc-900">{title}</p>
      {description && <div className="max-w-md text-sm text-zinc-500">{description}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  title = "Something went wrong",
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
  const code = error && "code" in error ? (error as ApiClientError).code : null;
  const status = error && "status" in error ? (error as ApiClientError).status : null;
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/60 px-5 py-4 sm:flex-row sm:items-center", className)}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-700">
        <TriangleAlert aria-hidden className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-rose-900">{title}</p>
        <p className="mt-0.5 text-sm break-words text-rose-800/90">
          {error?.message ?? "Unknown error."}
          {code && (
            <span className="ml-2 font-mono text-xs text-rose-700/80">
              {code}
              {status ? ` · ${status}` : ""}
            </span>
          )}
        </p>
      </div>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={retrying} className="bg-white">
          <RefreshCw aria-hidden className={cn(retrying && "animate-spin")} />
          Retry
        </Button>
      )}
    </div>
  );
}

export function LoadingRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full rounded-lg" style={{ opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
}
