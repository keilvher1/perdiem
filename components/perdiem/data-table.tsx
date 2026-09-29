import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Plain table primitives with a sticky header. The scroll container is ours (not the
 * shadcn Table wrapper) so `sticky top-0` works inside a max-height box.
 */
export function TableShell({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("relative w-full overflow-auto rounded-lg border border-line bg-surface", className)} {...props} />;
}

export function Tbl({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full border-collapse text-sm", className)} {...props} />;
}

export function THead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("sticky top-0 z-10 bg-surface-2 shadow-[inset_0_-1px_0_var(--line)]", className)} {...props} />;
}

export function Th({ className, numeric, ...props }: ComponentProps<"th"> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "h-9 px-3 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-ink",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("border-b border-line last:border-0 transition-colors duration-150 hover:bg-surface-2", className)} {...props} />;
}

export function Td({ className, numeric, ...props }: ComponentProps<"td"> & { numeric?: boolean }) {
  return (
    <td
      className={cn("px-3 py-2.5 align-middle text-ink", numeric && "text-right tabular-nums whitespace-nowrap", className)}
      {...props}
    />
  );
}
