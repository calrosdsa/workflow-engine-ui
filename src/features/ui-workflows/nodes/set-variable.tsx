import { Variable } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { registerUiWorkflowNode, type UiWorkflowNodeConfigPanelProps } from '../node-registry'
import { Field, FieldPicker, VALUE_SOURCE_HINT } from './panel-kit'
import { resolveValue } from '../values'
import { ALL_PLATFORMS } from '../types'

/** Run-local scratch state. Nothing here is persisted: a UI workflow run has
 *  no durability at all, and variables die with it. */
export interface SetVariableStepConfig {
  name: string
  /** 'static' writes `value` as-is; 'field' copies the named field's current
   *  value off the record/form the workflow is acting on. No expression mode:
   *  Expr is a Go library with no client evaluator, so an expression here
   *  would mean a round-trip per step. */
  source: 'static' | 'field'
  value?: unknown
  field?: string
}

export function emptySetVariableConfig(): SetVariableStepConfig {
  return { name: '', source: 'static', value: '' }
}

export function parseSetVariableConfig(raw: unknown): SetVariableStepConfig {
  const empty = emptySetVariableConfig()
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>
  return {
    name: typeof r.name === 'string' ? r.name : empty.name,
    source: r.source === 'field' ? 'field' : 'static',
    value: 'value' in r ? r.value : empty.value,
    field: typeof r.field === 'string' ? r.field : undefined,
  }
}

function SetVariablePanel({ config, onChange, fields }: UiWorkflowNodeConfigPanelProps<SetVariableStepConfig>) {
  return (
    <div className="space-y-2">
      <Field label="Variable name" hint="Later steps read this by name.">
        <Input
          value={config.name}
          onChange={(e) => onChange({ ...config, name: e.target.value })}
          placeholder="total"
          className="h-8 text-[12px]"
        />
      </Field>
      <Field label="Value from" hint={VALUE_SOURCE_HINT}>
        <SelectMenu
          value={config.source}
          onValueChange={(v) => onChange({ ...config, source: v as SetVariableStepConfig['source'] })}
        >
          <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="static" className="text-[12px]">A typed-in value</SelectItem>
            <SelectItem value="field" className="text-[12px]">A field on this record</SelectItem>
          </SelectContent>
        </SelectMenu>
      </Field>
      {config.source === 'static' ? (
        <Field label="Value">
          <Input
            value={String(config.value ?? '')}
            onChange={(e) => onChange({ ...config, value: e.target.value })}
            className="h-8 text-[12px]"
          />
        </Field>
      ) : (
        <Field label="Field">
          <FieldPicker
            fields={fields}
            value={config.field ?? ''}
            onChange={(field) => onChange({ ...config, field })}
          />
        </Field>
      )}
    </div>
  )
}

registerUiWorkflowNode({
  ConfigPanel: SetVariablePanel,
  type: 'set_variable',
  label: 'Set Variable',
  icon: Variable,
  description: 'Stores a value under a name for later steps in this run to read.',
  category: 'flow',
  platforms: ALL_PLATFORMS,
  configSchema: {
    type: 'object',
    description:
      'Writes a run-local variable. Values live only for the duration of the run — a UI workflow has no durability.',
    required: ['name', 'source'],
    properties: {
      name: { type: 'string', description: 'Variable name later steps read.' },
      source: {
        type: 'string',
        enum: ['static', 'field'],
        description: "'static' writes `value`; 'field' copies the named field's current value.",
      },
      value: { description: "The literal value written when source is 'static'." },
      field: { type: 'string', description: "Field key to copy when source is 'field'." },
    },
  },
  execute: ({ config, ctx }) => {
    // An unnamed variable is a half-configured step, not a reason to fail the
    // run: writing to key "" would silently create a variable nothing can
    // ever read, which is worse than doing nothing.
    if (config.name) {
      ctx.variables[config.name] = resolveValue(
        { source: config.source, value: config.value, field: config.field },
        ctx,
      )
    }
    return { kind: 'next' }
  },
  parseConfig: parseSetVariableConfig,
  createDefaultConfig: emptySetVariableConfig,
})
