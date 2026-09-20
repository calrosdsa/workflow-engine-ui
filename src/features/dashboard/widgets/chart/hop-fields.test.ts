import { describe, it, expect } from 'vitest'
import { referenceFields, isHopPath } from './hop-fields'
import type { FormDefinition } from '@/features/forms/types'

const FORM = {
  id: 'orders',
  fields: [
    { name: 'customer', label: 'Customer', type: 'reference', reference_table: 'customers' },
    { name: 'broken', label: 'Broken', type: 'reference' },
    { name: 'total', label: 'Total', type: 'decimal' },
  ],
} as unknown as FormDefinition

describe('referenceFields', () => {
  it('offers only reference fields that actually point somewhere', () => {
    expect(referenceFields(FORM).map((f) => f.name)).toEqual(['customer'])
  })

  it('tolerates no form at all', () => {
    expect(referenceFields(undefined)).toEqual([])
  })
})

describe('isHopPath', () => {
  it('recognises exactly one hop, mirroring the engine', () => {
    expect(isHopPath('customer.region')).toBe(true)
    expect(isHopPath('region')).toBe(false)
    // A chain is refused by the engine, so the panel must not treat it as a
    // hop either — the bucket/band controls stay hidden on the strength of
    // this, and showing them for a path the engine rejects would be worse
    // than showing them for a plain field.
    expect(isHopPath('customer.rep.name')).toBe(false)
    expect(isHopPath('.region')).toBe(false)
    expect(isHopPath('customer.')).toBe(false)
    expect(isHopPath(undefined)).toBe(false)
    expect(isHopPath('')).toBe(false)
  })
})
