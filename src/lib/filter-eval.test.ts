import { describe, it, expect } from 'vitest'
import {
  evaluateFilterGroup,
  matchesFilter,
  isClientEvaluable,
  CLIENT_EVALUABLE_OPS,
} from './filter-eval'
import type { FilterGroup, FilterCondition, CompareOp } from '@/features/workflows/types'
import type { AdvancedSettingGroup } from '@/features/form-builder/schema'

// These tests double as the specification the Kotlin port must satisfy, so
// each one states the server behavior it is matching rather than just asserting
// a value. Where the client deliberately differs from internal/graph/
// filter_expr.go, the test says so in its name.

let n = 0
function cond(field: string, op: CompareOp, value?: unknown, extra: Partial<FilterCondition> = {}): FilterCondition {
  return { id: `c${++n}`, field, op, value_mode: 'static', value, ...extra }
}
function group(combinator: 'and' | 'or', conditions: FilterCondition[], groups: FilterGroup[] = []): FilterGroup {
  return { combinator, conditions, groups }
}
function evalWith(g: FilterGroup, values: Record<string, unknown>, oldValues?: Record<string, unknown>) {
  return evaluateFilterGroup(g, { values, oldValues })
}

describe('empty and degenerate trees', () => {
  it('treats an absent group as matching everything', () => {
    // FilterGroup.IsEmpty() compiles to the literal "true": an empty filter
    // constrains nothing. The opposite default would silently hide every row.
    expect(matchesFilter(undefined, { values: {} })).toBe(true)
    expect(matchesFilter(null, { values: {} })).toBe(true)
  })

  it('treats a group with no conditions or subgroups as matching', () => {
    expect(matchesFilter(group('and', []), { values: {} })).toBe(true)
    expect(matchesFilter(group('or', []), { values: {} })).toBe(true)
  })

  it('tolerates missing conditions/groups arrays', () => {
    // RecordsTable.tsx notes that nothing forces a stored group to carry every
    // key, so a partial blob must not throw.
    const partial = { combinator: 'and' } as unknown as FilterGroup
    expect(() => matchesFilter(partial, { values: {} })).not.toThrow()
    expect(matchesFilter(partial, { values: {} })).toBe(true)
  })
})

describe('combinator', () => {
  it('ORs only on the literal "or"', () => {
    const conds = [cond('a', 'eq', 1), cond('b', 'eq', 2)]
    expect(matchesFilter(group('or', conds), { values: { a: 1, b: 99 } })).toBe(true)
    expect(matchesFilter(group('and', conds), { values: { a: 1, b: 99 } })).toBe(false)
  })

  it('treats an unrecognised combinator as AND, matching the server', () => {
    // filter_expr.go: "anything other than the literal 'or' combines with AND".
    const weird = { combinator: 'AND', conditions: [cond('a', 'eq', 1), cond('b', 'eq', 2)], groups: [] } as unknown as FilterGroup
    expect(matchesFilter(weird, { values: { a: 1, b: 99 } })).toBe(false)
  })

  it('nests groups', () => {
    // a == 1 AND (b == 2 OR c == 3)
    const g = group('and', [cond('a', 'eq', 1)], [group('or', [cond('b', 'eq', 2), cond('c', 'eq', 3)])])
    expect(matchesFilter(g, { values: { a: 1, b: 0, c: 3 } })).toBe(true)
    expect(matchesFilter(g, { values: { a: 1, b: 0, c: 0 } })).toBe(false)
    expect(matchesFilter(g, { values: { a: 9, b: 2, c: 3 } })).toBe(false)
  })
})

describe('null checks', () => {
  it('resolves is_null / not_null without needing a value', () => {
    // conditionToExprString returns for these before it ever reads ValueMode.
    expect(matchesFilter(group('and', [cond('a', 'is_null')]), { values: { a: null } })).toBe(true)
    expect(matchesFilter(group('and', [cond('a', 'is_null')]), { values: {} })).toBe(true)
    expect(matchesFilter(group('and', [cond('a', 'is_null')]), { values: { a: 0 } })).toBe(false)
    expect(matchesFilter(group('and', [cond('a', 'not_null')]), { values: { a: 0 } })).toBe(true)
  })

  it('does not treat empty string or zero as null', () => {
    expect(matchesFilter(group('and', [cond('a', 'is_null')]), { values: { a: '' } })).toBe(false)
    expect(matchesFilter(group('and', [cond('a', 'is_null')]), { values: { a: false } })).toBe(false)
  })

  it('resolves is_null even when the condition carries an expression value', () => {
    // The early return means an expression value never gets looked at, so this
    // must NOT be reported unsupported.
    const c = cond('a', 'is_null', undefined, { value_mode: 'expression', expression: 'Vars["x"]' })
    const r = evalWith(group('and', [c]), { a: null })
    expect(r.matches).toBe(true)
    expect(r.unsupported).toEqual([])
  })
})

