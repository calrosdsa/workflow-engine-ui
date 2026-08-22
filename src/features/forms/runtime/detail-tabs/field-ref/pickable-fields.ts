// Shared "which of this form's own fields can be mirrored" filter — same
// data-bearing/hidden/line_items rules DetailsTab already applies for its
// own read-only rendering (RecordDetailPanel.tsx). Used by field_ref's own
// ConfigPanel (a form already fetched via useFormDef) and the Detail Page
// Builder overlay's "Add Field" picker (a form already held live in the
// Form Builder's own store) so neither duplicates this filter.
import { COMPONENT_REGISTRY } from '@/features/form-builder/component-registry'
import type { FormSchema, FormElement } from '@/features/form-builder/schema'

export function pickableFields(schema: FormSchema | null | undefined): FormElement[] {
  if (!schema) return []
  const list: FormElement[] = []
  for (const section of schema.sections) {
    for (const column of section.columns) {
      for (const el of column.elements) {
        if (el.component === 'hidden') continue
        if (el.component === 'line_items' && el.sourceMode !== 'existing') continue
        if (!COMPONENT_REGISTRY[el.component].dataBearing) continue
        list.push(el)
      }
    }
  }
  return list
}
