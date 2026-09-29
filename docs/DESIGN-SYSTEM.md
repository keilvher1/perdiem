# PerDiem design system

Concept: an **authority-management finance console with a verifiable decision ledger**. Message:
**"The AI pays. You hold the authority."** (ko "결제는 AI가. 권한은 당신이.", ja "支払いはAIが。権限はあなたが。",
zh "支付交给 AI。权限握在你手中。", key `t.ui.shell.message`). A quiet cool page, white surfaces, ink text; the
strong signals are typography, alignment and the cobalt selection. Source brief: the redesign proposal
(2026-09-29). Every shared piece is rendered with fixture data at **`/design`** (development only; a 404 in
production builds).

Presentation only: nothing here changes the API, the policy engine, the chain code or the records.
Values on screen are what the API returns or exact derivations of it; nothing is invented.

## 1. Tokens (`app/globals.css`)

Hex values live in `:root` (light) and `.dark` (screen only). Tailwind classes come from `@theme inline`.
The shadcn variables are mapped onto the same palette, so `components/ui/*` follow without edits.

| Token | Tailwind | Light | Dark | Use |
|---|---|---|---|---|
| `--background` | `bg-page` / `bg-background` | `#F1F3F5` | `#0D131A` | page |
| `--surface` | `bg-surface` (= `bg-card`) | `#FFFFFF` | `#141C25` | panels, header |
| `--surface-2` | `bg-surface-2` | `#F7F8FA` | `#19222D` | table heads, hover, chips |
| `--ink` | `text-ink` | `#14202E` | `#E6EAF0` | text, solid bar |
| `--muted-ink` | `text-muted-ink` | `#556172` | `#9BA7B6` | secondary text, labels |
| `--line` / `--line-strong` | `border-line` / `border-line-strong` | `#DADFE5` / `#C2C9D2` | `#27313D` / `#394553` | dividers / dashed and secondary edges (not control boundaries) |
| `--input` | `border-input` | `#7D8796` | `#627080` | boundary of form controls (inputs, select triggers, checkboxes, unchecked switch): ≥ 3:1 |
| `--cobalt` (+ `-soft`, `-line`) | `text-cobalt`, `bg-cobalt-soft` | `#214FDB` | `#86A2FF` | brand, links, **selection** |
| `--primary` | `bg-primary` | `#214FDB` | `#3F66E6` | filled buttons (white label) |
| `--approve` (+ `-soft`, `-line`) | `text-approve` … | `#146949` | `#58C99F` | approval, settled, match |
| `--stop` (+ `-soft`, `-line`) | `text-stop` … | `#865215` | `#E3A95E` | **rule-based stop only** |
| `--pending` (+ `-soft`, `-line`) | `text-pending` … | `#3B5387` | `#9CB0DE` | broadcast not mined, running, not started |
| `--danger` (+ `-soft`, `-line`) | `text-danger` … | `#B42318` | `#F58F86` | errors, failed payment, verification mismatch |
| `--unverified` (+ `-soft`, `-line`) | `text-unverified` … | `#5A6573` | `#9BA7B6` | not run / cannot verify (dashed) |
| `--ring` | `ring-ring` / `outline-ring` | `#214FDB` | `#86A2FF` | focus |

Rules: amber is never an error; red is never a rule stop. Colour never stands alone: every state is glyph +
label (+ an sr-only family name). Do not add `zinc-*`, `indigo-*`, `rose-*`, `bg-white` in new code: use the
tokens so dark mode and print work.

**Radius**: `rounded-md` 4 px and `rounded-lg` 6 px for buttons and chips, `rounded-lg`/`rounded-xl` 6–8 px for
panels (`--radius: 6px`; `rounded-2xl`+ are capped at 8 px). **Motion**: 150–220 ms (`duration-150`,
`duration-200`, default transition 160 ms, `ease-standard`); `prefers-reduced-motion` cuts every transition
and animation to one frame globally. No decorative live effects (no spinners for pending: a static clock).
**Print**: always the light palette (`.dark` tokens and `dark:` utilities are screen-only), A4 margins.

### Contrast (WCAG 2.x, `node docs/contrast-check.mjs`, reads the hex values above)

Body text needs 4.5:1; UI glyphs, focus rings, control boundaries and control fills 3:1. State glyphs use
their text colour, so the text rows cover them. The script exits 1 if any pair fails.

