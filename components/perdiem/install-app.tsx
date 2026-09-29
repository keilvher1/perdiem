"use client";

/**
 * "Install app": PerDiem as a desktop app on Windows and macOS (manifest: app/manifest.ts).
 *
 *  - Chrome / Edge (any Chromium that fires `beforeinstallprompt`): the event is kept and the button
 *    opens the browser's own install dialog. `appinstalled` hides it and confirms with a toast.
 *  - Safari 17+ on macOS (no `beforeinstallprompt`; Add to Dock since macOS Sonoma): the button opens
 *    a popover with the steps (File > Add to Dock…).
 *  - Firefox and anything else without an install flow: nothing. There is no step a visitor could
 *    take in that browser, and a "switch browsers" notice would be a permanent, dead-end control on a
 *    finance console.
 *  - Already running as the installed app (display-mode standalone / navigator.standalone): nothing.
 *  - The x hides it for 7 days (localStorage, best effort). The browsers' own install entry points
 *    (address-bar icon, File > Add to Dock…) stay available either way.
 *
 * Layout: a slim tab on the LEFT edge near the bottom, 20 px wide inside the 24 px page gutter, so it
 * never rests on content (the Evidence control is the tab on the right edge). bottom-16 keeps it clear
 * of the Next dev indicator in development. Desktop only: hidden below 768 px and in print. It also registers /sw.js (production only; see public/sw.js).
 *
 * Lab (/design/install, development only): `lab` marks an instance the lab page mounts; while one is
 * mounted, the layout's instance steps aside, so there is never a second tab. `force` also pins a state
 * for screenshots (a forced instance writes no storage and fakes the accepted install).
 */
import { Fragment, useEffect, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronRight, MonitorDown, X } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { en, ja, ko, zh } from "@/lib/i18n/messages/install";
import { useLocale } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

const INSTALL = { en, ko, ja, zh } as const;

export type InstallMode = "prompt" | "safari" | "hidden";

/** Chromium's install event (not in lib.dom). */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<unknown>;
}

const DESKTOP = "(min-width: 48rem)";
const DISMISS_KEY = "perdiem:install-dismissed-until";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
const APP_MODES = ["(display-mode: standalone)", "(display-mode: window-controls-overlay)"];

// ---------------------------------------------------------------------------------------------
// Module state. `beforeinstallprompt` fires once per page load, possibly before React hydrates, so the
// listener is attached when this module loads, not in an effect.
// ---------------------------------------------------------------------------------------------

