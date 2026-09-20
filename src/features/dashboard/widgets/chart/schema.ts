import type { ConfigSchema } from '@/lib/config-schema'
import type { FilterGroup } from '@/features/workflows/types'
import type { AggregateFn, DateBucket } from '@/features/forms/api'
import type { FieldType } from '@/features/forms/types'

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'stat'

/** Fields eligible for `groupBy.bucket` — mirrors workflow-engine's own
 *  bucketableTypes gate in aggregate.go. Shared by ConfigPanel (which shows
 *  the bucket picker for these) and the runtime toolbar (which shows the
 *  same-gated time-range/bucket controls), so the two can never disagree
 *  about which fields are bucketable. */
export const DATE_FIELD_TYPES: FieldType[] = ['date', 'datetime']

export interface ChartDimension {
  field: string
  bucket?: DateBucket
  /** Ascending breakpoints bucketing the dimension into bands instead of
   *  (never together with) `bucket` — mirrors workflow-engine's own
   *  AggregateDimension.Ranges. On a numeric field, bands the field's own
   *  value; on a date/datetime field, bands its AGE IN DAYS FROM TODAY
   *  (negative = not yet due), the shape an ageing report needs. */
  ranges?: number[]
}

export interface ChartSeries {
  fn: AggregateFn
  field?: string
  label?: string
  color?: string
}

export interface ChartWidgetConfig {
  formId: string
  chartType: ChartType
  groupBy?: ChartDimension
  groupBy2?: ChartDimension
  series: ChartSeries[]
  filter?: FilterGroup
  sortBy: 'group' | 'value'
  sortDir: 'asc' | 'desc'
  limit: number
  legend: boolean
  /** Seconds between automatic re-fetches; unset = load once (matches
   *  docs/dashboard-system-plan.md section 5.3's refreshSeconds field). */
  refreshSeconds?: number
}

const VALID_CHART_TYPES: ChartType[] = ['bar', 'line', 'area', 'pie', 'stat']
const VALID_FNS: AggregateFn[] = ['count', 'sum', 'avg', 'min', 'max']
const VALID_BUCKETS: DateBucket[] = ['day', 'week', 'month', 'quarter', 'year']

function parseDimension(raw: unknown): ChartDimension | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Partial<ChartDimension>
  if (typeof r.field !== 'string' || !r.field) return undefined
  const ranges = Array.isArray(r.ranges) ? r.ranges.filter((n): n is number => typeof n === 'number' && Number.isFinite(n)) : undefined
  return {
    field: r.field,
    bucket: r.bucket && VALID_BUCKETS.includes(r.bucket) ? r.bucket : undefined,
    ranges: ranges && ranges.length > 0 ? ranges : undefined,
  }
}

function parseSeries(raw: unknown): ChartSeries[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .filter((s) => typeof s.fn === 'string' && VALID_FNS.includes(s.fn as AggregateFn))
    .map((s) => ({
      fn: s.fn as AggregateFn,
      field: typeof s.field === 'string' ? s.field : undefined,
      label: typeof s.label === 'string' ? s.label : undefined,
      color: typeof s.color === 'string' ? s.color : undefined,
    }))
}

export function parseChartConfig(raw: unknown): ChartWidgetConfig {
  if (raw && typeof raw === 'object') {
    const r = raw as Partial<ChartWidgetConfig>
    if (typeof r.formId === 'string') {
      return {
        formId: r.formId,
        chartType: r.chartType && VALID_CHART_TYPES.includes(r.chartType) ? r.chartType : 'bar',
        groupBy: parseDimension(r.groupBy),
        groupBy2: parseDimension(r.groupBy2),
        series: parseSeries(r.series),
        filter: r.filter,
        sortBy: r.sortBy === 'value' ? 'value' : 'group',
        sortDir: r.sortDir === 'desc' ? 'desc' : 'asc',
        limit: typeof r.limit === 'number' && r.limit > 0 ? r.limit : 20,
        legend: r.legend !== false,
        refreshSeconds: typeof r.refreshSeconds === 'number' && r.refreshSeconds > 0 ? r.refreshSeconds : undefined,
      }
    }
  }
  return createDefaultChartConfig()
}

export function createDefaultChartConfig(): ChartWidgetConfig {
  return {
    formId: '',
    chartType: 'bar',
    series: [{ fn: 'count' }],
    sortBy: 'group',
    sortDir: 'asc',
    limit: 20,
    legend: true,
  }
}

/** groupBy and groupBy2 are the same shape, so they share one description
 *  rather than two that can drift — groupBy2 was previously declared as a
 *  bare object, which meant its own bucket/field values went unchecked. */
const DIMENSION_SCHEMA = {
  type: 'object',
  required: ['field'],
  properties: {
    field: { type: 'string', fieldRef: true, description: 'Field to group rows by.' },
    bucket: { type: 'string', enum: ['day', 'week', 'month', 'quarter', 'year'], description: 'For date/datetime fields: bucket rows into this period.' },
    ranges: {
      type: 'array',
      items: { type: 'number' },
      description: "Ascending breakpoints bucketing into bands instead of (never together with) 'bucket'. On a numeric field, bands the field's own value. On a date/datetime field, bands its AGE IN DAYS FROM TODAY (negative = not yet due) — e.g. [30, 60, 90] on a due-date field makes an ageing report's classic <=30/31-60/61-90/>90 overdue bands.",
    },
  },
} as const

export const CHART_CONFIG_SCHEMA: ConfigSchema = {
  type: 'object',
  description: "An aggregate chart over one form's records, computed server-side. 'stat' renders a single big number and needs no groupBy.",
  required: ['formId', 'chartType', 'series'],
  properties: {
    formId: { type: 'string', description: 'Id of the form to aggregate.' },
    chartType: { type: 'string', enum: ['bar', 'line', 'area', 'pie', 'stat'] },
    groupBy: {
      ...DIMENSION_SCHEMA,
      description: "Primary dimension. Omit only for chartType 'stat'.",
    },
    groupBy2: {
      ...DIMENSION_SCHEMA,
      description: 'Optional second dimension (same shape as groupBy) — splits each group into stacked/colored sub-series.',
    },
    series: {
      type: 'array',
      description: 'What to measure per group, in order.',
      items: {
        type: 'object',
        required: ['fn'],
        properties: {
          fn: { type: 'string', enum: ['count', 'sum', 'avg', 'min', 'max'] },
          field: { type: 'string', fieldRef: true, description: "Numeric field to aggregate. Required for every fn except 'count'." },
          label: { type: 'string' },
          color: { type: 'string', description: 'CSS color; omit for the theme palette.' },
        },
      },
    },
    filter: { type: 'object', description: 'A FilterGroup narrowing which records count. Same grammar as workflow nodes.' },
    sortBy: { type: 'string', enum: ['group', 'value'] },
    sortDir: { type: 'string', enum: ['asc', 'desc'] },
    limit: { type: 'integer', description: 'Maximum groups shown. Default 20.' },
    legend: { type: 'boolean' },
    refreshSeconds: { type: 'integer', description: 'Seconds between automatic re-fetches; omit to load once.' },
  },
}
