// Recursive AND/OR filter builder for the Fetch Records node.
//
// Renders a FilterGroup tree: each group has an AND/OR combinator, leaf
// conditions ({field, op, value|expression}), and nested sub-groups. Condition
// values can be static or an Expr expression (opening the shared ExpressionEditor).

import { useState } from 'react'
import { Plus, Trash2, Code2, FolderPlus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ExpressionEditor } from './ExpressionEditor'
import { nanoid } from './nanoid'
import type { NodeOutputSchema } from './node-output-schema'
import type { FieldDef } from '@/features/forms/types'
import type { VariableDecl, FilterGroup, FilterCondition, CompareOp } from '../types'

const OPERATORS: { value: CompareOp; label: string }[] = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '≠' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'contains', label: 'contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'in', label: 'in list' },
  { value: 'is_null', label: 'is empty' },
  { value: 'not_null', label: 'is not empty' },
  // Matches the form's combined full-text search column, not the selected
  // field — the field picker is ignored for this op (see CompareOp's doc
  // comment in ../types).
  { value: 'search', label: 'full-text search' },
  // Change-detection — only meaningful where an old/new record pair exists
  // (a Trigger node's before/after/after_async filter). Harmless elsewhere:
  // evaluates false when there's no old record to compare against.
  { value: 'was_updated', label: 'was updated' },
]

function opNeedsValue(op: CompareOp): boolean {
  return op !== 'is_null' && op !== 'not_null' && op !== 'was_updated'
}

/** True when op ignores the condition's `field` (matches the whole record
 *  instead of one column) — currently only full-text search. */
function opIgnoresField(op: CompareOp): boolean {
  return op === 'search'
}

export function newCondition(): FilterCondition {
  return { id: nanoid(), field: '', op: 'eq', value_mode: 'static', value: '', expression: '' }
}

export function newGroup(): FilterGroup {
  return { id: nanoid(), combinator: 'and', conditions: [], groups: [] }
}

interface FilterBuilderProps {
  group: FilterGroup
  fields: FieldDef[]
  variables: VariableDecl[]
  nodeContext?: NodeOutputSchema[]
  onChange: (g: FilterGroup) => void
  /** Root group can't be removed; nested groups get a remove handler. */
  onRemove?: () => void
  depth?: number
}