Focus: shadcn components (`components/ui`, all carry `data-slot`) draw a 3 px halo; an unlayered rule in
`app/globals.css` raises it from 50 % to 75 % of `--ring` (≥ 3.6:1 on every surface; at 50 % it was 2.3:1 and
invisible around a filled cobalt button). Own components use `focus-visible:ring-2 focus-visible:ring-ring`,
or for an outline `focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring` — with
`outline-none` on the element, `outline-2` alone draws nothing (Tailwind 4 `outline-none` zeroes
`--tw-outline-style`).

| Pair | Light fg / bg | Light | Dark fg / bg | Dark | Min | Result |
|---|---|---:|---|---:|---:|---|
| ink text on background | #14202e / #f1f3f5 | 14.80 | #e6eaf0 / #0d131a | 15.46 | 4.5 | pass |
| ink text on surface | #14202e / #ffffff | 16.46 | #e6eaf0 / #141c25 | 14.23 | 4.5 | pass |
| ink text on surface-2 | #14202e / #f7f8fa | 15.49 | #e6eaf0 / #19222d | 13.30 | 4.5 | pass |
| ink text on cobalt-soft | #14202e / #ebf0fd | 14.43 | #e6eaf0 / #1b2849 | 12.02 | 4.5 | pass |
| muted-ink text on background | #556172 / #f1f3f5 | 5.65 | #9ba7b6 / #0d131a | 7.64 | 4.5 | pass |
| muted-ink text on surface | #556172 / #ffffff | 6.29 | #9ba7b6 / #141c25 | 7.03 | 4.5 | pass |
| muted-ink text on surface-2 | #556172 / #f7f8fa | 5.92 | #9ba7b6 / #19222d | 6.57 | 4.5 | pass |
| muted-ink text on cobalt-soft | #556172 / #ebf0fd | 5.51 | #9ba7b6 / #1b2849 | 5.94 | 4.5 | pass |
| cobalt text on background | #214fdb / #f1f3f5 | 5.89 | #86a2ff / #0d131a | 7.67 | 4.5 | pass |
| cobalt text on surface | #214fdb / #ffffff | 6.55 | #86a2ff / #141c25 | 7.06 | 4.5 | pass |
| cobalt text on surface-2 | #214fdb / #f7f8fa | 6.16 | #86a2ff / #19222d | 6.59 | 4.5 | pass |
| cobalt text on cobalt-soft | #214fdb / #ebf0fd | 5.74 | #86a2ff / #1b2849 | 5.96 | 4.5 | pass |
| approve text on background | #146949 / #f1f3f5 | 6.00 | #58c99f / #0d131a | 9.13 | 4.5 | pass |
| approve text on surface | #146949 / #ffffff | 6.67 | #58c99f / #141c25 | 8.40 | 4.5 | pass |
| approve text on surface-2 | #146949 / #f7f8fa | 6.28 | #58c99f / #19222d | 7.85 | 4.5 | pass |
| approve text on cobalt-soft | #146949 / #ebf0fd | 5.85 | #58c99f / #1b2849 | 7.10 | 4.5 | pass |
| stop text on background | #865215 / #f1f3f5 | 5.84 | #e3a95e / #0d131a | 8.98 | 4.5 | pass |
| stop text on surface | #865215 / #ffffff | 6.50 | #e3a95e / #141c25 | 8.26 | 4.5 | pass |
| stop text on surface-2 | #865215 / #f7f8fa | 6.12 | #e3a95e / #19222d | 7.72 | 4.5 | pass |
| stop text on cobalt-soft | #865215 / #ebf0fd | 5.70 | #e3a95e / #1b2849 | 6.99 | 4.5 | pass |
| pending text on background | #3b5387 / #f1f3f5 | 6.81 | #9cb0de / #0d131a | 8.60 | 4.5 | pass |
| pending text on surface | #3b5387 / #ffffff | 7.57 | #9cb0de / #141c25 | 7.92 | 4.5 | pass |
| pending text on surface-2 | #3b5387 / #f7f8fa | 7.13 | #9cb0de / #19222d | 7.40 | 4.5 | pass |
| pending text on cobalt-soft | #3b5387 / #ebf0fd | 6.64 | #9cb0de / #1b2849 | 6.69 | 4.5 | pass |
| danger text on background | #b42318 / #f1f3f5 | 5.91 | #f58f86 / #0d131a | 8.14 | 4.5 | pass |
| danger text on surface | #b42318 / #ffffff | 6.57 | #f58f86 / #141c25 | 7.49 | 4.5 | pass |
| danger text on surface-2 | #b42318 / #f7f8fa | 6.19 | #f58f86 / #19222d | 7.00 | 4.5 | pass |
| danger text on cobalt-soft | #b42318 / #ebf0fd | 5.76 | #f58f86 / #1b2849 | 6.33 | 4.5 | pass |
| unverified text on background | #5a6573 / #f1f3f5 | 5.33 | #9ba7b6 / #0d131a | 7.64 | 4.5 | pass |
| unverified text on surface | #5a6573 / #ffffff | 5.93 | #9ba7b6 / #141c25 | 7.03 | 4.5 | pass |
| unverified text on surface-2 | #5a6573 / #f7f8fa | 5.58 | #9ba7b6 / #19222d | 6.57 | 4.5 | pass |
| unverified text on cobalt-soft | #5a6573 / #ebf0fd | 5.20 | #9ba7b6 / #1b2849 | 5.94 | 4.5 | pass |
| approve text on approve-soft | #146949 / #e7f2ed | 5.82 | #58c99f / #0f2b23 | 7.39 | 4.5 | pass |
| stop text on stop-soft | #865215 / #f9f0e3 | 5.76 | #e3a95e / #2f2311 | 7.38 | 4.5 | pass |
| pending text on pending-soft | #3b5387 / #ecf0f7 | 6.63 | #9cb0de / #1a233a | 7.19 | 4.5 | pass |
| danger text on danger-soft | #b42318 / #fcedeb | 5.78 | #f58f86 / #361a1c | 6.93 | 4.5 | pass |
| unverified text on unverified-soft | #5a6573 / #eef0f3 | 5.19 | #9ba7b6 / #1d252f | 6.33 | 4.5 | pass |
| ink text on approve-soft | #14202e / #e7f2ed | 14.36 | #e6eaf0 / #0f2b23 | 12.51 | 4.5 | pass |
| muted-ink text on approve-soft | #556172 / #e7f2ed | 5.49 | #9ba7b6 / #0f2b23 | 6.18 | 4.5 | pass |
| ink text on stop-soft | #14202e / #f9f0e3 | 14.58 | #e6eaf0 / #2f2311 | 12.70 | 4.5 | pass |
| muted-ink text on stop-soft | #556172 / #f9f0e3 | 5.57 | #9ba7b6 / #2f2311 | 6.28 | 4.5 | pass |
| ink text on pending-soft | #14202e / #ecf0f7 | 14.40 | #e6eaf0 / #1a233a | 12.93 | 4.5 | pass |
| muted-ink text on pending-soft | #556172 / #ecf0f7 | 5.50 | #9ba7b6 / #1a233a | 6.39 | 4.5 | pass |
| ink text on danger-soft | #14202e / #fcedeb | 14.46 | #e6eaf0 / #361a1c | 13.16 | 4.5 | pass |
| muted-ink text on danger-soft | #556172 / #fcedeb | 5.53 | #9ba7b6 / #361a1c | 6.51 | 4.5 | pass |
| ink text on unverified-soft | #14202e / #eef0f3 | 14.42 | #e6eaf0 / #1d252f | 12.81 | 4.5 | pass |
| muted-ink text on unverified-soft | #556172 / #eef0f3 | 5.51 | #9ba7b6 / #1d252f | 6.33 | 4.5 | pass |
| primary-foreground on primary (button label) | #ffffff / #214fdb | 6.55 | #ffffff / #3f66e6 | 4.94 | 4.5 | pass |
| foreground on popover | #14202e / #ffffff | 16.46 | #e6eaf0 / #19222d | 13.30 | 4.5 | pass |
| primary (button fill) vs background | #214fdb / #f1f3f5 | 5.89 | #3f66e6 / #0d131a | 3.78 | 3 | pass |
| ring (focus) vs background | #214fdb / #f1f3f5 | 5.89 | #86a2ff / #0d131a | 7.67 | 3 | pass |
| ring (focus) vs surface | #214fdb / #ffffff | 6.55 | #86a2ff / #141c25 | 7.06 | 3 | pass |
| ring (focus) vs cobalt-soft (selected row) | #214fdb / #ebf0fd | 5.74 | #86a2ff / #1b2849 | 5.96 | 3 | pass |
| cobalt selected rule vs cobalt-soft | #214fdb / #ebf0fd | 5.74 | #86a2ff / #1b2849 | 5.96 | 3 | pass |
| input (control boundary) vs surface | #7d8796 / #ffffff | 3.63 | #627080 / #141c25 | 3.39 | 3 | pass |
| input (control boundary) vs surface-2 | #7d8796 / #f7f8fa | 3.42 | #627080 / #19222d | 3.17 | 3 | pass |
| input (control boundary) vs background | #7d8796 / #f1f3f5 | 3.27 | #627080 / #0d131a | 3.69 | 3 | pass |
| primary (button fill) vs surface | #214fdb / #ffffff | 6.55 | #3f66e6 / #141c25 | 3.48 | 3 | pass |
| focus halo (ring @ 75%) vs background | #5578e2 / #f1f3f5 | 3.65 | #687ec6 / #0d131a | 4.79 | 3 | pass |
| focus halo (ring @ 75%) vs surface | #597be4 / #ffffff | 3.90 | #6a81c9 / #141c25 | 4.58 | 3 | pass |
| focus halo (ring @ 75%) vs surface-2 | #5779e3 / #f7f8fa | 3.76 | #6b82cb / #19222d | 4.34 | 3 | pass |

