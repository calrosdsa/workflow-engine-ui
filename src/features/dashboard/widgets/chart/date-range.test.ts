import { describe, it, expect } from 'vitest'
import { getPresetRange } from './date-range'

// Wed Sep 9 2026 — an arbitrary mid-week reference date.
const WED = new Date(2026, 8, 9)

describe('getPresetRange', () => {
  it('last_week is the previous Mon–Sun, regardless of where in the current week `now` falls', () => {
    expect(getPresetRange('last_week', WED)).toEqual({ from: '2026-08-31', to: '2026-09-06' })
    // Monday and Sunday of the SAME current week (Sep 7–13) must agree with
    // the mid-week result above and with each other.
    expect(getPresetRange('last_week', new Date(2026, 8, 7))).toEqual({ from: '2026-08-31', to: '2026-09-06' })
    expect(getPresetRange('last_week', new Date(2026, 8, 13))).toEqual({ from: '2026-08-31', to: '2026-09-06' })
  })

  it('last_month is the entire previous calendar month', () => {
    expect(getPresetRange('last_month', WED)).toEqual({ from: '2026-08-01', to: '2026-08-31' })
  })

  it('last_month rolls back across a year boundary in January', () => {
    expect(getPresetRange('last_month', new Date(2026, 0, 15))).toEqual({ from: '2025-12-01', to: '2025-12-31' })
  })

  it('last_quarter is the entire previous calendar quarter', () => {
    // Sep is in Q3 (Jul–Sep) — previous quarter is Q2 (Apr–Jun).
    expect(getPresetRange('last_quarter', WED)).toEqual({ from: '2026-04-01', to: '2026-06-30' })
  })

  it('last_quarter rolls back across a year boundary in Q1', () => {
    // Mid-January is in Q1 (Jan–Mar) — previous quarter is Q4 of last year.
    expect(getPresetRange('last_quarter', new Date(2026, 0, 15))).toEqual({ from: '2025-10-01', to: '2025-12-31' })
  })

  it('last_year is the entire previous calendar year', () => {
    expect(getPresetRange('last_year', WED)).toEqual({ from: '2025-01-01', to: '2025-12-31' })
  })
})
