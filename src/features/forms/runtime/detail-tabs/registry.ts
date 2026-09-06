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
 *  guessing at their own fallback. Only the 'main' entries here are a real
 *  "default" an admin can then reshape; the sidebar/activity ones are
 *  pinned chrome CHROME_ZONES re-applies on every resolve anyway. */
export function defaultDetailTabs(): DetailTabConfig[] {
  return [
    { id: 'details', type: 'details', config: {} },
    { id: 'linked', type: 'linked', config: {} },
    { id: 'attachments', type: 'attachments', config: {}, zone: 'sidebar' },
    { id: 'tags', type: 'tags', config: {}, zone: 'sidebar' },
    { id: 'comment', type: 'comment', config: {}, zone: 'activity' },
    { id: 'audit', type: 'audit', config: {}, zone: 'activity' },
  ]
}

/** The four tab types that are platform CHROME rather than per-form
 *  configuration — every record detail page shows them, in the fixed zone
 *  named here, whatever a form's saved detailTabs array happens to say:
 *
 *    Attachments / Tags   -> the narrow right sidebar
 *    Comments / Audit Log -> the full-width activity strip underneath
 *
 *  Two consequences, both deliberate. A type missing from a saved array is
 *  APPENDED (a form saved before these existed — which is every form with
 *  a customized array — would otherwise never get them). A type already
 *  present has its `zone` PINNED, so an existing Audit Log tab moves out
 *  of the main tab bar and down into the activity strip instead of showing
 *  up in both places. Everything else about an admin's entry (its order
 *  within its zone, label override, visibility, renderIf, hidden) is left
 *  exactly as saved — `hidden: true` still suppresses one of these
 *  completely, which is the supported way to turn one off. */
const CHROME_ZONES: Record<string, string> = {
  attachments: 'sidebar',
  tags: 'sidebar',
  comment: 'activity',
  audit: 'activity',
}

/** True for a chrome tab type (see CHROME_ZONES). The Detail Page editing
 *  surfaces (form-builder/config/DetailPageConfigSection.tsx,
 *  detail-page-builder/canvas/TabCard.tsx via ZoneDropZone.tsx) use this to
 *  disable ONLY the Remove action for these types (Hide still works fully):
 *  without it, clicking Remove appears to work for the rest of that editing
 *  session, then silently reverts the next time this form's tabs resolve.
 *  Disabling the button turns that into an honest, explained constraint
 *  instead of a silent surprise. */
export function isAlwaysPresentDetailTab(type: string): boolean {
  return type in CHROME_ZONES
}

/** Resolves a form's configured tab list, falling back to the fixed default
 *  when absent or empty — the latter matters too, not just `undefined`,
 *  since the Form Builder's own "at least one tab" guard prevents saving an
 *  empty array, but a form saved before that guard existed, or one whose
 *  array was cleared by other means, should still show SOMETHING rather
 *  than a blank detail page. Then applies CHROME_ZONES: pinning the zone of
 *  any chrome type already in the array, and appending the ones that
 *  aren't. See that constant's own doc comment for why both halves. */
export function resolveDetailTabs(configured: DetailTabConfig[] | undefined): DetailTabConfig[] {
  const base = configured && configured.length > 0 ? configured : defaultDetailTabs()
  const pinned = base.map((t) => {
    const zone = CHROME_ZONES[t.type]
    return zone && t.zone !== zone ? { ...t, zone } : t
  })
  const present = new Set(pinned.map((t) => t.type))
  const appended = Object.entries(CHROME_ZONES)
    .filter(([type]) => !present.has(type))
    .map(([type, zone]): DetailTabConfig => ({ id: type, type, config: {}, zone }))
  return appended.length > 0 ? [...pinned, ...appended] : pinned
}
