import { describe, it, expect } from 'vitest'
import { buildFlatPlot, buildSplitPlot, canUseLog, hasSplit, logFloor, plottedValues } from './plot'
import type { ChartWidgetConfig } from './schema'
import type { AggregateGroupResponse } from '@/features/forms/api'

const base: ChartWidgetConfig = {
  formId: 'invoices',
  chartType: 'bar',
  series: [{ fn: 'count' }],
  sortBy: 'group', sortDir: 'asc', limit: 20, legend: true,
}

const cfg = (p: Partial<ChartWidgetConfig> = {}): ChartWidgetConfig => ({ ...base, ...p })

describe('hasSplit', () => {
  it('reads the response, not the config', () => {
    expect(hasSplit([{ key: 'a', values: [1] }])).toBe(false)
    expect(hasSplit([{ key: 'a', key2: 'north', values: [1] }])).toBe(true)
  })

  // A groupBy2 whose values are all empty gives a pivot of one nameless
  // sub-series — strictly worse than the flat chart it replaced.
  it('does not count an empty key2 as a split', () => {
    expect(hasSplit([{ key: 'a', key2: '', values: [1] }])).toBe(false)
  })
})

describe('buildFlatPlot', () => {
  it('gives one series per configured measure', () => {
    const groups: AggregateGroupResponse[] = [
      { key: 'Open', values: [3, 900] },
      { key: 'Paid', values: [7, 2100] },
    ]
    const { rows, series } = buildFlatPlot(cfg({ series: [{ fn: 'count' }, { fn: 'sum', field: 'amount' }] }), groups)

    expect(rows).toEqual([
      { key: 'Open', val_0: 3, val_1: 900 },
      { key: 'Paid', val_0: 7, val_1: 2100 },
    ])
    expect(series.map((s) => s.dataKey)).toEqual(['val_0', 'val_1'])
    // Each measure formats with its OWN column — the reason measureIndex
    // travels on the series at all.
    expect(series.map((s) => s.measureIndex)).toEqual([0, 1])
  })

  it('strips a range bucket\'s sort-safe prefix from the category', () => {
    const { rows } = buildFlatPlot(cfg(), [{ key: '00\x1f<= 30', values: [2] }])
    expect(rows[0].key).toBe('<= 30')
  })

  it('reads a per-series mark only for a combo chart', () => {
    const series = [{ fn: 'count' as const }, { fn: 'sum' as const, field: 'amount', type: 'line' as const }]
    expect(buildFlatPlot(cfg({ chartType: 'combo', series }), []).series.map((s) => s.type)).toEqual(['bar', 'line'])
    // Same config as a plain bar chart: every series draws as a bar, and the
    // declared 'line' is inert rather than quietly changing the chart.
    expect(buildFlatPlot(cfg({ chartType: 'bar', series }), []).series.map((s) => s.type)).toEqual(['bar', 'bar'])
  })
})

