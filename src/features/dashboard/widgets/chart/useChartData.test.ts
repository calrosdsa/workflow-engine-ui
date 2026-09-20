import { describe, it, expect } from 'vitest'
import { buildAggregateRequest } from './useChartData'
import { createDefaultChartConfig } from './schema'

describe('buildAggregateRequest', () => {
  it('returns null when no form is selected', () => {
    expect(buildAggregateRequest(createDefaultChartConfig())).toBeNull()
  })

  it('returns null for a non-stat chart with no groupBy field', () => {
    const config = { ...createDefaultChartConfig(), formId: 'f1' }
    expect(buildAggregateRequest(config)).toBeNull()
  })

  it('allows a stat chart with no groupBy at all (omits group_by from the request)', () => {
    const config = { ...createDefaultChartConfig(), formId: 'f1', chartType: 'stat' as const }
    const req = buildAggregateRequest(config)
    expect(req).not.toBeNull()
    expect(req!.group_by).toBeUndefined()
  })

  it('builds a full request for a grouped bar chart', () => {
    const config = {
      ...createDefaultChartConfig(),
      formId: 'f1',
      chartType: 'bar' as const,
      groupBy: { field: 'status' },
      groupBy2: { field: 'region' },
      series: [{ fn: 'sum' as const, field: 'amount' }],
      limit: 15,
    }
    const req = buildAggregateRequest(config)
    expect(req).toEqual({
      group_by: { field: 'status', bucket: undefined },
      group_by2: { field: 'region', bucket: undefined },
      series: [{ fn: 'sum', field: 'amount' }],
      filter: undefined,
      sort_by: 'group',
      sort_dir: 'asc',
      limit: 15,
    })
  })

  it('threads ranges through for both group_by and group_by2', () => {
    const config = {
      ...createDefaultChartConfig(),
      formId: 'f1',
      groupBy: { field: 'due_date', ranges: [30, 60, 90] },
      groupBy2: { field: 'amount', ranges: [1000] },
    }
    const req = buildAggregateRequest(config)
    expect(req!.group_by).toEqual({ field: 'due_date', bucket: undefined, ranges: [30, 60, 90] })
    expect(req!.group_by2).toEqual({ field: 'amount', bucket: undefined, ranges: [1000] })
  })

  it('omits series entirely (not an empty array) when the config has none, letting the backend default apply', () => {
    const config = { ...createDefaultChartConfig(), formId: 'f1', groupBy: { field: 'status' }, series: [] }
    const req = buildAggregateRequest(config)
    expect(req!.series).toBeUndefined()
  })
})

describe('the second dimension is gated at the REQUEST, not the render', () => {
  const split = {
    ...createDefaultChartConfig(),
    formId: 'f1',
    groupBy: { field: 'status' },
    groupBy2: { field: 'region' },
  }

  // A pie has no way to draw a split: it would get one response row per
  // (key, key2) pair and slice them all under duplicate names. Gating here
  // means a pie never receives a key2 at all.
  it('omits group_by2 for a pie and a donut', () => {
    expect(buildAggregateRequest({ ...split, chartType: 'pie' })!.group_by2).toBeUndefined()
    expect(buildAggregateRequest({ ...split, chartType: 'donut' })!.group_by2).toBeUndefined()
  })

  it('keeps group_by2 for every chart type with a category axis', () => {
    for (const chartType of ['bar', 'line', 'area', 'combo'] as const) {
      expect(buildAggregateRequest({ ...split, chartType })!.group_by2).toBeDefined()
    }
  })

  // The reachable human path: build a split bar chart, then switch it to a
  // pie. The panel hides the Split by control but does not clear what it
  // set, so the config still carries groupBy2.
  it('ignores a groupBy2 left behind by a chart-type switch', () => {
    expect(buildAggregateRequest({ ...split, chartType: 'pie' })!.group_by).toBeDefined()
  })
})
