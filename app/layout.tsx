import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

// System font stacks only (see app/globals.css): next/font/google needs network at build time,
// and the frontend agent's sandbox may be offline.
export const metadata: Metadata = {
  title: "PerDiem",
  description: "Delegated spend, kept inside the line.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