describe('buildSplitPlot', () => {
  const groups: AggregateGroupResponse[] = [
    { key: 'Jan', key2: 'North', values: [5] },
    { key: 'Jan', key2: 'South', values: [2] },
    { key: 'Feb', key2: 'North', values: [8] },
  ]

  // The whole point: before this, these three rows collapsed onto the
  // category axis under 'Jan', 'Jan', 'Feb' with no split at all.
  it('pivots (key, key2) pairs into one row per primary key', () => {
    const { rows, series } = buildSplitPlot(cfg(), groups)

    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.key)).toEqual(['Jan', 'Feb'])
    expect(series.map((s) => s.label)).toEqual(['North', 'South'])
  })

  it('gives every sub-series measure 0, whatever the split value', () => {
    const { series } = buildSplitPlot(cfg(), groups)
    expect(series.every((s) => s.measureIndex === 0)).toBe(true)
  })

  it('colours by split value rather than by the series that produced it', () => {
    const { series } = buildSplitPlot(cfg({ series: [{ fn: 'count', color: '#ff0000' }] }), groups)
    // The authored colour cannot apply — there is one series in the config
    // and two in the plot.
    expect(series.map((s) => s.color)).toHaveLength(2)
    expect(new Set(series.map((s) => s.color)).size).toBe(2)
  })

  // An absent (key, key2) pair means no records matched. For a count or a
  // sum that genuinely is zero; for an average it is "no data", and drawing
  // it as zero would invent a reading that pulls the chart down.
  it('fills a missing combination with zero for a count', () => {
    const { rows } = buildSplitPlot(cfg({ series: [{ fn: 'count' }] }), groups)
    expect(rows.find((r) => r.key === 'Feb')).toEqual({ key: 'Feb', s_0: 8, s_1: 0 })
  })

  it('fills a missing combination with zero for a sum', () => {
    const { rows } = buildSplitPlot(cfg({ series: [{ fn: 'sum', field: 'amount' }] }), groups)
    expect(rows.find((r) => r.key === 'Feb')?.s_1).toBe(0)
  })

  it('leaves a missing combination absent for an average', () => {
    const { rows } = buildSplitPlot(cfg({ series: [{ fn: 'avg', field: 'amount' }] }), groups)
    expect(rows.find((r) => r.key === 'Feb')).toEqual({ key: 'Feb', s_0: 8 })
  })

  // A split value could literally be "key", or collide with a val_N name.
  it('keys sub-series positionally so a split value cannot collide', () => {
    const { rows, series } = buildSplitPlot(cfg(), [
      { key: 'Jan', key2: 'key', values: [1] },
      { key: 'Jan', key2: 'val_0', values: [2] },
    ])
    expect(series.map((s) => s.dataKey)).toEqual(['s_0', 's_1'])
    expect(rows[0]).toEqual({ key: 'Jan', s_0: 1, s_1: 2 })
  })

  it('strips the sort-safe prefix from both dimensions', () => {
    const { rows, series } = buildSplitPlot(cfg(), [{ key: '00\x1f<= 30', key2: '01\x1f> 1000', values: [4] }])
    expect(rows[0].key).toBe('<= 30')
    expect(series[0].label).toBe('> 1000')
  })

  it('keeps the response\'s own ordering of primary keys', () => {
    const { rows } = buildSplitPlot(cfg(), [
      { key: 'Z', key2: 'a', values: [1] },
      { key: 'A', key2: 'a', values: [1] },
    ])
    expect(rows.map((r) => r.key)).toEqual(['Z', 'A'])
  })
})

describe('log value axis', () => {
  it('collects only the numeric cells, ignoring the category key', () => {
    const plot = buildFlatPlot(cfg(), [{ key: 'Jan', values: [5] }, { key: 'Feb', values: [8] }])
    expect(plottedValues(plot).sort()).toEqual([5, 8])
  })

  // A log domain touching zero renders an empty chart, and a count measure
  // reaches zero constantly — so the tile degrades rather than going blank.
  it('refuses a log axis when any value is zero or negative', () => {
    expect(canUseLog([12, 340, 9800])).toBe(true)
    expect(canUseLog([12, 0, 340])).toBe(false)
    expect(canUseLog([-1, 5])).toBe(false)
    expect(canUseLog([])).toBe(false)
  })

  // The regression this exists for: recharts' own 'auto' log domain picked a
  // floor of 40 for 12/340/9800 — ABOVE the smallest value — and the first
  // bar vanished off the bottom of the chart with no error anywhere.
  it('floors at the decade below the smallest value', () => {
    expect(logFloor([12, 340, 9800])).toBe(10)
    expect(logFloor([340, 9800])).toBe(100)
    expect(logFloor([0.04, 7])).toBeCloseTo(0.01)
  })

  // The same vanishing act one step later: a floor EQUAL to the smallest
  // value gives that bar zero height, which bites whenever the minimum is
  // itself a round power of ten.
  it('drops another decade when the smallest value IS a decade', () => {
    expect(logFloor([100, 5000])).toBe(10)
    expect(logFloor([1000])).toBe(100)
    expect(logFloor([1, 80])).toBeCloseTo(0.1)
  })

  // STRICTLY below, not at: equal is the zero-height case above.
  it('never floors at or above the data it has to contain', () => {
    for (const values of [[12, 340, 9800], [1, 2], [999, 1000], [0.5, 50], [100, 5000]]) {
      expect(logFloor(values)).toBeLessThan(Math.min(...values))
    }
  })
})
