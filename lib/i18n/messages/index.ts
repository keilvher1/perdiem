/**
 * All UI copy, one module per namespace (each module holds every language, so one owner edits
 * one file). `Messages` is the English shape; every other language must match it.
 */
import type { Locale } from "../config";
import * as audit from "./audit";
import * as common from "./common";
import * as evidence from "./evidence";
import * as fx from "./fx";
import * as ledger from "./ledger";
import * as metrics from "./metrics";
import * as principal from "./principal";
import * as receipt from "./receipt";
import * as shell from "./shell";
import * as stop from "./stop";
import * as traveler from "./traveler";
import * as ui from "./ui";

const NAMESPACES = {
  common,
  shell,
  principal,
  ledger,
  traveler,
  receipt,
  stop,
  audit,
  metrics,
  evidence,
  fx,
  ui,
} as const;

export type Messages = {
  [K in keyof typeof NAMESPACES]: (typeof NAMESPACES)[K]["en"];
};

function build(locale: Locale): Messages {
  const out = {} as Record<string, unknown>;
  for (const [name, mod] of Object.entries(NAMESPACES)) out[name] = mod[locale];
  return out as Messages;
}

export const MESSAGES: Record<Locale, Messages> = {
  en: build("en"),
  ko: build("ko"),
  ja: build("ja"),
  zh: build("zh"),
};
