import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BillsLab } from "./lab";

export const metadata: Metadata = {
  title: "PerDiem · Bill drop lab",
  robots: { index: false, follow: false },
};

/** Development-only lab for the bill drop (components/perdiem/bill-drop.tsx). A 404 in production builds. */
export default function BillsLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <BillsLab />;
}
