import { toDateInputValue } from '@/lib/datetime'
import type { FilterGroup, FilterCondition } from '@/features/workflows/types'
import type { DateRange } from './date-range'

function isEmptyFilterGroup(g?: FilterGroup): g is undefined {
  return !g || (g.conditions.length === 0 && g.groups.length === 0)
}

/** ANDs any number of FilterGroups together, wrap-don't-replace — the same
 *  shape SearchMenuRuntime's own `effectiveFilter` and the backend's
 *  `withSearchQuery` already use for layering an additive filter on top of
 *  a saved one. Never mutates its inputs. Skips empty/undefined groups;
 *  collapses to the lone survivor when only one is non-empty rather than
 *  wrapping it in a redundant extra 'and' shell; returns undefined when
 *  every input is empty (a chart with no saved filter and no live
 *  overrides needs no filter at all, not an empty FilterGroup shell). */
export function mergeFilters(...groups: (FilterGroup | undefined)[]): FilterGroup | undefined {
  const nonEmpty = groups.filter((g): g is FilterGroup => !isEmptyFilterGroup(g))
  if (nonEmpty.length === 0) return undefined
  if (nonEmpty.length === 1) return nonEmpty[0]
  return { combinator: 'and', conditions: [], groups: nonEmpty }
}

/** A date range compiles to a gte+lt pair, not gte+lte — this codebase's
 *  FilterGroup grammar has no `between` operator (see graph.CompareOp's
 *  closed set), and an inclusive `lte` against a bare calendar date would
 *  silently exclude same-day records with a time-of-day after midnight on
 *  a datetime column. `range.to` is an inclusive calendar date from the
 *  caller's point of view (see date-range.ts); this treats it as the day
 *  before an exclusive upper bound. */
export function rangeToConditions(field: string, range: DateRange): FilterCondition[] {
  return [
    { id: `range-${field}-from`, field, op: 'gte', value_mode: 'static', value: range.from },
    { id: `range-${field}-to`, field, op: 'lt', value_mode: 'static', value: addDays(range.to, 1) },
  ]
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return toDateInputValue(new Date(y, m - 1, d + days))
}
