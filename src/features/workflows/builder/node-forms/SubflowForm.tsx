// Execute Workflow node — mirrors internal/graph.SubflowConfig. Picks a
// target workflow, maps THIS (calling) workflow's own values into the
// CALLED workflow's declared variables (input_mappings — evaluated at
// dispatch time against this workflow's own Vars/NodeOutputs, see
// internal/activities.SubflowActivity), chooses sync vs. fire-and-forget,
// and — sync only — maps the called workflow's own final variables back
// into this workflow's declared variables (output_mappings).
import { useState } from 'react'
import { Plus, Trash2, Braces, Code2, Settings, ArrowRight, Zap, Hourglass } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ExpressionEditor } from '../ExpressionEditor'
import { WorkflowReferenceSelect } from '../config/WorkflowReferenceSelect'
import { nanoid } from '../nanoid'
import { useWorkflow } from '../../hooks'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, SubflowConfig, SubflowOutputMapping, VariableAssignment, AssignMode } from '../../types'

// normaliseSubflowConfig fills in defaults for a freshly-added node (empty
// definition_id, sync=true, no mappings) and coerces legacy pre-mapping rows
// (just { definition_id }, from before this feature existed) into the
// current shape — every mapping row gets a fresh local `id` for React
// keying, same convention normaliseSetVariableConfig already established.
export function normaliseSubflowConfig(raw: unknown): SubflowConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<SubflowConfig>
  return {
    definition_id: r.definition_id ?? '',
    input_mappings: (r.input_mappings ?? []).map((m) => ({ ...m, id: m.id ?? nanoid() })),
    sync: r.sync ?? true,
    output_mappings: (r.output_mappings ?? []).map((m) => ({ ...m, id: m.id ?? nanoid() })),
  }
}

export interface SubflowFormProps {
  config: SubflowConfig
  variables: VariableDecl[]
  nodeContext?: NodeOutputSchema[]
  onChange: (c: SubflowConfig) => void
}

