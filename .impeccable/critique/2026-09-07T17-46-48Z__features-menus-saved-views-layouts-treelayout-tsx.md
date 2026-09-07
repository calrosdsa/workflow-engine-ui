---
target: this tree view
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-09-07T17-46-48Z
slug: features-menus-saved-views-layouts-treelayout-tsx
---
Method: dual-agent (A: acd4603c5d1180be0 · B: a812b380fdc66e6b0)

# Design Critique — Tree Saved-View Layout

## Design Health Score

Mode: **Operate**. All 10 heuristics scored for real — none genuinely inapplicable to a task-completion surface.

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2/4 | States render clearly for sighted users, but expand/collapse state is never exposed programmatically (`aria-expanded` confirmed `null` on the live element) |
| 2 | Match System / Real World | 3/4 | Folder/file/chevron metaphor reads instantly; "Group/folder field (optional)" conflates two concepts in one label |
| 3 | User Control and Freedom | 2/4 | Escape/Cancel/Reset-all all work cleanly, but no bulk expand-all/collapse-all exists — the only way back to a known state in a deep tree is re-toggling every node by hand |
| 4 | Consistency and Standards | 2/4 | The fallback-banner pattern is exemplary and shared correctly with Calendar/Kanban; but Tree's own interaction model, focus styling, and Columns handling all diverge from its siblings |
| 5 | Error Prevention | 2/4 | The disabled-layout guardrail is solid, but the Group/folder-field picker offers *every* boolean field with zero semantic guidance (live-confirmed: "Active" is selectable right alongside "Is Group") |
| 6 | Recognition Rather Than Recall | 2/4 | Icons are legible, but the disabled-layout reason and the row-level Edit/Delete controls are both mouse-hover-only with no persistent visible cue |
| 7 | Flexibility and Efficiency | 1/4 | No shortcuts, no arrow-key tree navigation, no bulk actions, and collapse state does not survive a saved-view switch (live-reproduced) |
| 8 | Aesthetic and Minimalist Design | 3/4 | The rendered tree itself is clean — the detector found zero findings anywhere inside TreeLayout.tsx's own output across two live pages. The authoring drawer pulls this down: 4 nested-card boxes and 11px text in the same feature's "Edit view" panel |
| 9 | Error Recovery | 3/4 | The three-layout fallback-to-List pattern is genuinely good recovery design — plain language, no dead end |
| 10 | Help and Documentation | 1/4 | Zero in-UI explanation that the group field is icon-only and doesn't gate which nodes can expand — a non-obvious behavior currently documented only in a source comment |

**Total: 21/40 — Acceptable** (52.5%, per the 20–27 band: "significant improvements needed before users are happy").

## Design Specificity Verdict

**LLM assessment (Assessment A):** Split verdict. The integration is genuinely product-specific — `parentField` is validated as a `reference` field whose `reference_table` equals the form's own id (real domain modeling, not a generic field picker), and the stale-field fallback is structurally identical to Calendar's and Kanban's own drift-handling. But `TreeLayout.tsx` itself, stripped of props, is `File`/`Folder`/`FolderOpen` from lucide-react plus `depth * 20px` indentation — a generic file-explorer component that happens to be wired in carefully. The clearest tell: it's the only one of five layouts that ignores the view's own Columns configuration entirely.

**Deterministic scan (Assessment B):** The CLI regex scan came back clean (exit 0, zero findings) across all four changed files — a scope limitation, not a clean bill of health: the CLI engine only covers source-level regex-matchable rules, not the element/layout/page-level rules (cramped padding, nested cards, type-scale spread) that require rendered-DOM inspection. The browser pass is the real signal, and it corroborates Assessment A's split verdict almost exactly: zero element-level findings anywhere inside the rendered tree (both the Department and Warehouse pages) — the tree rows, chevrons, and icons are mechanically clean — while the surrounding authoring chrome in SaveViewDialog.tsx and ViewSwitcher.tsx picked up real findings (4x nested-cards, cramped-padding on the view-switcher trigger, tiny-text at 11px). Two additional page-level findings (flat-type-hierarchy, layout-transition) recurred near-identically on both tree pages regardless of content — Assessment B greps confirmed zero height-transition literals in any of the four changed files, weakening (not ruling out) their attribution to this feature; treat them as likely pre-existing/global rather than Tree-specific.

