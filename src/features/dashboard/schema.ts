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

// ---------------------------------------------------------------------------
// Envelope schemas — exported to /meta/catalog via src/lib/ui-catalog.ts
// ---------------------------------------------------------------------------
//
// JSON Schema descriptions of the wrapper objects above, living beside the
// interfaces they describe for the same same-folder drift defense the
// form-builder and ui-workflows envelopes use. The per-widget config shapes
// are NOT repeated here — each widget's registry entry carries its own
// configSchema, and this envelope only points at that vocabulary.
import type { ConfigSchema } from '@/lib/config-schema'

export const WIDGET_INSTANCE_ENVELOPE_SCHEMA: ConfigSchema = {
  type: 'object',
  description: "One tile on the grid. `type` names a widget from this catalog's dashboards.widgets and that widget's config_schema governs `config` — this envelope never interprets it.",
  required: ['id', 'type', 'layout', 'chrome'],
  properties: {
    id: { type: 'string', description: 'Stable identifier, unique within the dashboard.' },
    type: { type: 'string', description: "Widget registry key, e.g. 'chart'." },
    layout: {
      type: 'object',
      required: ['x', 'y', 'w', 'h'],
      properties: {
        x: { type: 'integer', description: 'Left column (0-based), in grid columns.' },
        y: { type: 'integer', description: 'Top row (0-based), in grid rows.' },
        w: { type: 'integer', description: 'Width in grid columns.' },
        h: { type: 'integer', description: 'Height in grid rows.' },
        minW: { type: 'integer' },
        minH: { type: 'integer' },
      },
      description: 'Grid position and size. The grid position IS the layout — tiles have no container structure. x + w must not exceed settings.cols; overlapping tiles are a mistake, not layering.',
    },
    title: { type: 'string', description: "Heading on the tile's card chrome. Ignored for chrome 'plain'." },
    chrome: { type: 'string', enum: ['card', 'plain'], description: "card = bordered, titled tile; plain = transparent, no chrome (the content widgets' default)." },
    config: { type: 'object', description: "The widget type's own payload; see that widget's config_schema." },
  },
}

export const DASHBOARD_ENVELOPE_SCHEMA: ConfigSchema = {
  type: 'object',
  description: "The widget grid a Dashboard menu stores as config.schema — and a detail page's 'custom' tab stores in its own config.schema. A flat list of positioned tiles; a canvas holding only content widgets is a page.",
  required: ['version', 'settings', 'widgets'],
  properties: {
    version: { type: 'integer', enum: [1] },
    settings: {
      type: 'object',
      required: ['layoutMode', 'cols', 'rowHeight', 'gap'],
      properties: {
        layoutMode: { type: 'string', enum: ['grid'] },
        cols: { type: 'integer', description: `Grid columns. Default ${DEFAULT_DASHBOARD_SETTINGS.cols}.` },
        rowHeight: { type: 'integer', description: `Row height in px. Default ${DEFAULT_DASHBOARD_SETTINGS.rowHeight}.` },
        gap: { type: 'integer', description: `Gap between tiles in px. Default ${DEFAULT_DASHBOARD_SETTINGS.gap}.` },
        maxWidth: { type: 'integer', description: 'Canvas max width in px; omit for full-bleed.' },
      },
    },
    widgets: { type: 'array', description: 'Tiles, per dashboards.widget_envelope.', items: { type: 'object' } },
  },
}
