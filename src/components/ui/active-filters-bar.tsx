import { X } from 'lucide-react'
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

// Renders directly above FilterBuilder.tsx's own panel (RecordsTable's
// filter toggle) — themed identically via hsl(var(--...)) tokens rather
// than the old hardcoded slate-*/rose-* classes, so the two read as one
// coherent surface instead of a themed panel sitting under an unthemed
// summary bar.
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
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]"
            style={{ borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--muted-foreground))' }}
          >
            <span className="font-medium" style={{ color: 'hsl(var(--foreground))' }}>{label}</span>
            <span>{opLabel}</span>
            {needsValue && valueLabel && <span style={{ color: 'hsl(var(--foreground))' }}>{valueLabel}</span>}
            <button
              type="button"
              onClick={() => onRemoveCondition(idx)}
              className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full transition-colors hover:bg-[hsl(var(--destructive)/0.12)] hover:text-[hsl(var(--destructive))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              aria-label={`Remove filter on ${label}`}
            >
              <X size={10} />
            </button>
          </span>
        )
      })}
      {hasGroups && (
        <span
          className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px]"
          style={{ borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--muted-foreground))' }}
        >
          + advanced filter groups
        </span>
      )}
      <button
        type="button"
        onClick={onResetAll}
        className="rounded px-1 text-[11px] font-medium transition-colors hover:text-[hsl(var(--destructive))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        style={{ color: 'hsl(var(--primary))' }}
      >
        Reset all
      </button>
    </div>
  )
}
