import { useMemo, useState } from 'react'
import {
  Settings, ChevronLeft, ChevronRight, SlidersHorizontal,
  Plus, Trash2, Braces, Code2, ArrowUpDown, Filter as FilterIcon,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useBuilderStore } from './store'
import { NODE_REGISTRY } from './node-registry'
import { cn } from '@/lib/utils'
import { ExpressionEditor } from './ExpressionEditor'
import { FilterBuilder, newGroup } from './FilterBuilder'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { useForm, useForms } from '@/features/forms/hooks'
import { computeAncestors } from './executionOrder'
import { buildNodeOutputSchema, type NodeOutputSchema } from './node-output-schema'
import { nanoid } from './nanoid'
import type {
  VariableDecl, SetVariableConfig, VariableAssignment, ConditionConfig, AssignMode,
  FetchRecordsConfig, FilterGroup, SortRule, FetchMode,
} from '../types'

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function NodeConfigPanel() {
  const { nodes, edges, selectedNodeId, variables, updateNodeConfig, updateNodeLabel, configPanelOpen, toggleConfigPanel } = useBuilderStore()
  const node = nodes.find((n) => n.id === selectedNodeId)
  const reg  = node ? NODE_REGISTRY[node.data.type] : null
  const Icon = reg?.icon

  // Forms cache → id map, so fetch_records outputs can expose their record fields.
  const { data: forms } = useForms()
  const formsById = useMemo(
    () => new Map((forms ?? []).map((f) => [f.id, f])),
    [forms],
  )

  // Context-aware: only the outputs of nodes that execute BEFORE the selected one.
  const nodeContext: NodeOutputSchema[] = useMemo(() => {
    if (!selectedNodeId) return []
    const ancestorIds = computeAncestors(nodes, edges, selectedNodeId)
    return nodes
      .filter((n) => ancestorIds.has(n.id))
      .map((n) => buildNodeOutputSchema(n, formsById))
      .filter((s): s is NodeOutputSchema => s !== null)
  }, [nodes, edges, selectedNodeId, formsById])

  return (
    <aside
      className={cn(
        'relative flex shrink-0 flex-col border-l border-slate-200 bg-white transition-all duration-200',
        configPanelOpen ? 'w-80' : 'w-10',
      )}
    >
      {/* Toggle button */}
      <button
        onClick={toggleConfigPanel}
        className="absolute -left-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-600"
        title={configPanelOpen ? 'Collapse config' : 'Expand config'}
      >
        {configPanelOpen ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>

      {/* Collapsed state */}
      {!configPanelOpen && (
        <div className="flex flex-1 flex-col items-center gap-2 pt-4">
          <SlidersHorizontal size={15} className="text-slate-400" />
          <span className="rotate-90 select-none whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Config
          </span>
        </div>
      )}

      {/* Expanded — no node selected */}
      {configPanelOpen && !node && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
            <Settings size={22} className="text-slate-300" />
          </div>
          <p className="text-sm text-slate-400">Select a node<br />to configure it</p>
        </div>
      )}

      {/* Expanded — node selected */}
      {configPanelOpen && node && reg && Icon && (
        <>
          {/* Header */}
          <div className={cn('flex items-center gap-3 px-4 py-3.5', reg.gradient)}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30">
              <Icon size={17} strokeWidth={2.25} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">{reg.label}</p>
              <p className="truncate font-mono text-[10px] text-white/60">{node.id}</p>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-5 p-4">
              {/* Label */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Label</Label>
                <Input
                  value={node.data.label}
                  onChange={(e) => updateNodeLabel(node.id, e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div className="h-px bg-slate-100" />

              {/* Type-specific config */}
              {node.data.type === 'set_variable' && (
                <SetVariableForm
                  config={normaliseSetVariableConfig(node.data.configuration)}
                  variables={variables}
                  nodeContext={nodeContext}
                  onChange={(cfg) => updateNodeConfig(node.id, cfg)}
                />
              )}
              {node.data.type === 'condition' && (
                <ConditionForm
                  config={node.data.configuration as ConditionConfig}
                  variables={variables}
                  nodeContext={nodeContext}
                  onChange={(cfg) => updateNodeConfig(node.id, cfg)}
                />
              )}
              {node.data.type === 'subflow' && (
                <SubflowForm
                  config={node.data.configuration as { definition_id: string }}
                  onChange={(cfg) => updateNodeConfig(node.id, cfg)}
                />
              )}
              {node.data.type === 'fetch_records' && (
                <FetchRecordsForm
                  config={normaliseFetchRecordsConfig(node.data.configuration)}
                  variables={variables}
                  nodeContext={nodeContext}
                  onChange={(cfg) => updateNodeConfig(node.id, cfg)}
                />
              )}
              {(node.data.type === 'entry' || node.data.type === 'exit' || node.data.type === 'merge') && (
                <p className="text-xs text-slate-400 text-center py-4">No additional configuration</p>
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Normalise legacy single-assignment payload into the new shape
// ---------------------------------------------------------------------------

function normaliseSetVariableConfig(raw: unknown): SetVariableConfig {
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

interface SetVariableFormProps {
  config: SetVariableConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: SetVariableConfig) => void
}

function SetVariableForm({ config, variables, nodeContext, onChange }: SetVariableFormProps) {
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
// condition
// ---------------------------------------------------------------------------

function ConditionForm({ config, variables, nodeContext, onChange }: {
  config: ConditionConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: ConditionConfig) => void
}) {
  const [editorOpen, setEditorOpen] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Condition Expression
        </Label>
        <button
          onClick={() => setEditorOpen(true)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-indigo-500 hover:bg-indigo-50 transition-colors"
        >
          <Code2 size={11} />
          Editor
        </button>
      </div>

      <div className="relative">
        <Braces size={11} className="absolute left-2.5 top-2.5 text-indigo-400" />
        <textarea
          value={config.expression}
          onChange={(e) => onChange({ expression: e.target.value })}
          rows={3}
          placeholder={`e.g. Vars["age"] >= 18`}
          className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 py-2 pl-7 pr-3 font-mono text-[11px] text-slate-700 placeholder:text-slate-300 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {variables.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Available variables</p>
          <div className="flex flex-wrap gap-1">
            {variables.map((v) => (
              <button
                key={v.name}
                onClick={() => onChange({ expression: config.expression + `Vars["${v.name}"]` })}
                className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                title={`Insert Vars["${v.name}"]`}
              >
                {v.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-400">
        Must return a boolean. Routes to <span className="font-semibold text-emerald-600">true</span> or <span className="font-semibold text-rose-500">false</span> output.
      </p>

      <ExpressionEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        value={config.expression}
        onChange={(expr) => onChange({ expression: expr })}
        variables={variables}
        nodeContext={nodeContext}
        label="condition"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// fetch_records
// ---------------------------------------------------------------------------

function normaliseFetchRecordsConfig(raw: unknown): FetchRecordsConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<FetchRecordsConfig>
  return {
    form_id:     r.form_id ?? '',
    mode:        r.mode ?? 'many',
    filter:      ensureGroupIds(r.filter) ?? newGroup(),
    refine_expr: r.refine_expr ?? '',
    sort:        (r.sort ?? []).map((s) => ({ ...s, id: s.id ?? nanoid() })),
    limit:       r.limit ?? 0,
    output_var:  r.output_var ?? '',
    count_var:   r.count_var ?? '',
  }
}

// Re-attach UI-only ids to a filter tree loaded from the backend (which strips them).
function ensureGroupIds(g: FilterGroup | undefined): FilterGroup | undefined {
  if (!g) return undefined
  return {
    id: g.id ?? nanoid(),
    combinator: g.combinator ?? 'and',
    conditions: (g.conditions ?? []).map((c) => ({ ...c, id: c.id ?? nanoid() })),
    groups: (g.groups ?? []).map((sub) => ensureGroupIds(sub)!).filter(Boolean),
  }
}

function FetchRecordsForm({ config, variables, nodeContext, onChange }: {
  config: FetchRecordsConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: FetchRecordsConfig) => void
}) {
  const { data: form } = useForm(config.form_id || '')
  const fields = form?.fields ?? []

  const set = (patch: Partial<FetchRecordsConfig>) => onChange({ ...config, ...patch })

  const addSort = () =>
    set({ sort: [...config.sort, { id: nanoid(), field: '', dir: 'asc' }] })
  const updateSort = (id: string, patch: Partial<SortRule>) =>
    set({ sort: config.sort.map((s) => (s.id === id ? { ...s, ...patch } : s)) })
  const removeSort = (id: string) =>
    set({ sort: config.sort.filter((s) => s.id !== id) })

  return (
    <div className="space-y-4">
      {/* Form picker */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Form / Table</Label>
        <FormReferenceSelect value={config.form_id || undefined} onChange={(id) => set({ form_id: id ?? '' })} />
      </div>

      {/* Mode */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Retrieve</Label>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {(['many', 'one'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => set({ mode: m as FetchMode })}
              className={cn(
                'flex-1 rounded-md py-1 text-[11px] font-medium transition-colors',
                config.mode === m ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {m === 'many' ? 'Multiple records' : 'Single record'}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-slate-100" />

      {/* Filter */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <FilterIcon size={12} className="text-slate-400" />
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Filter</Label>
        </div>
        {!config.form_id ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-400">Select a form to add filters.</p>
        ) : (
          <FilterBuilder
            group={config.filter ?? newGroup()}
            fields={fields}
            variables={variables}
            nodeContext={nodeContext}
            onChange={(g) => set({ filter: g })}
          />
        )}
      </div>

      {/* Sort */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ArrowUpDown size={12} className="text-slate-400" />
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Sort</Label>
          </div>
          <button onClick={addSort} disabled={!config.form_id} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-rose-500 hover:bg-rose-50 disabled:opacity-40">
            <Plus size={11} /> Add
          </button>
        </div>
        {config.sort.map((s) => (
          <div key={s.id} className="flex items-center gap-1.5">
            <select
              value={s.field}
              onChange={(e) => updateSort(s.id, { field: e.target.value })}
              className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 focus:border-rose-400 focus:outline-none"
            >
              <option value="">field…</option>
              {fields.map((f) => <option key={f.name} value={f.name}>{f.label || f.name}</option>)}
            </select>
            <select
              value={s.dir}
              onChange={(e) => updateSort(s.id, { dir: e.target.value as 'asc' | 'desc' })}
              className="shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 focus:border-rose-400 focus:outline-none"
            >
              <option value="asc">ASC</option>
              <option value="desc">DESC</option>
            </select>
            <button onClick={() => removeSort(s.id)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-300 hover:bg-red-50 hover:text-red-400">
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>

      {/* Limit */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Limit</Label>
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={0}
            value={config.mode === 'one' ? 1 : config.limit || ''}
            disabled={config.mode === 'one'}
            onChange={(e) => set({ limit: e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0) })}
            placeholder="0 = all"
            className="h-7 w-24 text-[12px]"
          />
          <div className="flex gap-1">
            {[10, 100].map((n) => (
              <button key={n} onClick={() => set({ limit: n })} disabled={config.mode === 'one'} className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                Top {n}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-slate-400">
          Outputs <span className="font-mono">records</span>, <span className="font-mono">count</span>, and <span className="font-mono">first</span> to downstream nodes.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// subflow
// ---------------------------------------------------------------------------

function SubflowForm({ config, onChange }: {
  config: { definition_id: string }
  onChange: (c: { definition_id: string }) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Workflow Definition ID</Label>
      <Input
        value={config.definition_id ?? ''}
        onChange={(e) => onChange({ definition_id: e.target.value })}
        placeholder="Paste workflow UUID…"
        className="text-xs font-mono"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared helpers
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
