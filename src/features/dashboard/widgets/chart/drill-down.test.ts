import { describe, it, expect } from 'vitest'
import { drillDownConditions } from './drill-down'
import { createDefaultChartConfig, type ChartWidgetConfig } from './schema'
import type { FieldDef } from '@/features/forms/types'

const FIELDS = [
  { name: 'status', label: 'Status', type: 'enum' },
  { name: 'region', label: 'Region', type: 'enum' },
  { name: 'grand_total', label: 'Grand Total', type: 'decimal' },
  { name: 'due_date', label: 'Due Date', type: 'date' },
  { name: 'created_at', label: 'Created', type: 'datetime' },
] as unknown as FieldDef[]

const cfg = (p: Partial<ChartWidgetConfig>): ChartWidgetConfig => ({
  ...createDefaultChartConfig(), formId: 'invoices', groupBy: { field: 'status' }, ...p,
})

/** A range-bucketed key as aggregate.go's rangeBucketLabel builds it: a
 *  "%02d" index, the \x1f separator, then the human label. */
const banded = (i: number, label: string) => `${String(i).padStart(2, '0')}\x1f${label}`

/** A date-bucketed key as the engine actually emits it: date_trunc(...)::text
 *  over a timestamptz, which Postgres renders with a SPACE and a
 *  session-timezone offset — not the ISO-8601 the first draft of these
 *  tests assumed. */
const pg = (day: string) => `${day} 00:00:00+00`

describe('unbucketed dimension', () => {
  it('matches the key exactly', () => {
    expect(drillDownConditions(cfg({}), FIELDS, 'Open')).toEqual([
      { id: 'drill-eq', field: 'status', op: 'eq', value_mode: 'static', value: 'Open' },
    ])
  })

  it('refuses when the chart has no dimension at all', () => {
    expect(drillDownConditions(cfg({ groupBy: undefined }), FIELDS, 'x')).toBeUndefined()
  })
})

// aggregate.go routes a NULL key through one "(empty)" sentinel for every
// dimension shape, so this inversion is exact in all of them.
describe('the empty group', () => {
  it('becomes is_null', () => {
    expect(drillDownConditions(cfg({}), FIELDS, '(empty)')).toEqual([
      { id: 'drill-null', field: 'status', op: 'is_null', value_mode: 'static', value: undefined },
    ])
  })

  it('becomes is_null for a banded dimension too, not a band', () => {
    const c = cfg({ groupBy: { field: 'grand_total', ranges: [100, 500] } })
    const out = drillDownConditions(c, FIELDS, banded(0, '(empty)'))
    expect(out).toHaveLength(1)
    expect(out![0].op).toBe('is_null')
  })
})

describe('numeric range bands', () => {
  // The SQL is `WHEN value <= ranges[i] THEN label_i`, evaluated in order.
  const c = cfg({ groupBy: { field: 'grand_total', ranges: [100, 500, 1000] } })

  it('reads the band from the key index, not from the human label', () => {
    // A deliberately WRONG label with the right index: the inversion must
    // not consult it. This is what makes the mapping drift-proof.
    const out = drillDownConditions(c, FIELDS, banded(1, 'nonsense'))
    expect(out).toEqual([
      { id: 'drill-gt', field: 'grand_total', op: 'gt', value_mode: 'static', value: 100 },
      { id: 'drill-lte', field: 'grand_total', op: 'lte', value_mode: 'static', value: 500 },
    ])
  })

  it('makes the first band open-ended below', () => {
    expect(drillDownConditions(c, FIELDS, banded(0, '<= 100'))).toEqual([
      { id: 'drill-lte', field: 'grand_total', op: 'lte', value_mode: 'static', value: 100 },
    ])
  })

  it('makes the last band open-ended above', () => {
    expect(drillDownConditions(c, FIELDS, banded(3, '> 1000'))).toEqual([
      { id: 'drill-gt', field: 'grand_total', op: 'gt', value_mode: 'static', value: 1000 },
    ])
  })

  // The bands must tile the line with no gap and no overlap, or a record
  // sitting on a boundary is reachable from two bars or from none.
  it('tiles the line: every bound is used exactly twice, as gt then lte', () => {
    const lower = drillDownConditions(c, FIELDS, banded(1, ''))!.find((x) => x.op === 'gt')!.value
    const upperOfPrevious = drillDownConditions(c, FIELDS, banded(0, ''))!.find((x) => x.op === 'lte')!.value
    expect(lower).toBe(upperOfPrevious)
  })

  it('refuses a banded key that carries no index', () => {
    expect(drillDownConditions(c, FIELDS, 'no-prefix-here')).toBeUndefined()
  })
})

// The one case that is NOT exactly invertible, and so does not navigate.
// The engine bands `CURRENT_DATE - field::date` — a whole-day integer in
// the SERVER's timezone — and nothing in the browser reproduces that
// without disagreeing at the band boundary, which is exactly where an
// ageing report's rows sit.
describe('date-age bands refuse rather than approximate', () => {
  it('refuses on a date field', () => {
    const c = cfg({ groupBy: { field: 'due_date', ranges: [30, 60, 90] } })
    expect(drillDownConditions(c, FIELDS, banded(1, '31 - 60'))).toBeUndefined()
  })

  it('refuses on a datetime field', () => {
    const c = cfg({ groupBy: { field: 'created_at', ranges: [7, 30] } })
    expect(drillDownConditions(c, FIELDS, banded(0, '<= 7'))).toBeUndefined()
  })

  // The refusal is about AGE banding, not about dates — a date grouped by
  // a time bucket inverts exactly and must still work.
  it('still drills down a date bucketed by period', () => {
    const c = cfg({ groupBy: { field: 'due_date', bucket: 'month' } })
    expect(drillDownConditions(c, FIELDS, pg('2026-09-01'))).toHaveLength(2)
  })
})

