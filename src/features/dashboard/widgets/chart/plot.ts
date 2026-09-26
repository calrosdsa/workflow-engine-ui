// Reconciles a chart config with an aggregate response into the rows and
// series recharts actually draws.
//
// This is a module of its own, beside runtime-filter.ts / date-range.ts /
// export-csv.ts, because the two data shapes disagree about what a "series"
// IS and getting that wrong is invisible in a rendered chart: without a
// second dimension there is one series per configured measure, and with one
// there is one per distinct split VALUE — a count known only at render time.
// Pure and directly testable rather than reachable only through a recharts
// tree that jsdom renders at zero size.
import type { AggregateGroupResponse } from '@/features/forms/api'
import { groupKeyLabel, rawGroupKey, type GroupKeyLabels } from './bucket-label'
import type { ChartWidgetConfig, SeriesType } from './schema'

// Categorical palette fallback (docs/dashboard-system-plan.md section 5.3) —
// no shared chart-color tokens exist yet in index.css, so this is a small,
// self-contained default rather than inventing app-wide theme
// infrastructure for this one widget. A per-series `color` override (see
// ChartSeries.color) always wins over this fallback.
export const PALETTE = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#ef4444', '#14b8a6']

export function seriesColor(config: ChartWidgetConfig, index: number): string {
  return config.series[index]?.color ?? PALETTE[index % PALETTE.length]
}

// Not translated: this feeds export-csv.ts's CSV column headers via a free
// function outside React, and the sibling branch (`${fn}(${field})`) is raw,
// untranslatable technical content — translating only the 'count' case would
// produce a header row that's half-Spanish. Same exclusion class as
// FORMAT_LABELS (reports/ReportSettingsPanel.tsx) and argument.label.
export function seriesLabel(config: ChartWidgetConfig, index: number): string {
  const s = config.series[index]
  if (s?.label) return s.label
  if (!s) return `val_${index}`
  return s.fn === 'count' ? 'Count' : `${s.fn}(${s.field ?? ''})`
}

/** One drawable line/bar/area, after config and response have been
 *  reconciled. Everything downstream draws from this and never re-derives
 *  which measure a key belongs to. */
export interface PlotSeries {
  dataKey: string
  label: string
  /** The split value exactly as the response sent it, sort-safe prefix and
   *  all. `label` is for reading; this is for inverting — drill-down.ts
   *  needs the "%02d" prefix to recover a range band's index, and stripping
   *  it is what makes the human label human. Undefined on an unsplit chart,
   *  where a series is a measure rather than a value. */
  rawLabel?: string
  color: string
  /** Which measure column this plots, indexing the response's measure
   *  columns. Every sub-series of a split plots measure 0 — see
   *  buildSplitPlot. */
  measureIndex: number
  type: SeriesType
}

/** The category key exactly as the response sent it ("" where it sent none,
 *  see rawGroupKey) — see PlotSeries.rawLabel for why both forms are
 *  carried. Recharts ignores keys nothing references, so this rides along on
 *  the row rather than needing a parallel array. */
export const RAW_KEY = '__rawKey'

export type PlotRow = Record<string, string | number>

export interface Plot {
  rows: PlotRow[]
  series: PlotSeries[]
}

/** True when this response actually carries a second dimension. Driven by
 *  the RESPONSE rather than by config.groupBy2: a config can name a second
 *  dimension the data turns out not to vary on, and a pivot on one constant
 *  value is just the flat chart with a worse legend. */
export function hasSplit(groups: AggregateGroupResponse[]): boolean {
  return groups.some((g) => g.key2 !== undefined && g.key2 !== '')
}

/** Every plotted number, in no particular order — the input both log-axis
 *  decisions below are made from. */
export function plottedValues(plot: Plot): number[] {
  return plot.rows
    .flatMap((r) => plot.series.map((s) => r[s.dataKey]))
    .filter((v): v is number => typeof v === 'number')
}

/** Whether a log value axis can be drawn at all. A log domain touching zero
 *  renders an empty chart, and a count measure reaches zero constantly, so
 *  the request degrades to a linear axis rather than a blank tile. */
export function canUseLog(values: number[]): boolean {
  return values.length > 0 && values.every((v) => v > 0)
}

