import { describe, expect, it } from 'vitest'
import {
  initialArgumentValues,
  isArgumentFilled,
  missingRequiredArguments,
  needsPrompt,
  pruneEmptyArguments,
} from './arguments'
import type { ReportArgument } from './types'

const dateRange: ReportArgument = { key: 'date', label: 'Date', type: 'date', range: true, required: true }
const search: ReportArgument = { key: 'q', label: 'Search', type: 'text' }
const customer: ReportArgument = { key: 'customer', label: 'Customer', type: 'reference', form_id: 'customers', required: true }

describe('isArgumentFilled', () => {
  it('treats a blank string as unsupplied, matching the backend', () => {
    expect(isArgumentFilled(search, '')).toBe(false)
    expect(isArgumentFilled(search, 'ACME')).toBe(true)
  })

  it('accepts a half-open range as filled', () => {
    // A half-open range is a legitimate query, not partial input.
    expect(isArgumentFilled(dateRange, { from: '2022-08-01' })).toBe(true)
    expect(isArgumentFilled(dateRange, { to: '2022-08-31' })).toBe(true)
    expect(isArgumentFilled(dateRange, {})).toBe(false)
  })

  it('treats false as a supplied boolean rather than an empty value', () => {
    const flag: ReportArgument = { key: 'paid', label: 'Paid', type: 'boolean' }
    expect(isArgumentFilled(flag, false)).toBe(true)
  })
})

describe('initialArgumentValues', () => {
  it('prefers a supplied value, then the default', () => {
    const withDefault: ReportArgument = { ...search, default: 'ACME' }
    expect(initialArgumentValues([withDefault])).toEqual({ q: 'ACME' })
    expect(initialArgumentValues([withDefault], { q: 'OTHER' })).toEqual({ q: 'OTHER' })
  })

  it('seeds a range argument with an empty pair rather than a string', () => {
    expect(initialArgumentValues([dateRange])).toEqual({ date: {} })
  })
})

describe('missingRequiredArguments', () => {
  it('gates confirm on required arguments only', () => {
    const values = initialArgumentValues([dateRange, search])
    expect(missingRequiredArguments([dateRange, search], values)).toEqual(['date'])

    values.date = { from: '2022-08-01' }
    expect(missingRequiredArguments([dateRange, search], values)).toEqual([])
  })
})

describe('pruneEmptyArguments', () => {
  it('omits an unfilled optional argument entirely', () => {
    // Omitting a filter and matching nothing are opposite outcomes — the
    // request must not carry an empty value.
    const values = { date: { from: '2022-08-01' }, q: '' }
    expect(pruneEmptyArguments([dateRange, search], values)).toEqual({ date: { from: '2022-08-01' } })
  })

  it('drops an empty bound from a half-open range', () => {
    const values = { date: { from: '2022-08-01', to: '' } }
    expect(pruneEmptyArguments([dateRange], values)).toEqual({ date: { from: '2022-08-01' } })
  })
})

describe('needsPrompt', () => {
  it('does not prompt when nothing is required', () => {
    expect(needsPrompt([search])).toBe(false)
  })

  it('does not prompt when a required argument has a default', () => {
    expect(needsPrompt([{ ...customer, default: 'rec-1' }])).toBe(false)
  })

  it('does not prompt when the caller already resolved the value', () => {
    // The export action's current_record mode resolves an argument before
    // the dialog would ever open.
    expect(needsPrompt([customer], { customer: 'rec-7' })).toBe(false)
  })

  it('prompts for an unresolved required argument', () => {
    expect(needsPrompt([customer])).toBe(true)
  })
})
