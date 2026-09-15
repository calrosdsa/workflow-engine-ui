---
target: create form screen
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-09-07T17-59-45Z
slug: src-features-runtime-runtimeformcreatepage-tsx
---
Method: dual-agent (A: a5f1acbe464f88c01 · B: adaae99ac9794efd3)

# Design Critique — Runtime "Create User" Screen
**Target**: `src/features/runtime/RuntimeFormCreatePage.tsx` — the end-user runtime's "create a record" screen (`/forms/:formId/new`), live-tested as the "Create User" form in the Acme Corp demo app.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2/4 | Success confirmation is architecturally unreachable (state is set and the page unmounts in the same tick); the "Previewing draft" banner every other runtime screen shows is silently absent here. |
| 2 | Match System / Real World | 3/4 | Plain language throughout; the Role select (Standard User / Sales Rep / Sales Manager) explains none of its options. |
| 3 | User Control and Freedom | 2/4 | "Back" exists but nothing guards it — Back, a sidebar click, or an interruption silently discards all typed data. |
| 4 | Consistency and Standards | 1/4 | Independently measured **twice**, by two different methods, to the same number: field labels render at **2.54:1** contrast (hardcoded `text-gray-600`) vs. **5.15:1** for the identical label text on the record-Detail page (theme-token-driven). One file in this feature (`FormSectionShell.tsx`) got real design treatment; its sibling (`FieldRenderer.tsx`), which renders every label/input/error on this exact screen, didn't. |
| 5 | Error Prevention | 2/4 | Required fields are fully guarded (Zod + react-hook-form). Email format has zero app-level check — `schema-to-zod.ts` treats `'email'` identically to `'text'` — so the only guard is the browser's own native popup. |
| 6 | Recognition Rather Than Recall | 4/4 | Labels always visible, native `<select>` shows every option, nothing hidden or icon-only. |
| 7 | Flexibility and Efficiency | 1/4 | No shortcuts, no bulk path, no smart defaults; every input has an empty `name=""` attribute, which likely suppresses free browser autofill. |
| 8 | Aesthetic and Minimalist Design | 3/4 | Clean single-section layout; undercut by the illegible label layer and — per the detector — a flat type scale (five sizes, 11-18px, ~1.5:1 steps) with a heading that floats with no card to anchor it. |
| 9 | Error Recovery | 2/4 | Required-field messages are specific and well-placed. The save-failure path is a blanket `catch {}` → one generic message regardless of actual cause. |
| 10 | Help and Documentation | 0/4 | No tooltip, hint, or doc link anywhere on the screen — confirmed via full accessibility-tree read. |
| **Total** | | **20/40** | **Acceptable** (bottom of the band) |

Both assessments scored all 10 heuristics for real — this is a data-entry Operate screen, not a landing page, so the usual Persuade/Experience `n/a` exception for #7/#10 doesn't apply, and both reviewers agreed nothing else here is genuinely inapplicable either.

Read this total carefully: the interaction plumbing underneath (ARIA wiring, live validation, focus order) is legitimately well-built — both assessments independently verified `aria-required`/`aria-invalid`/`aria-describedby`/`role="alert"` are all correctly wired, and the primary task completed end-to-end in under a minute with zero crashes or console errors. What drags the score down is concentrated, not comprehensive: one shared component (`FieldRenderer.tsx`) ignoring the theme entirely, and one success moment that was engineered but never surfaced.

## Design Specificity Verdict

**Category-interchangeable.** This screen could be lifted into any generic low-code/admin-CRUD product — Retool, Airtable, an unstyled shadcn scaffold — unchanged.