61 of 61 pairs pass.

## 2. Type

Pretendard (npm `pretendard@1.3.9`, the dynamic-subset variable build self-hosted from `node_modules`,
imported in `app/layout.tsx`) for English and Korean; Japanese (`[lang|=ja]`) leads with Hiragino Sans /
Hiragino Kaku Gothic ProN / Noto Sans JP and Chinese (`[lang|=zh]`) with PingFang SC / Microsoft YaHei / Noto
Sans SC, Pretendard after. Korean (`[lang|=ko]`) uses `word-break: keep-all` (breaks between words, never
inside one; an over-long word still wraps). Monospace only for hashes and ids (abbreviated + full value in a
tooltip + copy: `HashChip`, `CopyButton`) and stop codes; never for money, dates, keywords or prose (an
observed / limit value next to a `[CODE]` is sans with `tabular-nums`).

| Utility | Size | Use |
|---|---|---|
| `type-page-title` | 24 px → 30 px (≥ md) | page `<h1>` (`PageHeader` uses it) |
| `type-section` | 18 px | section headings |
| `type-amount` | 32 px → 40 px (≥ md), tabular | the one key amount of a screen |
| `type-amount-sm` | 20 px, tabular | secondary amounts |
| `type-body` | 15 px / 1.6 | reading text (UI default stays 14 px) |
| `type-label` | 12 px medium | eyebrows, field labels |
| `type-id` | 12 px mono | hashes, ids |

