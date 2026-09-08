import { describe, it, expect } from 'vitest'
import { parseChartConfig, createDefaultChartConfig } from './schema'

describe('parseChartConfig', () => {
  it('round-trips a fully-specified config', () => {
    const full = {
      formId: 'f1',
      chartType: 'line' as const,
      groupBy: { field: 'created_at', bucket: 'month' as const },
      groupBy2: { field: 'amount', ranges: [1000, 10000] },
      series: [{ fn: 'sum' as const, field: 'amount', label: 'Total', color: '#123456' }],
      filter: { id: 'g1', combinator: 'and' as const, conditions: [], groups: [] },
      sortBy: 'value' as const,
      sortDir: 'desc' as const,
      limit: 50,
      legend: false,
      refreshSeconds: 30,
    }
    expect(parseChartConfig(full)).toEqual(full)
  })

  it('falls back to defaults for garbage/legacy input', () => {
    expect(parseChartConfig({})).toEqual(createDefaultChartConfig())
    expect(parseChartConfig(null)).toEqual(createDefaultChartConfig())
    expect(parseChartConfig('garbage')).toEqual(createDefaultChartConfig())
  })

  it('heals an invalid chartType to "bar"', () => {
    expect(parseChartConfig({ formId: 'f1', chartType: 'donut-3d' }).chartType).toBe('bar')
  })

  it('drops a groupBy dimension missing a field', () => {
    expect(parseChartConfig({ formId: 'f1', groupBy: { bucket: 'month' } }).groupBy).toBeUndefined()
    expect(parseChartConfig({ formId: 'f1', groupBy: 'not-an-object' }).groupBy).toBeUndefined()
  })

  it('drops an invalid bucket but keeps the field', () => {
    const parsed = parseChartConfig({ formId: 'f1', groupBy: { field: 'created_at', bucket: 'fortnight' } })
    expect(parsed.groupBy).toEqual({ field: 'created_at', bucket: undefined })
  })

  it('round-trips ranges', () => {
    const parsed = parseChartConfig({ formId: 'f1', groupBy: { field: 'amount', ranges: [30, 60, 90] } })
    expect(parsed.groupBy).toEqual({ field: 'amount', bucket: undefined, ranges: [30, 60, 90] })
  })

  it('filters non-numeric entries out of ranges, and drops an empty result to undefined', () => {
    const parsed = parseChartConfig({ formId: 'f1', groupBy: { field: 'amount', ranges: [30, 'sixty', null, 90] } })
    expect(parsed.groupBy?.ranges).toEqual([30, 90])
    expect(parseChartConfig({ formId: 'f1', groupBy: { field: 'amount', ranges: ['a', 'b'] } }).groupBy?.ranges).toBeUndefined()
    expect(parseChartConfig({ formId: 'f1', groupBy: { field: 'amount', ranges: 'not-an-array' } }).groupBy?.ranges).toBeUndefined()
  })

  it('filters out series entries with an unrecognized fn', () => {
    const parsed = parseChartConfig({
      formId: 'f1',
      series: [{ fn: 'count' }, { fn: 'median', field: 'amount' }, 'not-an-object'],
    })
    expect(parsed.series).toEqual([{ fn: 'count', field: undefined, label: undefined, color: undefined }])
  })

  it('heals a non-array series to an empty array', () => {
    expect(parseChartConfig({ formId: 'f1', series: 'not-an-array' }).series).toEqual([])
  })

  it('heals invalid sortBy/sortDir to defaults', () => {
    const parsed = parseChartConfig({ formId: 'f1', sortBy: 'bogus', sortDir: 'bogus' })
    expect(parsed.sortBy).toBe('group')
    expect(parsed.sortDir).toBe('asc')
  })

  it('heals an invalid limit to 20 and legend defaults to true unless explicitly false', () => {
    expect(parseChartConfig({ formId: 'f1', limit: -5 }).limit).toBe(20)
    expect(parseChartConfig({ formId: 'f1', legend: false }).legend).toBe(false)
    expect(parseChartConfig({ formId: 'f1' }).legend).toBe(true)
  })

  it('createDefaultChartConfig produces a bar chart with a plain count series', () => {
    expect(createDefaultChartConfig()).toEqual({
      formId: '', chartType: 'bar', series: [{ fn: 'count' }], sortBy: 'group', sortDir: 'asc', limit: 20, legend: true,
    })
  })
})
