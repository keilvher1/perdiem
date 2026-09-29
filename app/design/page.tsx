import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DesignGallery } from "./gallery";

export const metadata: Metadata = {
  title: "PerDiem · Design system",
  robots: { index: false, follow: false },
};

/** Development-only component gallery (docs/DESIGN-SYSTEM.md). A 404 in production builds. */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignGallery />;
}
