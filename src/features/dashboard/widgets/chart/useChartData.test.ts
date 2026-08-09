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

  it('omits series entirely (not an empty array) when the config has none, letting the backend default apply', () => {
    const config = { ...createDefaultChartConfig(), formId: 'f1', groupBy: { field: 'status' }, series: [] }
    const req = buildAggregateRequest(config)
    expect(req!.series).toBeUndefined()
  })
})
