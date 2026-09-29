import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
// Pretendard, self-hosted from node_modules (dynamic subset: the browser fetches only the
// unicode-range files a page uses). Loaded before globals.css so the tokens can override it.
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppShell, AppShellFallback } from "@/components/perdiem/app-shell";
import { MandatesProvider } from "@/components/perdiem/mandates-provider";
import { SiteFooter } from "@/components/perdiem/site-footer";
import { ThemeProvider } from "@/components/perdiem/theme-provider";
import { HTML_LANG, LOCALE_COOKIE, toLocale } from "@/lib/i18n/config";
import { LocaleProvider } from "@/lib/i18n/provider";

// Fonts are self-hosted (Pretendard from node_modules + system CJK stacks, see app/globals.css):
// next/font/google would need network at build time.
export const metadata: Metadata = {
  title: "PerDiem",
  description: "Delegated spend, kept inside the line.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The UI language is a cookie set by the header switcher; English when absent (see lib/i18n/config.ts).
  const locale = toLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return (
    // suppressHydrationWarning: next-themes sets the theme class on <html> before hydration.
    <html lang={HTML_LANG[locale]} className="h-full antialiased" suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <LocaleProvider initialLocale={locale}>
            <TooltipProvider>
              <MandatesProvider>
                <Suspense fallback={<AppShellFallback />}>
                  <AppShell />
                </Suspense>
                <main className="flex-1">{children}</main>
                <SiteFooter />
              </MandatesProvider>
              {/* Offsets keep toasts above the floating Evidence button (bottom-6, 44–48 px tall).
                  The Toaster follows the theme (components/ui/sonner.tsx reads next-themes). */}
              <Toaster
                position="bottom-right"
                closeButton
                offset={{ bottom: 88 }}
                mobileOffset={{ bottom: 80 }}
              />
            </TooltipProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
