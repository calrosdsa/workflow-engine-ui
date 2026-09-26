# Design — App Builder

A locked design system for this app. Every page redesign reads this file
before emitting code. Do not regenerate per page — extend or amend this file
when the system needs to grow.

**This file (`DESIGN.md`) is the single, current design system. There is no
second design doc.** On 2026-08-29 it replaced a prior light system called
"The Instrument Panel" — replaced *in place*, in this same file. Earlier
revisions of this document described that replacement as though the old
system survived at a separate path, and `src/index.css` still carried the
same confusion by naming `design.md` and `DESIGN.md` as if they were two
files. They are one file: this repo is developed on a case-insensitive
filesystem and `git ls-files` tracks exactly one path. Corrected 2026-09-05.

The Instrument Panel's contents are therefore **gone**, recoverable only from
git history (`git log --follow -- DESIGN.md`) — deliberately not summarized
here, since a reconstructed-from-memory description of a superseded system
would be worse than none.

The replacement was a genuine identity change, confirmed explicitly by the
requester: RAGFlow's dark, gradient-accented DNA (studied and recorded in
full at [`../docs/design/ragflow-dna.md`](../docs/design/ragflow-dna.md))
becomes App Builder's own system, not a borrowed mechanism bolted onto the
old palette.

## Genre

modern-minimal (dev-tool / SaaS admin console — matches the genre the source
DNA itself was studied under; App Builder is a builder tool for the same
kind of technical audience RAGFlow serves).

## Macrostructure family

App Builder has exactly one page-type family — there are no marketing,
content, or public-facing pages in this codebase; every audited screen is an
authenticated builder tool. One family, several macrostructures within it,
matched to what each screen actually is:

- **Canvas/editor pages** (Form Builder, Page Builder, Dashboard Editor,
  Workflow Builder): unchanged shape from the prior system — a canvas +
  fixed right-rail split. RAGFlow's DNA has no canvas-editor analogue to
  draw from (it has no visual authoring tool), so this macrostructure is
  preserved as-is; only its color tokens change. Variation knob: rail width
  (`w-96` unchanged). The Workflow Builder keeps this shape but carries its
  own identity; see **Workflow Builder identity** below.
- **Workflow node configuration workbench:** a deliberate, canvas-editor
  exception added for the node-configuration foundation. The compact inspector
  remains rail-sized; the desktop Input / Parameters / Output workbench opens
  as a right-anchored overlay, not a layout column, so it never compresses or
  reorients the horizontal graph beneath it. Its panes may resize within that
  overlay and collapse to an explicit single-pane switcher at constrained
  widths. This is an interaction-density exception, not a new page family or
  a license to widen other editor rails.
- **List + detail pages** (Knowledge Base list/detail, App Design's tabbed
  sections): **Dashboard-Workbench** macrostructure, per the DNA's own
  system axis — a page-title header, then repeating
  `(icon + label header) → content row` sections. This is the macrostructure
  RAGFlow's own home dashboard and settings shell use, and it maps directly
  onto App Builder's own list/settings screens.
- **Settings shell** (the App Design nav + its tabs, `ApplicationDesignShell.tsx`):
  RAGFlow's **three-region settings-shell** shape (nav rail · active config ·
  searchable catalog, from the DNA's "Settings / configuration shell"
  section) — adopted directly, since App Builder's own App Design shell is
  structurally the same kind of screen (a persistent nav rail + tabbed
  content) that shell was built to hold.
- **Ingestion/detail sub-shells** (Knowledge Base detail specifically):
  RAGFlow's **four-surface dataset-ingestion shell** (Files · Retrieval
  testing · Logs · Configuration) is the target shape for a *future* Spec-ID
  build (FR-C9-001 §8 already names the 5 gaps between App Builder's current
  single-page KB detail and this shape) — **not retrofitted in this pass**.
  This redesign restyles the KB detail page's EXISTING single-page structure
  to the new token system; it does not add the four-tab structure. That
  remains a separate, larger functional change gated on FR-C9-001's own
  open decisions, not a visual-only redesign.

