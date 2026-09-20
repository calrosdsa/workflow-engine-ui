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

/** One viewer-supplied input a dashboard declares, so a single control can
 *  narrow many tiles instead of the same filter being pasted into each.
 *
 *  This is the report surface's `arguments[]` model lifted across rather than
 *  a second one invented: a typed, labelled, optionally-defaulted input, with
 *  the comparison OPERATOR living on the binding instead of here, so one
 *  parameter can be `gte` against one tile and `eq` against another. Only the
 *  casing differs — DashboardSchema is UI-owned and camelCase throughout.
 *
 *  `reference` and the report model's `range` flag are deliberately not here
 *  yet; see parameters.ts for what a range would have to decide first. */
export interface DashboardParameter {
  /** Stable identifier a binding points at. */
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'boolean'
  /** Used when the viewer has supplied nothing. An unset parameter with no
   *  default narrows NOTHING — see resolveParameterFilter. */
  default?: string | number | boolean
}

/** Connects one parameter to one field on one widget, with the comparison to
 *  make. Mirrors the report definition's ArgumentBinding, with widgetId where
 *  that has sourceId. */
export interface ParameterBinding {
  parameterKey: string
  widgetId: string
  /** A field on the widget's own form. */
  field: string
  /** Defaults to 'eq' when absent. */
  op?: string
}

export interface DashboardSchema {
  version: 1
  settings: DashboardSettings
  widgets: WidgetInstance[]
  /** Absent on every dashboard authored before parameters existed, which is
   *  why both of these are optional rather than empty arrays. */
  parameters?: DashboardParameter[]
  parameterBindings?: ParameterBinding[]
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
    parameters: {
      type: 'array',
      description: "Viewer-supplied inputs this dashboard declares, so ONE control narrows many tiles instead of the same filter being repeated in each. The same model a report's `arguments` uses. Optional; omit entirely for a dashboard with no parameters. A parameter the viewer leaves unset narrows NOTHING — it does not match nothing. ONLY A DASHBOARD MENU RENDERS THE CONTROL BAR: this same envelope is also what a detail page's 'custom' tab stores, and that surface has no bar, so parameters declared there never receive a value and every binding on them stays inert. Put them on a Dashboard menu.",
      items: {
        type: 'object',
        required: ['key', 'label', 'type'],
        properties: {
          key: { type: 'string', description: 'Stable identifier a binding points at.' },
          label: { type: 'string', description: 'Shown above the control.' },
          type: { type: 'string', enum: ['text', 'number', 'date', 'boolean'] },
          default: { description: 'Used when the viewer supplies nothing. Omit for "no narrowing until they choose".' },
        },
      },
    },
    parameterBindings: {
      type: 'array',
      description: "Connects a parameter to one field on one tile. The comparison operator lives HERE rather than on the parameter, so one parameter can be 'gte' against one tile and 'eq' against another — exactly as a report's argument_bindings work. A binding naming a parameter or widget that no longer exists is skipped at runtime, not an error.",
      items: {
        type: 'object',
        required: ['parameterKey', 'widgetId', 'field'],
        properties: {
          parameterKey: { type: 'string', description: "A key from this dashboard's parameters." },
          widgetId: { type: 'string', description: "A tile's id from this dashboard's widgets." },
          // Deliberately NOT marked fieldRef: that marker's contract is
          // "a field on the form this same config's formId names", and a
          // binding's field belongs to the WIDGET's form, reached via
          // widgetId. Marking it would claim a validation that does not
          // happen.
          field: { type: 'string', description: "A field on that widget's own form." },
          op: { type: 'string', description: "Comparison to apply; defaults to 'eq'. Same operator vocabulary as any filter condition." },
        },
      },
    },
  },
}
