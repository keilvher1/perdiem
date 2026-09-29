import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, toLocale } from "@/lib/i18n/config";
import { MESSAGES } from "@/lib/i18n/messages";

/**
 * Names the document (and Chrome's default "Save as PDF" file name) after the mandate, in the UI
 * language from the cookie the root layout also reads (English when absent).
 */
export async function generateMetadata({ params }: { params: Promise<{ mandateId: string }> }): Promise<Metadata> {
  const { mandateId } = await params;
  let id = mandateId;
  try {
    id = decodeURIComponent(mandateId);
  } catch {
    // keep the raw segment
  }
  const locale = toLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return { title: MESSAGES[locale].audit.report.docTitle(id) };
}

export default function TripStatementLayout({ children }: LayoutProps<"/audit/[mandateId]/report">) {
  return children;
}