**LLM assessment**: This isn't a vibe call — it's confirmed at the document level. `DESIGN.md`, this codebase's own locked design system, states outright that it covers only "authenticated builder tool" screens and that "there are no marketing, content, or public-facing pages in this codebase." The runtime end-user app — a structurally separate SPA bundle (`runtime.html`, per `PRODUCT.md`) — is out of scope by that document's own words, and no runtime-specific design brief exists anywhere else in the repo (this project's own context tooling confirms it: no surface brief resolves for this target). Grepping `src/features/runtime/` for any comment asserting a deliberate visual system turns up zero matches — every comment is behavioral, not design intent. Tellingly, one sibling file, `FormSectionShell.tsx`, *does* carry a Hallmark-style design header and correctly uses theme tokens; `FieldRenderer.tsx`, which renders everything on this exact screen, doesn't. The one legitimate axis of product character available to this screen — the tenant's own configurable theme (Acme Corp's indigo/violet accent, live-confirmed on the Save button and focus ring) — doesn't even fully reach the screen, because the busiest text on it opts out via hardcoded Tailwind grays instead.

**Deterministic scan**: The static CLI scan (`detect.mjs` against the three composing files) came back clean — exit 0, zero findings. That's a real result, not a suppressed one (Assessment B verified the engine itself works via a positive-control file that correctly triggered 3 findings, and re-ran with `--no-config` to rule out project-level suppression) — but it's a narrow result: `.tsx` files only run ~9 line-based regex rules plus a design-system-drift pass in the static engine; the page-level analyzers and the `low-contrast`/`tiny-text` rules simply don't exist in that path for this file type. The live browser-DOM detector, run against the actual rendered page, is where the real findings surfaced: **4 anti-patterns / 6 findings** — `low-contrast` (3×, the error messages at 4.0:1, need 4.5:1), `tiny-text` (11px error/body text), `flat-type-hierarchy` (5-6 sizes at ~1.5:1 ratio), and `layout-transition` (`transition: height`, unattributed to any file in `src/`, likely a third-party toast library). All six are real, non-advisory findings — none are false positives.

Here's the sharpest cross-check in this whole review: **the detector missed the worse defect.** It flagged the error text's 4.0:1 contrast but not the field labels' 2.54:1 — traced to a `SAFE_TAGS` exemption in the tool's own rule engine that skips contrast checks on `<label>` elements with a transparent background, on the reasoning that such elements usually just inherit an ancestor's already-checked surface. Nothing in this page's ancestor chain ever checks the label against the page background either, so the exemption misfires here. The LLM review caught this independently, by direct measurement; the mechanical scan structurally could not have. That's the clearest instance in this critique of the two methods covering each other's blind spots rather than just agreeing.

**Visual overlays**: No reliable user-visible overlay is available this run. Script-tag injection of the detector overlay was blocked by this app's own Content-Security-Policy (`script-src` has no external host allow-listed — a deliberate security control documented in `src/lib/csp.ts`, not a bug). Assessment B still obtained genuine live-page detector data via an in-page `fetch` + `eval` fallback (CSP-legal, since `unsafe-eval` and `connect-src http:` are both permitted) — real console/structured output from the actual rendered DOM, reported above, but no visible highlight boxes were drawn in your browser. If you want to *see* the overlay rather than just read its findings, this app's CSP would need a dev-only exception for the live-server's origin, which isn't something this critique should change unilaterally.

## Overall Impression

The bones are good and the finish is missing. Every structural and behavioral decision here — validation timing, ARIA wiring, focus order, the decision to keep this route's chrome deliberately thin since it has no owning menu — was made carefully. But the screen was seemingly never actually *looked at* against its own dark theme: the labels are the wrong gray for the background they're actually rendered on, and the one moment the user is here *for* — successful creation — fires and vanishes in the same tick, with nothing on the other side of the redirect to confirm it happened. The single biggest opportunity is also the cheapest fix in this whole report: point `FieldRenderer.tsx` at the theme tokens its sibling component already uses correctly, and the screen's worst, most-corroborated defect disappears in one file.

## What's Working

