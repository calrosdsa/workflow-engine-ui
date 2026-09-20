// ---------------------------------------------------------------------------
// FilterGroup → text. One direction only.
// ---------------------------------------------------------------------------
//
// Step 1 of the two-step in docs/analytics-and-charting-mcp-rnd.md §4.6:
// serialize, do not parse. There is no lexer here, no grammar to document
// and no parse errors, because nothing ever reads a string back. The text
// this produces is for people to read; `FilterGroup` remains the only
// stored representation, which is the whole point — it is referenced by 29
// Go files and 51 UI files, and a second source of truth across access
// scopes, trigger filters and report sources would be a genuine hazard.
//
// It exists because a partial, drifting copy of it already did.
// active-filters-bar.tsx carried its own operator table that never learned
// `ends_with`, `not_in`, `not_contains` or `search`, and rendered every
// value as String(value) — so a relative date chip read as a bare "-30d"
// with nothing marking it relative, and a current_user chip showed the raw
// attribute name. One owner for the hard parts (value modes, operator
// coverage, walking the tree), with presentation left to the caller.
//
// A NOTE ON WHAT THIS DOES NOT FIX: §4.6 claimed step 1 would replace
// ChartMenu's `ef=JSON.stringify(filter)` URL parameter. It cannot. That
// param is READ BACK by parseExternalFilterParam (runtime-router.tsx), and
// reading a text form back needs the parser that is step 2. The URL keeps
// its JSON until then.
import type { CompareOp, FilterCondition, FilterGroup } from './types'
import type { FieldDef } from '@/features/forms/types'

/** Canonical operator tokens — the candidate syntax §4.6 step 1 exists to
 *  put in front of people before anyone writes a parser for it.
 *
 *  Deliberately NOT translated: this is the stable, technical form, and a
 *  localized syntax would be meaningless to the parser step 2 might add.
 *  Callers rendering viewer-facing chrome pass their own translated labels
 *  — see ActiveFiltersBar. */
export const CANONICAL_OPS: Record<CompareOp, string> = {
  eq: '=',
  neq: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  contains: 'contains',
  not_contains: 'not contains',
  starts_with: 'starts with',
  ends_with: 'ends with',
  in: 'in',
  not_in: 'not in',
  is_null: 'is empty',
  not_null: 'is not empty',
  search: 'matches',
  was_updated: 'was updated',
}

/** Operators that compare against nothing — rendering a value for these
 *  would invent one. */
const VALUELESS: ReadonlySet<CompareOp> = new Set<CompareOp>(['is_null', 'not_null', 'was_updated'])

export function opTakesValue(op: CompareOp): boolean {
  return !VALUELESS.has(op)
}

export interface ConditionParts {
  /** The field's label when a definition is supplied, else its raw name.
   *  Absent for `search`, which has no single field to name — it runs
   *  against the form's combined tsv column. */
  field?: string
  /** Display token for the operator. */
  op: string
  /** Rendered value; absent when the operator takes none, or when one is
   *  genuinely missing from the condition. */
  value?: string
}

function fieldLabel(name: string | undefined, fields?: FieldDef[]): string {
  if (!name) return 'field'
  return fields?.find((f) => f.name === name)?.label || name
}

/** Renders one condition's value according to its MODE, which is the part
 *  the old inline version got wrong. Each mode has its own notation so a
 *  reader can tell a literal from a token that resolves at query time —
 *  the distinction that matters most, since a relative date and a typo'd
 *  string look identical once both are String()'d. */
function describeValue(c: FilterCondition): string | undefined {
  switch (c.value_mode) {
    case 'relative':
      // Already a compact syntax of its own (see builder/relative-date.ts).
      // Rendered bare because that IS the notation, not a stand-in for it.
      return typeof c.value === 'string' ? c.value : undefined
    case 'current_user':
      // value is an attribute name — record_id/user_id/email, or a field on
      // the app's user-account form.
      return c.value ? `me.${String(c.value)}` : 'me'
    case 'this_record':
      // value is "<reference_field>.<attr>", exactly one hop.
      return c.value ? `this.${String(c.value)}` : 'this record'
    case 'change_flag':
      return c.value == null ? undefined : `changed:${String(c.value)}`
    case 'expression':
      return c.expression ? `\`${c.expression}\`` : undefined
    default:
      return describeStatic(c.value)
  }
}

/** A literal. Strings are quoted so an empty one is visible and a value
 *  containing a space or an operator word cannot be misread as syntax. */
function describeStatic(value: unknown): string | undefined {
  if (value == null) return undefined
  if (Array.isArray(value)) return `[${value.map((v) => describeStatic(v) ?? '').join(', ')}]`
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  return JSON.stringify(value)
}

export function describeCondition(c: FilterCondition, fields?: FieldDef[]): ConditionParts {
  return {
    // `search` ignores `field` entirely — there is no per-field column to
    // target — so naming one here would describe a filter that isn't there.
    field: c.op === 'search' ? undefined : fieldLabel(c.field, fields),
    op: CANONICAL_OPS[c.op] ?? c.op,
    value: opTakesValue(c.op) ? describeValue(c) : undefined,
  }
}

export function conditionToText(c: FilterCondition, fields?: FieldDef[]): string {
  const p = describeCondition(c, fields)
  return [p.field, p.op, p.value].filter((s) => s !== undefined && s !== '').join(' ')
}

/** The whole tree as one line. Nested groups are parenthesised; the top
 *  level is not, so a flat filter reads as a plain sentence rather than as
 *  a bracketed expression.
 *
 *  Returns '' for a filter that narrows nothing, so a caller can treat
 *  emptiness with a falsy check rather than comparing against a sentinel. */
export function describeFilter(group: FilterGroup | undefined, fields?: FieldDef[]): string {
  return describeGroup(group, fields, true)
}

function describeGroup(group: FilterGroup | undefined, fields: FieldDef[] | undefined, top: boolean): string {
  if (!group) return ''
  const parts = [
    ...group.conditions.map((c) => conditionToText(c, fields)),
    // A group that contributes nothing is dropped rather than rendered as
    // an empty pair of brackets — an empty nested group is the normal state
    // of a half-built filter, not something to show a viewer.
    ...group.groups.map((g) => describeGroup(g, fields, false)).filter((s) => s !== ''),
  ].filter((s) => s !== '')

  if (parts.length === 0) return ''
  const joined = parts.join(group.combinator === 'or' ? ' OR ' : ' AND ')
  // A single member needs no brackets at any depth — "(status = "open")"
  // carries no more information than without them.
  return top || parts.length === 1 ? joined : `(${joined})`
}
