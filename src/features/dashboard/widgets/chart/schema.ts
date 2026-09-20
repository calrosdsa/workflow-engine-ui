import type { ConfigSchema } from '@/lib/config-schema'
import type { FilterGroup } from '@/features/workflows/types'
import type { AggregateFn, DateBucket } from '@/features/forms/api'
import type { FieldType } from '@/features/forms/types'

// Chart shape is deliberately split into an IDENTITY (chartType) and
// orthogonal MODIFIERS (stacked, orientation, series[].type) rather than one
// flat list of every combination. A flat enum would need stacked_bar,
// grouped_bar, stacked_hbar, grouped_hbar, stacked_area... and the four
// outcomes the roadmap asked for (donut, stacked/grouped bar, horizontal bar,
// combo) all fall out of the smaller vocabulary. Same reasoning as a
// dimension's bucket/ranges: knobs on a thing, not more things.
export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'combo' | 'stat'

/** Named from the VIEWER's point of view: 'horizontal' means the bars run
 *  left-to-right with categories down the side. Recharts spells that
 *  layout="vertical", and that inversion is translated in exactly one place
 *  — see Renderer.tsx's rechartsLayout. */
export type ChartOrientation = 'vertical' | 'horizontal'

/** Per-series mark, read ONLY when chartType is 'combo'. */
export type SeriesType = 'bar' | 'line' | 'area'

export interface ChartAxis {
  xTitle?: string
  yTitle?: string
  /** Value-axis bounds. Either may stand alone; unset ends stay automatic. */
  yMin?: number
  yMax?: number
  /** Log value axis. IGNORED — falling back to linear — whenever any plotted
   *  value is <= 0, because a log domain touching zero renders an empty
   *  chart. A count measure hits zero routinely, so this degrades rather
   *  than asking every author to know that. */
  yLog?: boolean
}

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
  /** Mark to draw this series with, read only for chartType 'combo' — the
   *  whole point of a combo chart being that series disagree. Defaults to
   *  'bar' so a combo with nothing declared still renders. */
  type?: SeriesType
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
  /** Stack the marks instead of placing them side by side. Unset/false IS
   *  the grouped chart — "grouped" is the absence of stacking, not a
   *  separate type. Applies to bar, area and combo's bar/area parts. */
  stacked?: boolean
  /** Bar/combo only; unset = 'vertical'. */
  orientation?: ChartOrientation
  axis?: ChartAxis
  /** Print each value on its mark. Off by default — on a dense chart the
   *  labels collide, which is a judgement only the author can make. */
  dataLabels?: boolean
  /** Seconds between automatic re-fetches; unset = load once (matches
   *  docs/dashboard-system-plan.md section 5.3's refreshSeconds field). */
  refreshSeconds?: number
}

const VALID_CHART_TYPES: ChartType[] = ['bar', 'line', 'area', 'pie', 'donut', 'combo', 'stat']
const VALID_FNS: AggregateFn[] = ['count', 'sum', 'avg', 'min', 'max']
const VALID_BUCKETS: DateBucket[] = ['day', 'week', 'month', 'quarter', 'year']
const VALID_SERIES_TYPES: SeriesType[] = ['bar', 'line', 'area']
const VALID_ORIENTATIONS: ChartOrientation[] = ['vertical', 'horizontal']

/** Chart types that draw against a category axis and can therefore stack,
 *  take an orientation, or carry a second dimension. Shared with the
 *  ConfigPanel so the panel never offers a knob the renderer ignores. */
export const CARTESIAN_TYPES: ChartType[] = ['bar', 'line', 'area', 'combo']
export const STACKABLE_TYPES: ChartType[] = ['bar', 'area', 'combo']
export const ORIENTABLE_TYPES: ChartType[] = ['bar', 'combo']

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
      type: VALID_SERIES_TYPES.includes(s.type as SeriesType) ? (s.type as SeriesType) : undefined,
    }))
}

/** Drops the whole axis block when nothing survives validation, so an empty
 *  `{}` never persists and the absent case stays the single "automatic" one. */