1. **The accessibility wiring is genuinely correct, verified by direct DOM inspection twice, not assumed from source.** Every field carries proper `aria-required`, `aria-invalid`, and `aria-describedby`, errors use `role="alert"` and are announced immediately, and a screen-reader user is materially *better served* here than a sighted low-vision user — the semantic layer is right even where the visual layer isn't.
2. **The full happy path just works.** Empty-submit, malformed-email, valid-submit, and mobile-width were all exercised live in one sitting; every path behaved correctly, a real record was created and the user landed on a sensible destination, in well under a minute, with zero console errors and zero failed network requests across the entire session.
3. **Keyboard and focus handling is solid.** Every control gets a visible, on-theme focus ring, tab order is linear with no traps, and Role is a genuine native `<select>` rather than a custom combobox — full keyboard/screen-reader operability for free.

## Priority Issues

No P0s — both assessments completed the full create-a-record task, including recovering from two induced error states, without ever getting stuck.

**[P1] `FieldRenderer.tsx` hardcodes colors instead of using this app's own theme tokens — the most corroborated finding in this review**
- **Why it matters**: Two independent assessments, using two different measurement methods (a canvas-based WCAG calculation and a manual OKLCH→sRGB conversion), arrived at the identical number: field labels render at **2.54:1** contrast — well under WCAG AA's 4.5:1 floor, and even under the 3:1 floor for large text. The live browser detector separately caught the adjacent error-message text failing too (4.0:1, plus 11px `tiny-text`), and flagged a flat overall type scale (5-6 sizes at ~1.5:1 steps) on the same page. All of this traces to one file: `FieldRenderer.tsx:81,83,108` hardcodes `text-gray-600`, `text-red-600`, and friends instead of `hsl(var(--muted-foreground))` / `hsl(var(--destructive))` — the exact tokens its sibling `FormSectionShell.tsx` already uses correctly. Verified by grep, not just this one screen: the exact `text-gray-600` label class also appears in `EnableAccountDialog.tsx` (2 files total), and the broader family of hardcoded utility colors Assessment A flagged (`text-gray-400/600`, `text-red-500/600`, `text-slate-600/700/800`, `border-gray-200`) spans 22 files across the codebase — not the "every form-field label in the runtime" scale originally estimated, but a real, multi-file pattern worth fixing at the component level rather than one-off.
- **Fix**: Replace every hardcoded Tailwind color utility in `FieldRenderer.tsx` with this codebase's existing `hsl(var(--x))` tokens.
- **Suggested command**: `/impeccable polish`

