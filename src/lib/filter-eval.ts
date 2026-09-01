// Client-side evaluation of a FilterGroup tree.
//
// WHY THIS EXISTS
// ---------------
// FilterGroup is already this platform's one structured condition grammar —
// menus, workflow nodes, record queries and trigger filters all speak it. But
// it has only ever been CONSTRUCTED on the client and evaluated on the server:
// internal/graph/filter_expr.go compiles a tree into a single Expr string, and
// Expr is a Go library with no JavaScript port. That is why the only
// conditional the runtime evaluates today (a field's visibleWhen) round-trips
// to POST /expressions/validate, debounced, once per value change.
//
// A round-trip per branch is affordable for one field and not affordable for a
// workflow. This module closes that gap for the structured subset: everything
// FilterGroup can express WITHOUT an Expr string is decided locally, with no
// network call, from data the client already has.
//
// FIDELITY IS THE WHOLE POINT
// ---------------------------
// A condition must not mean one thing in a server filter and another in the
// client. Every operator below is written against filter_expr.go's compiled
// output, and the divergences are deliberate, enumerated, and tested:
//
//   • `search` is refused, exactly as filter_expr.go refuses it — there is no
//     in-memory equivalent of Postgres's stemmed tsvector match, and a
//     substring approximation would silently disagree with the server.
//   • `value_mode: 'expression'` is refused: the value is an Expr string, and
//     evaluating it is the very thing this module cannot do. Refusing is the
//     honest outcome; guessing false would silently disarm a rule.
//   • Numeric coercion is looser than Expr — see compareLoose() for the reason
//     (live form inputs produce strings where the API produces numbers).
//
// NEVER SILENTLY FALSE
// --------------------
// A condition this module cannot decide is reported in `unsupported`, never
// folded into a plain `false`. A rule that quietly stops firing is far worse
// than one that reports it cannot be evaluated here, because the first failure
// mode is invisible until someone notices data is wrong.
//
// This file is also the reference semantics for the Kotlin port in
// runtime-app: the conformance fixtures both sides run should be derived from
// filter-eval.test.ts, not written twice.

import type { FilterGroup, FilterCondition, CompareOp } from '@/features/workflows/types'

export interface FilterEvalContext {
  /** The record / form values a condition's `field` resolves against — the
   *  client-side counterpart of ExprEnv.Vars. */
  values: Record<string, unknown>
  /** The pre-edit values, required by the change-detection family. Absent
   *  means "no previous state", which is what OldRecord == nil means on the
   *  server: nothing existed before, so nothing changed. */
  oldValues?: Record<string, unknown> | null
}

export interface FilterEvalResult {
  /** Only trustworthy when `unsupported` is empty. */
  matches: boolean
  /** One human-readable reason per condition that could not be decided here.
   *  Non-empty means the caller must either fall back to the server or treat
   *  the result as unknown — it must not present `matches` as the answer. */
  unsupported: string[]
}

/** Operators this module can decide without a server round-trip. Exported so
 *  a config panel can grey out the rest at authoring time rather than letting
 *  someone build a condition that silently can't run where they need it. */
export const CLIENT_EVALUABLE_OPS: readonly CompareOp[] = [
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
  'contains', 'starts_with', 'in',
  'is_null', 'not_null',
  'was_updated',
]

/** True when every condition in the tree can be decided on the client. Cheap
 *  enough to call during authoring. */
export function isClientEvaluable(group: FilterGroup | null | undefined): boolean {
  if (!group) return true
  for (const c of group.conditions ?? []) {
    if (!CLIENT_EVALUABLE_OPS.includes(c.op)) return false
    if (c.value_mode === 'expression') return false
  }
  return (group.groups ?? []).every(isClientEvaluable)
}

/** Evaluates a whole tree.
 *
 *  An absent or empty group matches everything, mirroring FilterGroup.IsEmpty()
 *  compiling to the literal `true` — "constrains nothing" is the established
 *  meaning of an empty filter throughout this codebase, not "matches nothing". */
export function evaluateFilterGroup(
  group: FilterGroup | null | undefined,
  ctx: FilterEvalContext,
): FilterEvalResult {
  const unsupported: string[] = []
  const matches = evalGroup(group, ctx, unsupported)
  return { matches, unsupported }
}

/** Convenience for the common case where the caller has already established
 *  the tree is client-evaluable. Treats an undecidable condition as false —
 *  only safe BECAUSE isClientEvaluable() gates it, so prefer
 *  evaluateFilterGroup() anywhere that gate isn't in place. */
export function matchesFilter(
  group: FilterGroup | null | undefined,
  ctx: FilterEvalContext,
): boolean {
  return evaluateFilterGroup(group, ctx).matches
}

function evalGroup(
  group: FilterGroup | null | undefined,
  ctx: FilterEvalContext,
  unsupported: string[],
): boolean {
  if (!group) return true

  const results: boolean[] = []
  for (const c of group.conditions ?? []) results.push(evalCondition(c, ctx, unsupported))
  for (const g of group.groups ?? []) results.push(evalGroup(g, ctx, unsupported))

  // Both the "no parts at all" and "empty tree" cases land here as true,
  // matching toExprString()'s two separate returns of "true".
  if (results.length === 0) return true

  // filter_expr.go is explicit that anything other than the literal "or"
  // combines with AND — an absent or misspelled combinator is AND, not an
  // error. buildWhere in internal/forms/store/query.go does the same.
  return group.combinator === 'or' ? results.some(Boolean) : results.every(Boolean)
}