/** The floor a log axis should start at: the decade at or below the smallest
 *  value.
 *
 *  Recharts' own 'auto' cannot be used here — given 12 / 340 / 9800 it picks
 *  a floor of 40, which is ABOVE the smallest value, and the first bar
 *  silently disappears off the bottom of the chart. A decade floor always
 *  contains the data and gives clean 10/100/1000 ticks.
 *
 *  Callers must check canUseLog first; a non-positive minimum has no
 *  logarithm. */
export function logFloor(values: number[]): number {
  const min = Math.min(...values)
  const decade = Math.pow(10, Math.floor(Math.log10(min)))
  // A floor EQUAL to the smallest value gives that bar zero height —
  // log(min) - log(min) = 0 — which is the same vanishing act, just one
  // step later. It bites whenever the minimum is itself a round power of
  // ten, so drop another decade. (>= rather than ===: the exponent round
  // trip can land a hair above min.)
  return decade >= min ? decade / 10 : decade
}

/** Plain shape: one row per group, one series per configured measure. The
 *  `val_N` keys match the backend's own positional aliasing (aggregate.go).
 *
 *  Only for a response that HAS group keys. A stat tile's ungrouped response
 *  has none, and the renderer does not plot it. */
export function buildFlatPlot(config: ChartWidgetConfig, groups: AggregateGroupResponse[], labels: GroupKeyLabels): Plot {
  const rows: PlotRow[] = groups.map((g) => {
    const raw = rawGroupKey(g.key)
    const row: PlotRow = { key: groupKeyLabel(raw, labels), [RAW_KEY]: raw }
    g.values.forEach((v, i) => { row[`val_${i}`] = v })
    return row
  })
  const series: PlotSeries[] = config.series.map((s, i) => ({
    dataKey: `val_${i}`,
    label: seriesLabel(config, i),
    color: seriesColor(config, i),
    measureIndex: i,
    type: config.chartType === 'combo' ? (s.type ?? 'bar') : 'bar',
  }))
  return { rows, series }
}

/** Split shape: pivots the response's (key, key2) pairs into one row per
 *  primary key with one series per distinct key2.
 *
 *  This pivot is what `groupBy2` always meant and never did. The engine has
 *  returned key2 since the second dimension shipped and export-csv.ts has
 *  always written it, but the renderer dropped it and flattened every pair
 *  onto the category axis under its primary key alone — so a split chart
 *  drew duplicate categories and no split.
 *
 *  Only series[0] is plotted: the sub-series have already spent the colour
 *  channel, leaving a second measure nothing to be drawn with. The caller
 *  tells the viewer when that discards something. */
export function buildSplitPlot(config: ChartWidgetConfig, groups: AggregateGroupResponse[], labels: GroupKeyLabels): Plot {
  // A combination with no records is absent from the response entirely, and
  // what that absence MEANS depends on the measure: no rows to count or sum
  // really is zero, whereas an absent average is "no data" and drawing it as
  // zero would invent a reading. So one is filled and the other left as a
  // gap.
  const fn = config.series[0]?.fn
  const fillsZero = fn === 'count' || fn === 'sum'

  // Both dimensions are tracked by the RAW value so two different groups
  // cannot merge just because their display labels happen to match — two
  // bands with one label, or a real value spelled like a "no value" label.
  const splitKeys: string[] = []
  const byKey = new Map<string, PlotRow>()
  for (const g of groups) {
    const raw = rawGroupKey(g.key)
    const split = rawGroupKey(g.key2)
    let idx = splitKeys.indexOf(split)
    if (idx === -1) {
      idx = splitKeys.length
      splitKeys.push(split)
    }
    let row = byKey.get(raw)
    if (!row) {
      row = { key: groupKeyLabel(raw, labels), [RAW_KEY]: raw }
      byKey.set(raw, row)
    }
    // Keyed positionally rather than by the split value itself, which could
    // collide with 'key' or with another series' name.
    row[`s_${idx}`] = g.values[0] ?? 0
  }

  const series: PlotSeries[] = splitKeys.map((raw, i) => ({
    dataKey: `s_${i}`,
    label: groupKeyLabel(raw, labels),
    rawLabel: raw,
    color: PALETTE[i % PALETTE.length],
    measureIndex: 0,
    type: config.chartType === 'combo' ? (config.series[0]?.type ?? 'bar') : 'bar',
  }))

  const rows = [...byKey.values()]
  if (fillsZero) {
    for (const row of rows) {
      for (const s of series) if (row[s.dataKey] === undefined) row[s.dataKey] = 0
    }
  }
  return { rows, series }
}
