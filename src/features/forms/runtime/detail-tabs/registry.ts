// ---------------------------------------------------------------------------
// Detail-tab registry (FR-D2-015)
// ---------------------------------------------------------------------------
//
// Direct structural analog of features/dashboard/widget-registry.ts — same
// Map-backed registration, same production-throw/dev-overwrite duplicate
// handling (see registerDetailTab's own comment for why: widget-registry.ts's
// identical guard was proven, this session, to need the dev-mode exception —
// Vite's HMR can re-run every registerX() call from several different
// propagation paths without disposing the old module first).
import type { DetailTabDefinition } from './contract'
import type { DetailTabConfig } from '@/features/form-builder/schema'

const REGISTRY = new Map<string, DetailTabDefinition<any>>()

export function registerDetailTab<T>(def: DetailTabDefinition<T>): void {
  if (REGISTRY.has(def.type) && !import.meta.hot) {
    throw new Error(`detail tab type "${def.type}" is already registered`)
  }
  REGISTRY.set(def.type, def)
}

export function getDetailTab(type: string): DetailTabDefinition | undefined {
  return REGISTRY.get(type)
}

export function allDetailTabs(): DetailTabDefinition[] {
  return Array.from(REGISTRY.values())
}

/** The fixed tabs every form gets when it has never opened the "Detail
 *  Page" config panel (FormSchema.settings.detailTabs absent) — the single
 *  place this default is expressed, so RecordDetailPanel.tsx and the Form
 *  Builder's config panel both resolve identically instead of each
 *  guessing at their own fallback.
 *
 *  attachments/tags default into the 'sidebar' zone: on a form still using
 *  the 'single' layout (every form's implicit default) ZonedDetailTabList
 *  falls back an unrecognized zone id to 'main', so they render as two more
 *  ordinary tabs — only a form whose admin has switched to
 *  'main-right-sidebar'/'main-left-sidebar' actually sees them beside the
 *  fields, ERPNext-sidebar-style. */
export function defaultDetailTabs(): DetailTabConfig[] {
  return [
    { id: 'details', type: 'details', config: {} },
    { id: 'attachments', type: 'attachments', config: {}, zone: 'sidebar' },
    { id: 'tags', type: 'tags', config: {}, zone: 'sidebar' },
    { id: 'audit', type: 'audit', config: {} },
    { id: 'linked', type: 'linked', config: {} },
  ]
}

/** Tab types that must show up on EVERY form's detail page, even one saved
 *  before these types existed — the ERPNext-sidebar parity this feature is
 *  for wouldn't land on a single real form otherwise, since any form whose
 *  admin has ever opened the Detail Page config panel already has a saved,
 *  non-empty detailTabs array (confirmed live: a form using the newer
 *  'connections' tab already has a fully custom array with no way to
 *  retroactively include a type introduced after it was saved). Appended,
 *  not merged in place, so an admin's existing order/zone choices for every
 *  OTHER tab are untouched. Presence is checked by `type` alone (including
 *  an existing `hidden: true` entry) — so "hide" (the existing per-tab
 *  toggle) genuinely suppresses one of these, while outright removing the
 *  entry brings it back next resolve. That's a deliberate, narrow
 *  exception to "an admin's saved config is never second-guessed": it's
 *  what makes these two types the "not deletable outright, only hideable"
 *  built-ins DetailTabDefinition.builtin's own doc comment already
 *  promises for details/audit/linked, a promise TabCard.tsx's Remove
 *  button doesn't actually enforce for those three today — see this
 *  array's own scope, which is deliberately NOT "every builtin type," only
 *  the two this feature adds. */
const ALWAYS_PRESENT_TYPES = ['attachments', 'tags']

/** True for a tab type resolveDetailTabs backfills onto every form — the
 *  Detail Page editing surfaces (form-builder/config/DetailPageConfigSection.tsx,
 *  detail-page-builder/canvas/TabCard.tsx via ZoneDropZone.tsx) use this to
 *  disable ONLY the Remove action for these types (Hide still works fully):
 *  without it, clicking Remove appears to work for the rest of that editing
 *  session, then silently reverts the next time this form's tabs resolve —
 *  see ALWAYS_PRESENT_TYPES's own doc comment for why that reversion is
 *  intentional. Disabling the button turns that into an honest, explained
 *  constraint instead of a silent surprise. */
export function isAlwaysPresentDetailTab(type: string): boolean {
  return (ALWAYS_PRESENT_TYPES as string[]).includes(type)
}

/** Resolves a form's configured tab list, falling back to the fixed default
 *  when absent or empty — the latter matters too, not just `undefined`,
 *  since the Form Builder's own "at least one tab" guard prevents saving an
 *  empty array, but a form saved before that guard existed, or one whose
 *  array was cleared by other means, should still show SOMETHING rather
 *  than a blank detail page. Then backfills any ALWAYS_PRESENT_TYPES this
 *  particular array predates (see that constant's own doc comment) —
 *  appended in the 'sidebar' zone, same placement defaultDetailTabs() uses
 *  for a brand-new form. */
export function resolveDetailTabs(configured: DetailTabConfig[] | undefined): DetailTabConfig[] {
  const base = configured && configured.length > 0 ? configured : defaultDetailTabs()
  const present = new Set(base.map((t) => t.type))
  const backfilled = ALWAYS_PRESENT_TYPES.filter((type) => !present.has(type))
    .map((type): DetailTabConfig => ({ id: type, type, config: {}, zone: 'sidebar' }))
  return backfilled.length > 0 ? [...base, ...backfilled] : base
}
