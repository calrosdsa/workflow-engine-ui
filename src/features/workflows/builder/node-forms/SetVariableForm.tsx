import { useState } from 'react'
import { Plus, Trash2, Braces, Code2, Settings } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ExpressionEditor } from '../ExpressionEditor'
import { nanoid } from '../nanoid'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, SetVariableConfig, VariableAssignment, AssignMode } from '../../types'

// Normalise legacy single-assignment payload into the new shape
export function normaliseSetVariableConfig(raw: unknown): SetVariableConfig {
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>
    if (Array.isArray(r.assignments)) return raw as SetVariableConfig
    // Legacy shape
    if (r.variable_name) {
      return {
        assignments: [{
          id:            nanoid(),
          variable_name: String(r.variable_name),
          mode:          (r.mode as AssignMode) ?? 'literal',
          literal_value: r.literal_value,
          expression:    String(r.expression ?? ''),
        }],
      }
    }
  }
  return { assignments: [] }
}

// ---------------------------------------------------------------------------
// set_variable — multi-assignment form
// ---------------------------------------------------------------------------

export interface SetVariableFormProps {
  config: SetVariableConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: SetVariableConfig) => void
}

export function SetVariableForm({ config, variables, nodeContext, onChange }: SetVariableFormProps) {
  const [editorOpen, setEditorOpen] = useState<string | null>(null) // assignment id

  const assignments = config.assignments ?? []

  const update = (id: string, patch: Partial<VariableAssignment>) => {
    onChange({
      assignments: assignments.map((a) => a.id === id ? { ...a, ...patch } : a),
    })
  }

  const add = () => {
    onChange({
      assignments: [
        ...assignments,
        { id: nanoid(), variable_name: '', mode: 'literal', literal_value: '', expression: '' },
      ],
    })
  }

  const remove = (id: string) => {
    onChange({ assignments: assignments.filter((a) => a.id !== id) })
  }

  const openingAssignment = editorOpen ? assignments.find((a) => a.id === editorOpen) : null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Variable Assignments
        </Label>
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
          {assignments.length}
        </span>
      </div>

      {variables.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
          Declare variables in the Variables panel first.
        </div>
      )}

      {assignments.length === 0 && variables.length > 0 && (
        <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
          No assignments yet — click Add below.
        </div>
      )}

      <div className="space-y-2">
        {assignments.map((a, idx) => (
          <AssignmentRow
            key={a.id}
            index={idx}
            assignment={a}
            variables={variables}
            onChange={(patch) => update(a.id, patch)}
            onDelete={() => remove(a.id)}
            onOpenEditor={() => setEditorOpen(a.id)}
          />
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={add}
        disabled={variables.length === 0}
        className="w-full gap-1.5 border-dashed text-slate-500 hover:text-slate-700"
      >
        <Plus size={13} />
        Add Variable
      </Button>

      {/* Expression editor dialog */}
      {openingAssignment && (
        <ExpressionEditor
          open={editorOpen !== null}
          onClose={() => setEditorOpen(null)}
          value={openingAssignment.expression ?? ''}
          onChange={(expr) => update(openingAssignment.id, { expression: expr })}
          variables={variables}
          nodeContext={nodeContext}
          label={openingAssignment.variable_name || 'expression'}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single assignment row
// ---------------------------------------------------------------------------

interface AssignmentRowProps {
  index: number
  assignment: VariableAssignment
  variables: VariableDecl[]
  onChange: (patch: Partial<VariableAssignment>) => void
  onDelete: () => void
  onOpenEditor: () => void
}

function AssignmentRow({ index, assignment, variables, onChange, onDelete, onOpenEditor }: AssignmentRowProps) {
  const selVar = variables.find((v) => v.name === assignment.variable_name)

  return (
    <div className="group relative rounded-xl border border-slate-200 bg-slate-50/60 p-3 transition-shadow hover:shadow-sm">
      {/* Row header: index + variable selector + delete */}
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500">
          {index + 1}
        </span>
        <div className="flex-1">
          <select
            value={assignment.variable_name}
            onChange={(e) => onChange({ variable_name: e.target.value, literal_value: '' })}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">Select variable…</option>
            {variables.map((v) => (
              <option key={v.name} value={v.name}>{v.name} ({v.type})</option>
            ))}
          </select>
        </div>
        <button
          onClick={onDelete}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-red-50 hover:text-red-400"
          title="Remove assignment"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Mode toggle */}
      <div className="mb-2 flex gap-1.5 rounded-lg bg-white p-1 border border-slate-200">
        {(['literal', 'expression'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange({ mode: m })}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium transition-colors',
              assignment.mode === m
                ? 'bg-indigo-500 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {m === 'literal' ? <Settings size={10} /> : <Code2 size={10} />}
            {m === 'literal' ? 'Static' : 'Expression'}
          </button>
        ))}
      </div>

      {/* Value field */}
      {assignment.mode === 'literal' && (
        <LiteralInput
          varType={selVar?.type ?? 'string'}
          value={assignment.literal_value}
          onChange={(v) => onChange({ literal_value: v })}
        />
      )}

      {assignment.mode === 'expression' && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Braces size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-400" />
              <input
                value={assignment.expression ?? ''}
                onChange={(e) => onChange({ expression: e.target.value })}
                placeholder='e.g. Vars["count"] + 1'
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
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Literal-value input, switched by variable type
// ---------------------------------------------------------------------------

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
        if (varType === 'float')   { onChange(parseFloat(raw));   return }
        onChange(raw)
      }}
      className="text-sm"
    />
  )
}
