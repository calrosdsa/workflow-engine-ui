import type { NumberFormat } from '../../types'

// Mirrors internal/reports.GroupBlockConfig (Go, block_group.go) exactly —
// snake_case field names matching the wire schema (FR-J1-002 §1). AggFn
// mirrors internal/forms/store.AggregateFn's own value set.
export type AggFn = 'count' | 'sum' | 'avg' | 'min' | 'max'

export interface GroupByDimension {
  field: string
  bucket?: '' | 'day' | 'week' | 'month' | 'quarter' | 'year'
}

export interface GroupSeries {
  fn: AggFn
  field?: string
  label?: string
  /** Renders this measure as money, a percentage or a fixed-decimal number.
   *  A summed amount is the case this exists for. The block's group-key
   *  column is text and is never formatted, even when the key looks like a
   *  year. */
  number_format?: NumberFormat
}

export interface GroupBlockConfig {
  form_id: string
  group_by?: GroupByDimension
  series: GroupSeries[]
  limit?: number
}

export function emptyGroupBlockConfig(): GroupBlockConfig {
  return { form_id: '', series: [{ fn: 'count' }] }
}

/** Defensive parse — never throws, heals a malformed/stale blob. */
export function parseGroupBlockConfig(raw: unknown): GroupBlockConfig {
  const empty = emptyGroupBlockConfig()
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>
  return {
    form_id: typeof r.form_id === 'string' ? r.form_id : empty.form_id,
    group_by: (r.group_by && typeof r.group_by === 'object') ? (r.group_by as GroupByDimension) : undefined,
    series: Array.isArray(r.series) && r.series.length > 0 ? (r.series as GroupSeries[]) : empty.series,
    limit: typeof r.limit === 'number' ? r.limit : undefined,
  }
}