## Theme

**Mechanism: edit the existing shadcn/ui HSL-triplet variables in
`src/index.css`'s `:root` block in place — do not introduce a parallel
token vocabulary.** Every component in this codebase already consumes
`hsl(var(--background))`, `hsl(var(--foreground))`, `hsl(var(--card))`,
`hsl(var(--border))`, `hsl(var(--primary))`, `hsl(var(--muted-foreground))`,
etc. (space-separated `H S% L%` triplets, the shadcn/ui convention). This
redesign changes what those existing variables RESOLVE TO, using RAGFlow's
studied colors — it does not rename or duplicate them. A component that
already reads `hsl(var(--card))` correctly picks up the new dark fill with
zero changes to its own className string; only `index.css` itself needs
editing for the color layer.

**Dark-only for this pass — no toggle mechanism exists yet.** A real
constraint found while implementing: the builder shell has no light/dark
switching capability today (`main.tsx`'s own comment: "The builder shell
runs a single fixed light theme") — `.dark` exists in `index.css` only for
the SEPARATE published-app runtime's `ThemeProvider` (per-tenant theme
customization, a different system entirely, untouched by this redesign).
This redesign edits `index.css`'s `:root` block directly (the values the
builder shell actually reads) to RAGFlow's dark palette; it does not touch
`.dark`'s own values, since nothing in the builder shell ever applies that
class. A future toggle is a separate feature request — see
`ragflow-dna.md`'s own Light Mode section for the values that pass would need.

**Color mapping — RAGFlow token → this codebase's existing variable:**

