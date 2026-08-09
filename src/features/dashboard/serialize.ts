// Mirror of features/page-builder/serialize.ts's parsePageSchema — a
// defensive normalizer, not a full bridge layer. DashboardSchema is already
// typed on the wire (inside DashboardMenuConfig.schema), so this guards
// against unexpected/legacy shapes (e.g. {} from a menu created before this
// schema existed) and, unlike PageSchema, against widget instances whose
// `type` no longer resolves in the registry (a widget plugin removed or
// renamed after a dashboard was built with it).
//
// Unknown-type widgets are NOT dropped — they round-trip through
// parseDashboardSchema untouched (id/layout/config preserved) so re-saving a
// dashboard that has one open never silently deletes user data. The canvas
// is what decides how to render them (see widget-registry.ts's getWidget
// returning undefined → an "Unavailable widget" fallback tile), not this
// parser.
import type { DashboardSchema, WidgetInstance } from './schema'
import { emptyDashboardSchema, DEFAULT_DASHBOARD_SETTINGS } from './schema'

function isWidgetInstance(v: unknown): v is WidgetInstance {
  if (!v || typeof v !== 'object') return false
  const w = v as Record<string, unknown>
  if (typeof w.id !== 'string' || typeof w.type !== 'string') return false
  if (!w.layout || typeof w.layout !== 'object') return false
  const l = w.layout as Record<string, unknown>
  return typeof l.x === 'number' && typeof l.y === 'number' && typeof l.w === 'number' && typeof l.h === 'number'
}

export function parseDashboardSchema(raw: unknown): DashboardSchema {
  if (!raw) return emptyDashboardSchema()
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!obj || typeof obj !== 'object') return emptyDashboardSchema()
    const o = obj as Partial<DashboardSchema>
    const widgets = Array.isArray(o.widgets) ? o.widgets.filter(isWidgetInstance) : []
    const settings = { ...DEFAULT_DASHBOARD_SETTINGS, ...(o.settings ?? {}) }
    return { version: 1, settings, widgets }
  } catch {
    // fall through
  }
  return emptyDashboardSchema()
}
