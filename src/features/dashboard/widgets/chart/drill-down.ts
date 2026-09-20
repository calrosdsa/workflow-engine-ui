// ---------------------------------------------------------------------------
// Clicked data point → the filter that selects the records behind it.
// ---------------------------------------------------------------------------
//
// "View records" has always carried the chart's effective filter and thrown
// the clicked key away, so clicking the tallest bar took you to every record
// the chart covers rather than to the ones that made that bar tall.
//
// The work is inverting the dimension. A group key is not the field's value
// — it is whatever `dimension()` (workflow-engine's aggregate.go) produced,
// which depends on how the dimension was bucketed. Getting that inversion
// wrong sends a viewer to a plausible-looking set of the WRONG records,
// which is worse than not navigating at all, so anything not exactly
// invertible refuses to produce a filter rather than approximating one.
//
// What makes the range case exact is the key's own "%02d" prefix
// (rangeBucketLabel): the bucket INDEX travels with the key, so the band is
// recovered from the config's own `ranges` array rather than by parsing
// "31 - 60" back into numbers. The human label never has to be understood.
import type { FilterCondition } from '@/features/workflows/types'
import type { ChartDimension, ChartWidgetConfig } from './schema'
import type { FieldDef, FieldType } from '@/features/forms/types'

/** formdata.BucketLabelSep. Kept in step with bucket-label.ts's own copy —
 *  that one strips the prefix for display, this one reads it. */
const BUCKET_LABEL_SEP = '\x1f'

/** formdata.emptyGroupLabel — what a NULL group key surfaces as. */
const EMPTY_GROUP_LABEL = '(empty)'

const DATE_TYPES: FieldType[] = ['date', 'datetime']

/** The bucket index a range-bucketed key carries, or undefined when the key
 *  is not range-bucketed. */
function bucketIndex(key: string): number | undefined {
  const i = key.indexOf(BUCKET_LABEL_SEP)
  if (i < 0) return undefined
  const n = Number(key.slice(0, i))
  return Number.isInteger(n) && n >= 0 ? n : undefined
}

/** The calendar date a bucketed key begins on. The engine emits
 *  `date_trunc(...)::text` over a timestamptz, which Postgres renders as
 *  "2026-09-01 00:00:00+00" — a space, and an offset in the SERVER's
 *  session timezone.
 *
 *  Deliberately NOT `new Date(key)`. That string is outside the grammar
 *  ECMAScript mandates, so parsing it is implementation-defined; a form
 *  carrying no offset is read as LOCAL time and silently shifts the whole
 *  window by the browser's own offset. Only the leading date is relied on,
 *  which every rendering of a truncated timestamp shares. */
const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/

/** The half-open window a bucketed key covers, as YYYY-MM-DD bounds.
 *
 *  Plain calendar dates rather than instants, matching runtime-filter.ts's
 *  own rangeToConditions — and because they are what makes this correct
 *  across a DST change. An instant window advanced in UTC drifts by an hour
 *  when the server's offset shifts mid-range; a date bound is coerced by
 *  Postgres to midnight in the session timezone, which is where the bucket
 *  boundary actually sits, whatever the offset was that day. */
function bucketWindow(key: string, bucket: string): [string, string] | undefined {
  const m = DATE_PREFIX.exec(key)
  if (!m) return undefined
  // Date.UTC is used purely as calendar arithmetic over Y/M/D — no instant
  // ever leaves this function, so no timezone enters. Month and quarter
  // have to advance by parts rather than by a fixed span, or February
  // lands in the wrong place.
  const start = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  const end = new Date(start)
  switch (bucket) {
    case 'day': end.setUTCDate(end.getUTCDate() + 1); break
    case 'week': end.setUTCDate(end.getUTCDate() + 7); break
    case 'month': end.setUTCMonth(end.getUTCMonth() + 1); break
    case 'quarter': end.setUTCMonth(end.getUTCMonth() + 3); break
    case 'year': end.setUTCFullYear(end.getUTCFullYear() + 1); break
    default: return undefined
  }
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return [iso(start), iso(end)]
}

