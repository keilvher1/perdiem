import type { Metadata } from "next";

/** Names the document (and Chrome's default "Save as PDF" file name) after the mandate. */
export async function generateMetadata({ params }: { params: Promise<{ mandateId: string }> }): Promise<Metadata> {
  const { mandateId } = await params;
  let id = mandateId;
  try {
    id = decodeURIComponent(mandateId);
  } catch {
    // keep the raw segment
  }
  return { title: `PerDiem trip statement ${id}` };
}

export default function TripStatementLayout({ children }: LayoutProps<"/audit/[mandateId]/report">) {
  return children;
}
