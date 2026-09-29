"use client";

import type { ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Light is the default (the demo video is filmed in light); Dark and System are opt-in from the
 * header menu. `class` strategy: `.dark` on <html> switches the tokens in app/globals.css.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      storageKey="perdiem-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