let deferred: BeforeInstallPromptEvent | null = null;
let labCount = 0;
/** The dismissal, also kept in memory: with storage blocked the x still hides the tab until reload. */
let dismissedUntil = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function readDismissed(): boolean {
  if (dismissedUntil > Date.now()) return true;
  try {
    const until = Number(window.localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

function writeDismissed() {
  dismissedUntil = Date.now() + DISMISS_MS;
  try {
    window.localStorage.setItem(DISMISS_KEY, String(dismissedUntil));
  } catch {
    // Storage blocked: the in-memory value hides it until the page reloads.
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Keep the event for our button. preventDefault only suppresses the browser's own mini-infobar
    // (phones); desktop Chrome / Edge keep their address-bar install icon regardless. On narrow
    // screens, where this control is not shown, the browser's default is left alone.
    if (window.matchMedia(DESKTOP).matches && !readDismissed()) e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
}

function subscribeDismissed(onChange: () => void): () => void {
  const off = subscribe(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === DISMISS_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    off();
    window.removeEventListener("storage", onStorage);
  };
}

function isInstalledApp(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || APP_MODES.some((q) => window.matchMedia(q).matches);
}

function subscribeDisplayMode(onChange: () => void): () => void {
  const mqs = APP_MODES.map((q) => window.matchMedia(q));
  mqs.forEach((m) => m.addEventListener("change", onChange));
  return () => mqs.forEach((m) => m.removeEventListener("change", onChange));
}

/**
 * Safari 17+ on a Mac (Add to Dock). Every other macOS browser carries its own token (Chrome, Edg,
 * Firefox, OPR, DuckDuckGo's Ddg, …); an iPad asking for the desktop site also says "Macintosh" but
 * has touch points.
 * The UA cannot tell the macOS version; the popover states the Sonoma requirement.
 */
function isMacSafariWithDock(): boolean {
  const ua = navigator.userAgent;
  if (!/Macintosh/.test(ua) || navigator.maxTouchPoints > 1) return false;
  if (/Chrome|Chromium|CriOS|FxiOS|Firefox|Edg|OPR|Opera|SamsungBrowser|Ddg\//.test(ua)) return false;
  const m = /Version\/(\d+)(?:\.\d+)*\s+Safari\//.exec(ua);
  return m !== null && Number(m[1]) >= 17;
}

const noSubscribe = () => () => {};
const promptReady = () => deferred !== null;
const labPresent = () => labCount > 0;
const onServer = { no: () => false, yes: () => true };

// ---------------------------------------------------------------------------------------------

const TAB =
  "flex w-full flex-col items-center gap-1.5 rounded-tr-md py-2.5 text-xs font-medium text-cobalt outline-none transition-colors duration-150 hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-expanded:bg-surface";

/** Lab helper: forget the 7-day dismissal. */
export function clearInstallDismissal() {
  dismissedUntil = 0;
  try {
    window.localStorage.removeItem(DISMISS_KEY);
  } catch {
    // Storage blocked: nothing was stored.
  }
  emit();
}

export function InstallApp({ force, lab = false }: { force?: InstallMode; lab?: boolean }) {
  const t = INSTALL[useLocale()];
  const forced = force !== undefined;
  const isLab = lab || forced;
  const titleId = useId();

  // Server snapshots render nothing (installed = true, dismissed = true): the control appears after
  // hydration, so server and first client render always agree.
  const hasPrompt = useSyncExternalStore(subscribe, promptReady, onServer.no);
  const labMounted = useSyncExternalStore(subscribe, labPresent, onServer.no);
  const shadowed = !isLab && labMounted;
  const installed = useSyncExternalStore(subscribeDisplayMode, isInstalledApp, onServer.yes);
  const dismissed = useSyncExternalStore(subscribeDismissed, readDismissed, onServer.yes);
  const safari = useSyncExternalStore(noSubscribe, isMacSafariWithDock, onServer.no);

  const [closedHere, setClosedHere] = useState(false); // forced lab instances only
  const [open, setOpen] = useState(false);

  // A lab instance: the layout's own instance steps aside while it is mounted.
  useEffect(() => {
    if (!isLab) return;
    labCount += 1;
    emit();
    return () => {
      labCount -= 1;
      emit();
    };
  }, [isLab]);

  // Service worker: production only (no stale dev bundles), never from the lab.
  useEffect(() => {
    if (isLab || process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Not needed for installation in current Chrome / Edge / Safari; nothing to tell the user.
    });
  }, [isLab]);

  // Installed from our button or from the browser's own entry point: confirm once.
  useEffect(() => {
    if (forced || shadowed) return;
    const onInstalled = () => toast.success(t.installed.title, { description: t.installed.description });
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, [forced, shadowed, t]);

  let mode: InstallMode;
  if (forced) mode = closedHere ? "hidden" : force;
  else if (shadowed || installed || dismissed) mode = "hidden";
  else if (hasPrompt) mode = "prompt";
  else if (safari) mode = "safari";
  else mode = "hidden";

  if (mode === "hidden") return null;

  const install = async () => {
    const ev = deferred;
    if (!ev) {
      // Lab only (forced "prompt" without a real event): play the accepted path.
      if (forced) {
        setClosedHere(true);
        toast.success(t.installed.title, { description: t.installed.description });
      }
      return;
    }
    try {
      // prompt() needs the click's user activation, so it is the first call in the handler.
      await ev.prompt();
      await ev.userChoice; // accepted -> `appinstalled` confirms; dismissed -> the button goes away
    } catch {
      toast.error(t.promptError.title, { description: t.promptError.description });
    } finally {
      // Single use either way; Chrome fires a fresh event if the site becomes installable again.
      if (deferred === ev) {
        deferred = null;
        emit();
      }
    }
  };

  const dismiss = () => {
    const wasSafari = mode === "safari";
    setOpen(false);
    if (forced) {
      setClosedHere(true);
    } else {
      writeDismissed();
      emit();
    }
    toast(t.dismissed.title, { description: wasSafari ? t.dismissed.safari : t.dismissed.chromium });
  };

  const label = (
    <>
      <MonitorDown aria-hidden className="size-3.5 shrink-0" />
      <span className="[writing-mode:vertical-rl]">
        {t.button}
        <span className="sr-only">{t.buttonSr}</span>
      </span>
    </>
  );

  return (
    <div className="contents print:hidden">
      <div
        data-install-app={mode}
        className={cn(
          "fixed bottom-16 left-0 z-40 hidden w-5 flex-col rounded-r-md border border-l-0 border-cobalt-line bg-cobalt-soft md:flex",
          "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-2 motion-safe:duration-200",
        )}
      >
        {mode === "prompt" ? (
          <button type="button" onClick={install} className={TAB}>
            {label}
          </button>
        ) : (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={TAB}>
                {label}
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="right"
              align="end"
              sideOffset={10}
              collisionPadding={16}
              aria-labelledby={titleId}
              className="w-80 gap-3 p-4 text-pretty print:hidden"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 id={titleId} className="text-[15px] leading-6 font-semibold text-ink">
                  {t.safari.title}
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={t.safari.close}
                  className="-mt-0.5 -mr-1.5 grid size-7 shrink-0 place-items-center rounded-md text-muted-ink outline-none transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X aria-hidden className="size-4" />
                </button>
              </div>
              <p className="text-sm text-muted-ink">{t.safari.intro}</p>
              {/* role="list": Safari drops list semantics from list-style:none lists. */}
              <ol role="list" className="space-y-2.5 text-sm text-ink">
                <Step n={1}>
                  <p>{t.safari.step1}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-1">
                    {t.safari.menuPath.map((item, i) => (
                      <Fragment key={item}>
                        {i > 0 && (
                          <>
                            <ChevronRight aria-hidden className="size-3 text-muted-ink" />
                            <span className="sr-only"> &gt; </span>
                          </>
                        )}
                        <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-xs font-medium text-ink">
                          {item}
                        </kbd>
                      </Fragment>
                    ))}
                  </p>
                </Step>
                <Step n={2}>{t.safari.step2}</Step>
                <Step n={3}>{t.safari.step3}</Step>
              </ol>
              <div className="space-y-1 border-t border-line pt-3 text-xs text-muted-ink">
                <p>{t.safari.share}</p>
                <p>{t.safari.requirement}</p>
              </div>
            </PopoverContent>
          </Popover>
        )}
        <span aria-hidden className="mx-1 h-px bg-cobalt-line" />
        <button
          type="button"
          onClick={dismiss}
          aria-label={t.dismiss}
          title={t.dismiss}
          className="grid h-7 w-full place-items-center rounded-br-md text-muted-ink outline-none transition-colors duration-150 hover:bg-surface hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <X aria-hidden className="size-3" />
        </button>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span
        aria-hidden
        className="grid size-5 shrink-0 place-items-center rounded-full bg-cobalt-soft text-xs font-semibold text-cobalt tabular-nums"
      >
        {n}
      </span>
      <div className="min-w-0 pt-px">{children}</div>
    </li>
  );
}