export function FilterBuilder({ group, fields, variables, nodeContext = [], onChange, onRemove, depth = 0 }: FilterBuilderProps) {
  const setCombinator = (combinator: 'and' | 'or') => onChange({ ...group, combinator })

  const addCondition = () => onChange({ ...group, conditions: [...group.conditions, newCondition()] })
  const addGroup = () => onChange({ ...group, groups: [...group.groups, newGroup()] })

  const updateCondition = (id: string, patch: Partial<FilterCondition>) =>
    onChange({ ...group, conditions: group.conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)) })
  const removeCondition = (id: string) =>
    onChange({ ...group, conditions: group.conditions.filter((c) => c.id !== id) })

  const updateGroup = (idx: number, g: FilterGroup) =>
    onChange({ ...group, groups: group.groups.map((x, i) => (i === idx ? g : x)) })
  const removeGroup = (idx: number) =>
    onChange({ ...group, groups: group.groups.filter((_, i) => i !== idx) })

  const isEmpty = group.conditions.length === 0 && group.groups.length === 0

  return (
    <div className={cn('rounded-xl border p-2.5', depth === 0 ? 'border-slate-200 bg-slate-50/40' : 'border-slate-200 bg-white')}>
      {/* Header: AND/OR toggle + remove */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-white p-0.5 border border-slate-200">
          {(['and', 'or'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCombinator(c)}
              className={cn(
                'rounded-md px-2.5 py-0.5 text-[11px] font-semibold uppercase transition-colors',
                group.combinator === c ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600',
              )}
            >
              {c}
            </button>
          ))}
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-400"
            title="Remove group"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {isEmpty && (
        <p className="px-1 py-2 text-center text-[11px] text-slate-400">No conditions yet.</p>
      )}

      {/* Leaf conditions */}
      <div className="space-y-1.5">
        {group.conditions.map((c) => (
          <ConditionRow
            key={c.id}
            condition={c}
            fields={fields}
            variables={variables}
            nodeContext={nodeContext}
            onChange={(patch) => updateCondition(c.id, patch)}
            onRemove={() => removeCondition(c.id)}
          />
        ))}
      </div>

      {/* Nested groups */}
      {group.groups.length > 0 && (
        <div className="mt-1.5 space-y-1.5 border-l-2 border-slate-200 pl-2">
          {group.groups.map((g, idx) => (
            <FilterBuilder
              key={g.id ?? idx}
              group={g}
              fields={fields}
              variables={variables}
              nodeContext={nodeContext}
              onChange={(ng) => updateGroup(idx, ng)}
              onRemove={() => removeGroup(idx)}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      {/* Add buttons */}
      <div className="mt-2 flex gap-1.5">
        <Button variant="outline" size="sm" onClick={addCondition} className="h-7 flex-1 gap-1 border-dashed text-[11px] text-slate-500">
          <Plus size={12} /> Condition
        </Button>
        {depth < 3 && (
          <Button variant="outline" size="sm" onClick={addGroup} className="h-7 gap-1 border-dashed text-[11px] text-slate-500">
            <FolderPlus size={12} /> Group
          </Button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single condition row
// ---------------------------------------------------------------------------

function ConditionRow({ condition, fields, variables, nodeContext, onChange, onRemove }: {
  condition: FilterCondition
  fields: FieldDef[]
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (patch: Partial<FilterCondition>) => void
  onRemove: () => void
}) {
  const [editorOpen, setEditorOpen] = useState(false)
  const needsValue = opNeedsValue(condition.op)
  const ignoresField = opIgnoresField(condition.op)
  const isExpr = condition.value_mode === 'expression'

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <div className="flex items-center gap-1.5">
        {/* Field */}
        {ignoresField ? (
          <div className="min-w-0 flex-1 truncate rounded-md border border-slate-100 bg-slate-50 px-1.5 py-1 text-[11px] italic text-slate-400">
            whole record
          </div>
        ) : (
          <select
            value={condition.field}
            onChange={(e) => onChange({ field: e.target.value })}
            className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 focus:border-rose-400 focus:outline-none"
          >
            <option value="">field…</option>
            {fields.map((f) => (
              <option key={f.name} value={f.name}>{f.label || f.name}</option>
            ))}
          </select>
        )}
        {/* Operator */}
        <select
          value={condition.op}
          onChange={(e) => onChange({ op: e.target.value as CompareOp, field: e.target.value === 'search' ? '_search' : condition.field })}
          className="shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 focus:border-rose-400 focus:outline-none"
        >
          {OPERATORS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={onRemove}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-300 hover:bg-red-50 hover:text-red-400"
          title="Remove condition"
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* Value (static or expression) */}
      {needsValue && (
        <div className="mt-1.5 space-y-1.5">
          <div className="flex gap-1 rounded-md bg-slate-100 p-0.5">
            {(['static', 'expression'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChange({ value_mode: m })}
                className={cn(
                  'flex-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                  (condition.value_mode ?? 'static') === m ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400',
                )}
              >
                {m === 'static' ? 'Value' : 'Expression'}
              </button>
            ))}
          </div>

          {isExpr ? (
            <div className="flex items-center gap-1.5">
              <input
                value={condition.expression ?? ''}
                onChange={(e) => onChange({ expression: e.target.value })}
                placeholder='Vars["country"]'
                className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-700 placeholder:text-slate-300 focus:border-rose-400 focus:outline-none"
              />
              <button
                onClick={() => setEditorOpen(true)}
                title="Open expression editor"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-200 text-slate-400 hover:border-rose-300 hover:text-rose-600"
              >
                <Code2 size={12} />
              </button>
            </div>
          ) : (
            <Input
              value={condition.value == null ? '' : String(condition.value)}
              onChange={(e) => onChange({ value: e.target.value })}
              placeholder={condition.op === 'in' ? 'comma,separated,values' : 'value…'}
              className="h-7 text-[12px]"
            />
          )}
        </div>
      )}

      <ExpressionEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        value={condition.expression ?? ''}
        onChange={(expr) => onChange({ expression: expr })}
        variables={variables}
        nodeContext={nodeContext}
        label={condition.field || 'filter value'}
      />
    </div>
  )
}
