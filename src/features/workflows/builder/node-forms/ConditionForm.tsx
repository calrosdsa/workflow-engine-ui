import { useState } from 'react'
import { Braces, Code2, ListFilter, Split } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ExpressionEditor } from '../ExpressionEditor'
import { FilterBuilder, newGroup } from '../FilterBuilder'
import { useBuilderStore } from '../store'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, ConditionConfig, FilterGroup } from '../../types'
import type { FieldDef, FieldType } from '@/features/forms/types'

// condition — no normalisation needed; the config shape has been stable
// since the DAG redesign and is safe to cast directly (the structured
// `condition` field is a pure addition).
export function normaliseConditionConfig(raw: unknown): ConditionConfig {
  return (raw ?? {}) as ConditionConfig
}

/** Declared variable types → the field types FilterBuilder picks operators
 *  by. Compile-shaped as a Record so a new variable type fails here until
 *  mapped (same trick the ui-catalog description maps use). */
const VAR_TYPE_TO_FIELD_TYPE: Record<string, FieldType> = {
  string: 'string', integer: 'integer', float: 'decimal', boolean: 'boolean',
  time: 'date', datetime: 'datetime', object: 'json', list: 'json',
}

/** The structured builder's addressable "fields": declared variables plus
 *  the triggering record's fields (the trigger's `(triggering record)`
 *  schema entries). Both resolve as Vars[field] when the backend compiles
 *  the group — declared variables winning a name collision — so offering
 *  them in one list matches exactly what the expression will read. */
function conditionFields(variables: VariableDecl[], nodeContext: NodeOutputSchema[]): FieldDef[] {
  const out = new Map<string, FieldDef>()
  for (const s of nodeContext) {
    if (s.root !== 'trigger_record') continue
    for (const f of s.fields) {
      out.set(f.key, { name: f.key, label: `${f.key} (record)`, type: (f.type as FieldType) || 'string' })
    }
  }
  for (const v of variables) {
    out.set(v.name, { name: v.name, label: `${v.name} (variable)`, type: VAR_TYPE_TO_FIELD_TYPE[v.type] ?? 'string' })
  }
  return [...out.values()]
}

export interface ConditionFormProps {
  config: ConditionConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: ConditionConfig) => void
}

export function ConditionForm({ config, variables, nodeContext, onChange }: ConditionFormProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  // Expression mode only when an expression was actually authored — the
  // structured builder is the default for new nodes.
  const [mode, setMode] = useState<'builder' | 'expression'>(config.expression ? 'expression' : 'builder')

  const selectedNodeId = useBuilderStore((s) => s.selectedNodeId)
  const node = useBuilderStore((s) => s.nodes.find((n) => n.id === s.selectedNodeId))
  const setConditionFalseBranch = useBuilderStore((s) => s.setConditionFalseBranch)
  const twoWay = (node?.data.outputs?.length ?? 1) > 1

  const group: FilterGroup = config.condition ?? newGroup()
  const fields = conditionFields(variables, nodeContext)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          Condition
        </Label>
        <div className="flex overflow-hidden rounded-lg border border-[hsl(var(--border))]">
          {([['builder', ListFilter, 'Builder'], ['expression', Code2, 'Expression']] as const).map(([m, Icon, lbl]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium transition-colors ${
                mode === m
                  ? 'bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'
              }`}
            >
              <Icon size={11} />
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {mode === 'builder' && (
        <FilterBuilder
          group={group}
          fields={fields}
          variables={variables}
          nodeContext={nodeContext}
          onChange={(g) => onChange({ condition: g })}
        />
      )}

      {mode === 'expression' && (
        <>
          <div className="relative">
            <Braces size={11} className="absolute left-2.5 top-2.5 text-[hsl(var(--primary))]" />
            <textarea
              value={config.expression ?? ''}
              onChange={(e) => onChange({ expression: e.target.value })}
              rows={3}
              placeholder={`e.g. TriggerRecord["status"] == "New"`}
              className="w-full resize-y rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] py-2 pl-7 pr-3 font-mono text-[11px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]/60 focus:border-[hsl(var(--primary))] focus:bg-[hsl(var(--card))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/15"
            />
          </div>
          <button
            onClick={() => setEditorOpen(true)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10 transition-colors"
          >
            <Code2 size={11} />
            Open editor
          </button>
        </>
      )}

      <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <Split size={12} className="text-[hsl(var(--muted-foreground))]" />
          <div>
            <p className="text-[11px] font-medium text-[hsl(var(--foreground))]">Two-path branch</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {twoWay
                ? 'Routes to a true or false output.'
                : 'Off: continues only when the condition is true.'}
            </p>
          </div>
        </div>
        <Switch
          checked={twoWay}
          onCheckedChange={(v) => selectedNodeId && setConditionFalseBranch(selectedNodeId, v)}
        />
      </div>

      <ExpressionEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        value={config.expression ?? ''}
        onChange={(expr) => onChange({ expression: expr })}
        variables={variables}
        nodeContext={nodeContext}
        label="condition"
      />
    </div>
  )
}