Money: always `fmtUsd` (USD, the policy's exact format), right-aligned with `tabular-nums`. Dates and
integers: `useFmt()`. Stop reasons: `localizeReason(reason, locale)`.

## 3. Theme

`next-themes` (`components/perdiem/theme-provider.tsx`): `attribute="class"`, `defaultTheme="light"`,
`enableSystem`, storage key `perdiem-theme`. Header menu Light / Dark / System (`ThemeSwitcher`). Light is the
default (the demo video is filmed in light). The Sonner toaster follows the theme. Every screen is on
the tokens (no `zinc-*`, `slate-*`, `indigo-*`, `emerald-*`, `rose-*`, `amber-*`, `gray-*`, `bg-white` or
`text-white` in `app/` or `components/perdiem/`); a new screen must be checked in light and dark, at 1440 and
390 px, in all four languages.

## 4. State families (`lib/ui-state.ts`)

Four families, never merged: a valid mandate is not an approval, an approval is not a settlement, a
settlement is not "verified" until a check ran. Labels: `t.ui.state[family][state]`; one-line meaning:
`t.ui.hint[family][state]` (the badge tooltip).

| Family | State | Label (en) | Tone | Glyph |
|---|---|---|---|---|
| authority | `active` | Active | cobalt | ◉ dot-ring |
| | `paused` | Paused | ink | ‖ pause |
| | `revoked` | Revoked (final) | ink | ⊘ slash |
| | `expired` | Expired | unverified | ⊖ minus |
| | `scheduled` | Not started | pending | ◷ clock |
| decision | `approve` | Approved | approve | ● circle |
| | `stop` | Stopped | stop (amber) | ■ square |
| execution (approvals only) | `approved` | Not sent yet | approve | ○ ring |
| | `pending` | Pending | pending | ◷ clock |
| | `settled` | Settled | approve | ● with check |
| | `failed` | Failed | danger | ▲ triangle |
| verification | `not_run` | Not run | unverified | ◌ dashed |
| | `running` | Running | pending | ◐ half (static) |
| | `match` | Match | approve | ● with check |
| | `mismatch` | Mismatch | danger | ▲ triangle |
| | `unverifiable` | Can't verify | unverified | dashed + slash |

Helpers: `authorityState(m, now)` (paused / revoked win, then the trip window; same rule as
`effectiveMandateStatus`), `decisionState(entry)`, `executionState(entry)` (null for a stop: nothing was sent),
`verificationState(result, { running, verifiable })` (undefined/null result = `not_run`, never a pass).

Budget facts (`lib/view.ts`): spent = Σ total of approved | pending | settled; pending ⊂ spent; remaining =
budget − spent. **Pending is already reserved** (inside spent, already out of remaining); a failed payment
does not count.

Control facts: pause / resume / revoke (`PATCH /api/mandates/[id]`) take the same per-mandate lock as
`POST /api/chat`, so once they return no in-flight purchase still sees the old status. They stop **new**
requests; they never cancel a transaction already broadcast. Revoke is final: a later pause or resume is
refused (409).

## 5. Rule checks (`lib/rule-checks.ts`)

`deriveRuleChecks(entry, locale)` returns the 12 checks of `lib/policy.ts evaluate()` in evaluation order,
each `passed | failed | not_evaluated`, from the recorded entry alone: a code in `entry.reasons` failed;
`MERCHANT_NOT_ALLOWED` and `CATEGORY_NOT_ALLOWED` are not evaluated when `UNKNOWN_MERCHANT` failed,
`OVER_BUDGET_WITH_FEES` when `FEE_UNAVAILABLE` failed; every other check passed at decision time (an approval
passed all 12). Failed checks carry the localized reason. This reads the record; it is not a verification
(the audit replay re-runs the policy). `tests/rule-checks.test.ts` proves the derivation against the real
`evaluate()` over 5,000 generated requests.

Fee caveat: `evaluate()` records fee 0 when the fee is unknown (`FEE_UNAVAILABLE`), and `lib/agent.ts` passes
fee 0 with `feeSource: "none"` for an unknown merchant (so a live unknown-merchant stop has no
`FEE_UNAVAILABLE` and its fee check reads "passed" with "— (none)"). Neither 0 is a real fee: show the
fee as unknown / "— (none)" and the total as "amount only", never "$0.00" (`EvidencePanel`, `LedgerTable` and
the printable statement do).

## 6. Components (`components/perdiem/`)

| Component | Props | Notes |
|---|---|---|
| `StateBadge` | `family`, `state`, `size?: "sm" \| "md"`, `variant?: "soft" \| "plain"` | glyph + label + sr-only "Decision: …" |
| `StateGlyph` | `glyph`, `className` | 12×12 SVG in `currentColor`, aria-hidden |
| `AuthoritySummary` | `mandate` (id, traveler, principal, status, window), `now`, `actions?`, `headingLevel?` | authority badge, window, deadline; `actions` slot for pause / resume / revoke; 4 columns from a 48rem container |
| `RuleSummary` | `mandate` (terms + catalog), `defaultOpen?`, `headingLevel?: 2 \| 3` (default 3) | one line (budget · cap · N merchants · categories · window) + full list (merchants by name, blocked keywords); label column from a 32rem container |
| `BudgetBreakdown` | `budget` (`budgetUsd`, `spentUsd`, `pendingUsd`, `remainingUsd`) | remaining as the key amount; spent = approved-or-settled (solid) + pending (hatched, "already reserved"); 3 columns from a 32rem container |
| `DecisionLedger` | `entries` (oldest first), `selectedId`, `onSelect`, `now?`, `order?`, `filter?`/`onFilterChange?`/`defaultFilter?`, `loading?`, `label?`, `maxHeightClass?`, `ref` (`focusSelected()`) | filters All / Approved / Stopped / Pending with counts; single-select listbox, roving tabindex, ↑ ↓ Home End Enter/Space; layout follows its own width (container queries) |
| `EvidencePanel` | `entry`, `mandate?` (terms + `id?` + `hash?`; `MandateDetail` fits), `onBack?`, `backClassName?`, `headingRef?` | 1 decision + reason → 2 the 12 checks (requested vs allowed) → 3 raw evidence (tx + Etherscan, receipt and mandate hash, JSON collapsed); same selected marker as the row; one polite live region (mounted even when empty). Allowed values are used only when `mandate.id` (if given) is the entry's and `mandate.hash` (if given) equals `entry.mandateHash`; a different hash shows a red "Mismatch" note |
| `DecisionWorkspace` | `entries`, `mandate?`, `selectedId`, `onSelect`, `now?`, `ledgerProps?`, `stickyTopClass?`, `panelMaxHeightClass?`, `ref?` (`DecisionWorkspaceHandle`: `showDetail()`) | ledger + panel: adjacent sticky column ≥ lg, stacked detail view with "Back to ledger" below lg (focus moves in and back). Mounted with a `selectedId` (a `?d=` link) the stacked view starts open, without moving focus; `showDetail()` opens it (and focuses the panel heading) for a selection made elsewhere, e.g. a receipt's "Open evidence" |
| `ThemeSwitcher`, `LocaleSwitcher`, `HealthBadge`, `MandateSelector`, `AppShell`, `SiteFooter` | — | the console shell |
| `StatusPill` (legacy) | `status` | same tones and glyphs as the state model; new code uses `StateBadge` |
| `LedgerTable` | `entries` (oldest first), `now`, `caption?`, `selectedId?`, `className?`, `maxHeightClass?`; also exports `countPayments(entries)` | the **payments** register on /principal: approved entries only (stops send nothing), newest first; execution state, fee as recorded (+ actual once mined), total, tx and receipt hashes. A feeSource "none" row shows fee "—" and the total as "amount only". Rows are not interactive (select in the DecisionLedger); the selected decision's row carries the selected marker |
| `ReceiptCard` | `entry`, `terms?` (used only when id and hash match), `budgetNow?`, `onOpenEvidence?`, `selected?`, `className?` | the traveler's structured receipt: decision → reason and what to change → payment state; `<article aria-label="Receipt <id>: …">` (capture hook) |
| `EvidenceFab` (drawer), `EvidenceActions` | mounted by `AppShell` | "This decision" (the page's `?d=`, opening the page's own panel or `/audit/<id>?d=`), the mandate's records, download and "Run checks" (not run → running → match / mismatch / can't verify per scope). `[data-evidence-fab]` is the capture hook |

