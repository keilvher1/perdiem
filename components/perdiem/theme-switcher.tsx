"use client";

import { useSyncExternalStore, type ComponentType, type SVGProps } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/provider";

const THEMES = ["light", "dark", "system"] as const;
type ThemeChoice = (typeof THEMES)[number];

const ICONS: Record<ThemeChoice, ComponentType<SVGProps<SVGSVGElement>>> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const noop = () => () => {};

/** False on the server and during hydration, true after: the stored theme is only known then. */
function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

function isThemeChoice(v: unknown): v is ThemeChoice {
  return typeof v === "string" && (THEMES as readonly string[]).includes(v);
}

/** Header theme menu: Light (default) / Dark / System. Stored per browser by next-themes. */
export function ThemeSwitcher() {
  const t = useT();
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  // Until mounted the stored choice is unknown; show the default so server and client markup agree.
  const value: ThemeChoice = mounted && isThemeChoice(theme) ? theme : "light";
  const Icon = ICONS[value];
  return (
    <Select value={value} onValueChange={(v) => isThemeChoice(v) && setTheme(v)}>
      <SelectTrigger size="sm" aria-label={t.ui.theme.label} className="bg-surface text-xs text-ink">
        <SelectValue>
          <Icon aria-hidden className="size-3.5 text-muted-ink" />
          <span className="max-md:sr-only">{t.ui.theme[value]}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        {THEMES.map((k) => {
          const ItemIcon = ICONS[k];
          return (
            <SelectItem key={k} value={k} className="text-sm">
              <ItemIcon aria-hidden className="size-3.5" />
              {t.ui.theme[k]}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
