// parseLayout in its own leaf module (schema-only imports) so that BOTH
// serialize.ts and form-spec.ts can use it while heal.ts sits between them:
// serialize → heal → form-spec must not loop back into serialize at runtime,
// and parseLayout was form-spec's only runtime import from there. Moved
// verbatim; serialize re-exports it, so every existing import keeps working.

import { type FormSchema, emptySchema, emptyFormSettings } from './schema'

/** Parse the backend `layout` blob into a FormSchema, tolerating older/empty data. */
export function parseLayout(layout: unknown): FormSchema {
  if (!layout) return emptySchema()
  try {
    const obj = typeof layout === 'string' ? JSON.parse(layout) : layout
    if (obj && typeof obj === 'object' && Array.isArray((obj as FormSchema).sections)) {
      return {
        version: 1,
        sections: (obj as FormSchema).sections,
        variables: (obj as FormSchema).variables,
        settings: (obj as FormSchema).settings ?? emptyFormSettings(),
      }
    }
  } catch {
    // fall through
  }
  return emptySchema()
}