function parseAxis(raw: unknown): ChartAxis | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Partial<ChartAxis>
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
  const axis: ChartAxis = {
    xTitle: typeof r.xTitle === 'string' && r.xTitle ? r.xTitle : undefined,
    yTitle: typeof r.yTitle === 'string' && r.yTitle ? r.yTitle : undefined,
    yMin: num(r.yMin),
    yMax: num(r.yMax),
    yLog: r.yLog === true ? true : undefined,
  }
  return Object.values(axis).some((v) => v !== undefined) ? axis : undefined
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
        // Every one of these stays UNDEFINED when absent rather than
        // defaulting to a literal — a chart authored before they existed
        // must serialize back out byte-identical, which a persisted
        // `stacked: false` would break.
        stacked: r.stacked === true ? true : undefined,
        orientation: VALID_ORIENTATIONS.includes(r.orientation as ChartOrientation) ? r.orientation : undefined,
        axis: parseAxis(r.axis),
        dataLabels: r.dataLabels === true ? true : undefined,
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
    chartType: {
      type: 'string',
      enum: ['bar', 'line', 'area', 'pie', 'donut', 'combo', 'stat'],
      description: "The chart's identity. Shape variants are separate knobs, not types here: a STACKED bar is chartType 'bar' with stacked true, a GROUPED bar is the same with stacked absent, and a HORIZONTAL bar is orientation 'horizontal'. 'combo' mixes marks per series via series[].type. 'donut' is a pie with the centre cut out.",
    },
    groupBy: {
      ...DIMENSION_SCHEMA,
      description: "Primary dimension. Omit only for chartType 'stat'.",
    },
    groupBy2: {
      ...DIMENSION_SCHEMA,
      description: "Optional second dimension (same shape as groupBy) — splits each primary group into one coloured sub-series per distinct value, stacked when `stacked` is set. Only for the cartesian types (bar, line, area, combo). A split chart plots series[0] ONLY: the sub-series already spend the colour channel, so a second measure has nothing left to be drawn with. Give a split chart exactly one series.",
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
          color: { type: 'string', description: 'CSS color; omit for the theme palette. Ignored on a groupBy2 split, where the colours belong to the split values rather than to the series.' },
          type: { type: 'string', enum: ['bar', 'line', 'area'], description: "Mark for this series. Read ONLY when chartType is 'combo'; defaults to 'bar'. The classic use is bars for an amount plus a line for a running average." },
        },
      },
    },
    filter: { type: 'object', description: 'A FilterGroup narrowing which records count. Same grammar as workflow nodes.' },
    sortBy: { type: 'string', enum: ['group', 'value'] },
    sortDir: { type: 'string', enum: ['asc', 'desc'] },
    limit: { type: 'integer', description: 'Maximum groups shown. Default 20. With a groupBy2 this caps the RETURNED ROWS, which are primary × split combinations — so a limit of 20 across 4 split values leaves only 5 primary groups. Raise it accordingly on a split chart.' },
    legend: { type: 'boolean' },
    stacked: { type: 'boolean', description: "Stack the marks rather than placing them side by side. Applies to 'bar', 'area', and combo's bar/area parts. Omit for a grouped chart — grouped is the absence of stacking, not a chartType of its own." },
    orientation: { type: 'string', enum: ['vertical', 'horizontal'], description: "'horizontal' runs the bars left-to-right with the categories down the side — the readable choice when labels are long or numerous. Bar and combo only; default 'vertical'." },
    axis: {
      type: 'object',
      description: 'Value-axis titles and bounds. Omit entirely for automatic scaling.',
      properties: {
        xTitle: { type: 'string', description: 'Caption under the category axis.' },
        yTitle: { type: 'string', description: 'Caption beside the value axis.' },
        yMin: { type: 'number', description: 'Lower bound. Set 0 to stop a chart exaggerating small differences by starting the axis near the data.' },
        yMax: { type: 'number', description: 'Upper bound.' },
        yLog: { type: 'boolean', description: 'Logarithmic value axis, for data spanning orders of magnitude. IGNORED — silently linear — when any plotted value is <= 0, since a log domain touching zero renders nothing; a count measure hits zero routinely.' },
      },
    },
    dataLabels: { type: 'boolean', description: "Print each value on its mark, formatted with the measure's own number format. Off by default: on a dense chart the labels collide." },
    refreshSeconds: { type: 'integer', description: 'Seconds between automatic re-fetches; omit to load once.' },
  },
}
