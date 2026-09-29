import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppShell, AppShellFallback } from "@/components/perdiem/app-shell";
import { MandatesProvider } from "@/components/perdiem/mandates-provider";
import { SiteFooter } from "@/components/perdiem/site-footer";
import { HTML_LANG, LOCALE_COOKIE, toLocale } from "@/lib/i18n/config";
import { LocaleProvider } from "@/lib/i18n/provider";

// System font stacks only (see app/globals.css): next/font/google needs network at build time,
// and the frontend agent's sandbox may be offline.
export const metadata: Metadata = {
  title: "PerDiem",
  description: "Delegated spend, kept inside the line.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The UI language is a cookie set by the header switcher; English when absent (see lib/i18n/config.ts).
  const locale = toLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return (
    <html lang={HTML_LANG[locale]} className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <LocaleProvider initialLocale={locale}>
          <TooltipProvider>
            <MandatesProvider>
              <Suspense fallback={<AppShellFallback />}>
                <AppShell />
              </Suspense>
              <main className="flex-1">{children}</main>
              <SiteFooter />
            </MandatesProvider>
            {/* Offsets keep toasts above the floating Evidence button (bottom-6, 44–48 px tall). */}
            <Toaster
              position="bottom-right"
              theme="light"
              closeButton
              offset={{ bottom: 88 }}
              mobileOffset={{ bottom: 80 }}
            />
          </TooltipProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
