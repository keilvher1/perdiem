import { Suspense } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppShell, AppShellFallback } from "@/components/perdiem/app-shell";
import { MandatesProvider } from "@/components/perdiem/mandates-provider";

// System font stacks only (see app/globals.css): next/font/google needs network at build time,
// and the frontend agent's sandbox may be offline.
export const metadata: Metadata = {
  title: "PerDiem",
  description: "Delegated spend, kept inside the line.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <TooltipProvider>
          <MandatesProvider>
            <Suspense fallback={<AppShellFallback />}>
              <AppShell />
            </Suspense>
            <main className="flex-1">{children}</main>
            <footer className="border-t border-zinc-200 bg-white print:hidden">
              <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 text-xs text-zinc-500 sm:flex-row sm:justify-between sm:px-6">
                <span>Challenge B | FuriosaAI x Bricksum | GWDC 2026 Korea</span>
                <span>Sepolia testnet only · no real money moves</span>
              </div>
            </footer>
          </MandatesProvider>
          {/* Offsets keep toasts above the floating Evidence button (bottom-6, 44–48 px tall). */}
          <Toaster position="bottom-right" theme="light" closeButton offset={{ bottom: 88 }} mobileOffset={{ bottom: 80 }} />
        </TooltipProvider>
      </body>
    </html>
  );
}
