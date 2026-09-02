// ---------------------------------------------------------------------------
// Widget plugin contract
// ---------------------------------------------------------------------------
//
// The interface every widget type implements to become a self-contained
// plugin (docs/dashboard-system-plan.md section 4). Direct structural analog
// of features/menus/menu-registry.ts's MenuTypeRegistryEntry — same
// configPanel/runtimeRenderer/createDefaultConfig split, extended with a
// layout default and a chrome default since widgets (unlike menus) need to
// tell the canvas how much space to claim when first placed.
//
// A widget folder (features/dashboard/widgets/<type>/) implements this
// contract and calls registerWidget() once at import time. Nothing outside
// that folder should import its internals — the registry entry is the only
// public surface. See widget-registry.ts for registration/lookup and
// widgets/index.ts for the single file that imports every widget module.
import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { ConfigSchema } from '@/lib/config-schema'
import type { Menu } from '@/features/menus/types'
import type { WidgetInstance, WidgetLayout, WidgetChrome } from './schema'

export type WidgetCategory = 'Data' | 'Content' | 'Navigation' | 'Embed'

export interface WidgetRendererProps<TConfig> {
  config: TConfig
  instance: WidgetInstance
  clientId: string
  appId: string
  /** The full sibling menu list for this app (from the published snapshot),
   *  mirroring MenuRuntimeRendererProps's `menus` — widgets that navigate
   *  (quick links) or need cross-menu context read this. */
  menus?: Menu[]
  /** Navigate to another menu by slug, mirroring MenuRuntimeRendererProps's
   *  onNavigate. */
  onNavigate?: (slug: string) => void
  /** 'builder' renders live but inert — e.g. links/navigation disabled,
   *  polling paused — so editing the dashboard doesn't trigger side effects
   *  or fire off a stream of background requests while the user is mid-edit.
   *  'runtime' is the real, fully-interactive end-user render. */
  mode: 'builder' | 'runtime'
  /** Set ONLY when this widget instance is rendering inside a detail-page
   *  'custom' tab (FR-D2-015), never for an ordinary Dashboard menu — a
   *  widget that wants to auto-scope itself to "the record this tab is
   *  attached to" (e.g. the table widget's scopeToRecord config, see
   *  widgets/table/schema.ts) reads this; every widget type that doesn't
   *  opt in simply ignores it and renders exactly as it does in a Dashboard
   *  menu today. */
  recordContext?: { formId: string; recordId: string }
}

export interface WidgetConfigPanelProps<TConfig> {
  config: TConfig
  onChange: (config: TConfig) => void
  clientId: string
  appId: string
}

export interface WidgetDefinition<TConfig = unknown> {
  type: string
  label: string
  icon: LucideIcon
  category: WidgetCategory
  description: string
  /** JSON Schema for this widget's config, exported to the backend's
   *  /meta/catalog via src/lib/ui-catalog.ts (the `dashboards` section) —
   *  required so a new widget type cannot register without describing
   *  itself, same drift guard every other UI registry carries. Write it
   *  beside the widget's parseConfig/interface in its schema.ts. */
  configSchema: ConfigSchema
  /** Parses/heals a possibly-stale or malformed config blob into a valid
   *  TConfig, the same defensive role features/page-builder/serialize.ts's
   *  parsePageSchema plays for PageSchema. Must never throw — on anything
   *  it can't make sense of, fall back to createDefaultConfig(). */
  parseConfig: (raw: unknown) => TConfig
  createDefaultConfig: () => TConfig
  defaultLayout: Pick<WidgetLayout, 'w' | 'h' | 'minW' | 'minH'>
  defaultChrome: WidgetChrome
  Renderer: ComponentType<WidgetRendererProps<TConfig>>
  ConfigPanel: ComponentType<WidgetConfigPanelProps<TConfig>>
  /** Optional lightweight stand-in shown on the canvas instead of Renderer
   *  when a live render would be expensive or side-effecting to keep mounted
   *  while dragging/resizing (e.g. a chart re-querying on every resize
   *  tick). Falls back to Renderer with mode='builder' when absent. */
  BuilderPreview?: ComponentType<WidgetRendererProps<TConfig>>
}
