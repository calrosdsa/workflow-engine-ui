// ---------------------------------------------------------------------------
// Relative date filter values
// ---------------------------------------------------------------------------
//
// The client-side half of workflow-engine's `relative` condition value_mode.
// A relative value resolves, server-side, to a single INSTANT — never a range
// — which is what lets it sit inside the existing one-field/one-operator
// condition. A window is therefore two conditions:
//
//   last calendar month   due >= start_of_month-1   AND   due < start_of_month
//   the last 90 days      due >= -90d
//   overdue right now     due <  today
//
// DRIFT WARNING: the two patterns below mirror `relativeOffsetPattern` and
// `relativeBoundaryPattern` in workflow-engine/internal/graph/relative.go,
// which is the authority — the server validates on save regardless of what
// this file allows. They are duplicated here only so a typo is caught while
// the author is still looking at the field, rather than as a 400 later. Same
// deliberate mirroring (and the same obligation to update both) as
// DATE_FIELD_TYPES in features/dashboard/widgets/chart/schema.ts, which
// tracks aggregate.go's bucketableTypes.

/** -90d, +2w, -6M, +1y. `M` is months; the unit is case-sensitive. */
const OFFSET_PATTERN = /^([+-]\d{1,4})([dwMy])$/

/** start_of_month, start_of_month-1, start_of_quarter+2. */
const BOUNDARY_PATTERN = /^start_of_(day|week|month|quarter|year)([+-]\d{1,4})?$/

/** Human-readable grammar, shown when a custom token doesn't parse. */
export const RELATIVE_SYNTAX_HINT =
  'now, today, an offset from now (-90d, -2w, -6M, -1y), or the start of a period (start_of_month, start_of_month-1)'

export function isValidRelativeValue(token: string): boolean {
  const t = token.trim()
  if (t === 'now' || t === 'today') return true
  return OFFSET_PATTERN.test(t) || BOUNDARY_PATTERN.test(t)
}

/** One offered choice. `labelKey` is an i18n key, never display text — this
 *  module is imported by a component that translates at render time. */
export interface RelativePreset {
  value: string
  labelKey: string
}

/** The presets a picker offers, in reading order: the two instants, the
 *  trailing windows people actually ask for, then calendar-period starts and
 *  their previous-period counterparts (the pair a closed window needs). */
export const RELATIVE_PRESETS: RelativePreset[] = [
  { value: 'today', labelKey: 'workflows.builder.relative.today' },
  { value: 'now', labelKey: 'workflows.builder.relative.now' },
  { value: '-7d', labelKey: 'workflows.builder.relative.days_ago_7' },
  { value: '-30d', labelKey: 'workflows.builder.relative.days_ago_30' },
  { value: '-90d', labelKey: 'workflows.builder.relative.days_ago_90' },
  { value: '-1y', labelKey: 'workflows.builder.relative.year_ago' },
  { value: 'start_of_week', labelKey: 'workflows.builder.relative.start_of_week' },
  { value: 'start_of_month', labelKey: 'workflows.builder.relative.start_of_month' },
  { value: 'start_of_quarter', labelKey: 'workflows.builder.relative.start_of_quarter' },
  { value: 'start_of_year', labelKey: 'workflows.builder.relative.start_of_year' },
  { value: 'start_of_week-1', labelKey: 'workflows.builder.relative.start_of_last_week' },
  { value: 'start_of_month-1', labelKey: 'workflows.builder.relative.start_of_last_month' },
  { value: 'start_of_quarter-1', labelKey: 'workflows.builder.relative.start_of_last_quarter' },
  { value: 'start_of_year-1', labelKey: 'workflows.builder.relative.start_of_last_year' },
]

export function isRelativePreset(token: string): boolean {
  return RELATIVE_PRESETS.some((p) => p.value === token)
}
