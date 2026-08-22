// ---------------------------------------------------------------------------
// Detail-tab plugin contract (FR-D2-015)
// ---------------------------------------------------------------------------
//
// Structural analog of features/dashboard/widget-contract.ts's
// WidgetDefinition<TConfig> — same parseConfig/createDefaultConfig/Renderer/
// ConfigPanel split. defaultLayout/defaultChrome/BuilderPreview (grid-tile
// concerns, meaningful for a dashboard tile) are NOT carried over — a tab has
// no tile geometry, just a position in an ordered list.
//
// A tab-type folder (features/forms/runtime/detail-tabs/<type>/) implements
// this contract and calls registerDetailTab() once at import time. See
// registry.ts for registration/lookup and index.ts for the single file that
// imports every built-in tab type.
import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { FormSchema } from '@/features/form-builder/schema'
import type { FieldDef } from '@/features/forms/types'

/** Shared cycle-protection cap for any tab type that can nest another
 *  DetailTabList inside itself (currently 'group' and 'details' — a
 *  Details' own childTabs, or a group's own tabs, can each contain the
 *  other, or another instance of the same type). Nothing in the registry/
 *  schema prevents an admin from configuring a self-referential nesting;
 *  this caps it at a depth no legitimate layout would ever need instead of
 *  recursing until the browser tab crashes. One shared constant so both
 *  types agree on the same limit rather than drifting independently. */
export const MAX_GROUP_DEPTH = 4

export interface DetailTabRendererProps<TConfig> {
  formId: string
  recordId: string
  fields: FieldDef[]
  schema?: FormSchema
  config: TConfig
  /** Called with a (formId, recordId) pair when the tab's own content wants
   *  to jump to a different record — same contract as RecordDetailPanel's
   *  own onNavigateToRecord prop, threaded straight through so a
   *  related_form tab's row-click can reuse it without RecordDetailPanel
   *  special-casing tab types. */
  onNavigateToRecord?: (formId: string, recordId: string) => void
  /** related_form-only: called once this tab's own data has loaded, with
   *  whether it came back empty — RecordDetailPanel uses this to hide the
   *  tab (trigger AND content) retroactively when hideWhenEmpty is set,
   *  since "does this tab have any records" can only be known after this
   *  tab's own Renderer has fetched, unlike visibility/renderIf which
   *  resolve before any tab-specific data fetch happens. Every other tab
   *  type ignores this — optional and unused, same as the edit-mode props. */
  onEmptyResolved?: (empty: boolean) => void
  /** group-only: how many `group` levels deep this Renderer call is — 0 at
   *  the top level, incremented once per nested group. Lets the group type
   *  refuse to recurse past a sane depth cap rather than stack-overflow on
   *  a config cycle (a group containing itself, directly or via several
   *  groups) nothing in the registry/schema otherwise prevents. Every other
   *  tab type ignores this — optional and unused, same as onEmptyResolved. */
  groupDepth?: number
}

export interface DetailTabConfigPanelProps<TConfig> {
  config: TConfig
  onChange: (config: TConfig) => void
  /** The OWNING form's id — a related_form tab's target-form/field pickers
   *  need this to restrict valid choices to forms that actually reference
   *  it back. */
  formId: string
}

export interface DetailTabDefinition<TConfig = unknown> {
  type: string
  label: string
  icon: LucideIcon
  description: string
  /** Built-in types (details/audit/linked) are structural extractions of
   *  today's fixed tabs, always present by default and not deletable
   *  outright (only hideable) — see registry.ts's resolveDetailTabs. */
  builtin?: boolean
  /** Parses/heals a possibly-stale or malformed config blob, the same
   *  defensive role WidgetDefinition.parseConfig plays. Must never throw. */
  parseConfig: (raw: unknown) => TConfig
  createDefaultConfig: () => TConfig
  Renderer: ComponentType<DetailTabRendererProps<TConfig>>
  /** Absent for built-in types (config: {}, nothing to configure beyond the
   *  shared label/visibility/renderIf fields every tab already gets). */
  ConfigPanel?: ComponentType<DetailTabConfigPanelProps<TConfig>>
}