Selection: the parent owns `selectedId`, and it lives in the URL as `?d=<ledger entry id>` next to `?m=`
(principal, audit and traveler keep them in sync with `router.replace(…, { scroll: false })` and keep every
other param; changing the mandate drops `?d=`). Links between screens carry `?m=` and, for a decision,
`?d=`. The selected row and the panel header share the `selected-marker` utility (cobalt left rule +
cobalt-soft background). Requested vs allowed values come only from the entry, the mandate terms, or the
recorded reason's observed / limit; "—" when the data does not say.

Sticky header: `html { scroll-padding-top }` (10.5rem below sm, 7.5rem from sm; `app/globals.css`) keeps
whatever focus, `scrollIntoView()` or an anchor brings into view clear of the app header. Pages do not add
their own `scroll-mt-*` for it.

## 7. Layout rules

- Reading order everywhere: **decision → reason → rule comparison → raw evidence**.
- Approvals and stops get equal weight: same row height, same badge size, same panel structure. A stop is a
  normal outcome (amber square), not an error (red triangle).
- Divide with lines and alignment; do not box every block. Give the authority summary, the ledger and the
  evidence panel different weights.
- Desktop: the evidence panel is the column next to the ledger. Mobile: a stacked detail view with a back
  control; the list keeps its place.
- Mobile order per role: **Principal** authority → budget and pending → key actions → decision ledger.
  **Traveler** the current request's decision → reason and what to change → request input. **Audit** scope and
  results → mismatch or the selected decision → evidence.
- Pause / revoke confirmations state what the backend does (section 4) and promise nothing else.
- Verification never shows a pass before a check actually ran (`not_run` is the initial state).

## 8. i18n

All shared copy is in the `ui` namespace (`lib/i18n/messages/ui.ts`), en / ko / ja / zh (en is the
reference; the others are typed `typeof en`). Glossary: Principal 위임자 / 委任者 / 委托方, Traveler 출장자 /
出張者 / 出差人, mandate 위임 / 委任 / 授权, approved 승인 / 承認 / 批准, stopped 중단 / 停止 / 已拦截, pending 대기 /
保留中 / 待确认, settled 정산 완료 / 決済完了 / 已结算, ledger 장부 / 台帳 / 账本, evidence 증빙 / 証跡 / 证据.