**[P1] The one moment the user is here for — success — is structurally unobservable**
- **Why it matters**: `handleSubmit` sets `result: 'success'` and calls `runtimeRouter.navigate(...)` in the same handler, so the confirmation banner is mounted and unmounted before it can realistically be seen — verified live across a full successful create-and-redirect cycle. Nothing on the destination page (the new record's own detail view) replaces it. This is a textbook peak-end-rule violation on the more consequential half of the rule: people remember peaks and endings most, and this journey supplies neither. It compounds with a second, source-verified defect: both the success and error inline banners use hardcoded *light-mode-only* Tailwind colors (`bg-emerald-50`/`text-emerald-700`, `bg-red-50`/`text-red-700`), so even a fixed-timing version would likely render wrong against this dark tenant theme.
- **Fix**: Hold the success state visibly for a beat (a toast that survives navigation, or a short delay before redirect), and port both banners onto theme tokens.
- **Suggested command**: `/impeccable clarify`

**[P2] One form speaks two validation languages, and the messages themselves are hard to read**
- **Why it matters**: Required-field errors use a clean, custom, presumably-i18n-aware pattern — but there is no application-level email-format check at all (`schema-to-zod.ts` treats `'email'` exactly like `'text'`), so the only format guard is the browser's own native, unstyled, unlocalized popup. On a form whose other messages ship Spanish and Portuguese translations, this one validation path will always surface in the browser's own language. Separately, an invalid field gets no change to its own border or ring — only the caption below changes — so a low-vision user scanning the controls rather than the captions gets no signal at all, and (per the detector) that caption itself is 11px text at a near-miss 4.0:1 contrast.
- **Fix**: Add a real `.email()` check to the Zod schema; consider `aria-invalid`-driven border styling on the base `Input`/`Select` components.
- **Suggested command**: `/impeccable harden`

**[P2] Chrome is missing beyond what this route's own design rationale accounts for, with no unsaved-changes guard**
- **Why it matters**: `RuntimeFormCreatePage`'s own doc comment justifies thinner chrome — no breadcrumbs, no active-item highlight — specifically because the route has no owning menu. That reasoning doesn't extend to `ProfileMenu`/`NotificationBell` being absent too, and the consequence is sharper than it looks: `ProfileMenu`'s theme toggle is the *only* place in the entire runtime app to switch light/dark/system mode. The one screen with this review's worst measured contrast failure is also the one screen where the user's own escape hatch — switching to light mode — has been silently removed. Separately, the form holds all state in memory with no persistence and no `beforeunload` guard, so Back, a sidebar click, or an interruption discards a half-filled form with zero warning.
- **Fix**: Either surface `ProfileMenu`/`NotificationBell` here or document why not; add a confirm-before-navigate-away guard when the form is dirty.
- **Suggested command**: `/impeccable harden`

## Persona Red Flags

Per this interface type (form-heavy data entry), the applicable personas are **Jordan, Sam, and Casey**.

**Jordan (Confused First-Timer)**: The Role select offers three options with zero explanation of what any of them grant — Jordan has to guess blind. The moment Jordan is most anxious about ("did my click work?") gets no lasting answer — they land on a new screen with no confirmation anything happened. And if Jordan mistypes an email, the correction shows up as a browser-native popup in a totally different visual register than the two custom red messages they just read, which reads as "did I do something differently this time?"

**Sam (Accessibility-Dependent User)**: Confirmed by two independent measurements converging on the same number — field labels render at 2.54:1, failing WCAG AA's 4.5:1 floor for normal text. A low-vision *sighted* user would genuinely struggle to read "Full Name" / "Email" / "Role" against this background. An invalid field changes nothing about its own border or ring, so a screen-magnifier user panned to just the input sees no signal that anything is wrong. Worth stating for balance: Sam using an actual screen reader is *better off* than this — the ARIA layer is correctly wired and independently verified, so the gap here is specifically visual/low-vision, not screen-reader.

**Casey (Distracted Mobile User)**: Assessment A measured the mobile hamburger nav toggle's live bounding box at 30×30px — under the 44×44 minimum recommended touch target, and it's the only way to reach the rest of the app on a phone. No state persistence exists; if Casey gets pulled away mid-fill and the tab reloads or they tap Back by muscle memory, everything typed is silently gone. To Casey's credit, the core fill-and-submit path itself held up well under an actual viewport resize during this review — clean single-column collapse, no console errors, no horizontal scroll.

## Minor Observations

- Every input carries an empty `name=""` attribute, which likely suppresses browser-native autofill for Full Name/Email — a small, free efficiency loss.
- No placeholder or help text on any field — most likely a tenant-authoring gap rather than a code defect, since the underlying components support `placeholder`/`helpText`/section descriptions and this specific Acme Corp form just doesn't use them.
- The required-field asterisk (5.05:1 contrast) is more visually prominent than the label it decorates (2.54:1) — an inverted hierarchy where the decoration outweighs the content.
- The detector's `layout-transition` finding (`transition: height`) couldn't be traced to any file in `src/` — most likely a third-party toast library, worth a quick look if it's ever visibly janky.
- The top-bar label ("New User") is the only wayfinding text on the entire screen, since the sidebar shows no active-item highlight here — fine today, but thin if that label were ever slow to resolve.

## Questions to Consider

- If a user has been typing for two minutes and gets pulled away, should the form really vanish without a word?
- The success banner exists in the code but can structurally never be seen — what would it mean to design this flow around the moment of completion actually being *felt*?
- Every other runtime screen tells the user "you're previewing a draft." Why does the one screen that *writes* data get to skip that warning?
- If the tenant's brand color is the one piece of identity this screen is allowed to carry, why does the busiest text on the page ignore it entirely?