export function SubflowForm({ config, variables, nodeContext = [], onChange }: SubflowFormProps) {
  const { data: target } = useWorkflow(config.definition_id || '')
  const targetVars = target?.definition.variables ?? []

  const set = (patch: Partial<SubflowConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Workflow to Run</Label>
        <WorkflowReferenceSelect value={config.definition_id || undefined} onChange={(id) => set({ definition_id: id ?? '' })} />
      </div>

      <div className="h-px bg-slate-100" />

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Run Mode</Label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => set({ sync: true })}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-lg border p-2 text-[12px] font-medium transition-colors',
              config.sync ? 'border-indigo-400 bg-indigo-50/60 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
            )}
          >
            <Hourglass size={13} /> Wait for it
          </button>
          <button
            type="button"
            onClick={() => set({ sync: false })}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-lg border p-2 text-[12px] font-medium transition-colors',
              !config.sync ? 'border-indigo-400 bg-indigo-50/60 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
            )}
          >
            <Zap size={13} /> Fire and forget
          </button>
        </div>
        <p className="text-[10px] text-slate-400">
          {config.sync
            ? 'This node waits for the called workflow to finish before continuing — its output can be mapped back below.'
            : 'This node starts the called workflow and continues immediately, without waiting for it to finish.'}
        </p>
      </div>

      {!config.definition_id ? (
        <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-400">
          Pick a workflow above to configure input/output mappings.
        </p>
      ) : (
        <>
          <div className="h-px bg-slate-100" />
          <InputMappingsSection
            mappings={config.input_mappings ?? []}
            targetVars={targetVars}
            callerVars={variables}
            nodeContext={nodeContext}
            onChange={(m) => set({ input_mappings: m })}
          />

          {config.sync && (
            <>
              <div className="h-px bg-slate-100" />
              <OutputMappingsSection
                mappings={config.output_mappings ?? []}
                targetVars={targetVars}
                callerVars={variables}
                onChange={(m) => set({ output_mappings: m })}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Input mappings — target is the CALLED workflow's declared variable,
// value is a literal or an expression evaluated against THIS (caller's)
// Vars/NodeOutputs. Reuses VariableAssignment's shape exactly (same as
// SetVariableForm), just pointed at a different variable list for the
// target dropdown.
// ---------------------------------------------------------------------------

function InputMappingsSection({ mappings, targetVars, callerVars, nodeContext, onChange }: {
  mappings: VariableAssignment[]
  targetVars: VariableDecl[]
  callerVars: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (m: VariableAssignment[]) => void
}) {
  const [editorOpen, setEditorOpen] = useState<string | null>(null)

  const update = (id: string, patch: Partial<VariableAssignment>) => {
    onChange(mappings.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }
  const add = () => {
    onChange([...mappings, { id: nanoid(), variable_name: '', mode: 'literal', literal_value: '', expression: '' }])
  }
  const remove = (id: string) => onChange(mappings.filter((m) => m.id !== id))
  const opening = editorOpen ? mappings.find((m) => m.id === editorOpen) : null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Input Mappings</Label>
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{mappings.length}</span>
      </div>
      <p className="text-[10px] text-slate-400">Set the called workflow's variables before it starts.</p>

      {targetVars.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-400">
          The selected workflow has no declared variables to map into.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {mappings.map((m, idx) => (
              <MappingRow
                key={m.id}
                index={idx}
                targetName={m.variable_name}
                targetOptions={targetVars}
                mode={m.mode}
                literalValue={m.literal_value}
                expression={m.expression}
                onTargetChange={(name) => update(m.id, { variable_name: name, literal_value: '' })}
                onModeChange={(mode) => update(m.id, { mode })}
                onLiteralChange={(v) => update(m.id, { literal_value: v })}
                onExpressionChange={(e) => update(m.id, { expression: e })}
                onOpenEditor={() => setEditorOpen(m.id)}
                onDelete={() => remove(m.id)}
              />
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={add} className="w-full gap-1.5 border-dashed text-slate-500 hover:text-slate-700">
            <Plus size={13} /> Add Input Mapping
          </Button>
        </>
      )}

      {opening && (
        <ExpressionEditor
          open={editorOpen !== null}
          onClose={() => setEditorOpen(null)}
          value={opening.expression ?? ''}
          onChange={(expr) => update(opening.id, { expression: expr })}
          variables={callerVars}
          nodeContext={nodeContext}
          label={opening.variable_name || 'expression'}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Output mappings — source is the CALLED workflow's own final declared
// variable, target is one of THIS (caller's) declared variables. Both sides
// are plain variable-name dropdowns (no literal/expression split — there's
// nothing to evaluate, just a value to copy).
// ---------------------------------------------------------------------------

function OutputMappingsSection({ mappings, targetVars, callerVars, onChange }: {
  mappings: SubflowOutputMapping[]
  targetVars: VariableDecl[]
  callerVars: VariableDecl[]
  onChange: (m: SubflowOutputMapping[]) => void
}) {
  const update = (id: string, patch: Partial<SubflowOutputMapping>) => {
    onChange(mappings.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }
  const add = () => onChange([...mappings, { id: nanoid(), source_variable: '', target_variable: '' }])
  const remove = (id: string) => onChange(mappings.filter((m) => m.id !== id))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Output Mappings</Label>
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{mappings.length}</span>
      </div>
      <p className="text-[10px] text-slate-400">Copy the called workflow's final variables back into this one's.</p>

      {(targetVars.length === 0 || callerVars.length === 0) ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-400">
          {targetVars.length === 0
            ? 'The selected workflow has no declared variables to read from.'
            : 'Declare variables in this workflow first to have somewhere to store the result.'}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {mappings.map((m, idx) => (
              <div key={m.id} className="group flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500">
                  {idx + 1}
                </span>
                <select
                  value={m.source_variable}
                  onChange={(e) => update(m.id, { source_variable: e.target.value })}
                  className="w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] font-medium text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">Called var…</option>
                  {targetVars.map((v) => (
                    <option key={v.name} value={v.name}>{v.name} ({v.type})</option>
                  ))}
                </select>
                <ArrowRight size={12} className="shrink-0 text-slate-300" />
                <select
                  value={m.target_variable}
                  onChange={(e) => update(m.id, { target_variable: e.target.value })}
                  className="w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] font-medium text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">This var…</option>
                  {callerVars.map((v) => (
                    <option key={v.name} value={v.name}>{v.name} ({v.type})</option>
                  ))}
                </select>
                <button
                  onClick={() => remove(m.id)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-red-50 hover:text-red-400"
                  title="Remove mapping"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={add} className="w-full gap-1.5 border-dashed text-slate-500 hover:text-slate-700">
            <Plus size={13} /> Add Output Mapping
          </Button>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// One input-mapping row — target dropdown (called workflow's vars) + a
// literal/expression value, mirroring SetVariableForm's AssignmentRow.
// ---------------------------------------------------------------------------

function MappingRow({
  index, targetName, targetOptions, mode, literalValue, expression,
  onTargetChange, onModeChange, onLiteralChange, onExpressionChange, onOpenEditor, onDelete,
}: {
  index: number
  targetName: string
  targetOptions: VariableDecl[]
  mode: AssignMode
  literalValue: unknown
  expression?: string
  onTargetChange: (name: string) => void
  onModeChange: (mode: AssignMode) => void
  onLiteralChange: (v: unknown) => void
  onExpressionChange: (e: string) => void
  onOpenEditor: () => void
  onDelete: () => void
}) {
  const selVar = targetOptions.find((v) => v.name === targetName)

  return (
    <div className="group relative rounded-xl border border-slate-200 bg-slate-50/60 p-3 transition-shadow hover:shadow-sm">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500">
          {index + 1}
        </span>
        <div className="flex-1">
          <select
            value={targetName}
            onChange={(e) => onTargetChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">Called workflow's variable…</option>
            {targetOptions.map((v) => (
              <option key={v.name} value={v.name}>{v.name} ({v.type})</option>
            ))}
          </select>
        </div>
        <button
          onClick={onDelete}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-red-50 hover:text-red-400"
          title="Remove mapping"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="mb-2 flex gap-1.5 rounded-lg bg-white p-1 border border-slate-200">
        {(['literal', 'expression'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium transition-colors',
              mode === m ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {m === 'literal' ? <Settings size={10} /> : <Code2 size={10} />}
            {m === 'literal' ? 'Static' : 'Expression'}
          </button>
        ))}
      </div>

      {mode === 'literal' && (
        <LiteralInput varType={selVar?.type ?? 'string'} value={literalValue} onChange={onLiteralChange} />
      )}

      {mode === 'expression' && (
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Braces size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-400" />
            <input
              value={expression ?? ''}
              onChange={(e) => onExpressionChange(e.target.value)}
              placeholder='e.g. Vars["orderId"]'
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-7 pr-2 font-mono text-[11px] text-slate-700 placeholder:text-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <button
            onClick={onOpenEditor}
            title="Open expression editor"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
          >
            <Code2 size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

function LiteralInput({ varType, value, onChange }: {
  varType: VariableDecl['type']
  value: unknown
  onChange: (v: unknown) => void
}) {
  const str = value === undefined || value === null ? '' : String(value)

  if (varType === 'boolean') {
    return (
      <select
        value={str}
        onChange={(e) => onChange(e.target.value === 'true' ? true : e.target.value === 'false' ? false : '')}
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      >
        <option value="">—</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    )
  }

  const inputTypeMap: Record<string, string> = {
    integer: 'number', float: 'number', time: 'time', datetime: 'datetime-local',
  }

  return (
    <Input
      type={inputTypeMap[varType] ?? 'text'}
      step={varType === 'float' ? '0.01' : undefined}
      value={str}
      placeholder={varType === 'string' ? 'Enter value…' : undefined}
      onChange={(e) => {
        const raw = e.target.value
        if (raw === '') { onChange(''); return }
        if (varType === 'integer') { onChange(parseInt(raw, 10)); return }
        if (varType === 'float') { onChange(parseFloat(raw)); return }
        onChange(raw)
      }}
      className="text-sm"
    />
  )
}
