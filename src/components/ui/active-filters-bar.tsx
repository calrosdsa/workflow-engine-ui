import { X } from 'lucide-react'
import { useTranslation, type I18nContextValue } from '@/features/i18n/I18nProvider'
import { describeCondition, describeFilter } from '@/features/workflows/filter-text'
import type { FieldDef } from '@/features/forms/types'
import type { CompareOp, FilterGroup } from '@/features/workflows/types'

// Viewer-facing operator words. The STRUCTURE of a chip — which field, how
// the value renders for its value_mode, whether the operator takes a value
// at all — comes from filter-text.ts; only the operator's wording is
// localized here.
//
// This table used to live here in full and had drifted: no entry for
// ends_with, not_in, not_contains or search, so those chips rendered the
// raw enum value. Incomplete coverage is now impossible — Record<CompareOp>
// fails to compile until a new operator is given a word.
function opLabels(t: I18nContextValue['t']): Record<CompareOp, string> {
  return {
    eq: '=', neq: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤',
    contains: t('filters.op.contains'),
    not_contains: t('filters.op.not_contains'),
    starts_with: t('filters.op.starts_with'),
    ends_with: t('filters.op.ends_with'),
    in: t('filters.op.in'),
    not_in: t('filters.op.not_in'),
    is_null: t('filters.op.is_empty'),
    not_null: t('filters.op.is_not_empty'),
    search: t('filters.op.matches'),
    was_updated: t('filters.op.was_updated'),
  }
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
  const t = useTranslation()
  const labels = opLabels(t)
  const hasConditions = filter.conditions.length > 0
  const nestedGroups = filter.groups.filter((g) => g.conditions.length > 0 || g.groups.length > 0)
  if (!hasConditions && nestedGroups.length === 0) return null

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      {filter.conditions.map((c, idx) => {
        const parts = describeCondition(c, fields)
        const label = parts.field ?? t('filters.any_field')
        return (
          <span
            key={c.id ?? idx}
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]"
            style={{ borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--muted-foreground))' }}
          >
            <span className="font-medium" style={{ color: 'hsl(var(--foreground))' }}>{label}</span>
            <span>{labels[c.op] ?? c.op}</span>
            {parts.value && <span style={{ color: 'hsl(var(--foreground))' }}>{parts.value}</span>}
            <button
              type="button"
              onClick={() => onRemoveCondition(idx)}
              className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full transition-colors hover:bg-[hsl(var(--destructive)/0.12)] hover:text-[hsl(var(--destructive))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              aria-label={t('filters.remove_on', { field: label })}
            >
              <X size={10} />
            </button>
          </span>
        )
      })}
      {nestedGroups.map((g, idx) => (
        // Nested groups used to collapse to the words "+ advanced filter
        // groups", which told a viewer that something was narrowing their
        // results but not what. They now say so — read-only, because this
        // bar still only removes top-level leaves.
        <span
          key={`g${idx}`}
          className="inline-flex max-w-full items-center truncate rounded-full border border-dashed px-2.5 py-1 text-[11px]"
          style={{ borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--muted-foreground))' }}
          title={describeFilter(g, fields)}
        >
          {describeFilter(g, fields)}
        </span>
      ))}
      <button
        type="button"
        onClick={onResetAll}
        className="rounded px-1 text-[11px] font-medium transition-colors hover:text-[hsl(var(--destructive))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        style={{ color: 'hsl(var(--primary))' }}
      >
        {t('filters.reset_all')}
      </button>
    </div>
  )
}
