// Fabricates a plausible sample record for the Detail Page Builder's live
// preview — lets preview work on a brand-new form with zero saved records
// (the user's explicit requirement), at the cost of Comments/History/
// Linked Records/Related Form/Custom showing empty or placeholder content
// (also explicitly accepted — see DetailPagePreview.tsx).
//
// Values are fixed/deterministic (not Date.now()-derived, not random) so
// re-rendering the same preview session never shows shifting data.
import type { FieldDef, FormRecord } from '@/features/forms/types'
import { PREVIEW_REFERENCE_SENTINEL } from '@/features/forms/runtime/preview-sentinel'

export { PREVIEW_REFERENCE_SENTINEL }

const SAMPLE_DATE = '2026-01-15'
const SAMPLE_TIME = '14:30'
const SAMPLE_DATETIME = '2026-01-15T14:30:00Z'

function sampleValueForType(f: FieldDef): unknown {
  switch (f.type) {
    case 'string':
      return /email/i.test(f.name) || /email/i.test(f.label) ? 'sample@example.com' : 'Sample Text'
    case 'text':
      return 'This is sample text for preview purposes. It shows roughly how longer content will look.'
    case 'email':
      return 'sample@example.com'
    case 'phone':
      return '+1 (555) 010-0100'
    case 'integer':
      return 42
    case 'decimal':
      return 99.5
    case 'boolean':
      return true
    case 'date':
      return SAMPLE_DATE
    case 'time':
      return SAMPLE_TIME
    case 'datetime':
      return SAMPLE_DATETIME
    case 'enum':
      return f.enum_values && f.enum_values.length > 0 ? f.enum_values[0] : 'Sample Option'
    case 'json':
      // Multiselect fields are the only 'json'-typed component today
      // (component-registry.ts) — a one-item array reads plausibly for
      // both a multiselect chip row and any future array-shaped json use.
      return ['Sample']
    case 'file':
      return 'sample-file.pdf'
    case 'reference':
      return PREVIEW_REFERENCE_SENTINEL
    // Virtual/system fields (never in the form's own field-picker) — no
    // plausible fabricated value, leave absent so their renderer's own
    // empty-state handles it rather than guessing at fake data.
    case 'parent_link':
    case 'line_item_count':
    case 'line_item_adopted':
      return undefined
    default:
      return undefined
  }
}

export function fabricateSampleRecord(fields: FieldDef[]): FormRecord {
  const record: FormRecord = { id: '__preview__' }
  for (const f of fields) {
    const value = sampleValueForType(f)
    if (value !== undefined) record[f.name] = value
  }
  return record
}
