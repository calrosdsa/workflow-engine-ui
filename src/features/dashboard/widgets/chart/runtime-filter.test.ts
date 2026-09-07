import { describe, it, expect } from 'vitest'
import { mergeFilters, rangeToConditions } from './runtime-filter'
import type { FilterGroup } from '@/features/workflows/types'

const cond = (field: string, value: unknown): FilterGroup => ({
  combinator: 'and',
  conditions: [{ id: field, field, op: 'eq', value_mode: 'static', value }],
  groups: [],
})
const empty: FilterGroup = { combinator: 'and', conditions: [], groups: [] }

describe('mergeFilters', () => {
  it('returns undefined when every input is empty or undefined', () => {
    expect(mergeFilters()).toBeUndefined()
    expect(mergeFilters(undefined, empty)).toBeUndefined()
  })

  it('collapses to the lone survivor instead of wrapping a single group', () => {
    const a = cond('status', 'open')
    expect(mergeFilters(a, undefined, empty)).toBe(a)
  })

  it('AND-wraps every non-empty group when more than one is present', () => {
    const a = cond('status', 'open')
    const b = cond('amount', 100)
    expect(mergeFilters(a, undefined, b, empty)).toEqual({
      combinator: 'and',
      conditions: [],
      groups: [a, b],
    })
  })
})

describe('rangeToConditions', () => {
  it('compiles an inclusive {from, to} into a gte + exclusive-upper lt pair', () => {
    const conds = rangeToConditions('created_at', { from: '2026-08-01', to: '2026-08-31' })
    expect(conds).toEqual([
      { id: 'range-created_at-from', field: 'created_at', op: 'gte', value_mode: 'static', value: '2026-08-01' },
      { id: 'range-created_at-to', field: 'created_at', op: 'lt', value_mode: 'static', value: '2026-09-01' },
    ])
  })

  it('rolls the exclusive upper bound across a month/year boundary', () => {
    const conds = rangeToConditions('created_at', { from: '2025-12-01', to: '2025-12-31' })
    expect(conds[1]).toEqual({ id: 'range-created_at-to', field: 'created_at', op: 'lt', value_mode: 'static', value: '2026-01-01' })
  })
})
