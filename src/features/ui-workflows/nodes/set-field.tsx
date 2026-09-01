import { PenLine, Eye } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { registerUiWorkflowNode, type UiWorkflowNodeConfigPanelProps } from '../node-registry'
import { Field, FieldPicker, VALUE_SOURCE_HINT } from './panel-kit'
import { resolveValue } from '../values'
import { ALL_PLATFORMS } from '../types'
import type { FieldStatePatch } from '../host'

// These two are the reason the field_change trigger is worth having: they act
// on the FORM BEING FILLED rather than on the database. Both need host
// capabilities that only a form surface has, and both say so plainly when
// used somewhere without one — a record action runs against a saved record,
// where there is no field on screen to write into.

// ---------------------------------------------------------------------------
// set_field
// ---------------------------------------------------------------------------

export interface SetFieldStepConfig {
  field: string
  source: 'static' | 'variable' | 'field'
  value?: unknown
  variable?: string
  /** For source 'field': which OTHER field to copy from. */
  from_field?: string
}

export function emptySetFieldConfig(): SetFieldStepConfig {
  return { field: '', source: 'static', value: '' }
}

export function parseSetFieldConfig(raw: unknown): SetFieldStepConfig {
  const empty = emptySetFieldConfig()
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>
  const source = r.source === 'variable' || r.source === 'field' ? r.source : 'static'
  return {
    field: typeof r.field === 'string' ? r.field : empty.field,
    source,
    value: 'value' in r ? r.value : empty.value,
    variable: typeof r.variable === 'string' ? r.variable : undefined,
    from_field: typeof r.from_field === 'string' ? r.from_field : undefined,
  }
}

function SetFieldPanel({ config, onChange, fields }: UiWorkflowNodeConfigPanelProps<SetFieldStepConfig>) {
  return (
    <div className="space-y-2">
      <Field label="Field to set">
        <FieldPicker fields={fields} value={config.field} onChange={(field) => onChange({ ...config, field })} />
      </Field>
      <Field label="Value from" hint={VALUE_SOURCE_HINT}>
        <SelectMenu
          value={config.source}
          onValueChange={(v) => onChange({ ...config, source: v as SetFieldStepConfig['source'] })}
        >
          <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="static" className="text-[12px]">A typed-in value</SelectItem>
            <SelectItem value="variable" className="text-[12px]">A variable</SelectItem>
            <SelectItem value="field" className="text-[12px]">Another field</SelectItem>
          </SelectContent>
        </SelectMenu>
      </Field>
      {config.source === 'static' && (
        <Field label="Value">
          <Input
            value={String(config.value ?? '')}
            onChange={(e) => onChange({ ...config, value: e.target.value })}
            className="h-8 text-[12px]"
          />
        </Field>
      )}
      {config.source === 'variable' && (
        <Field label="Variable">
          <Input
            value={config.variable ?? ''}
            onChange={(e) => onChange({ ...config, variable: e.target.value })}
            className="h-8 font-mono text-[11px]"
          />
        </Field>
      )}
      {config.source === 'field' && (
        <Field label="Copy from">
          <FieldPicker fields={fields} value={config.from_field ?? ''} onChange={(from_field) => onChange({ ...config, from_field })} />
        </Field>
      )}
    </div>
  )
}

registerUiWorkflowNode({
  ConfigPanel: SetFieldPanel,
  type: 'set_field',
  label: 'Set Field',
  icon: PenLine,
  description: 'Fills in a field on the form being filled — not a saved record.',
  category: 'interface',
  platforms: ALL_PLATFORMS,
  configSchema: {
    type: 'object',
    description:
      'Writes a value into the form currently on screen. Nothing is saved by this step; the value is submitted with the rest of the form. Only usable where a form is being filled.',
    required: ['field', 'source'],
    properties: {
      field: { type: 'string', description: 'Key of the field to write.' },
      source: {
        type: 'string',
        enum: ['static', 'variable', 'field'],
        description: 'Where the value comes from.',
      },
      value: { description: "The literal value, when source is 'static'." },
      variable: { type: 'string', description: "Run variable to read, when source is 'variable'." },
      from_field: { type: 'string', description: "Another field to copy, when source is 'field'." },
    },
  },
  execute: ({ config, ctx, host }) => {
    if (!config.field) throw new Error('This step has no field configured.')
    if (!host.setFieldValue) {
      throw new Error('“Set Field” only works where a form is being filled in.')
    }
    host.setFieldValue(
      config.field,
      resolveValue({ source: config.source, value: config.value, variable: config.variable, field: config.from_field }, ctx),
    )
    return { kind: 'next' }
  },
  parseConfig: parseSetFieldConfig,
  createDefaultConfig: emptySetFieldConfig,
})

