import { toDateInputValue } from '@/lib/datetime'

/** Time-range choices for the runtime chart toolbar. 'custom' has no
 *  computed range — the caller supplies its own {from, to} from a pair of
 *  DatePicker fields instead of calling getPresetRange. */
export type RangePreset = 'last_week' | 'last_month' | 'last_quarter' | 'last_year' | 'custom'

/** The 4 presets with a computable range, in display order. */
export const RANGE_PRESETS: Exclude<RangePreset, 'custom'>[] = ['last_week', 'last_month', 'last_quarter', 'last_year']

export interface DateRange {
  /** 'YYYY-MM-DD', inclusive. */
  from: string
  /** 'YYYY-MM-DD', inclusive. */
  to: string
}

/** Calendar-period ranges relative to `now` — "Last Month" is the entirety
 *  of the previous calendar month (not a trailing 30 days), "Last Quarter"
 *  the previous calendar quarter, etc. — matching what ERPNext's own
 *  identically-named dashboard chart presets mean, per the feature request
 *  this control was modeled on. Both endpoints are inclusive calendar
 *  dates; runtime-filter.ts's rangeToConditions is what turns `to` into a
 *  safe exclusive upper-bound filter condition (avoids any time-of-day/
 *  timezone ambiguity from treating a bare date as an inclusive upper
 *  bound directly). */
export function getPresetRange(preset: Exclude<RangePreset, 'custom'>, now: Date = new Date()): DateRange {
  const y = now.getFullYear()
  const m = now.getMonth()

  switch (preset) {
    case 'last_week': {
      // ISO (Monday-start) week, regardless of which day of the current
      // week `now` falls on. now.getDay(): 0=Sun..6=Sat; this remaps it to
      // "days since this week's Monday" for any day of the week.
      const daysSinceMonday = (now.getDay() + 6) % 7
      const thisMonday = new Date(y, m, now.getDate() - daysSinceMonday)
      const lastMonday = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 7)
      const lastSunday = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 1)
      return { from: toDateInputValue(lastMonday), to: toDateInputValue(lastSunday) }
    }
    case 'last_month': {
      // Day 0 of a month is JS Date's own idiom for "the day before day 1",
      // i.e. the last day of the previous month — correctly rolls back
      // across a year boundary (month -1 in January) with no special case.
      const firstOfLastMonth = new Date(y, m - 1, 1)
      const lastOfLastMonth = new Date(y, m, 0)
      return { from: toDateInputValue(firstOfLastMonth), to: toDateInputValue(lastOfLastMonth) }
    }
    case 'last_quarter': {
      const q = Math.floor(m / 3)
      const firstOfLastQuarter = new Date(y, (q - 1) * 3, 1)
      const lastOfLastQuarter = new Date(y, q * 3, 0)
      return { from: toDateInputValue(firstOfLastQuarter), to: toDateInputValue(lastOfLastQuarter) }
    }
    case 'last_year': {
      return { from: toDateInputValue(new Date(y - 1, 0, 1)), to: toDateInputValue(new Date(y - 1, 11, 31)) }
    }
  }
}
