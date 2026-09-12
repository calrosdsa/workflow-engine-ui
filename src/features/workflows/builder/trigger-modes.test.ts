import { describe, it, expect } from 'vitest'
import { TRIGGER_MODES } from './trigger-modes'
import type { TriggerMode } from '../types'

// Guards silent drift between this shared list and the TriggerMode union it
// is meant to cover completely — both TriggerForm.tsx's mode picker and the
// new TriggerOnboardingModal read from this one list.
describe('TRIGGER_MODES', () => {
  const allModes: TriggerMode[] = [
    'on_demand', 'on_demand_data_driven', 'scheduled', 'before', 'after',
    'after_async', 'webhook', 'executed_by_workflow', 'on_error',
  ]

  it('has exactly one entry per TriggerMode value', () => {
    expect(TRIGGER_MODES.map((m) => m.value).sort()).toEqual([...allModes].sort())
  })

  it('every entry has an icon and both i18n keys', () => {
    for (const m of TRIGGER_MODES) {
      expect(m.icon).toBeTruthy()
      expect(m.labelKey).toMatch(/^workflows\.trigger\.mode\./)
      expect(m.descriptionKey).toMatch(/^workflows\.trigger\.mode\./)
    }
  })
})
