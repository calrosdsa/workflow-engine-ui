import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FieldDef } from '@/features/forms/types'
import type { FilterGroup } from '@/features/workflows/types'

const OP_LABELS: Record<string, string> = {
  eq: '=', neq: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤',
  contains: 'contains', starts_with: 'starts with', in: 'in',
  is_null: 'is empty', not_null: 'is not empty', was_updated: 'was updated',
}

interface ActiveFiltersBarProps {
  filter: FilterGroup
  fields: FieldDef[]
  /** Removes the top-level condition at this index. Nested-group editing
   *  stays inside the full FilterBuilder panel — this bar only summarizes
   *  and clears top-level leaf conditions. */
  onRemoveCondition: (index: number) => void
  onResetAll: () => void
}

export function ActiveFiltersBar({ filter, fields, onRemoveCondition, onResetAll }: ActiveFiltersBarProps) {
  const hasConditions = filter.conditions.length > 0
  const hasGroups = filter.groups.some((g) => g.conditions.length > 0 || g.groups.length > 0)
  if (!hasConditions && !hasGroups) return null

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      {filter.conditions.map((c, idx) => {
        const field = fields.find((f) => f.name === c.field)
        const label = field?.label ?? c.field ?? 'field'
        const opLabel = OP_LABELS[c.op] ?? c.op
        const needsValue = c.op !== 'is_null' && c.op !== 'not_null' && c.op !== 'was_updated'
        const valueLabel = c.value_mode === 'expression' ? c.expression : c.value == null ? '' : String(c.value)
        return (
          <span
            key={c.id ?? idx}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 shadow-sm',
            )}
          >
            <span className="font-medium text-slate-700">{label}</span>
            <span className="text-slate-400">{opLabel}</span>
            {needsValue && valueLabel && <span className="text-slate-700">{valueLabel}</span>}
            <button
              type="button"
              onClick={() => onRemoveCondition(idx)}
              className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-slate-300 hover:bg-red-50 hover:text-red-400"
              aria-label={`Remove filter on ${label}`}
            >
              <X size={10} />
            </button>
          </span>
        )
      })}
      {hasGroups && (
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-500">
          + advanced filter groups
        </span>
      )}
      <button
        type="button"
        onClick={onResetAll}
        className="text-[11px] font-medium text-rose-500 hover:text-rose-600"
      >
        Reset all
      </button>
    </div>
  )
}
