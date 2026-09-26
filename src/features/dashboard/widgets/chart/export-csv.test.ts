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

  it('strips a range bucket\'s sort-safe prefix from key and key2', () => {
    const config: ChartWidgetConfig = { ...createDefaultChartConfig(), groupBy: { field: 'due_date', ranges: [30, 60] }, groupBy2: { field: 'amount', ranges: [1000] } }
    const groups: AggregateGroupResponse[] = [{ key: '00\x1f<= 30', key2: '01\x1f> 1000', values: [3] }]
    expect(buildChartCsv(config, groups)).toBe('due_date,amount,Count\r\n<= 30,> 1000,3')
  })

  it('quotes cells containing commas, quotes, or newlines', () => {
    const config: ChartWidgetConfig = { ...createDefaultChartConfig(), groupBy: { field: 'status' } }
    const groups: AggregateGroupResponse[] = [{ key: 'a, "quoted"', values: [1] }]
    expect(buildChartCsv(config, groups)).toBe('status,Count\r\n"a, ""quoted""",1')
  })

  // The engine omits a key that is the empty string, so a group of records
  // saved with the field blank arrives keyless. Its cell is empty — the value
  // those records hold — not the chart's translated "(blank)" label.
  it('writes an empty cell for a group the response sent no key for', () => {
    const config: ChartWidgetConfig = { ...createDefaultChartConfig(), groupBy: { field: 'phone' }, groupBy2: { field: 'region' } }
    const groups: AggregateGroupResponse[] = [
      { key: '(empty)', key2: 'west', values: [2] },
      { key2: 'west', values: [3] },
      { key: '555-0101', values: [1] },
    ]
    expect(buildChartCsv(config, groups)).toBe('phone,region,Count\r\n(empty),west,2\r\n,west,3\r\n555-0101,,1')
  })

  it('renders a stat tile as a single labeled value, with no Group column', () => {
    const config: ChartWidgetConfig = {
      ...createDefaultChartConfig(),
      chartType: 'stat',
      series: [{ fn: 'sum', field: 'amount', label: 'Total Sales' }],
    }
    // The shape the engine really sends for an ungrouped request: no key.
    const groups: AggregateGroupResponse[] = [{ values: [4200] }]
    expect(buildChartCsv(config, groups)).toBe('Total Sales\r\n4200')
  })

  it('falls back to 0 for a stat tile with no data', () => {
    const config: ChartWidgetConfig = { ...createDefaultChartConfig(), chartType: 'stat' }
    expect(buildChartCsv(config, [])).toBe('Count\r\n0')
  })
})
