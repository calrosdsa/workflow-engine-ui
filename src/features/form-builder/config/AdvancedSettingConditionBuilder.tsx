// Recursive AND/OR condition builder for an Advanced Setting's "Apply These
// Settings When" rule. Mirrors features/workflows/builder/FilterBuilder.tsx's
// shape (group header with AND/OR pill, leaf condition rows, nested groups),
// but kept local to form-builder: conditions compare this form's own fields
// (not workflow node output), and values are always static — no expression
// escape hatch, since Advanced Settings rules run against the current
// record's own field values.

import { Plus, Trash2, FolderPlus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { FormElement } from '../schema'
import {
  type AdvancedSettingGroup, type AdvancedSettingCondition, type AdvancedSettingCompareOp,
  emptyAdvancedSettingGroup as newAdvancedSettingGroup,
  newAdvancedSettingCondition,
} from '../schema'

const OPERATORS: { value: AdvancedSettingCompareOp; label: string }[] = [
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
]

function opNeedsValue(op: AdvancedSettingCompareOp): boolean {
  return op !== 'is_null' && op !== 'not_null'
}

interface AdvancedSettingConditionBuilderProps {
  group: AdvancedSettingGroup
  fields: FormElement[]
  onChange: (g: AdvancedSettingGroup) => void
  onRemove?: () => void
  depth?: number
}

export function AdvancedSettingConditionBuilder({
  group, fields, onChange, onRemove, depth = 0,
}: AdvancedSettingConditionBuilderProps) {
  const setCombinator = (combinator: 'and' | 'or') => onChange({ ...group, combinator })

  const addCondition = () => onChange({ ...group, conditions: [...group.conditions, newAdvancedSettingCondition()] })
  const addGroup = () => onChange({ ...group, groups: [...group.groups, newAdvancedSettingGroup()] })

  const updateCondition = (cid: string, patch: Partial<AdvancedSettingCondition>) =>
    onChange({ ...group, conditions: group.conditions.map((c) => (c.id === cid ? { ...c, ...patch } : c)) })
  const removeCondition = (cid: string) =>
    onChange({ ...group, conditions: group.conditions.filter((c) => c.id !== cid) })

  const updateGroup = (idx: number, g: AdvancedSettingGroup) =>
    onChange({ ...group, groups: group.groups.map((x, i) => (i === idx ? g : x)) })
  const removeGroup = (idx: number) =>
    onChange({ ...group, groups: group.groups.filter((_, i) => i !== idx) })

  const isEmpty = group.conditions.length === 0 && group.groups.length === 0

  return (
    <div className={cn('rounded-xl border p-2.5', depth === 0 ? 'border-slate-200 bg-slate-50/40' : 'border-slate-200 bg-white')}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-white p-0.5 border border-slate-200">
          {(['and', 'or'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCombinator(c)}
              className={cn(
                'rounded-md px-2.5 py-0.5 text-[11px] font-semibold uppercase transition-colors',
                group.combinator === c ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600',
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
        <p className="px-1 py-2 text-center text-[11px] text-slate-400">No conditions yet — settings always apply.</p>
      )}

      <div className="space-y-1.5">
        {group.conditions.map((c) => (
          <ConditionRow
            key={c.id}
            condition={c}
            fields={fields}
            onChange={(patch) => updateCondition(c.id, patch)}
            onRemove={() => removeCondition(c.id)}
          />
        ))}
      </div>

      {group.groups.length > 0 && (
        <div className="mt-1.5 space-y-1.5 border-l-2 border-slate-200 pl-2">
          {group.groups.map((g, idx) => (
            <AdvancedSettingConditionBuilder
              key={g.id}
              group={g}
              fields={fields}
              onChange={(ng) => updateGroup(idx, ng)}
              onRemove={() => removeGroup(idx)}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

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

function ConditionRow({ condition, fields, onChange, onRemove }: {
  condition: AdvancedSettingCondition
  fields: FormElement[]
  onChange: (patch: Partial<AdvancedSettingCondition>) => void
  onRemove: () => void
}) {
  const needsValue = opNeedsValue(condition.op)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <div className="flex items-center gap-1.5">
        <select
          value={condition.field}
          onChange={(e) => onChange({ field: e.target.value })}
          className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 focus:border-indigo-400 focus:outline-none"
        >
          <option value="">field…</option>
          {fields.map((f) => (
            <option key={f.id} value={f.key}>{f.label || f.key}</option>
          ))}
        </select>
        <select
          value={condition.op}
          onChange={(e) => onChange({ op: e.target.value as AdvancedSettingCompareOp })}
          className="shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 focus:border-indigo-400 focus:outline-none"
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

      {needsValue && (
        <Input
          value={condition.value == null ? '' : String(condition.value)}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder={condition.op === 'in' ? 'comma,separated,values' : 'value…'}
          className="mt-1.5 h-7 text-[12px]"
        />
      )}
    </div>
  )
}
