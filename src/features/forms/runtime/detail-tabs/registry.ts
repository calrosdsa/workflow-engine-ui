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

/** The fixed three tabs every form gets when it has never opened the
 *  "Detail Page" config panel (FormSchema.settings.detailTabs absent) —
 *  the single place this default is expressed, so RecordDetailPanel.tsx and
 *  the Form Builder's config panel both resolve identically instead of each
 *  guessing at their own fallback. */
export function defaultDetailTabs(): DetailTabConfig[] {
  return [
    { id: 'details', type: 'details', config: {} },
    { id: 'audit', type: 'audit', config: {} },
    { id: 'linked', type: 'linked', config: {} },
  ]
}

/** Resolves a form's configured tab list, falling back to the fixed default
 *  when absent or empty — the latter matters too, not just `undefined`,
 *  since the Form Builder's own "at least one tab" guard (see
 *  detail-tabs/index.ts's DEFAULT_DETAIL_TABS re-export) prevents saving an
 *  empty array, but a form saved before that guard existed, or one whose
 *  array was cleared by other means, should still show SOMETHING rather
 *  than a blank detail page. */
export function resolveDetailTabs(configured: DetailTabConfig[] | undefined): DetailTabConfig[] {
  return configured && configured.length > 0 ? configured : defaultDetailTabs()
}