**Visual overlays:** Injection succeeded on all three inspected pages (Department tree, Warehouse tree, the Edit-view drawer) via a documented workaround — the app's CSP blocks the methodology's literal `<script src>` cross-origin injection, so Assessment B fetched the detector script text and executed it as an inline `<script>` instead, which the same CSP already permits. Findings above come from that run. No overlay is currently open in any browser tab — both tabs were closed during cleanup per the methodology's own stop-server requirement — so there's nothing to look at live right now; the table above and the screenshots/console transcripts Assessment B captured are the evidence of record. One methodology artifact worth knowing about if this gets re-run: an id not prefixed `impeccable-live-` on the injected script fooled the detector's own self-exclusion filter into flagging its own source text as a theater-slop-phrase false positive on the first pass — Assessment B diagnosed and fixed this with an A/B re-injection, so it's excluded from every count above.

## Overall Impression

The tree renders correctly, handles a genuine edge case (cyclic parent references) with real engineering thought rather than a defensive hack, and slots into the existing stale-field-fallback pattern without inventing a new mechanism. What it doesn't do yet is finish the job the rest of this feature family already does: Card and Kanban both render the view's configured Columns as supporting content under a record's title; Tree renders title only. On real data that's not a style preference — both assessments independently converged on the same live fixture (two records both literally named "Main Warehouse") and found it renders as two indistinguishable rows. The single biggest opportunity is also the cheapest fix: wire `columns` into TreeLayout the same way CardLayout already does, and a meaningful share of today's issues (disambiguation, the "help" heuristic's low score, part of the aesthetic gap) improve together.

## What's Working

1. **Theming correctness is real, not just token-deep.** TreeLayout.tsx uses `hsl(var(--...))` exclusively — verified by full-file read, zero hardcoded hex/rgb — the right mechanism given this component renders in the tenant-themeable Runtime app, not the fixed-dark Builder shell. Contrast measured live: 5.15:1 (dark), 5.34:1 (light), both comfortably over WCAG AA's 4.5:1.
2. **The three-layout stale-field fallback is disciplined, not bolted-on.** calendarFieldMissing/kanbanFieldMissing/treeFieldMissing are structurally identical checks producing an identical warning-banner pattern — a renamed or deleted field degrades to a working List view with a plain-language explanation, never a crash or silent broken render.
3. **buildForest's cycle-safety is genuinely reasoned, not defensive.** Every record lands in exactly one bucket (root XOR one childrenOf[parentId] list), so a real cycle simply has no root to be reached from and never renders — no visited-set guard needed, and the code says why. The detector's clean pass over the rendered output for both live fixtures independently confirms this holds up outside the source review too.

## Priority Issues

**[P0] ViewSwitcher's Edit/Delete controls are keyboard-focusable but invisible while focused**
- What: In ViewSwitcher.tsx, the pencil/trash buttons live inside a wrapper using `opacity-0 group-hover:opacity-100` with no `focus-within` equivalent.
- Why it matters: Live-confirmed — calling `.focus()` on the real "Edit view" button showed `document.activeElement` landing on it while the parent wrapper's computed opacity stayed "0" throughout. A keyboard-only user tabbing through the view dropdown lands on a completely invisible control with no focus ring and no other path to configure a Tree view at all.
- Fix: Add `group-focus-within:opacity-100` (and `focus-visible:opacity-100` on the buttons themselves) alongside the existing hover trigger.
- Suggested command: /impeccable audit

