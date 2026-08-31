import type { RangeValue, ReportArgument, ReportDefinition } from './types'

// Argument value handling shared by every run surface (FR-D2-019): the report
// list's Run action, the builder's Preview button, and the export_report
// custom action. Kept as pure functions separate from the dialog so the
// required/default/range rules are testable without rendering anything, and
// so all three surfaces cannot drift from each other.

/** True when a value counts as supplied. A blank string is treated as absent,
 *  matching the backend's own isEmptyArgumentValue — a cleared input should
 *  behave like an untouched one rather than filtering on "". */
export function isArgumentFilled(argument: ReportArgument, value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false
  if (argument.range) {
    const range = value as RangeValue
    // A half-open range is legitimate, so either bound alone is enough.
    return isBoundFilled(range?.from) || isBoundFilled(range?.to)
  }
  return true
}

function isBoundFilled(bound: unknown): boolean {
  return bound !== undefined && bound !== null && bound !== ''
}

/** Seeds the dialog: an explicitly supplied value wins, then the argument's
 *  own default (RUN-04), so a required argument with a default opens ready to
 *  confirm rather than as a data-entry task. */
export function initialArgumentValues(
  argumentList: ReportArgument[],
  seed: Record<string, unknown> = {},
): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const argument of argumentList) {
    if (Object.prototype.hasOwnProperty.call(seed, argument.key)) {
      values[argument.key] = seed[argument.key]
    } else if (argument.default !== undefined) {
      values[argument.key] = argument.default
    } else if (argument.range) {
      values[argument.key] = {} satisfies RangeValue
    } else {
      values[argument.key] = ''
    }
  }
  return values
}

/** Keys of every required argument still unfilled — the dialog's confirm gate
 *  (RUN-02). The backend enforces this too; this only avoids a round trip. */
export function missingRequiredArguments(
  argumentList: ReportArgument[],
  values: Record<string, unknown>,
): string[] {
  return argumentList
    .filter((a) => a.required && !isArgumentFilled(a, values[a.key]))
    .map((a) => a.key)
}

/** Strips arguments the caller left empty so the request omits them entirely
 *  rather than sending "" — the backend treats an omitted optional argument
 *  as "no filter", which is NOT the same as matching nothing. */
export function pruneEmptyArguments(
  argumentList: ReportArgument[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const argument of argumentList) {
    const value = values[argument.key]
    if (!isArgumentFilled(argument, value)) continue
    out[argument.key] = argument.range ? pruneRange(value as RangeValue) : value
  }
  return out
}

function pruneRange(range: RangeValue): RangeValue {
  const out: RangeValue = {}
  if (isBoundFilled(range?.from)) out.from = range.from
  if (isBoundFilled(range?.to)) out.to = range.to
  return out
}

/** The arguments a report declares, in declaration order. */
export function declaredArguments(definition: Pick<ReportDefinition, 'arguments'>): ReportArgument[] {
  return definition.arguments ?? []
}

/** True when a surface must prompt before it can run: any argument the caller
 *  has not already resolved and that has no default to fall back on. Used by
 *  Preview and the export action to stay one-click whenever they can. */
export function needsPrompt(
  argumentList: ReportArgument[],
  resolved: Record<string, unknown> = {},
): boolean {
  return argumentList.some((a) => {
    if (isArgumentFilled(a, resolved[a.key])) return false
    if (a.default !== undefined) return false
    // An optional argument with nothing to fill it simply goes unsupplied;
    // only a required one forces the dialog open.
    return a.required === true
  })
}