describe('date buckets', () => {
  const at = (c: ChartWidgetConfig, key: string) => drillDownConditions(c, FIELDS, key)!
  const monthly = cfg({ groupBy: { field: 'due_date', bucket: 'month' } })

  it('produces a half-open window so a boundary record lands in one bucket only', () => {
    const out = at(monthly, pg('2026-09-01'))
    expect(out[0]).toMatchObject({ op: 'gte', value: '2026-09-01' })
    expect(out[1]).toMatchObject({ op: 'lt', value: '2026-10-01' })
  })

  // Adding a fixed span would land February in the wrong place.
  it('advances months and quarters by calendar parts', () => {
    expect(at(monthly, pg('2026-02-01'))[1].value).toBe('2026-03-01')
    expect(at(cfg({ groupBy: { field: 'due_date', bucket: 'quarter' } }), pg('2026-10-01'))[1].value)
      .toBe('2027-01-01')
  })

  it('handles the shorter buckets', () => {
    expect(at(cfg({ groupBy: { field: 'due_date', bucket: 'day' } }), pg('2026-09-30'))[1].value).toBe('2026-10-01')
    expect(at(cfg({ groupBy: { field: 'due_date', bucket: 'week' } }), pg('2026-09-28'))[1].value).toBe('2026-10-05')
    expect(at(cfg({ groupBy: { field: 'due_date', bucket: 'year' } }), pg('2026-01-01'))[1].value).toBe('2027-01-01')
  })

  // The window must not move with the machine running the browser. Feeding
  // the offsets a server in any timezone would emit has to give the same
  // calendar bounds — which is why only the key's date prefix is read, and
  // why `new Date(key)` is not used: a Postgres timestamp string is outside
  // the grammar ECMAScript mandates, and an offset-less one is parsed as
  // LOCAL time.
  it('gives the same window whatever offset the server rendered', () => {
    const expected = ['2026-09-01', '2026-10-01']
    for (const key of [
      '2026-09-01 00:00:00+00',    // a UTC server
      '2026-09-01 00:00:00-04',    // and one that is not
      '2026-09-01 00:00:00+05:30',
      '2026-09-01 00:00:00',       // no offset at all
      '2026-09-01T00:00:00.000Z',  // and the ISO form, still accepted
      '2026-09-01',
    ]) {
      expect(at(monthly, key).map((x) => x.value), key).toEqual(expected)
    }
  })

  it('refuses a key carrying no date rather than producing an Invalid Date window', () => {
    expect(drillDownConditions(monthly, FIELDS, 'not-a-date')).toBeUndefined()
    expect(drillDownConditions(monthly, FIELDS, '')).toBeUndefined()
  })

  // Same format rangeToConditions emits for the chart's own time-range
  // control, so the two never disagree about how a date bound is written.
  it('emits plain calendar dates, not instants', () => {
    for (const x of at(monthly, pg('2026-09-01'))) expect(x.value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('split charts', () => {
  const c = cfg({ groupBy: { field: 'status' }, groupBy2: { field: 'region' } })

  it('narrows by both dimensions when a sub-series was clicked', () => {
    expect(drillDownConditions(c, FIELDS, 'Open', 'North')).toEqual([
      { id: 'drill-eq', field: 'status', op: 'eq', value_mode: 'static', value: 'Open' },
      { id: 'drill2-eq', field: 'region', op: 'eq', value_mode: 'static', value: 'North' },
    ])
  })

  it('narrows by the primary dimension alone when no sub-series was identified', () => {
    expect(drillDownConditions(c, FIELDS, 'Open')).toHaveLength(1)
  })

  it('ignores a split key when the chart declares no second dimension', () => {
    expect(drillDownConditions(cfg({}), FIELDS, 'Open', 'North')).toHaveLength(1)
  })

  // Drilling to the primary band across EVERY split value is a WIDER set
  // than the segment that was clicked — the wrong-records failure again.
  it('refuses entirely when the split dimension cannot be inverted', () => {
    const ageSplit = cfg({ groupBy: { field: 'status' }, groupBy2: { field: 'due_date', ranges: [30, 60] } })
    expect(drillDownConditions(ageSplit, FIELDS, 'Open', banded(1, '31 - 60'))).toBeUndefined()
  })
})

describe('condition ids', () => {
  // These reach a react-query key downstream; a random id would refetch on
  // every render, the same reason resolveParameterFilter pins its own.
  it('are stable across calls with the same input', () => {
    const a = drillDownConditions(cfg({}), FIELDS, 'Open', undefined)
    const b = drillDownConditions(cfg({}), FIELDS, 'Open', undefined)
    expect(a).toEqual(b)
  })

  it('do not collide between the two dimensions', () => {
    const out = drillDownConditions(cfg({ groupBy2: { field: 'region' } }), FIELDS, 'Open', 'North')!
    expect(new Set(out.map((x) => x.id)).size).toBe(out.length)
  })
})
