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

  it('accepts the donut and combo identities', () => {
    expect(parseChartConfig({ formId: 'f1', chartType: 'donut' }).chartType).toBe('donut')
    expect(parseChartConfig({ formId: 'f1', chartType: 'combo' }).chartType).toBe('combo')
    // The shape variants are knobs, not types — a chartType naming one is
    // as unrecognized as any other typo and heals to bar.
    expect(parseChartConfig({ formId: 'f1', chartType: 'stacked_bar' }).chartType).toBe('bar')
  })

  // The load-bearing property: a chart authored before these knobs existed
  // must parse back out byte-identical. A persisted `stacked: false` would
  // dirty every such dashboard on first open.
  it('leaves every new knob undefined when absent rather than defaulting it', () => {
    const parsed = parseChartConfig({ formId: 'f1' })
    expect(parsed.stacked).toBeUndefined()
    expect(parsed.orientation).toBeUndefined()
    expect(parsed.axis).toBeUndefined()
    expect(parsed.dataLabels).toBeUndefined()
  })

  it('treats a false boolean knob as absent, since false IS the default', () => {
    expect(parseChartConfig({ formId: 'f1', stacked: false }).stacked).toBeUndefined()
    expect(parseChartConfig({ formId: 'f1', dataLabels: false }).dataLabels).toBeUndefined()
  })

  it('heals an unrecognized orientation and series mark', () => {
    expect(parseChartConfig({ formId: 'f1', orientation: 'sideways' }).orientation).toBeUndefined()
    expect(parseChartConfig({ formId: 'f1', series: [{ fn: 'count', type: 'scatter' }] }).series[0].type).toBeUndefined()
    expect(parseChartConfig({ formId: 'f1', series: [{ fn: 'count', type: 'line' }] }).series[0].type).toBe('line')
  })

  it('keeps the axis bounds it can read and drops the block when none survive', () => {
    expect(parseChartConfig({ formId: 'f1', axis: { yMin: 0, yMax: 100, yTitle: 'Bs' } }).axis)
      .toMatchObject({ yMin: 0, yMax: 100, yTitle: 'Bs' })
    // Nothing readable left means "automatic", which has exactly one
    // representation: absent.
    expect(parseChartConfig({ formId: 'f1', axis: { yMin: 'lots', yTitle: '' } }).axis).toBeUndefined()
    expect(parseChartConfig({ formId: 'f1', axis: {} }).axis).toBeUndefined()
    expect(parseChartConfig({ formId: 'f1', axis: 'nope' }).axis).toBeUndefined()
  })

  // 0 is a meaningful bound — the one that stops a bar chart exaggerating
  // small differences — so it must survive a falsy check.
  it('keeps a zero axis bound', () => {
    expect(parseChartConfig({ formId: 'f1', axis: { yMin: 0 } }).axis).toEqual({
      xTitle: undefined, yTitle: undefined, yMin: 0, yMax: undefined, yLog: undefined,
    })
  })
})

describe('count_distinct', () => {
  it('is accepted as a measure', () => {
    const parsed = parseChartConfig({ formId: 'f1', series: [{ fn: 'count_distinct', field: 'customer' }] })
    expect(parsed.series).toEqual([{ fn: 'count_distinct', field: 'customer', label: undefined, color: undefined, type: undefined }])
  })

  // The engine exempts it from the numeric gate on purpose, so the parser
  // must not reintroduce one — a distinct count of an enum is the case it
  // exists for.
  it('keeps a non-numeric field', () => {
    expect(parseChartConfig({ formId: 'f1', series: [{ fn: 'count_distinct', field: 'status' }] }).series[0].field).toBe('status')
  })

  it('still rejects a measure the engine does not implement', () => {
    expect(parseChartConfig({ formId: 'f1', series: [{ fn: 'median', field: 'amount' }] }).series).toEqual([])
  })
})
