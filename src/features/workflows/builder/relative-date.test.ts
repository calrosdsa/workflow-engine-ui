import { describe, it, expect } from 'vitest'
import { RELATIVE_PRESETS, isRelativePreset, isValidRelativeValue } from './relative-date'

// These mirror workflow-engine/internal/graph/relative.go's own patterns —
// the server is the authority and validates on save regardless. These cases
// exist so the two stay honest about the same grammar; if one side gains a
// form the other refuses, this file should fail.

describe('isValidRelativeValue', () => {
  it('accepts the two bare instants', () => {
    expect(isValidRelativeValue('now')).toBe(true)
    expect(isValidRelativeValue('today')).toBe(true)
  })

  it('accepts signed offsets in every unit', () => {
    for (const token of ['-7d', '+1d', '-2w', '+12w', '-6M', '+1M', '-1y', '+10y']) {
      expect(isValidRelativeValue(token), token).toBe(true)
    }
  })

  it('accepts period starts, with and without an offset', () => {
    for (const token of [
      'start_of_day', 'start_of_week', 'start_of_month', 'start_of_quarter', 'start_of_year',
      'start_of_month-1', 'start_of_year+1', 'start_of_quarter-2',
    ]) {
      expect(isValidRelativeValue(token), token).toBe(true)
    }
  })

  it('rejects what the server would reject', () => {
    for (const token of [
      '', '   ', 'yesterday', 'last_month', '30d', '-30', '-30x', '-30days',
      'start_of_fortnight', 'start_of_month*2', '--1d', 'START_OF_MONTH', '-1m',
    ]) {
      expect(isValidRelativeValue(token), token).toBe(false)
    }
  })

  it('tolerates surrounding whitespace, since the input is hand-typed', () => {
    expect(isValidRelativeValue('  -90d  ')).toBe(true)
  })
})

describe('RELATIVE_PRESETS', () => {
  it('offers only tokens the grammar accepts', () => {
    for (const preset of RELATIVE_PRESETS) {
      expect(isValidRelativeValue(preset.value), preset.value).toBe(true)
    }
  })

  it('has no duplicate values and carries an i18n key, never display text', () => {
    const values = RELATIVE_PRESETS.map((p) => p.value)
    expect(new Set(values).size).toBe(values.length)
    for (const preset of RELATIVE_PRESETS) {
      expect(preset.labelKey).toMatch(/^workflows\.builder\.relative\./)
    }
  })

  // Both halves of a closed window have to be expressible from the presets
  // alone, or "last calendar month" forces a user into the custom input.
  it('includes the pair a closed calendar window needs', () => {
    const values = RELATIVE_PRESETS.map((p) => p.value)
    expect(values).toContain('start_of_month')
    expect(values).toContain('start_of_month-1')
  })
})

describe('isRelativePreset', () => {
  it('separates preset tokens from custom ones, which is what decides the picker mode', () => {
    expect(isRelativePreset('start_of_month-1')).toBe(true)
    // Valid grammar, but not offered as a preset — an MCP-authored value
    // like this must open the custom input rather than show an empty select.
    expect(isValidRelativeValue('-45d')).toBe(true)
    expect(isRelativePreset('-45d')).toBe(false)
  })
})