function evalCondition(
  c: FilterCondition,
  ctx: FilterEvalContext,
  unsupported: string[],
): boolean {
  const actual = ctx.values?.[c.field]

  // Null checks are resolved before the value is looked at, exactly as
  // conditionToExprString returns for these two ops before touching ValueMode.
  if (c.op === 'is_null') return isNullish(actual)
  if (c.op === 'not_null') return !isNullish(actual)

  // Change detection compiles to `OldRecord != nil && OldRecord[f] != Vars[f]`,
  // so a missing previous state is false rather than undecidable — on a create
  // there is genuinely nothing that could have changed.
  if (c.op === 'was_updated') {
    if (!ctx.oldValues) return false
    return !looseEquals(ctx.oldValues[c.field], actual)
  }

  if (c.op === 'search') {
    unsupported.push(
      `field "${c.field}": the "search" operator is full-text and has no client-side equivalent`,
    )
    return false
  }

  if (c.value_mode === 'expression') {
    unsupported.push(
      `field "${c.field}": value is an expression, which only the server can evaluate`,
    )
    return false
  }

  const expected = c.value

  switch (c.op) {
    case 'eq':  return looseEquals(actual, expected)
    case 'neq': return !looseEquals(actual, expected)

    case 'gt': case 'gte': case 'lt': case 'lte': {
      const ord = compareLoose(actual, expected)
      if (ord === undefined) {
        // Expr would fail to evaluate an ordering comparison between a nil and
        // a number, or between two unrelated types. Reporting matches that;
        // returning false would present a definite answer we don't have.
        unsupported.push(
          `field "${c.field}": cannot order-compare ${describe(actual)} against ${describe(expected)}`,
        )
        return false
      }
      if (c.op === 'gt')  return ord > 0
      if (c.op === 'gte') return ord >= 0
      if (c.op === 'lt')  return ord < 0
      return ord <= 0
    }

    // Both string ops lower-case each side and coerce to string, matching
    // `lower(string(x)) contains lower(string(y))`. That case-insensitivity is
    // not incidental — it exists so the operator agrees with the ILIKE the SQL
    // path uses for the same operator name.
    case 'contains':     return toStr(actual).includes(toStr(expected))
    case 'starts_with':  return toStr(actual).startsWith(toStr(expected))

    case 'in': {
      if (!Array.isArray(expected)) {
        unsupported.push(`field "${c.field}": the "in" operator needs a list value`)
        return false
      }
      return expected.some((e) => looseEquals(actual, e))
    }

    default:
      unsupported.push(`field "${c.field}": unsupported operator "${String(c.op)}"`)
      return false
  }
}

// ---------------------------------------------------------------------------
// Value semantics
// ---------------------------------------------------------------------------

function isNullish(v: unknown): boolean {
  return v === null || v === undefined
}

/** Lower-cased string coercion, matching Expr's `lower(string(v))`. Nullish
 *  becomes "" rather than "null"/"undefined" so `contains ""` doesn't start
 *  matching empty fields on the literal text of their own absence. */
function toStr(v: unknown): string {
  if (isNullish(v)) return ''
  return String(v).toLowerCase()
}

/** Finite number, or undefined when the value isn't one. Booleans are excluded
 *  deliberately: JS would happily read `true` as 1, and an `amount > false`
 *  comparison should be reported as nonsense rather than quietly answered. */
function toNum(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

/** THE ONE DELIBERATE DIVERGENCE FROM EXPR.
 *
 *  Numeric coercion applies only when at least one side is a real number and
 *  the other is numerically readable. The reason is that this evaluator runs
 *  against LIVE FORM STATE, where an `<input>` bound to an integer field holds
 *  the string "42" while the same field arrives from the API as the number 42.
 *  Refusing to compare those would make the identical condition behave
 *  differently on a record-detail page than on a half-filled form, which is a
 *  worse form of drift than the one this rule introduces.
 *
 *  Two strings are NOT coerced, so a text field holding "05" still differs
 *  from "5" — string-vs-string stays exact, which is what a text field means.
 *
 *  Returns a sign, or undefined when the two values have no defined ordering. */
function compareLoose(a: unknown, b: unknown): number | undefined {
  if (isNullish(a) || isNullish(b)) return undefined

  if (typeof a === 'number' || typeof b === 'number') {
    const na = toNum(a)
    const nb = toNum(b)
    if (na === undefined || nb === undefined) return undefined
    return na === nb ? 0 : na < nb ? -1 : 1
  }

  // ISO-8601 is the wire format for every date and datetime field here, and it
  // is designed to sort correctly as text — so lexicographic comparison is the
  // right answer for dates as well as for plain strings, and needs no date
  // parsing that could disagree with the server's.
  if (typeof a === 'string' && typeof b === 'string') {
    return a === b ? 0 : a < b ? -1 : 1
  }

  return undefined
}

/** Equality with the same coercion rule as compareLoose, plus the nullish
 *  handling Expr's `==` against nil provides. */
function looseEquals(a: unknown, b: unknown): boolean {
  if (isNullish(a) && isNullish(b)) return true
  if (isNullish(a) || isNullish(b)) return false

  if (typeof a === 'boolean' || typeof b === 'boolean') return a === b

  if (typeof a === 'number' || typeof b === 'number') {
    const na = toNum(a)
    const nb = toNum(b)
    if (na !== undefined && nb !== undefined) return na === nb
    return false
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((x, i) => looseEquals(x, b[i]))
  }

  return a === b
}

/** Short type label for a diagnostic message. Values themselves are left out:
 *  a diagnostic can surface in a toast, and field values are user data. */
function describe(v: unknown): string {
  if (v === null) return 'null'
  if (v === undefined) return 'nothing'
  if (Array.isArray(v)) return 'a list'
  return `a ${typeof v}`
}
