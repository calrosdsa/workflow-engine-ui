import { describe, it, expect } from 'vitest'
import { formatNumber, formatFieldValue } from './format-value'
import type { NumberFormat } from '@/features/forms/types'

describe('formatNumber without a NumberFormat (unchanged plain-grouping behavior)', () => {
  it('groups thousands with no forced decimals', () => {
    expect(formatNumber(420000)).toBe('420,000')
    expect(formatNumber(8000000)).toBe('8,000,000')
  })
  it('renders the em dash for null/undefined/empty', () => {
    expect(formatNumber(null)).toBe('—')
    expect(formatNumber(undefined)).toBe('—')
    expect(formatNumber('')).toBe('—')
  })
})

// These mirror field.NumberFormat.Format's own test cases (number_format_test.go)
// wherever the case is style-agnostic, so a rendering divergence between the
// record display (here) and a report export (Go) shows up as a failing
// assertion in one of the two suites rather than a silent disagreement.
describe('formatNumber with a NumberFormat — parity with field.NumberFormat.Format', () => {
  it('defaults to 2 decimals, comma grouping, dot decimal', () => {
    expect(formatNumber(1234.5, {})).toBe('1,234.50')
  })
  it('rounds half away from zero, not half-to-even', () => {
    expect(formatNumber(0.125, { decimals: 2 })).toBe('0.13')
    expect(formatNumber(2.5, { decimals: 0 })).toBe('3')
    expect(formatNumber(-2.5, { decimals: 0 })).toBe('-3')
  })
  it('agrees with Go on the value that neither implementation can fix: 1.005 has no exact binary representation, so it is already ~1.00499999999999989 before any rounding rule runs', () => {
    expect(formatNumber(1.005, { decimals: 2 })).toBe('1.00')
  })
  it('0 decimals is a real distinct setting, not "unset"', () => {
    expect(formatNumber(1234, { decimals: 0 })).toBe('1,234')
  })
  it('an explicit empty thousands_separator turns grouping off', () => {
    expect(formatNumber(1234567, { thousands_separator: '', decimals: 0 })).toBe('1234567')
  })
  it('swapped separators render the Bolivian convention', () => {
    const fmt: NumberFormat = { thousands_separator: '.', decimal_separator: ',', decimals: 2 }
    expect(formatNumber(1234.5, fmt)).toBe('1.234,50')
  })
  it('currency: prefix and suffix positions', () => {
    expect(formatNumber(1234.5, { style: 'currency', currency_symbol: '$' })).toBe('$1,234.50')
    expect(formatNumber(1234.5, { style: 'currency', currency_symbol: ' €', currency_position: 'suffix' })).toBe('1,234.50 €')
  })
  it('percent multiplies by 100 before rendering', () => {
    expect(formatNumber(0.5, { style: 'percent', decimals: 2 })).toBe('50.00%')
  })
  it('negative: minus (default) vs. parentheses', () => {
    expect(formatNumber(-1234.5, { decimals: 2 })).toBe('-1,234.50')
    expect(formatNumber(-1234.5, { decimals: 2, negative_style: 'parentheses' })).toBe('(1,234.50)')
    expect(formatNumber(-1234.5, { style: 'currency', currency_symbol: '$', negative_style: 'parentheses' })).toBe('($1,234.50)')
  })
  it('a negative value that rounds to zero still shows the sign', () => {
    expect(formatNumber(-0.001, { decimals: 2 })).toBe('-0.00')
  })
  it('decimals clamps to [0,10] rather than throwing on an out-of-range value', () => {
    expect(formatNumber(1.5, { decimals: -3 })).toBe('2')
    expect(formatNumber(1.5, { decimals: 99 })).toBe('1.5000000000')
  })
})

describe('formatFieldValue threads numberFormat only into the numeric branch', () => {
  it('applies numberFormat for decimal/integer/number types', () => {
    const fmt: NumberFormat = { style: 'currency', currency_symbol: '$' }
    expect(formatFieldValue(1234, 'decimal', fmt)).toBe('$1,234.00')
    expect(formatFieldValue(1234, 'integer', fmt)).toBe('$1,234.00')
    expect(formatFieldValue(1234, 'number', fmt)).toBe('$1,234.00')
  })
  it('ignores numberFormat for a non-numeric type', () => {
    expect(formatFieldValue('hello', 'string', { style: 'currency', currency_symbol: '$' })).toBe('hello')
  })
  it('falls back to plain grouping when numberFormat is omitted', () => {
    expect(formatFieldValue(420000, 'decimal')).toBe('420,000')
  })
})
