import { describe, expect, it } from 'vitest'
import { withSeparatorsDistinct } from '../NumberFormatFields'
import { parseTableBlockConfig } from './table/schema'
import { parseGroupBlockConfig } from './group/schema'
import { parseRelatedBlockConfig } from './related/schema'
import type { NumberFormat } from '../types'

const bolivianos: NumberFormat = {
  style: 'currency',
  currency_symbol: 'Bs ',
  decimals: 2,
  thousands_separator: '.',
  decimal_separator: ',',
}

// Each block's defensive parse rebuilds its config field by field. A parse
// that reconstructed columns or series property-by-property would silently
// drop number_format on the way in, exactly the way the workbook's own
// Univer bridge used to drop a cell format — so this pins that they pass
// their arrays through whole.
describe('block configs keep a column number format through parse', () => {
  it('table columns', () => {
    const parsed = parseTableBlockConfig({
      form_id: 'f1',
      columns: [{ key: 'amount', number_format: bolivianos }],
    })
    expect(parsed.columns?.[0].number_format).toEqual(bolivianos)
  })

  it('group series', () => {
    const parsed = parseGroupBlockConfig({
      form_id: 'f1',
      series: [{ fn: 'sum', field: 'amount', number_format: bolivianos }],
    })
    expect(parsed.series[0].number_format).toEqual(bolivianos)
  })

  it('related child columns', () => {
    const parsed = parseRelatedBlockConfig({
      parent_form_id: 'p',
      child_form_id: 'c',
      columns: [{ key: 'amount', number_format: bolivianos }],
    })
    expect(parsed.columns?.[0].number_format).toEqual(bolivianos)
  })
})

// The backend rejects a descriptor whose separators match, and the panel is
// where that is prevented. Reachable by picking the European "1.234"
// grouping while the decimal is still "." — which renders 1.234.567.89, a
// number in no locale at all.
describe('withSeparatorsDistinct', () => {
  it('moves the decimal out of the way of a colliding thousands separator', () => {
    expect(withSeparatorsDistinct({ thousands_separator: '.' }).decimal_separator).toBe(',')
    expect(withSeparatorsDistinct({ thousands_separator: ',', decimal_separator: ',' }).decimal_separator).toBe('.')
  })

  it('leaves a distinct pair alone', () => {
    const format: NumberFormat = { thousands_separator: '.', decimal_separator: ',' }
    expect(withSeparatorsDistinct(format)).toBe(format)
  })

  // No grouping means there is no separator to collide with, so the decimal
  // must not be moved out from under the author.
  it('does not touch the decimal when grouping is off', () => {
    expect(withSeparatorsDistinct({ thousands_separator: '', decimal_separator: '.' }).decimal_separator).toBe('.')
  })
})
