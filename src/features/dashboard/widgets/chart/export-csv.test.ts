import { describe, it, expect } from 'vitest'
import { buildChartCsv } from './export-csv'
import { createDefaultChartConfig } from './schema'
import type { ChartWidgetConfig } from './schema'
import type { AggregateGroupResponse } from '@/features/forms/api'

describe('buildChartCsv', () => {
  it('builds a header + one row per group for a plain count chart', () => {
    const config: ChartWidgetConfig = { ...createDefaultChartConfig(), groupBy: { field: 'status' } }
    const groups: AggregateGroupResponse[] = [
      { key: 'open', values: [3] },
      { key: 'closed', values: [7] },
    ]
    expect(buildChartCsv(config, groups)).toBe('status,Count\r\nopen,3\r\nclosed,7')
  })

  it('adds a second column when any group carries key2', () => {
    const config: ChartWidgetConfig = { ...createDefaultChartConfig(), groupBy: { field: 'status' }, groupBy2: { field: 'region' } }
    const groups: AggregateGroupResponse[] = [{ key: 'open', key2: 'west', values: [3] }]
    expect(buildChartCsv(config, groups)).toBe('status,region,Count\r\nopen,west,3')
  })

  it('quotes cells containing commas, quotes, or newlines', () => {
    const config: ChartWidgetConfig = { ...createDefaultChartConfig(), groupBy: { field: 'status' } }
    const groups: AggregateGroupResponse[] = [{ key: 'a, "quoted"', values: [1] }]
    expect(buildChartCsv(config, groups)).toBe('status,Count\r\n"a, ""quoted""",1')
  })

  it('renders a stat tile as a single labeled value, with no Group column', () => {
    const config: ChartWidgetConfig = {
      ...createDefaultChartConfig(),
      chartType: 'stat',
      series: [{ fn: 'sum', field: 'amount', label: 'Total Sales' }],
    }
    const groups: AggregateGroupResponse[] = [{ key: '', values: [4200] }]
    expect(buildChartCsv(config, groups)).toBe('Total Sales\r\n4200')
  })

  it('falls back to 0 for a stat tile with no data', () => {
    const config: ChartWidgetConfig = { ...createDefaultChartConfig(), chartType: 'stat' }
    expect(buildChartCsv(config, [])).toBe('Count\r\n0')
  })
})
