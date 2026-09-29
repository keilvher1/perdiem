#!/usr/bin/env node
/**
 * docs/contrast-check.mjs — WCAG 2.x contrast of the PerDiem palette, read from app/globals.css.
 *
 *   node docs/contrast-check.mjs          # prints the Markdown table used in docs/DESIGN-SYSTEM.md
 *
 * Reads the hex tokens of the light block (:root) and the dark block (.dark) and checks every
 * text/background pair a state token is drawn on. Body text needs 4.5:1, UI glyphs, focus rings
 * and control boundaries 3:1 (a state glyph is drawn in its text colour, so the text rows cover it).
 * Exit code 1 when any pair fails. No dependencies, no network.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../app/globals.css"), "utf8");

/** The body of the first `{ … }` block that follows `selector` (first occurrence). */
function block(selector) {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf("{", start);
  let depth = 1;
  let i = open + 1;
  for (; i < css.length && depth > 0; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
  }
  return css.slice(open + 1, i - 1);
}

function tokens(body) {
  const out = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2].toLowerCase();
  return out;
}

const light = tokens(block(":root {"));
const dark = { ...light, ...tokens(block(".dark {")) };

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** `fg` at `alpha` composited over `bg` (sRGB), as a hex colour. */
function over(fg, bg, alpha) {
  const ch = (hex, i) => parseInt(hex.slice(i, i + 2), 16);
  return `#${[1, 3, 5]
    .map((i) => Math.round(ch(fg, i) * alpha + ch(bg, i) * (1 - alpha)).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Alpha of the shadcn focus halo, set by the `[data-slot]:focus-visible` rule in app/globals.css. */
const FOCUS_HALO_ALPHA = 0.75;

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const UI = 3;
const STATES = ["cobalt", "approve", "stop", "pending", "danger", "unverified"];

/** [label, foreground token, background token, minimum] */
const pairs = [];
for (const fg of ["ink", "muted-ink", ...STATES]) {
  for (const bg of ["background", "surface", "surface-2", "cobalt-soft"]) pairs.push([`${fg} text on ${bg}`, fg, bg, TEXT]);
}
for (const s of STATES.filter((x) => x !== "cobalt")) pairs.push([`${s} text on ${s}-soft`, s, `${s}-soft`, TEXT]);
// Body copy inside tinted blocks (stop reasons, error banners, selected rows).
for (const s of STATES.filter((x) => x !== "cobalt")) {
  pairs.push([`ink text on ${s}-soft`, "ink", `${s}-soft`, TEXT]);
  pairs.push([`muted-ink text on ${s}-soft`, "muted-ink", `${s}-soft`, TEXT]);
}
pairs.push(["primary-foreground on primary (button label)", "primary-foreground", "primary", TEXT]);
pairs.push(["foreground on popover", "popover-foreground", "popover", TEXT]);
pairs.push(["primary (button fill) vs background", "primary", "background", UI]);
pairs.push(["ring (focus) vs background", "ring", "background", UI]);
pairs.push(["ring (focus) vs surface", "ring", "surface", UI]);
pairs.push(["ring (focus) vs cobalt-soft (selected row)", "ring", "cobalt-soft", UI]);
pairs.push(["cobalt selected rule vs cobalt-soft", "cobalt", "cobalt-soft", UI]);
// Form-control boundaries (inputs, select triggers, checkboxes, unchecked switch track).
for (const bg of ["surface", "surface-2", "background"]) pairs.push([`input (control boundary) vs ${bg}`, "input", bg, UI]);
pairs.push(["primary (button fill) vs surface", "primary", "surface", UI]);
// The shadcn focus halo is the ring colour at FOCUS_HALO_ALPHA over whatever is around the control.
for (const bg of ["background", "surface", "surface-2"]) {
  pairs.push([`focus halo (ring @ ${FOCUS_HALO_ALPHA * 100}%) vs ${bg}`, { halo: "ring" }, bg, UI]);
}

let failed = 0;
const rows = pairs.map(([label, fgSpec, bg, min]) => {
  const fgOf = (theme) =>
    typeof fgSpec === "string" ? theme[fgSpec] : over(theme[fgSpec.halo], theme[bg], FOCUS_HALO_ALPHA);
  const [lf, df] = [fgOf(light), fgOf(dark)];
  const l = ratio(lf, light[bg]);
  const d = ratio(df, dark[bg]);
  const ok = l >= min && d >= min;
  if (!ok) failed += 1;
  return `| ${label} | ${lf} / ${light[bg]} | ${l.toFixed(2)} | ${df} / ${dark[bg]} | ${d.toFixed(2)} | ${min} | ${ok ? "pass" : "FAIL"} |`;
});

console.log("| Pair | Light fg / bg | Light | Dark fg / bg | Dark | Min | Result |");
console.log("|---|---|---:|---|---:|---:|---|");
for (const r of rows) console.log(r);
console.log(`\n${pairs.length - failed} of ${pairs.length} pairs pass.`);
process.exit(failed ? 1 : 0);