| Existing variable | New value (RAGFlow source) |
|---|---|
| `--background` | `240 4% 8%` (`#161618`) |
| `--foreground` | `240 2% 97%` (`#f6f6f7`) |
| `--card` / `--popover` | `240 4% 8%` (same as background — RAGFlow's cards are flat, separation is border+shadow only) |
| `--card-foreground` / `--popover-foreground` | `240 2% 97%` |
| `--muted` | `0 0% 100% / 5%` (5% white tint — the fill-swap "selected" background) |
| `--muted-foreground` | `240 2% 71%` (`#b2b5b7`) |
| `--border` / `--input` | `0 0% 100% / 10%` (0.8px hairline, RAGFlow's own alpha) |
| `--primary` | `175 100% 37%` (`rgb(0,190,180)` — `--accent-primary`, RAGFlow's one theme-invariant accent) |
| `--primary-foreground` | `240 4% 8%` (dark text on the teal accent, matching RAGFlow's own contrast choice) |
| `--secondary` / `--accent` | `0 0% 100% / 5%` (same as `--muted` — RAGFlow doesn't distinguish secondary/muted/accent into 3 different fills) |
| `--secondary-foreground` / `--accent-foreground` | `240 2% 97%` |
| `--destructive` | `359 63% 57%` (`rgb(216,73,75)` — RAGFlow's `--state-error`) |
| `--success` | `142 46% 43%` (`rgb(59,160,92)`); light mode `142 64% 28%` (see below) |
| `--warning` | `38 89% 53%` (`rgb(250,173,20)`); light mode `32 95% 30%`, with `--warning-foreground` white |
| `--ring` | `175 100% 37%` (same as `--primary` — RAGFlow reuses one color for accent and focus) |
| `--radius` | `0.4375rem` (7px, RAGFlow's own card radius — was 0.5rem/8px) |

**Status colors in light mode (2026-09-26):** the DNA keeps `--success` and
`--warning` theme-invariant, but those shades are tuned for the dark surface:
as text on white they measure 3.3:1 and 2.1:1, under WCAG AA's 4.5:1, and ~150
places use them as text. The builder's light theme (`.light` in
`src/index.css`, set by its own theme switch) therefore redeclares them as
darker shades of the same hues, `142 64% 28%` and `32 95% 30%` (5.7:1 and
6.1:1 on white, at least 4.6:1 on their own 15% tint), with white text on
filled amber. The dark theme is unchanged. The mocked browser suite's axe
checks (`e2e/mock`) catch a regression. **Not yet the runtime:** a published
app's light mode never gets `.light` (its `ThemeProvider` sets per-tenant
variables instead), so it still inherits `:root`'s shades.

**Two gradient tokens, new — added as their own CSS custom properties,
kept as gradients, never flattened** (per the DNA's own explicit warning
that averaging a two-stop gradient into one HSL/OKLCH value destroys it):
- `--gradient-brand: linear-gradient(to left, #40ebe3, #4a51ff)` — wordmark only.
- `--gradient-upsell: linear-gradient(to right, #00beb4, #43ffa4)` — commerce/upgrade CTAs only.
  App Builder has no commerce surface today; this token is reserved, unused
  until one exists. Do not repurpose it as a second general-purpose accent.

## Workflow Builder identity — "Signal box"

**A scoped exception, added 2026-09-26 at the requester's direction** ("new
direction, in code" for the workflow editor). It applies to the Workflow
Builder page only (`WorkflowBuilderPage.tsx` and what it renders). Every other
page keeps the teal system above.

**Concept.** The editor reads as a railway interlocking mimic panel. The
workflow is a line diagram, each step is a raised station plate, the edges
are track, and a run is a train whose route lights up on the panel. Signal
lamps already mean what the run states mean, so the metaphor carries real
information: **violet = route set / selected, green = cleared (completed),
amber = caution (completed with errors, needs setup), red = failed.**

**Mechanism.** While the editor is mounted it sets `data-surface="workflow-editor"`
on `<html>`, so portalled popovers, menus and selects match the canvas.
`index.css` re-points the existing shadcn variables under
`[data-surface='workflow-editor']:not(.light)` (night) and
`[data-surface='workflow-editor'].light` (day). Both are (0,2,0), so each beats
`:root` or `.light` without either mode losing. There is no parallel
vocabulary: components keep reading `hsl(var(--card))` etc. Editor-only tokens
are `--wf-tile` (panel grid), `--wf-track` / `--wf-track-bed` (edges) and
`--wf-readout` (the readout face). All raw values stay in `index.css`.

**Palette source (2026-09-26, at the requester's direction):** the product
landing page, `app-builder-landing/styles.css` (OKLCH), converted exactly to
the HSL triplets below. Night is the landing page's own system; the landing
page has no light theme, so day is that system inverted.

| Role | Night | Day |
|---|---|---|
| Paper (`--background`) | `241 26% 6%` (landing `--paper`) | `238 33% 96%` |
| Plate (`--card`) | `241 23% 10%` (landing `--paper-raised`) | `238 100% 100%` |
| Text (`--foreground`) | `245 69% 98%` (landing `--ink`) | ink `241 23% 8%` |
| Muted text | `245 8% 70%` (landing `--muted`) | `246 7% 36%` |
| Lit route, selection, primary action (`--primary`) | violet `270 100% 71%` (landing `--accent`) | violet `271 62% 48%` |
| Green / amber / red lamps | `154 69% 45%` (landing `--success`) / `40 90% 58%` / `5 78% 68%` | `154 70% 26%` / `36 95% 27%` / `5 72% 40%` |

Computed from these token values: every lamp, accent and muted colour holds
at least 5.1:1 as text on the paper, a plate and the header strip in both
modes (lowest: day green on the header, 5.15; night violet on a plate,
5.68). Button text on the violet is at least 6:1. Re-measure if any of these
values move.

**Lamp colours are reserved for run state.** Configuration never borrows
them: node-body chips (trigger mode, message type, severity, HTTP method,
variable names) are neutral `.wf-chip`s, and a condition's true/false outputs
are told apart by fill (solid / hollow) and label, not green/red. A healthy
idle workflow shows no green or red at all.

**Lever colours = node category.** One hue per category (`--wf-lever-*`,
global in `:root` / `.light` because the picker, palette, outline and
execution logs show categories outside the canvas too). They appear only as
the plate's left strip and the icon tile (`[data-lever]` + `.wf-lever-tile`,
chosen by `leverFor()` in `node-registry.ts`), and none sits on a lamp hue.
The trigger gets its own ink lever. This replaces the per-type Tailwind
gradients (`bg-emerald-500` etc.) the registry used to paint icons with.

**Type.** Archivo (variable, self-hosted via `@fontsource-variable/archivo`,
no font CDN), with the width axis carrying the role: expanded (112%) for the
workflow's name, once; normal for titles and body; condensed caps (75–80%)
for plate labels (view tabs, node meta, inspector tabs). B612 Mono (the
Airbus cockpit-display face, `@fontsource/b612-mono`) is only for readouts:
step plates, run status, config chips, run id. Code, JSON and expression
panes keep the system mono, since B612 ships only 400/700 and dense
semibold lists turn bold in it.

**Signature: route lighting.**
- Every edge is two strokes: a bed (channel) and a core.
- Selecting a step lights its upstream route back to the trigger in the violet accent:
  the steps whose output can feed its input (`route.ts`, keyed to React
  Flow's selection so it stays lit after the config workbench closes).
- Selecting a run draws the route it took section by section, in real run
  order (or the graph's step order for runs without logs), each section in
  the lamp colour of the step it leads into. Untaken track goes dark. The
  draw-on plays once per selected run (keyed on the run id, delay fixed at
  mount), never on the status poll. Under reduced motion the route is lit
  at once.
- Precedence: run on the panel > selected step's route > selected edge
  (dashed) > hover.

**Canvas.** A square "domino tile" grid that pans with the graph (React Flow
`Background` lines, 24px), not dots. Each view tool exists once: undo/redo and
the command bar at the top; add, fit, tidy and minimap in the right rail;
zoom in the corner. Dagre lays plates out at their measured size (fallback
232×100) so the track between steps is a readable 80px.

## Runtime default theme

**Amends the boundary set above.** The Theme section's own "untouched by
this redesign" note (Dark-only for this pass) still holds for `index.css`'s
`.dark` block — this section is a separate decision, about the ONE file
that seeds a brand-new tenant app's theme before its owner ever opens the
Theme tab: `src/features/theme/default-theme.ts`'s `DEFAULT_THEME` export
(`ThemeConfig`, five color slots × light/dark, consumed by `ThemeProvider`
via `element.style.setProperty` — see that file's own doc comment). This is
intentionally its OWN identity, never the builder shell's teal — a real
tenant's CRM/ERP/etc. should not look like App Builder's own chrome.

**Why it changed:** the prior defaults were an unmodified shadcn/ui "New
York" starter — `221.2 83.2% 53.3%` primary (Tailwind's own stock blue-600),
hue-210 cool-slate neutrals, pure `0 0% 100%`/near-black surfaces. Every
un-customized shadcn scaffold ships these exact numbers; a tenant who never
opens the Theme tab shipped a visibly-unstyled default. Replaced with a
modern indigo-violet identity a real app can credibly ship as-is, following
this repo's own `color.md` Hallmark reference (tint the neutrals toward the
accent hue; no pure `#fff`/`#000`; dark-mode surfaces read *lighter* than
background, not flat/identical, per its elevation recipe).

**Values (`DEFAULT_THEME`, HSL triplets — same format as the rest of this
system, chosen directly rather than derived from OKLCH since this codebase's
theme editor round-trips hex⇄HSL, not OKLCH; see `color-utils.ts`):**

| Slot | Light | Dark |
|---|---|---|
| `primary` | `243 82% 61%` | `239 91% 74%` |
| `secondary` / `accent` | `240 25% 96%` | `240 20% 18%` |
| `background` | `240 25% 99%` | `240 22% 7%` |
| `surface` | `240 25% 99%` (= background) | `240 18% 11%` (lighter than background — elevation) |

All four `*-foreground` variables (`primary-foreground`, `secondary-foreground`,
`accent-foreground`, `foreground`, `card-foreground`) are NOT hand-picked —
`ThemeProvider` derives them per-color via `pickForeground()`'s real WCAG
contrast check against two fixed candidates, already exact for whatever
background/accent values this table sets. No change needed to that
mechanism for this palette swap.

**Scope note:** `radius` (`0.5rem`) and `shadow` (`sm`) were left unchanged —
this decision is about color only, per the request that prompted it.

## Typography

(The Workflow Builder is excepted: Archivo + B612 Mono. See § Workflow
Builder identity.)

- Display: InterVariable, weight 700 for H1-scale headings, style normal
- Body:    InterVariable, weight 400
- Mono:    ui-monospace, SFMono-Regular, Menlo, monospace (unchanged from
  the prior system — the DNA never samples a monospace surface, and
  App Builder's canvas/config panels use mono for IDs/expressions; no
  reason to invent a new mono face against no evidence)
- Display tracking: normal (0em) — the DNA shows no letter-spacing on its
  one H1 sample; weight alone carries the hierarchy, per the source's own
  "single family, weight-driven" axis.
- Type scale anchor: `--text-display` = 48px / 700 / 72px line-height (H1,
  the DNA's own exact sampled value — this is a ceiling, not a typical
  size: only page-title H1s on Dashboard-Workbench-macrostructure pages use
  it; canvas/editor pages keep their existing smaller scale, since the DNA
  never samples a canvas surface to draw a display-size precedent from)

**Single-family discipline, not a pairing.** Unlike Hallmark's default
2+1 font rule, this system keeps ONE typeface (InterVariable) for display
and body both, matching the DNA's own confirmed choice exactly. This is a
deliberate exception, grounded in direct source evidence, not a shortcut.

## Spacing

Tailwind's default spacing scale (`p-1`/`gap-2`/`space-y-4`/etc.), unchanged
from the prior system — the DNA never contradicts this scale or introduces
its own named spacing tokens (RAGFlow's own spacing is expressed as
Tailwind utility values too, per `ragflow-dna.md`'s own sampled classNames
like `px-4 py-3`, `gap-2`). No new spacing tokens needed; keep using
Tailwind utilities directly as this codebase already does.

## Motion

- Easings: `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` (Hallmark's standard
  exponential ease-out — the DNA's own nav-pill motion is an unscoped
  `transition-all`, explicitly flagged in `ragflow-dna.md`'s own Notes
  section as an anti-pattern to narrow, not copy verbatim)
- Reveal pattern: none — this is an authenticated admin tool, not a
  marketing page; matches both the prior system's stance and the DNA's own
  ("no scroll-triggered reveals observed... nothing needs to arrive")
- Reduced-motion fallback: opacity-only, ≤150ms, for the one real animated
  element in this system (the sliding nav pill)

## Microinteractions stance

- Silent success on trivial saves (a value the user can already see saved
  doesn't need a toast) — inherited from the prior system, unchanged; the
  DNA offers no counter-evidence (RAGFlow's own dialogs use a plain "Save"
  button with no visible success-toast pattern sampled).
- Hover delay 800ms · focus delay 0ms on tooltips (unchanged, universal
  Hallmark rule, no DNA conflict).
- **The sliding-pill nav mechanism has shipped, scoped exactly where the DNA
  itself uses it — and nowhere else.** `ApplicationDesignShell.tsx`'s
  top-level nav (Dashboard/Workflows/Forms/App Design/Settings) now runs
  the real CSS-Anchor-Positioned pill: `.nav-pill`/`.nav-pill-anchor` in
  `index.css`, `transition` narrowed to `top/left/right/bottom/background-color`
  (never `transition-all`, per the DNA's own flagged anti-pattern on this
  exact mechanism), near-white fill (`hsl(var(--foreground))`) with a 2px
  `hsl(var(--primary))` inset-bottom accent riding along, `@supports not`
  fallback to a plain static background on unsupported browsers (no slide,
  never an invisible active state). `Sidebar.tsx` (the global vertical rail)
  deliberately does NOT get this treatment — the DNA's own Left Sidebar
  section documents RAGFlow using a plain static fill-swap for its own
  settings-scale vertical nav, explicitly reasoned as "a sliding pill for
  the small, frequently-glanced-at top-level nav (worth the animation
  budget); a plain fill-swap for the longer, denser settings list (would be
  visual noise to animate every row)." `Sidebar.tsx` is retoned to that
  exact fill-swap language instead: active = `hsl(var(--muted))` (5% white
  tint) fill + `hsl(var(--foreground))` bright text, inactive = transparent
  + `hsl(var(--muted-foreground))` dim text — matching the DNA's sampled
  `rgba(255,255,255,.05)` / `rgb(246,246,247)` values precisely, not a
  solid `--primary` fill (the prior interim retone's placeholder choice).
  Two mechanisms, same as the DNA's own app: don't add a third sliding-pill
  instance, and don't retrofit this one onto a vertical/settings-scale list
  without updating this section first.
- **Destructive actions always get a confirm step**, even where RAGFlow
  itself doesn't confirm this DNA sample either way (the DNA's own Notes
  section names this explicitly as "a Hallmark/App-Builder house rule, not
  something this DNA sample can confirm" for the card overflow-menu Delete
  action) — this system follows the house rule, not silence-as-permission.
  This ALSO directly closes one of the two real bugs the prior audit found:
  Knowledge Base's document-row delete, which currently fires with no
  confirmation at all while KB-level delete correctly confirms — the new
  system requires both to confirm, closing the asymmetry as part of the
  redesign, not as a separate patch.

## CTA voice

- Primary CTA: solid fill using `hsl(var(--foreground))` (near-white on
  dark paper, matching RAGFlow's own "Save"/"Run"/"Create" convention —
  RAGFlow's button text is dark-on-light-fill even against its own dark
  page, the same near-inverse relationship `--primary-foreground` already
  gives this codebase's `Button` component for free), `rounded-full` pill
  shape, existing `Button` padding unchanged.
- Secondary CTA: outline variant (already exists in this codebase's
  `Button` component — `hsl(var(--border))` hairline, transparent fill),
  same pill radius — matches the DNA's own "Cancel" button treatment.
  No new component needed; this is the existing `variant="outline"` Button
  picking up the new border color automatically.

## Per-page allowances

- Canvas/editor pages MAY keep their existing node/widget-type categorical
  color coding (the prior system's own declared Canvas Exception Rule,
  preserved unchanged — RAGFlow's DNA has no canvas to override this with,
  and there is no reason to remove a rule the DNA doesn't contradict).
- List/settings/dashboard pages MUST NOT introduce a third accent color
  beyond `hsl(var(--primary))` and the two reserved gradients — this
  directly closes the prior audit's dominant finding (an undeclared indigo
  accent leaking across Dashboard Editor, Page Builder, and parts of App
  Design).
- No page may render a raw hex/rgb/Tailwind-color-utility value (e.g.
  `bg-slate-50`, `text-indigo-600`, `#161618`) outside `index.css`'s own
  token blocks (`:root`, `.light`, and the Workflow Builder's
  `[data-surface]` blocks) — every color reference goes through
  `hsl(var(--x))`. This
  is the single most emphasized rule in this system, given the prior
  audit's own 5-critical/6-major finding count was almost entirely this
  exact violation, repeated across 6+ files.

## What pages MUST share

(Every page except the Workflow Builder, which carries its own palette and
type by design. See § Workflow Builder identity before "fixing" it back.)

- The single InterVariable typeface, weight-driven hierarchy (unchanged —
  `index.css`'s `body { font-family: system-ui, sans-serif }` needs a real
  `InterVariable` font load added; the prior system used `system-ui`
  deliberately, this one departs from that per the DNA's own confirmed
  choice).
- The accent color (`hsl(var(--primary))`, the teal) and its two reserved
  gradients, used only for their declared jobs (accent = focus rings/active
  states/CTAs; brand gradient = wordmark only; upsell gradient = reserved,
  unused today).
- The existing `--radius` scale (now `7px`) and Tailwind's built-in
  `rounded-md`/`rounded-lg`/`rounded-full` utilities — no new named radius
  tokens. Where the DNA calls for a sharper radius than the default scale
  gives (`5px` sub-pills, `4px` dense secondary controls, per
  `ragflow-dna.md`), use Tailwind's arbitrary-value syntax (`rounded-[5px]`)
  rather than adding permanent tokens for a handful of one-off surfaces.
- The fill-swap active-state language for any list/tab/chip control (5%
  opacity tint via `hsl(var(--muted))`) — reserve the sliding
  CSS-anchor-positioned pill specifically for the primary top-level nav and
  settings-shell sub-tabs, per the DNA's own "worth the animation budget vs.
  visual noise" distinction; do not add a third sliding-pill instance
  without updating this file first.
- Dialogs: this codebase's existing `Dialog`/`DialogContent` component
  already matches the DNA's own three-zone anatomy (bordered header/body/
  footer) and centered-overlay shape — it needs a color-token pickup only,
  no structural change. **Keep the existing close-X and visible Cancel
  button** — the DNA's own Notes section calls RAGFlow's no-close-X /
  no-visible-Cancel choice "a real discoverability tradeoff... decide on it
  deliberately rather than copying it by default," and this system decides
  against removing either affordance, since no functional reason exists to
  do so.

## What pages MAY differ on

- Macrostructure within the one family (canvas+rail vs. Dashboard-Workbench
  vs. three-region settings-shell — see Macrostructure family above), matched
  to what the specific screen actually needs to show.
- The four-surface ingestion-shell shape (Files/Retrieval-testing/Logs/
  Configuration) is reserved for Knowledge Base's detail page ONLY, and
  ONLY once FR-C9-001's own gaps are resolved as a functional change — this
  redesign pass does not add it.

## Tokens — where they actually live

**There is no separate `tokens.css` in this system.** This codebase already
has one real token file (`src/index.css`'s `@layer base :root` block) that
every component consumes via `hsl(var(--x))`. This redesign edits that
block's values in place per the Theme section's mapping table above, and
adds exactly two new custom properties for the gradients:

```css
/* src/index.css, inside the existing @layer base :root block — edit the
   existing HSL triplet values per the Theme section's mapping table.
   These two are net-new additions, not existing-variable edits: */
--gradient-brand: linear-gradient(to left, #40ebe3, #4a51ff);
--gradient-upsell: linear-gradient(to right, #00beb4, #43ffa4);
```

**Font load — also new.** `InterVariable` is not currently loaded anywhere
in this codebase (`body`'s `font-family: system-ui, sans-serif` is the
prior system's deliberate choice). Add a self-hosted `@font-face` or a
package import (`rsms/inter` via a package, matching how the studied source
loads it) at the top of `index.css`, above the `@import "tailwindcss"` line
per Tailwind's own required import order, then set
`body { font-family: "InterVariable", ui-sans-serif, system-ui, sans-serif; }`.

**No DTCG/Tailwind-`@theme`/separate-shadcn exports.** Those formats exist
for projects that don't already have a working shadcn/ui token file: this
project already has one, and it's the same format those exports would
produce. Duplicating it would create exactly the "two sources of truth"
problem this system's own Theme section warns against.
