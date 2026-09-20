import { describe, it, expect } from 'vitest'
import { CANONICAL_OPS, conditionToText, describeCondition, describeFilter, opTakesValue } from './filter-text'
import type { CompareOp, FilterCondition, FilterGroup } from './types'
import type { FieldDef } from '@/features/forms/types'

const FIELDS = [
  { name: 'status', label: 'Status', type: 'enum' },
  { name: 'grand_total', label: 'Grand Total', type: 'decimal' },
  { name: 'due_date', label: 'Due Date', type: 'date' },
] as unknown as FieldDef[]

const c = (p: Partial<FilterCondition>): FilterCondition =>
  ({ id: 'c1', field: 'status', op: 'eq', value_mode: 'static', ...p } as FilterCondition)

const group = (p: Partial<FilterGroup>): FilterGroup =>
  ({ combinator: 'and', conditions: [], groups: [], ...p })

describe('operator coverage', () => {
  // The bug this file exists to prevent: active-filters-bar.tsx carried a
  // partial table that never learned ends_with, not_in, not_contains or
  // search, so those chips rendered the raw enum value at a viewer.
  const ALL_OPS: CompareOp[] = [
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'not_contains',
    'starts_with', 'ends_with', 'in', 'not_in', 'is_null', 'not_null',
    'search', 'was_updated',
  ]

  it('names every operator in the union', () => {
    for (const op of ALL_OPS) expect(CANONICAL_OPS[op], op).toBeTruthy()
    // Record<CompareOp, string> already makes an omission a compile error;
    // this catches a stub left as an empty string.
    expect(Object.keys(CANONICAL_OPS).sort()).toEqual([...ALL_OPS].sort())
  })

  // Exactly the four the old inline table was missing.
  it('renders the operators that used to fall through as raw enum values', () => {
    expect(conditionToText(c({ op: 'ends_with', value: 'Ltd' }), FIELDS)).toBe('Status ends with "Ltd"')
    expect(conditionToText(c({ op: 'not_in', value: ['open'] }), FIELDS)).toBe('Status not in ["open"]')
    expect(conditionToText(c({ op: 'not_contains', value: 'x' }), FIELDS)).toBe('Status not contains "x"')
    expect(conditionToText(c({ op: 'search', value: 'acme' }), FIELDS)).toBe('matches "acme"')
  })

  it('knows which operators compare against nothing', () => {
    expect(opTakesValue('is_null')).toBe(false)
    expect(opTakesValue('not_null')).toBe(false)
    expect(opTakesValue('was_updated')).toBe(false)
    expect(opTakesValue('eq')).toBe(true)
  })

  it('renders no value for an operator that takes none, whatever the condition holds', () => {
    expect(describeCondition(c({ op: 'is_null', value: 'ignored' })).value).toBeUndefined()
  })
})

describe('value modes', () => {
  // Each mode gets its own notation so a reader can tell a literal from a
  // token that resolves at query time. String()'ing them all — what the old
  // inline version did — made a relative date and a typo'd string identical.
  it('renders a relative date as its own token, bare', () => {
    expect(conditionToText(c({ field: 'due_date', op: 'gte', value_mode: 'relative', value: '-30d' }), FIELDS))
      .toBe('Due Date >= -30d')
  })

  it('marks a current_user attribute rather than showing the bare name', () => {
    expect(conditionToText(c({ field: 'owner', value_mode: 'current_user', value: 'email' })))
      .toBe('owner = me.email')
  })

  it('marks a this_record hop', () => {
    expect(conditionToText(c({ field: 'region', value_mode: 'this_record', value: 'customer.region' })))
      .toBe('region = this.customer.region')
  })

  it('backticks an expression rather than printing it as a literal', () => {
    expect(conditionToText(c({ value_mode: 'expression', expression: 'record.total * 2' }), FIELDS))
      .toBe('Status = `record.total * 2`')
  })

  it('quotes a static string so an empty one is visible', () => {
    expect(conditionToText(c({ value: 'open' }), FIELDS)).toBe('Status = "open"')
    expect(conditionToText(c({ value: '' }), FIELDS)).toBe('Status = ""')
  })

  it('leaves numbers and booleans unquoted', () => {
    expect(conditionToText(c({ field: 'grand_total', op: 'gt', value: 500 }), FIELDS)).toBe('Grand Total > 500')
    expect(conditionToText(c({ field: 'archived', value: false }))).toBe('archived = false')
  })

  it('renders an `in` list as a bracketed set', () => {
    expect(conditionToText(c({ op: 'in', value: ['open', 'paid'] }), FIELDS)).toBe('Status in ["open", "paid"]')
  })
})

describe('field naming', () => {
  it('prefers the field label and falls back to the raw name', () => {
    expect(describeCondition(c({ field: 'status' }), FIELDS).field).toBe('Status')
    expect(describeCondition(c({ field: 'unknown_field' }), FIELDS).field).toBe('unknown_field')
    expect(describeCondition(c({ field: 'status' })).field).toBe('status')
  })

  // `search` runs against the form's combined tsv column, so naming a field
  // would describe a filter that isn't there.
  it('names no field for a full-text search', () => {
    expect(describeCondition(c({ op: 'search', value: 'acme' })).field).toBeUndefined()
    expect(conditionToText(c({ op: 'search', value: 'acme' }))).toBe('matches "acme"')
  })
})

describe('describeFilter', () => {
  it('joins with the group combinator', () => {
    const g = group({ conditions: [c({ id: 'a', value: 'open' }), c({ id: 'b', field: 'grand_total', op: 'gt', value: 100 })] })
    expect(describeFilter(g, FIELDS)).toBe('Status = "open" AND Grand Total > 100')
    expect(describeFilter({ ...g, combinator: 'or' }, FIELDS)).toBe('Status = "open" OR Grand Total > 100')
  })

  it('parenthesises a nested group but not the top level', () => {
    const g = group({
      conditions: [c({ id: 'a', value: 'open' })],
      groups: [group({ combinator: 'or', conditions: [c({ id: 'b', field: 'grand_total', op: 'gt', value: 1 }), c({ id: 'd', field: 'grand_total', op: 'lt', value: 9 })] })],
    })
    expect(describeFilter(g, FIELDS)).toBe('Status = "open" AND (Grand Total > 1 OR Grand Total < 9)')
  })

  it('does not bracket a nested group holding one member', () => {
    const g = group({
      conditions: [c({ id: 'a', value: 'open' })],
      groups: [group({ conditions: [c({ id: 'b', field: 'grand_total', op: 'gt', value: 1 })] })],
    })
    expect(describeFilter(g, FIELDS)).toBe('Status = "open" AND Grand Total > 1')
  })

  // A half-built filter has empty nested groups all the time; rendering
  // them as "()" would show a viewer punctuation and nothing else.
  it('drops groups that contribute nothing', () => {
    const g = group({ conditions: [c({ id: 'a', value: 'open' })], groups: [group({}), group({ groups: [group({})] })] })
    expect(describeFilter(g, FIELDS)).toBe('Status = "open"')
  })

  it('returns an empty string for a filter that narrows nothing', () => {
    expect(describeFilter(undefined)).toBe('')
    expect(describeFilter(group({}))).toBe('')
    expect(describeFilter(group({ groups: [group({})] }))).toBe('')
  })
})
