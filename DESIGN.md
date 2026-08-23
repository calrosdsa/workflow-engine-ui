---
name: App Builder
description: Multi-tenant low-code admin console for designing forms, workflows, dashboards, and menus
colors:
  primary: "hsl(221.2 83.2% 53.3%)"
  primary-foreground: "hsl(210 40% 98%)"
  secondary: "hsl(210 40% 96.1%)"
  secondary-foreground: "hsl(222.2 47.4% 11.2%)"
  accent: "hsl(210 40% 96.1%)"
  accent-foreground: "hsl(222.2 47.4% 11.2%)"
  muted: "hsl(210 40% 96.1%)"
  muted-foreground: "hsl(215.4 16.3% 46.9%)"
  destructive: "hsl(0 84.2% 60.2%)"
  destructive-foreground: "hsl(210 40% 98%)"
  success: "hsl(142 71% 45%)"
  success-foreground: "hsl(355 100% 97%)"
  warning: "hsl(38 92% 50%)"
  warning-foreground: "hsl(48 96% 12%)"
  background: "hsl(0 0% 100%)"
  foreground: "hsl(222.2 84% 4.9%)"
  card: "hsl(0 0% 100%)"
  card-foreground: "hsl(222.2 84% 4.9%)"
  border: "hsl(214.3 31.8% 91.4%)"
  ring: "hsl(221.2 83.2% 53.3%)"
  node-trigger: "#10b981"
  node-condition: "#f59e0b"
  node-subflow: "#8b5cf6"
  node-data: "#3b82f6"
  node-notify: "#f43f5e"
  node-knowledge: "#06b6d4"
typography:
  dialog-title:
    fontFamily: "system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  title:
    fontFamily: "system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  body-compact:
    fontFamily: "system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  label:
    fontFamily: "system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.05em"
  caption:
    fontFamily: "system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "normal"
  micro:
    fontFamily: "system-ui, sans-serif"
    fontSize: "9px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.03em"
rounded:
  chip: "0.25rem"
  control: "0.5rem"
  card: "0.5rem"
  dialog: "1rem"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-outline-hover:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
  badge-default:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  badge-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  badge-success:
    backgroundColor: "{colors.success}"
    textColor: "{colors.success}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  badge-warning:
    backgroundColor: "{colors.warning}"
    textColor: "{colors.warning}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  card-default:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.card}"
    padding: "24px"
  input-default:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    height: "36px"
---

# Design System: App Builder

## Overview

**Creative North Star: "The Instrument Panel"**

App Builder's own admin surface is deliberately quiet: an unmodified shadcn/ui shell in `system-ui`, a single default blue, and gray-scale everywhere else. This is not an unfinished visual identity — it is the honest current state, and it fits the product. A builder spends the day switching between a form designer, a node-graph workflow canvas, a dashboard grid, and a permissions table; the chrome around every one of those tools stays identical and gets out of the way, so the one thing that's allowed to carry color is the thing that actually varies: what a piece of the interface *is* and what *state* it's in.

The one place this system spends color deliberately is the workflow canvas, where every node type owns a fixed hue — emerald for triggers, amber for conditions, violet for Execute Workflow, blue for data operations, rose for notifications, cyan for knowledge/RAG nodes. That's the system's real signature: not a brand palette applied to the whole app, but a categorical color code applied to exactly one surface, because that's the one surface where "instantly tell what kind of thing this is" is load-bearing to the job of building a workflow.

**Key Characteristics:**
- Neutral, unbranded shell (default shadcn/ui tokens, `system-ui` type) everywhere outside the workflow canvas.
- Color is semantic, never decorative: it marks node category, status (success/warning/destructive), and interactive state — nothing is colored "for atmosphere."
- Flat at rest; shadow appears only as surfaces lift off the page (cards, popovers, dialogs), scaled by how far off the page they sit.
- A visible, consistent focus ring on every interactive element — this system does not rely on hover alone.

## Colors

The palette itself is deliberately restrained — one accent, a neutral gray scale, and a small set of reserved status colors — with all the system's real color vocabulary spent on the workflow canvas instead.

### Primary
- **Default Blue** (`hsl(221.2 83.2% 53.3%)` / `#2563eb`-adjacent): the one accent color in the entire admin shell. Primary buttons, active states, focus rings, links. Used sparingly — most of any given screen is neutral.

