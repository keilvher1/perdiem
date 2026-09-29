"use client";

import { useT } from "@/lib/i18n/provider";

export function SiteFooter() {
  const t = useT();
  return (
    <footer className="border-t border-zinc-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 text-xs text-zinc-500 sm:flex-row sm:justify-between sm:px-6">
        <span>{t.shell.footer.event}</span>
        <span>{t.shell.footer.testnet}</span>
      </div>
    </footer>
  );
}