function cond(id: string, field: string, op: FilterCondition['op'], value?: unknown): FilterCondition {
  // Stable ids, like resolveParameterFilter's: these end up in a react-query
  // key downstream, and a random one would refetch on every render.
  return { id, field, op, value_mode: 'static', value }
}

/** Inverts one dimension against one group key.
 *
 *  Returns undefined — meaning "do not navigate" — when the inversion would
 *  be a guess. There is exactly one such case, and it is called out below. */
function conditionsForDimension(
  dim: ChartDimension,
  rawKey: string,
  fields: FieldDef[],
  idPrefix: string,
): FilterCondition[] | undefined {
  const fieldType = fields.find((f) => f.name === dim.field)?.type
  const index = bucketIndex(rawKey)
  const key = index === undefined ? rawKey : rawKey.slice(rawKey.indexOf(BUCKET_LABEL_SEP) + 1)

  // A NULL group. Exact for every dimension shape — aggregate.go routes all
  // of them through the same derefKey sentinel.
  if (key === EMPTY_GROUP_LABEL) return [cond(`${idPrefix}-null`, dim.field, 'is_null')]

  if (dim.ranges && dim.ranges.length > 0) {
    if (index === undefined) return undefined
    const r = dim.ranges

    // A date/datetime field banded by `ranges` bands its AGE IN DAYS FROM
    // TODAY, computed server-side as `CURRENT_DATE - field::date` — a
    // whole-day integer in the SERVER's timezone. Nothing available here
    // reproduces that: a relative token resolves from time.Now(), an
    // instant with a time component, and the browser's own date can be a
    // day ahead or behind the server's besides. The two disagree at the
    // band boundary, which is precisely where an ageing report's rows sit.
    //
    // So an age band does not drill down. A window that is right on most
    // days is the failure this whole module is written to avoid.
    if (fieldType && DATE_TYPES.includes(fieldType)) return undefined

    // The SQL is `WHEN value <= ranges[i] THEN label_i`, tested in order —
    // so bucket i is (ranges[i-1], ranges[i]], the first is <= ranges[0],
    // and the last is > ranges[last].
    if (index === 0) return [cond(`${idPrefix}-lte`, dim.field, 'lte', r[0])]
    if (index >= r.length) return [cond(`${idPrefix}-gt`, dim.field, 'gt', r[r.length - 1])]
    return [
      cond(`${idPrefix}-gt`, dim.field, 'gt', r[index - 1]),
      cond(`${idPrefix}-lte`, dim.field, 'lte', r[index]),
    ]
  }

  if (dim.bucket) {
    const window = bucketWindow(key, dim.bucket)
    if (!window) return undefined
    // Half-open, so a record exactly on the next boundary belongs to the
    // next bucket — matching what date_trunc grouped it into, and the same
    // gte/lt pair rangeToConditions uses. There is no `between` operator in
    // this codebase's grammar.
    return [
      cond(`${idPrefix}-gte`, dim.field, 'gte', window[0]),
      cond(`${idPrefix}-lt`, dim.field, 'lt', window[1]),
    ]
  }

  // Unbucketed: the key is the field's own value cast to text.
  return [cond(`${idPrefix}-eq`, dim.field, 'eq', key)]
}

/** The conditions selecting the records behind one clicked data point.
 *
 *  `splitKey` is the raw key2 of the clicked sub-series, where the chart is
 *  split — the caller resolves which sub-series was clicked, since only it
 *  knows how the plot was laid out.
 *
 *  undefined means the click should do nothing. */
export function drillDownConditions(
  config: ChartWidgetConfig,
  fields: FieldDef[],
  groupKey: string,
  splitKey?: string,
): FilterCondition[] | undefined {
  if (!config.groupBy?.field) return undefined

  const primary = conditionsForDimension(config.groupBy, groupKey, fields, 'drill')
  if (!primary) return undefined

  if (splitKey === undefined || !config.groupBy2?.field) return primary

  const secondary = conditionsForDimension(config.groupBy2, splitKey, fields, 'drill2')
  // A split whose own dimension cannot be inverted would drill down to the
  // primary band across EVERY split value — a wider set than the segment
  // that was clicked, which is the wrong-records failure again.
  if (!secondary) return undefined

  return [...primary, ...secondary]
}
