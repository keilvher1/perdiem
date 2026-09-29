import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InstallLab, type LabState } from "./lab";

export const metadata: Metadata = {
  title: "PerDiem · Install lab",
  robots: { index: false, follow: false },
};

const STATES: ReadonlyArray<LabState> = ["live", "prompt", "safari", "hidden"];

/**
 * Development-only lab for the desktop install control (components/perdiem/install-app.tsx).
 * ?state=prompt | safari | hidden pins a state; ?state=live (default) runs the real detection.
 * A 404 in production builds.
 */
export default async function InstallLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const raw = (await searchParams).state;
  const state = STATES.find((s) => s === raw) ?? "live";
  return <InstallLab state={state} />;
}
