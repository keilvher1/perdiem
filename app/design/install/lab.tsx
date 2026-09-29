"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { clearInstallDismissal, InstallApp } from "@/components/perdiem/install-app";
import { PageContainer, PageHeader, Panel, PanelTitle } from "@/components/perdiem/page";
import { cn } from "@/lib/utils";

export type LabState = "live" | "prompt" | "safari" | "hidden";

const STATE_NOTES: Record<LabState, string> = {
  live: "Real detection: Chrome / Edge show the tab once beforeinstallprompt fires, Safari 17+ on macOS shows the Add to Dock steps, other browsers and the installed app show nothing.",
  prompt: "Pinned: Chrome / Edge. Without a real event the click plays the accepted path (tab hides, success toast).",
  safari: "Pinned: Safari on macOS. The click opens the Add to Dock steps.",
  hidden: "Pinned: hidden (installed app, dismissed, or a browser without an install flow).",
};

const ICONS = [
  { src: "/icons/icon-192.png", label: "icon-192 (any)", size: 96 },
  { src: "/icons/icon-512.png", label: "icon-512 (any)", size: 96 },
  { src: "/icons/icon-maskable-512.png", label: "icon-maskable-512", size: 96, round: true },
  { src: "/icons/apple-touch-icon-180.png", label: "apple-touch-icon-180", size: 96 },
] as const;

/** A fake Chromium install event, so the live path can be exercised without a real install. */
function simulatePrompt(outcome: "accepted" | "dismissed") {
  const ev = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    platforms: string[];
    userChoice: Promise<{ outcome: string; platform: string }>;
    prompt: () => Promise<void>;
  };
  let choose: (v: { outcome: string; platform: string }) => void = () => {};
  ev.platforms = ["web"];
  ev.userChoice = new Promise((r) => (choose = r));
  ev.prompt = async () => {
    choose({ outcome, platform: "web" });
    if (outcome === "accepted") window.setTimeout(() => window.dispatchEvent(new Event("appinstalled")), 300);
  };
  window.dispatchEvent(ev);
}

export function InstallLab({ state }: { state: LabState }) {
  return (
    <PageContainer>
      <InstallApp lab force={state === "live" ? undefined : state} />
      <PageHeader
        eyebrow="Design lab · development only"
        title="Install app"
        description="The slim tab on the left edge, near the bottom (768 px and wider). It sits inside the 24 px page gutter, so it never covers this content."
      />
      <nav aria-label="Lab states" className="mb-6 flex flex-wrap gap-2">
        {(Object.keys(STATE_NOTES) as LabState[]).map((s) => (
          <Link
            key={s}
            href={s === "live" ? "/design/install" : `/design/install?state=${s}`}
            aria-current={s === state ? "page" : undefined}
            className={cn(
              "rounded-md border px-2.5 py-1 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
              s === state ? "border-cobalt bg-cobalt-soft text-cobalt" : "border-line bg-surface text-ink hover:bg-surface-2",
            )}
          >
            {s}
          </Link>
        ))}
      </nav>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelTitle description={STATE_NOTES[state]}>State: {state}</PanelTitle>
          {state === "live" && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => simulatePrompt("accepted")}>
                Simulate prompt (accept)
              </Button>
              <Button variant="outline" onClick={() => simulatePrompt("dismissed")}>
                Simulate prompt (cancel)
              </Button>
              <Button variant="ghost" onClick={clearInstallDismissal}>
                Reset 7-day dismissal
              </Button>
            </div>
          )}
        </Panel>
        <Panel>
          <PanelTitle description="Served from public/icons, listed in /manifest.webmanifest.">Icons</PanelTitle>
          <ul className="flex flex-wrap gap-5">
            {ICONS.map((icon) => (
              <li key={icon.src} className="flex flex-col items-center gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element -- the raw files are what is being checked */}
                <img
                  src={icon.src}
                  alt=""
                  width={icon.size}
                  height={icon.size}
                  className={cn("round" in icon && icon.round ? "rounded-full" : undefined)}
                />
                <span className="type-id text-muted-ink">{icon.label}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      {/* Content flush with the gutter, down to the bottom of the viewport: the tab must not cover it. */}
      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3 text-sm">
            <span className="text-ink">Ledger row {i + 1} · content starts at the gutter</span>
            <span className="type-id text-muted-ink">led_{String(i + 1).padStart(3, "0")}</span>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