### Secondary
- **Success Green** (`hsl(142 71% 45%)`): positive status only — a completed execution, an active/healthy state. Added to the root token set alongside this pass; previously several components (`Badge`'s `success` variant, and workflow-canvas status indicators) reached for a raw Tailwind green literal because no real token existed.
- **Warning Amber** (`hsl(38 92% 50%)`): non-fatal, needs-attention status — a partial success, a stale/needs-review state. Same origin story as Success Green above.

### Neutral
- **Foreground** (`hsl(222.2 84% 4.9%)`): body text, headings.
- **Muted Foreground** (`hsl(215.4 16.3% 46.9%)`): secondary text, placeholders, field labels, helper copy — the majority of text on a dense settings/config screen.
- **Background** (`hsl(0 0% 100%)`): page background.
- **Card** (`hsl(0 0% 100%)`): identical to background at rest; separation comes from border + shadow, not a tint.
- **Muted / Accent** (`hsl(210 40% 96.1%)`): the one light-gray fill used for hover states, subtle section backgrounds, and selected/active chips.
- **Border** (`hsl(214.3 31.8% 91.4%)`): the default hairline for every card, input, and divider.
- **Destructive** (`hsl(0 84.2% 60.2%)`): delete actions and error states only.

### Named Rules
**The Reserved Red Rule.** Destructive red appears only on delete/remove actions and genuine error states — never as a generic "important" accent.

**The Named Status Rule.** Success and warning are real root tokens (`--success`, `--warning`), not raw Tailwind green/amber literals reached for per-component. Any new status-colored surface references these, the same way it already references `--destructive`.

**The Canvas Exception Rule.** The neutral-shell discipline above applies to every surface except the workflow node canvas. There, each node *type* (not status) owns a fixed, saturated hue from the standard Tailwind palette (`emerald`, `amber`, `violet`, `blue`, `rose`, `cyan`, `slate`, `indigo`, `sky`, `red`, `teal`) expressed as a two-stop `to-br` gradient on the node's header, a matching solid hex for the minimap and connection handles, and a soft tint (`-50`/`-100`) for the node's badges and selected-state background. This is the one place in the system where color density is intentionally high, because distinguishing a Trigger from a Condition from a Notification node at a glance is the actual task.

## Typography

**Body Font:** `system-ui, sans-serif` (the OS default stack; no custom or web font is loaded anywhere in this codebase).

**Character:** Unopinionated on purpose — this is a tool for getting work done across many dense, information-heavy screens (config panels, data tables, permission matrices), not a surface where typographic voice is part of the product's expression.

### Hierarchy

The shell runs a genuinely fine-grained scale, not just two roles — canvas chrome (node cards, badges, toolbars, picker grids) packs a lot of meaning into a small footprint, so it steps down in 1px increments rather than jumping straight from body text to "small caption":

- **Dialog Title** (600, 15px): modal/dialog headers — the largest text anywhere in the shell.
- **Title** (600, 13px): canvas card titles, node picker item labels — one step below a dialog title, used where a name/label needs to read as the primary thing in a small container.
- **Body** (400, 14px via `text-sm`, 1.5 line-height): the default for nearly all UI text — inputs, buttons, body copy, table cells, form field labels.
- **Body Compact** (400–500, 12px): the second most common size after body — dense list rows, canvas node body text, secondary panel copy.
- **Label** (600, 11px, uppercase, 0.05em tracking): section headers inside config panels (`text-[11px] font-semibold uppercase tracking-wider`) — the system's one recurring typographic device for "this heading introduces a group of controls," used consistently across every builder surface (form config, workflow node config, detail-page builder). Also reused at 11px non-uppercase for compact canvas-card body text.
- **Caption** (400, 10px, muted-foreground): field descriptions, timestamps, counts, node subtitles — the standard "supporting text" size on canvas surfaces.
- **Micro** (500–600, 9px, uppercase, muted-foreground): the floor of the scale — badge glyphs, tiny inline tags (e.g. a node's "parent link"/"conditional" pill), used only where space is genuinely too tight for 10px.

### Named Rules
**The No-Display-Size Rule.** There is no display/hero typographic tier anywhere in the Builder shell — the largest text on any screen is a dialog title at 15px. Density and legibility at small sizes matter more than typographic drama in a tool used for hours at a time.

**The Density Floor Rule.** 9px (Micro) is the smallest text this system uses anywhere, and it's reserved for glyphs/tags, never for a sentence a user has to actually read. Body-length copy never drops below 10px (Caption).

## Layout

Feature-panel density over marketing-page whitespace. Config panels (the right-hand rail in every builder canvas — workflow node config, form field config, detail-tab config) run a consistent `space-y-1.5`–`space-y-4` rhythm: tight (`gap-1.5`) within one control's label+input pair, generous (`gap-4`) between distinct config sections. Canvas surfaces (workflow nodes, form sections, dashboard widgets) use a coarser `gap-4`/`p-4` rhythm since they're spatial, not list-like.

Full-screen builder overlays (e.g. the Detail Page Builder) use a fixed two-pane split: a flexible canvas region and a fixed `w-96` right-hand config rail behind a `ScrollArea`. This same canvas+rail shape recurs across the workflow builder, form builder, and detail-page builder — it is the system's default "spatial editor" layout, not a one-off.

No dedicated marketing/wide-content breakpoints exist; the Builder targets desktop admin usage (no mobile-specific layout pass observed in the shell itself — mobile support is a separate, explicit *product* surface for the published-app runtime, not this admin tool).

## Elevation & Depth

Flat at rest, layered by z-order. Cards and the page background sit at the same flat plane (`shadow-sm` at most, often none) — separation comes from a 1px border, not elevation. Depth only appears as a surface genuinely lifts off the page: popovers and dropdowns get a mid-weight shadow, and the highest layer (modal dialogs) gets the heaviest shadow in the system paired with a `bg-black/50 backdrop-blur-sm` overlay behind it.

### Shadow Vocabulary
- **Resting** (`shadow-sm`): cards, buttons, inputs — barely perceptible, present mostly for edge softness.
- **Floating** (`shadow-md`–`shadow-lg`): popovers, dropdown menus, select content — enough separation to read as "temporarily on top of the page."
- **Modal** (`shadow-xl`): dialog content — the system's heaviest shadow, reserved for the one surface that also gets a dedicated backdrop-blur scrim behind it.

### Named Rules
**The Border-Before-Shadow Rule.** A card is defined first by its border, second by its shadow. Shadow strength should scale with how temporary/overlaid a surface is, not with how "important" its content is.

## Shapes

Four-tier radius scale, tied to surface role rather than size:
- **Inline chip** (`rounded` / 0.25rem): the one sub-control-radius step, reserved for small inline elements sitting inside running text or a compose box (e.g. an @mention chip) — small enough not to compete with the surrounding text's own line height.
- **Controls** (`rounded-md`, 0.5rem — the `--radius` token): buttons, inputs, badges-as-outline, the default for nearly everything interactive.
- **Containers** (`rounded-lg`, 0.5rem visually equivalent but used semantically for cards, sections, canvas node cards): slightly more relaxed framing for content groupings.
- **Modals** (`rounded-2xl`, 1rem): the one place radius steps up — dialogs read as a distinct, softer-edged layer above the rest of the interface.
- **Pills** (`rounded-full`): badges, avatars, segmented-toggle buttons, status chips.

Borders are always 1px, always the `border` token color, never a decorative width or a colored accent border.

## Components

### Buttons
- **Shape:** `rounded-md` (0.5rem), height 36px default / 32px small / 40px large / 36×36px icon-only.
- **Primary:** solid `primary` background, `primary-foreground` text, 90%-opacity darken on hover.
- **Outline / Ghost:** transparent or bordered at rest, fills with the `accent` gray tint on hover — the system's default for every secondary action.
- **Destructive:** solid `destructive` red, reserved for delete/remove.
- **Focus:** a visible 2px ring in the `ring` color with a 2px offset against the page background on every variant, including ghost — this system never relies on hover alone to signal focus.

### Cards / Containers
- **Corner Style:** `rounded-lg`.
- **Background:** `card` token (visually identical to page background).
- **Shadow Strategy:** `shadow-sm` at rest (see Elevation & Depth).
- **Border:** always 1px, `border` token.
- **Internal Padding:** 24px (`p-6`) header/body/footer, no padding between adjacent sections beyond that.

### Inputs / Fields
- **Style:** `rounded-md`, 1px `input`-token border, `shadow-sm`, 36px height.
- **Focus:** border color implied by the ring (2px `ring`-colored ring, no border-color change) — same focus language as buttons.
- **Disabled:** 50% opacity, pointer-events removed.

### Dialogs / Overlays
- **Style:** `rounded-2xl`, 1px border, `shadow-xl`, centered, backed by a `bg-black/50 backdrop-blur-sm` scrim.
- **Motion:** a single authored entrance — fade + scale-from-95% + slight slide-from-top, 200ms, reversed on close. This is the system's one deliberately animated moment; nothing else in the shell animates beyond color/opacity `transition-colors`.
- **Anatomy:** header (title + description) and footer (right-aligned actions) each get a 1px border separating them from the scrollable body — a consistent three-zone dialog shape used everywhere from confirm dialogs to full-screen builder overlays.

### Badges
- **Shape:** `rounded-full` (pill), 2px/10px padding, 12px semibold text.
- **Variants:** `default` (primary tint), `secondary` (muted gray), `destructive` (destructive tint), `success` (success tint), `warning` (warning tint), `outline` (bordered, no fill) — each a translucent (~15% opacity) tint of its token color as background with the full-strength token color as text, so every variant reads correctly in both light and dark without a second set of hand-picked values.

### Workflow Canvas Nodes (signature component)
Each of the ~15 node types (Trigger, Condition, Execute Workflow, Set Variable, Fetch/Update/Delete Records, HTTP Request, Notification, Knowledge Retrieval/Ingest, etc.) is a card with a colored two-stop gradient header (`bg-gradient-to-br from-{hue}-500 to-{hue}-600`) carrying an icon and label, a white/card-colored body showing a short config preview, and a matching-hue soft tint (`bg-{hue}-50`) used for that node's badges. The same hue drives the node's minimap dot and connection-handle color, so a node's identity is legible at every zoom level, not just up close. Selected state adds a 2px ring in the node's own hue (not the system's default blue ring) — the one place selection color is category-specific rather than using the shared `ring` token.

## Do's and Don'ts

### Do:
- **Do** keep the admin shell's color vocabulary to primary blue + neutral gray + reserved destructive red. New chrome should not introduce a second accent color.
- **Do** reserve saturated, categorical color for surfaces where "what type is this" is the actual task (the workflow canvas is the only current example) — not as a general decorative device.
- **Do** use the `focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2` pattern on every new custom interactive element, matching the shared `Button`/`Input` convention — this system depends on keyboard focus being visible everywhere, not just on primitives that get it for free from Radix. Drop to `focus-visible:ring-offset-1` on compact icon-only controls (toolbar icon buttons, drag handles, in-row actions typically 20–28px) packed close enough that a 2px offset would visually collide with a neighboring control — `-offset-2` stays the default everywhere else.
- **Do** scale shadow with how "temporary/overlaid" a surface is (resting → floating → modal), not with perceived importance.
- **Do** use the uppercase 11px/600-weight/tracked label style for config-panel section headers — it's the system's one consistent structural device across every builder surface.

### Don't:
- **Don't** add a display/hero typographic size. The system's ceiling is a 15px dialog title; a bigger headline anywhere in the admin shell would be a foreign element.
- **Don't** introduce raw Tailwind color utilities (`bg-blue-100`, `text-red-800`) on shell components — every component in `src/components/ui/*` now references `hsl(var(--token))` tokens throughout (including `Badge`, which used raw literals until this pass). Status colors that don't yet have a token (there is no third status beyond success/warning/destructive today) are the one legitimate reason to introduce a new root token rather than reach for a raw literal — see the Named Status Rule under Colors.
- **Don't** apply the workflow-canvas node-color system anywhere outside the workflow canvas. It's a categorical code for one surface, not a secondary brand palette.
- **Don't** add a colored left/right border as a status indicator on cards or list rows — this system has no precedent for that pattern; status is currently expressed via `Badge` variants and text color instead.
- **Don't** invent a custom or web font. `system-ui` is the confirmed, deliberate choice for the entire admin shell.
