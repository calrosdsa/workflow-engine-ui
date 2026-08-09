// ---------------------------------------------------------------------------
// Dashboard schema
// ---------------------------------------------------------------------------
//
// Structural analog of features/page-builder/schema.ts's PageSchema: stored
// verbatim inside a Dashboard menu's config.schema (see features/menus/types.ts's
// DashboardMenuConfig), opaque to the backend exactly like PageSchema is
// opaque inside a Custom menu's config. See docs/dashboard-system-plan.md
// section 4.1 for the design rationale.
//
// Hierarchy: DashboardSchema → WidgetInstance[], each pointing at a `type`
// key resolved through widget-registry.ts. Unlike PageSchema (a fixed
// sections/columns/components tree), a dashboard is a flat list of
// arbitrarily-positioned tiles on a grid — the grid position IS the layout,
// there's no separate container structure to traverse.
//
// `config: unknown` on WidgetInstance is the load-bearing decision that makes
// the plugin contract real: this file (and everything in canvas/) treats it
// as an opaque blob it serializes, clones, and diffs but never inspects.
// Only the owning widget's own config type (in widgets/<type>/schema.ts)
// gives it shape.

export type LayoutMode = 'grid'

export interface WidgetLayout {
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
}

/** 'card' draws a bordered/titled tile shell around the widget's render
 *  output; 'plain' renders it transparently with no chrome — used by content
 *  widgets (heading, paragraph, ...) so a text-heavy dashboard doesn't look
 *  like a wall of cards. */
export type WidgetChrome = 'card' | 'plain'

export interface WidgetInstance {
  id: string
  /** Registry key — resolved via widget-registry.ts's getWidget(). The ONLY
   *  coupling between a dashboard and any specific widget implementation. */
  type: string
  layout: WidgetLayout
  title?: string
  chrome: WidgetChrome
  /** Widget-owned payload; the dashboard core never inspects this. */
  config: unknown
}

export interface DashboardSettings {
  layoutMode: LayoutMode
  cols: number
  rowHeight: number
  gap: number
  /** px; unset = full-bleed. */
  maxWidth?: number
}

export interface DashboardSchema {
  version: 1
  settings: DashboardSettings
  widgets: WidgetInstance[]
}

export const DEFAULT_DASHBOARD_SETTINGS: DashboardSettings = {
  layoutMode: 'grid',
  cols: 12,
  rowHeight: 40,
  gap: 12,
}

export function emptyDashboardSchema(): DashboardSchema {
  return { version: 1, settings: { ...DEFAULT_DASHBOARD_SETTINGS }, widgets: [] }
}
