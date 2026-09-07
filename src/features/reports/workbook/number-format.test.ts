import { describe, expect, it } from 'vitest'
import type { NumberFormat } from '../types'
import { excelPattern, patternIndex, sampleFor } from './number-format'

// excelPattern has to agree with NumberFormat.ExcelCode() in the Go writer:
// the same descriptor renders through Go for the downloaded file and through
// this for the on-canvas grid. These cases are the ones the backend's own
// excelize-oracle test pinned, restated here so the two cannot drift apart
// silently.
describe('excelPattern mirrors the backend ExcelCode', () => {
  const cases: Array<[string, NumberFormat, string]> = [
    ['plain 2dp', {}, '#,##0.00'],
    ['integer', { decimals: 0 }, '#,##0'],
    ['ungrouped', { thousands_separator: '' }, '0.00'],
    ['currency prefix', { style: 'currency', currency_symbol: 'Bs ' }, '"Bs "#,##0.00'],
    ['currency suffix', { style: 'currency', currency_symbol: ' Bs', currency_position: 'suffix' }, '#,##0.00" Bs"'],
    ['accounting', { style: 'currency', currency_symbol: 'Bs ', negative_style: 'parentheses' }, '"Bs "#,##0.00;("Bs "#,##0.00)'],
    ['percent', { style: 'percent' }, '#,##0.00%'],
    // The separators are NOT in the code, whatever the author chose — a
    // stored Excel format is canonical and the viewer supplies the
    // characters. This is the asymmetry the panel warns about.
    ['bolivian separators still canonical', { thousands_separator: '.', decimal_separator: ',' }, '#,##0.00'],
  ]
  it.each(cases)('%s', (_name, format, want) => {
    expect(excelPattern(format)).toBe(want)
  })

  // Both would break out of the quoted literal and produce a code Excel
  // refuses the whole file over — the backend strips them for the same
  // reason, at the same point.
  it('strips characters that would break the quoted literal', () => {
    expect(excelPattern({ style: 'currency', currency_symbol: 'a"b\c' })).toBe('"abc"#,##0.00')
  })

  it('clamps decimals rather than trusting them', () => {
    expect(excelPattern({ decimals: 99 })).toBe(`#,##0.${'0'.repeat(10)}`)
    expect(excelPattern({ decimals: -3 })).toBe('#,##0')
  })
})

describe('sampleFor', () => {
  it('applies the author separators the exported document will use', () => {
    expect(sampleFor({ style: 'currency', currency_symbol: 'Bs ', thousands_separator: '.', decimal_separator: ',' }))
      .toBe('Bs 1.234.567,89')
  })
  // The rule most likely to be got backwards, and the one the backend's own
  // tests pin: a percent format multiplies by 100.
  it('multiplies a percent by 100', () => {
    expect(sampleFor({ style: 'percent', decimals: 0, thousands_separator: '' })).toBe('123456789%')
  })
})

describe('patternIndex', () => {
  it('recovers a descriptor from the pattern it generated', () => {
    const format: NumberFormat = { style: 'currency', currency_symbol: '$' }
    expect(patternIndex([format]).get('"$"#,##0.00')).toEqual(format)
  })

  // Two descriptors differing only in separators generate the identical
  // canonical pattern. Neither is more correct, so the collision resolves
  // deterministically instead of depending on iteration order.
  it('keeps the first of two descriptors that collide on one pattern', () => {
    const first: NumberFormat = { thousands_separator: '.', decimal_separator: ',' }
    const second: NumberFormat = { thousands_separator: ',', decimal_separator: '.' }
    expect(patternIndex([first, second]).get('#,##0.00')).toEqual(first)
  })
})

// The panel keeps the two separators distinct, because the backend rejects a
// descriptor where they match and the collision is easy to reach by
// accident: choosing the European "1.234" grouping while the decimal
// separator is still "." renders 1.234.567.89, which is a number in no
// locale at all. Caught in the live editor, not by a test.
describe('separator collision', () => {
  it('is not representable — the sample proves the two must differ', () => {
    expect(sampleFor({ thousands_separator: '.', decimal_separator: '.' })).toBe('1.234.567.89')
    expect(sampleFor({ thousands_separator: '.', decimal_separator: ',' })).toBe('1.234.567,89')
  })
})