describe('equality', () => {
  it('compares numbers and strings exactly', () => {
    expect(matchesFilter(group('and', [cond('a', 'eq', 5)]), { values: { a: 5 } })).toBe(true)
    expect(matchesFilter(group('and', [cond('a', 'eq', 'hi')]), { values: { a: 'hi' } })).toBe(true)
    expect(matchesFilter(group('and', [cond('a', 'eq', 'hi')]), { values: { a: 'HI' } })).toBe(false)
  })

  it('treats two nullish values as equal and one as unequal', () => {
    expect(matchesFilter(group('and', [cond('a', 'eq', null)]), { values: { a: undefined } })).toBe(true)
    expect(matchesFilter(group('and', [cond('a', 'eq', null)]), { values: { a: 0 } })).toBe(false)
  })

  it('does not read a boolean as a number', () => {
    // JS would make `true == 1` true. A form field is either a checkbox or a
    // number; conflating them is never what the author meant.
    expect(matchesFilter(group('and', [cond('a', 'eq', 1)]), { values: { a: true } })).toBe(false)
    expect(matchesFilter(group('and', [cond('a', 'eq', true)]), { values: { a: true } })).toBe(true)
  })

  it('compares lists element-wise', () => {
    expect(matchesFilter(group('and', [cond('a', 'eq', ['x', 'y'])]), { values: { a: ['x', 'y'] } })).toBe(true)
    expect(matchesFilter(group('and', [cond('a', 'eq', ['x', 'y'])]), { values: { a: ['y', 'x'] } })).toBe(false)
  })

  it('neq is the exact negation of eq', () => {
    for (const [actual, expected] of [[5, 5], [5, 6], [null, null], ['a', 'b'], [true, false]] as const) {
      const eq = matchesFilter(group('and', [cond('a', 'eq', expected)]), { values: { a: actual } })
      const neq = matchesFilter(group('and', [cond('a', 'neq', expected)]), { values: { a: actual } })
      expect(neq).toBe(!eq)
    }
  })
})

describe('numeric coercion — the deliberate divergence from Expr', () => {
  it('reads a numeric string against a real number, because form inputs produce strings', () => {
    // An <input> bound to an integer field holds "42"; the same field from the
    // API is 42. The identical condition must behave the same on a form as on
    // a detail page.
    expect(matchesFilter(group('and', [cond('a', 'eq', 42)]), { values: { a: '42' } })).toBe(true)
    expect(matchesFilter(group('and', [cond('a', 'gt', 10)]), { values: { a: '42' } })).toBe(true)
    expect(matchesFilter(group('and', [cond('a', 'lt', 10)]), { values: { a: '42' } })).toBe(false)
  })

  it('does NOT coerce when both sides are strings', () => {
    // A text field holding "05" is not the number 5. String-vs-string stays
    // exact, which is what a text field means.
    expect(matchesFilter(group('and', [cond('a', 'eq', '5')]), { values: { a: '05' } })).toBe(false)
  })

  it('refuses a number against non-numeric text rather than guessing', () => {
    const r = evalWith(group('and', [cond('a', 'gt', 10)]), { a: 'abc' })
    expect(r.matches).toBe(false)
    expect(r.unsupported).toHaveLength(1)
  })
})

