// ---------------------------------------------------------------------------
// Custom record-action plugin contract (FR-D2-017)
// ---------------------------------------------------------------------------
//
// Structural analog of detail-tabs/contract.ts's DetailTabDefinition<TConfig>
// — same parseConfig/createDefaultConfig/ConfigPanel split. `MenuItem`
// replaces `Renderer`: an action has no persistent visual output of its own
// beyond the menu entry it contributes, but it still needs to be a real
// component (not a plain function) so a type like `update_field` can call
// useUpdateRecord and other hooks directly, the same way any other React
// component in this codebase would.
import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { FormSchema } from '@/features/form-builder/schema'
import type { FormRecord } from '@/features/forms/types'

export interface CustomActionMenuItemProps<TConfig> {
  formId: string
  recordId: string
  record: FormRecord
  schema?: FormSchema
  config: TConfig
  /** The admin-authored CustomActionConfig.label — always the menu item's
   *  visible text; unlike a detail tab (which falls back to the registry's
   *  own default label), a custom action has no sensible generic default,
   *  so this is always real, non-empty text by the time it reaches here. */
  label: string
  /** Called after this action's own effect completes (success or handled
   *  failure) so the toolbar can close the dropdown menu — mirrors how
   *  RecordDetailToolbar's existing Delete/account actions close their own
   *  dialogs on completion. Optional: an action type with no natural
   *  "done" moment (none exist yet) can leave the menu open. */
  onDone?: () => void
}

export interface CustomActionConfigPanelProps<TConfig> {
  config: TConfig
  onChange: (config: TConfig) => void
  /** The OWNING form's id/schema — an update_field action's field picker
   *  needs the form's own field list to restrict valid targets, the same
   *  way related_form's target-field picker (FR-D2-015) needs formId. */
  formId: string
  schema?: FormSchema
}

export interface CustomActionDefinition<TConfig = unknown> {
  type: string
  label: string
  icon: LucideIcon
  description: string
  /** Parses/heals a possibly-stale or malformed config blob, the same
   *  defensive role DetailTabDefinition.parseConfig plays. Must never throw. */
  parseConfig: (raw: unknown) => TConfig
  createDefaultConfig: () => TConfig
  MenuItem: ComponentType<CustomActionMenuItemProps<TConfig>>
  ConfigPanel: ComponentType<CustomActionConfigPanelProps<TConfig>>
}
