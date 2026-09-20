import type { NumberFormat } from '../../types'
import type { ReportFilter } from '../table/schema'

// Mirrors internal/reports.GroupBlockConfig (Go, block_group.go) exactly —
// snake_case field names matching the wire schema (FR-J1-002 §1). AggFn
// mirrors internal/forms/store.AggregateFn's own value set.
export type AggFn = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'count_distinct'

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
  /** A named report data source. When set it supplies the form, filter and
   *  sort, and Go treats it as WINNING over form_id (block_group.go). */
  source_id?: string
  form_id: string
  group_by?: GroupByDimension
  series: GroupSeries[]
  limit?: number
  /** Not editable here — carried so the panel cannot destroy it. */
  filter?: ReportFilter
  sort_by?: string
  sort_dir?: string
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
    // CARRIED, NOT PARSED — see parseTableBlockConfig's note for why these
    // are copied through individually rather than spread.
    //
    // source_id is the worst of these to lose: Go treats it as winning over
    // form_id, so a group block created by the sheet's own "Insert data"
    // gesture (which sets source_id and never sets form_id) silently fell
    // back to an empty form_id on the first panel touch, and then failed to
    // generate at all.
    source_id: typeof r.source_id === 'string' && r.source_id ? r.source_id : undefined,
    filter: r.filter,
    sort_by: typeof r.sort_by === 'string' ? r.sort_by : undefined,
    sort_dir: typeof r.sort_dir === 'string' ? r.sort_dir : undefined,
  }
}
