import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Plain table primitives with a sticky header. The scroll container is ours (not the
 * shadcn Table wrapper) so `sticky top-0` works inside a max-height box.
 */
export function TableShell({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("relative w-full overflow-auto rounded-lg border border-zinc-200 bg-white", className)} {...props} />;
}

export function Tbl({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full border-collapse text-sm", className)} {...props} />;
}

export function THead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("sticky top-0 z-10 bg-zinc-50 shadow-[inset_0_-1px_0_#e4e4e7]", className)} {...props} />;
}

export function Th({ className, numeric, ...props }: ComponentProps<"th"> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "h-9 px-3 text-left align-middle text-xs font-medium whitespace-nowrap text-zinc-500",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("border-b border-zinc-100 last:border-0 transition-colors hover:bg-zinc-50/80", className)} {...props} />;
}

export function Td({ className, numeric, ...props }: ComponentProps<"td"> & { numeric?: boolean }) {
  return (
    <td
      className={cn("px-3 py-2.5 align-middle text-zinc-700", numeric && "text-right tabular-nums whitespace-nowrap", className)}
      {...props}
    />
  );
}
