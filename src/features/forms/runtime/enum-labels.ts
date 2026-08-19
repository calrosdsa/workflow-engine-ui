// Resolves an enum-typed field's stored value (e.g. "active") to its real
// display label (e.g. "Active") for read-only rendering. FieldDef.enum_values
// (internal/forms/field/types.go's CHECK-constraint set) is deliberately
// value-only — form-builder/projection.ts's own comment confirms it "carries
// their option values as the CHECK constraint set", discarding the label
// half of each SelectOption on save. The real label/value pairs still exist,
// just one layer up: in the form's own `layout` (FormSchema, via
// parseLayout), which the builder's select/radio/multiselect elements
// already populate via OptionsEditor. This is the read-only counterpart to
// FieldRenderer.tsx's editable <select>, which already shows real labels
// because it reads el.options directly rather than the flattened FieldDef.
import { iterElements } from '@/features/form-builder/projection'
import type { FormSchema } from '@/features/form-builder/schema'

/** field name -> (stored value -> display label), for every select/radio/
 *  multiselect element in the schema that has real options configured. */
export function buildEnumLabels(schema: FormSchema | undefined): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>()
  if (!schema) return out
  for (const el of iterElements(schema)) {
    if (!el.options || el.options.length === 0) continue
    if (!el.key) continue
    const byValue = new Map<string, string>()
    for (const o of el.options) byValue.set(o.value, o.label)
    out.set(el.key, byValue)
  }
  return out
}

/** Resolves one enum value through the map buildEnumLabels produced —
 *  falls back to the raw stored value when no matching option is found
 *  (a value saved before the option existed, or since removed/renamed). */
export function resolveEnumLabel(enumLabels: Map<string, Map<string, string>>, fieldName: string, value: unknown): string {
  if (typeof value !== 'string' || value === '') return '—'
  return enumLabels.get(fieldName)?.get(value) ?? value
}
