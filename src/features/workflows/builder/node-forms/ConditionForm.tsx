import { useState } from 'react'
import { Braces, Code2, ListFilter, Split } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { ExpressionEditor } from '../ExpressionEditor'
import { FilterBuilder, newGroup, type FieldGroup } from '../FilterBuilder'
import { useBuilderStore } from '../store'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, ConditionConfig, FilterGroup } from '../../types'
import type { FieldType } from '@/features/forms/types'
import { useI18n } from '@/features/i18n/I18nProvider'

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

/** The structured builder's addressable fields, grouped for display: one
 *  section for the trigger's record fields, one for declared workflow
 *  variables. Both resolve as Vars[field] when the backend compiles the
 *  group (a Trigger Record field is overlaid into Vars for exactly this
 *  reason — see internal/activities/helpers.go) — that's also why an
 *  upstream node's own output (e.g. a Fetch Records node's found record)
 *  can't be offered here: NodeOutputs["<nodeId>"][...] lives in a separate
 *  namespace the structured Field compiler never reads. Reaching one
 *  requires either a Set Variable node bridging it into a workflow variable
 *  first, or switching this condition to Expression mode, whose editor
 *  already browses every upstream node's outputs (grouped exactly like
 *  this) via nodeContext.
 *
 *  A variable sharing a name with a trigger field appears in both groups —
 *  picking either produces the same `field` string, so both resolve to
 *  whichever value actually ended up in Vars at runtime (the variable, per
 *  the collision rule above) rather than being silently deduped away. */
function conditionFieldGroups(variables: VariableDecl[], nodeContext: NodeOutputSchema[]): FieldGroup[] {
  const groups: FieldGroup[] = []

  const triggerSchema = nodeContext.find((s) => s.root === 'trigger_record')
  if (triggerSchema && triggerSchema.fields.length > 0) {
    groups.push({
      label: 'Trigger Record',
      fields: triggerSchema.fields.map((f) => ({ name: f.key, label: f.label || f.key, type: (f.type as FieldType) || 'string' })),
    })
  }

  if (variables.length > 0) {
    groups.push({
      label: 'Workflow Variables',
      fields: variables.map((v) => ({ name: v.name, label: v.name, type: VAR_TYPE_TO_FIELD_TYPE[v.type] ?? 'string' })),
    })
  }

  return groups
}

export interface ConditionFormProps {
  config: ConditionConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: ConditionConfig) => void
}

export function ConditionForm({ config, variables, nodeContext, onChange }: ConditionFormProps) {
  const { t } = useI18n()
  const [editorOpen, setEditorOpen] = useState(false)
  // Expression mode only when an expression was actually authored — the
  // structured builder is the default for new nodes.
  const [mode, setMode] = useState<'builder' | 'expression'>(config.expression ? 'expression' : 'builder')

  const selectedNodeId = useBuilderStore((s) => s.selectedNodeId)
  const node = useBuilderStore((s) => s.nodes.find((n) => n.id === s.selectedNodeId))
  const setConditionFalseBranch = useBuilderStore((s) => s.setConditionFalseBranch)
  const twoWay = (node?.data.outputs?.length ?? 1) > 1

  const group: FilterGroup = config.condition ?? newGroup()
  const fieldGroups = conditionFieldGroups(variables, nodeContext)
  const fields = fieldGroups.flatMap((g) => g.fields)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          {t('workflows.node_forms.condition')}
        </Label>
        <div className="flex overflow-hidden rounded-lg border border-[hsl(var(--border))]">
          {([['builder', ListFilter, t('workflows.node_forms.builder')], ['expression', Code2, t('workflows.node_forms.expression')]] as const).map(([m, Icon, lbl]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                'flex items-center gap-1 px-2 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--ring))]',
                mode === m
                  ? 'bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]',
              )}
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
          fieldGroups={fieldGroups}
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
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--primary))]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          >
            <Code2 size={11} />
            {t('workflows.node_forms.open_editor')}
          </button>
        </>
      )}

      {/* The whole row is the click target (via the <label>/htmlFor pairing
          below, which native-forwards a click to the Switch's own button) —
          not just the small thumb — and the icon picks up the accent color
          live so the row visibly confirms its own state at a glance. */}
      <label
        htmlFor="condition-two-path-branch"
        className={cn(
          'flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border))] px-3 py-2 transition-colors hover:bg-[hsl(var(--muted))]/60',
          twoWay ? 'bg-[hsl(var(--primary))]/5' : 'bg-[hsl(var(--muted))]/40',
        )}
      >
        <div className="flex items-center gap-2">
          <Split size={12} className={cn('transition-colors', twoWay ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]')} />
          <div>
            <p className="text-[11px] font-medium text-[hsl(var(--foreground))]">{t('workflows.node_forms.two_path')}</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {twoWay
                ? t('workflows.node_forms.routes_true_false')
                : t('workflows.node_forms.true_only')}
            </p>
          </div>
        </div>
        <Switch
          id="condition-two-path-branch"
          checked={twoWay}
          onCheckedChange={(v) => selectedNodeId && setConditionFalseBranch(selectedNodeId, v)}
        />
      </label>

      <ExpressionEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        value={config.expression ?? ''}
        onChange={(expr) => onChange({ expression: expr })}
        variables={variables}
        nodeContext={nodeContext}
        label={t('workflows.node_forms.condition')}
      />
    </div>
  )
}