**[P1] Tree silently drops the view's Columns configuration, and that's the exact mechanism that would fix its worst reproduced failure**
- What: SaveViewDialog.tsx's Columns section applies to every layout, and the live "Org Chart" view has 5 columns configured — but RecordsTable.tsx's Tree call site never passes columns to TreeLayout at all (Card and Kanban's call sites both do).
- Why it matters: Not abstract — both assessments independently hit the same live consequence. Two real Warehouse records, both named "Main Warehouse" (codes WH-MAIN and MAIN), render with identical visible content: title only, no tooltip, no second line.
- Fix: Thread columns into TreeLayout and render configured fields as a secondary line under the title, matching Card's body-row pattern.
- Suggested command: /impeccable harden

**[P1] No ARIA tree semantics — the hierarchy is unavailable to screen reader users**
- What: A live accessibility-tree read of the rendered Org Chart view shows a flat button sequence with no role="tree"/role="treeitem", no aria-expanded (confirmed null), no aria-level, and the toggle's accessible name precedes its subject in reading order.
- Why it matters: The feature's entire purpose — communicating a hierarchy — is invisible to screen reader users through this view. Scored P1 rather than P0 because a real alternate path exists: this same menu's default List view renders a literal "Parent Department" column.
- Fix: Add role="tree"/role="treeitem", real aria-expanded on toggles, aria-level/aria-setsize/aria-posinset per the WAI-ARIA treeview pattern.
- Suggested command: /impeccable audit

**[P1] A structural parent that isn't flagged "group" renders a self-contradicting icon**
- What: isGroup is driven entirely by the group field's value when one is configured, independent of hasChildren — but the expand chevron is driven by hasChildren alone. Live-confirmed: "Accounting" (is_group: false, but structurally parent to "Purchasing") renders an expanded chevron directly next to a plain leaf/file icon.
- Why it matters: This undermines the one thing a tree view exists to communicate — container vs. leaf — at exactly the moment real-world data is most likely to produce it.
- Fix: Either let hasChildren win when it disagrees with the group field, or surface both signals together instead of one silently overriding the other.
- Suggested command: /impeccable clarify

**[P2] The Tree authoring UI (Edit-view drawer) has real, detector-confirmed visual-polish gaps**
- What: The browser pass found 4 separate nested-cards hits inside SaveViewDialog.tsx, cramped-padding on the ViewSwitcher trigger button, and an 11px tiny-text hit on the filter's empty-state copy.
- Why it matters: This is the part of the feature the detector — not the LLM review — caught: a builder configuring a Tree view sees a drawer that's visually boxier and denser than the clean, unremarkable tree it's configuring.
- Fix: Flatten the redundant nested borders, bump the empty-state copy to at least 12px, and give the view-switcher trigger real vertical padding.
- Suggested command: /impeccable layout

## Persona Red Flags

**Alex (Power User)**
- No arrow-key tree traversal despite this being the standard convention, and despite this same app's Kanban already shipping a full KeyboardSensor for its own drag interactions.
- No "Expand all"/"Collapse all" — a repeated tax on exactly the user managing the largest trees.
- Live-verified: collapsing "Corporate," switching to Default view, then back to "Org Chart" re-expands it. Collapse state doesn't survive a routine, same-session view switch.
- Cannot reach Edit/Delete on a saved view by keyboard at all (see P0).

**Sam (Accessibility-Dependent)**
- The tree's entire hierarchy is unavailable through the accessibility tree (see P1) — the single worst finding for Sam specifically.
- Chevron toggle buttons measure 16x16 CSS px, below WCAG 2.2 SC 2.5.8's 24x24px minimum.
- The ViewSwitcher Edit/Delete controls are a real focus trap in the visual sense: DOM focus lands there but the control is 100% invisible the entire time.

**Riley (Stress Tester)**
- Live-reproduced: two "Main Warehouse" records render as visually identical twins (see P1).
- Live-reproduced: filtering out a parent silently promotes its child to a root with no orphan indicator, and the identical code path triggers once a real hierarchy exceeds the default 25-record page size.
- Live-reproduced: a structurally-parent, unflagged-group record renders a self-contradicting icon/chevron combination.

## Minor Observations

- A record whose real parent falls outside the current filter or page renders as an unmarked top-level root, indistinguishable from a genuine root.
- The disabled Layout-picker buttons' explanation lives only in a title attribute — mouse-hover-only; a keyboard-focused user sees "Kanban" grayed out with no visible reason why.
- The Group/folder field picker offers every boolean field with no semantic filtering (live-confirmed: "Active" is selectable alongside "Is Group").
- No connecting guide-lines between parent/child rows — fine at the 2-3 levels tested, untested at real depth.
- CalendarLayout.tsx sets a native title tooltip on truncated event labels; TreeLayout.tsx's node-title button has no equivalent.
- The "Default view" item never shows a "(current)" marker the way saved-view rows do.
- On a 375px mobile viewport, the RecordsTable toolbar overflows horizontally and the ViewSwitcher's own label truncates mid-word for a long saved-view name — pre-existing across all layouts, but Tree's more descriptive names make it more visible.
- Toggling a node has no transition — an instant layout snap, notable given this app already invests in motion deliberately elsewhere (the builder shell's nav-pill).
- flat-type-hierarchy and layout-transition fired near-identically on both tree pages regardless of content and are likely page-level/pre-existing rather than introduced by this feature.
- Housekeeping: the live-server run created an untracked .impeccable/live/ directory in workflow-engine-ui. It isn't gitignored — worth adding to .gitignore.

## Questions to Consider

1. If Tree is the only layout that can misrepresent its own data, should it opt out of the shared filter/pagination pipeline the way Kanban already does for its own reasons?
2. The group field is documented in code as "purely presentational," a distinction that needed a paragraph of comments for the next engineer. Doesn't it need a sentence of UI copy for the builder configuring it?
3. Every sibling layout treats the Columns picker as a promise. Tree breaks that promise silently. Was that a deliberate scoping decision, or did it ship before anyone decided what a tree row's second line should show?