describe('ordering', () => {
  it('orders ISO dates lexicographically, which is also chronological', () => {
    // ISO-8601 is the wire format for every date field here and sorts as text,
    // so no date parsing is needed that could disagree with the server's.
    const g = group('and', [cond('due', 'gte', '2026-01-01')])
    expect(matchesFilter(g, { values: { due: '2026-09-01' } })).toBe(true)
    expect(matchesFilter(g, { values: { due: '2025-12-31' } })).toBe(false)
  })

  it('covers all four ordering operators at the boundary', () => {
    const at = (op: CompareOp) => matchesFilter(group('and', [cond('a', op, 5)]), { values: { a: 5 } })
    expect(at('gt')).toBe(false)
    expect(at('gte')).toBe(true)
    expect(at('lt')).toBe(false)
    expect(at('lte')).toBe(true)
  })

  it('reports rather than answers when a side is null', () => {
    // Expr cannot evaluate `nil > 5`; presenting false would be a definite
    // answer we do not have.
    const r = evalWith(group('and', [cond('a', 'gt', 5)]), { a: null })
    expect(r.matches).toBe(false)
    expect(r.unsupported[0]).toContain('cannot order-compare')
  })
})

describe('string operators', () => {
  it('is case-insensitive on both sides, matching the SQL ILIKE path', () => {
    // filter_expr.go lowercases both operands specifically so this operator
    // agrees with buildWhere's ILIKE for the same operator name.
    expect(matchesFilter(group('and', [cond('a', 'contains', 'ACME')]), { values: { a: 'acme corp' } })).toBe(true)
    expect(matchesFilter(group('and', [cond('a', 'starts_with', 'ac')]), { values: { a: 'ACME' } })).toBe(true)
  })

  it('coerces non-strings the way string() does', () => {
    expect(matchesFilter(group('and', [cond('a', 'contains', '4')]), { values: { a: 42 } })).toBe(true)
  })

  it('does not let a nullish field match on the text of its own absence', () => {
    expect(matchesFilter(group('and', [cond('a', 'contains', 'null')]), { values: { a: null } })).toBe(false)
    expect(matchesFilter(group('and', [cond('a', 'contains', 'undefined')]), { values: {} })).toBe(false)
  })
})

describe('in', () => {
  it('matches any element, with the same coercion as eq', () => {
    expect(matchesFilter(group('and', [cond('a', 'in', ['x', 'y'])]), { values: { a: 'y' } })).toBe(true)
    expect(matchesFilter(group('and', [cond('a', 'in', [1, 2])]), { values: { a: '2' } })).toBe(true)
    expect(matchesFilter(group('and', [cond('a', 'in', ['x'])]), { values: { a: 'z' } })).toBe(false)
  })

  it('reports a non-list value instead of throwing', () => {
    const r = evalWith(group('and', [cond('a', 'in', 'x')]), { a: 'x' })
    expect(r.matches).toBe(false)
    expect(r.unsupported[0]).toContain('needs a list')
  })
})

describe('was_updated', () => {
  it('is false without previous state, matching OldRecord == nil on create', () => {
    const g = group('and', [cond('status', 'was_updated')])
    expect(matchesFilter(g, { values: { status: 'open' } })).toBe(false)
    expect(matchesFilter(g, { values: { status: 'open' }, oldValues: null })).toBe(false)
  })

  it('compares old against new', () => {
    const g = group('and', [cond('status', 'was_updated')])
    expect(evalWith(g, { status: 'closed' }, { status: 'open' }).matches).toBe(true)
    expect(evalWith(g, { status: 'open' }, { status: 'open' }).matches).toBe(false)
  })

  it('does not report itself unsupported when previous state is absent', () => {
    // It is a definite false, not an undecidable — the server says the same.
    const r = evalWith(group('and', [cond('a', 'was_updated')]), { a: 1 })
    expect(r.unsupported).toEqual([])
  })

  it('counts a key missing from the NEW values as a change', () => {
    // filter_expr_test.go calls this out explicitly: the compiled expression is
    // `OldRecord[f] != Vars[f]`, and a key absent from Vars reads as nil, so an
    // old value of "open" against a missing new value is a change. Subtle, and
    // exactly the case a second implementation would get wrong.
    expect(evalWith(group('and', [cond('status', 'was_updated')]), {}, { status: 'open' }).matches).toBe(true)
  })

  it('counts a key missing from the OLD values as a change', () => {
    expect(evalWith(group('and', [cond('status', 'was_updated')]), { status: 'open' }, {}).matches).toBe(true)
  })

  it('is not a change when the key is absent from both', () => {
    expect(evalWith(group('and', [cond('status', 'was_updated')]), {}, {}).matches).toBe(false)
  })
})