// ---------------------------------------------------------------------------
// set_field_state
// ---------------------------------------------------------------------------

export interface SetFieldStateStepConfig {
  field: string
  visible?: boolean
  required?: boolean
  readOnly?: boolean
}

export function emptySetFieldStateConfig(): SetFieldStateStepConfig {
  return { field: '' }
}

/** Only keys actually PRESENT are carried through, because absent means "leave
 *  this to the form's own rules" while `false` is an active assertion. Reading
 *  a missing key as false would make every step silently force a field
 *  visible, required-off and editable. */
export function parseSetFieldStateConfig(raw: unknown): SetFieldStateStepConfig {
  const empty = emptySetFieldStateConfig()
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>
  const out: SetFieldStateStepConfig = { field: typeof r.field === 'string' ? r.field : '' }
  if (typeof r.visible === 'boolean') out.visible = r.visible
  if (typeof r.required === 'boolean') out.required = r.required
  if (typeof r.readOnly === 'boolean') out.readOnly = r.readOnly
  return out
}

function StateToggle({ label, value, onChange }: {
  label: string
  value: boolean | undefined
  onChange: (next: boolean | undefined) => void
}) {
  return (
    <label className="flex items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))]">
      <Checkbox
        checked={value === true}
        // Cycles set-true -> unset rather than true/false, so "don't touch it"
        // stays reachable: an unchecked box that meant `false` would force the
        // opposite instead of deferring to the form's own rules.
        onCheckedChange={(v) => onChange(v === true ? true : undefined)}
      />
      {label}
      {value === undefined && <span className="text-[10px]">(left alone)</span>}
    </label>
  )
}

function SetFieldStatePanel({ config, onChange, fields }: UiWorkflowNodeConfigPanelProps<SetFieldStateStepConfig>) {
  return (
    <div className="space-y-2">
      <Field label="Field">
        <FieldPicker fields={fields} value={config.field} onChange={(field) => onChange({ ...config, field })} />
      </Field>
      <Field label="Make it" hint="Unticked means “leave this to the form’s own rules”, not the opposite.">
        <div className="space-y-1">
          <StateToggle label="Visible" value={config.visible} onChange={(visible) => onChange({ ...config, visible })} />
          <StateToggle label="Required" value={config.required} onChange={(required) => onChange({ ...config, required })} />
          <StateToggle label="Read-only" value={config.readOnly} onChange={(readOnly) => onChange({ ...config, readOnly })} />
        </div>
      </Field>
    </div>
  )
}

registerUiWorkflowNode({
  ConfigPanel: SetFieldStatePanel,
  type: 'set_field_state',
  label: 'Show / Hide Field',
  icon: Eye,
  description: 'Makes a field visible, required, or read-only for the rest of this fill.',
  category: 'interface',
  platforms: ALL_PLATFORMS,
  configSchema: {
    type: 'object',
    description:
      "Overrides a field's state on the form being filled. Layered on top of the form's own behavior rules and Advanced Settings rather than replacing them, and an omitted key means “leave it alone” — not false. UI only: the server re-checks what it requires regardless.",
    required: ['field'],
    properties: {
      field: { type: 'string', description: 'Key of the field to affect.' },
      visible: { type: 'boolean', description: 'Omit to leave visibility to the form’s own rules.' },
      required: { type: 'boolean', description: 'Omit to leave requiredness to the form’s own rules.' },
      readOnly: { type: 'boolean', description: 'Omit to leave editability to the form’s own rules.' },
    },
  },
  execute: ({ config, host }) => {
    if (!config.field) throw new Error('This step has no field configured.')
    if (!host.setFieldState) {
      throw new Error('“Show / Hide Field” only works where a form is being filled in.')
    }
    const patch: FieldStatePatch = {}
    if (config.visible !== undefined) patch.visible = config.visible
    if (config.required !== undefined) patch.required = config.required
    if (config.readOnly !== undefined) patch.readOnly = config.readOnly
    host.setFieldState(config.field, patch)
    return { kind: 'next' }
  },
  parseConfig: parseSetFieldStateConfig,
  createDefaultConfig: emptySetFieldStateConfig,
})