describe('what this module refuses to decide', () => {
  it('refuses the full-text search operator, as the server does', () => {
    const r = evalWith(group('and', [cond('a', 'search', 'term')]), { a: 'term here' })
    expect(r.matches).toBe(false)
    expect(r.unsupported[0]).toContain('full-text')
  })

  it('refuses an expression-mode value', () => {
    const c = cond('a', 'eq', undefined, { value_mode: 'expression', expression: 'Vars["b"] + 1' })
    const r = evalWith(group('and', [c]), { a: 2, b: 1 })
    expect(r.matches).toBe(false)
    expect(r.unsupported[0]).toContain('expression')
  })

  it('refuses an unknown operator instead of throwing', () => {
    const c = cond('a', 'no_such_op' as CompareOp, 1)
    const r = evalWith(group('and', [c]), { a: 1 })
    expect(r.matches).toBe(false)
    expect(r.unsupported[0]).toContain('unsupported operator')
  })

  it('reports every undecidable condition, not just the first', () => {
    const g = group('and', [cond('a', 'search', 'x'), cond('b', 'gt', 5)])
    const r = evalWith(g, { a: 'x', b: null })
    expect(r.unsupported).toHaveLength(2)
  })

  it('surfaces an undecidable condition even when the tree still matches', () => {
    // The OR is satisfied by the other branch, so `matches` is true — but the
    // caller still has to know one branch could not be evaluated here. This is
    // the case a plain boolean API would hide.
    const g = group('or', [cond('a', 'eq', 1), cond('b', 'search', 'x')])
    const r = evalWith(g, { a: 1, b: 'x' })
    expect(r.matches).toBe(true)
    expect(r.unsupported).toHaveLength(1)
  })
})

describe('convergence with AdvancedSetting', () => {
  it('evaluates an AdvancedSettingGroup with no conversion at all', () => {
    // AdvancedSettingGroup was forked from FilterGroup for import-locality
    // reasons only (see its comment in form-builder/schema.ts), and the fork is
    // structurally identical: same combinator/conditions/groups shape, and
    // AdvancedSettingCompareOp is a strict subset of CompareOp. That makes an
    // AdvancedSetting's `when` tree directly evaluable here — which is what
    // lets the currently-dead Advanced Settings config gain a runtime without
    // a schema migration. If either type drifts, this stops compiling.
    const when: AdvancedSettingGroup = {
      id: 'g1',
      combinator: 'and',
      conditions: [
        { id: 'x1', field: 'stage', op: 'eq', value: 'won' },
        { id: 'x2', field: 'amount', op: 'gte', value: 1000 },
      ],
      groups: [],
    }
    const asFilter: FilterGroup = when
    const r = evaluateFilterGroup(asFilter, { values: { stage: 'won', amount: 2500 } })
    expect(r.matches).toBe(true)
    expect(r.unsupported).toEqual([])
    expect(evaluateFilterGroup(asFilter, { values: { stage: 'won', amount: 10 } }).matches).toBe(false)
  })
})

describe('isClientEvaluable', () => {
  it('accepts a tree of supported operators', () => {
    expect(isClientEvaluable(group('and', [cond('a', 'eq', 1)], [group('or', [cond('b', 'contains', 'x')])]))).toBe(true)
  })

  it('rejects a tree containing search or an expression value, at any depth', () => {
    expect(isClientEvaluable(group('and', [cond('a', 'search', 'x')]))).toBe(false)
    expect(isClientEvaluable(group('and', [], [group('and', [cond('a', 'search', 'x')])]))).toBe(false)
    const expr = cond('a', 'eq', undefined, { value_mode: 'expression', expression: 'x' })
    expect(isClientEvaluable(group('and', [], [group('and', [expr])]))).toBe(false)
  })

  it('accepts an absent group', () => {
    expect(isClientEvaluable(undefined)).toBe(true)
  })

  it('agrees with the evaluator: nothing in the supported list is ever reported unsupported', () => {
    // The two lists are separate pieces of knowledge and would otherwise drift.
    for (const op of CLIENT_EVALUABLE_OPS) {
      const r = evalWith(group('and', [cond('a', op, 1)]), { a: 1 }, { a: 0 })
      const unknownOp = r.unsupported.some((u) => u.includes('unsupported operator'))
      expect(unknownOp, `${op} should be evaluable`).toBe(false)
    }
  })
})
