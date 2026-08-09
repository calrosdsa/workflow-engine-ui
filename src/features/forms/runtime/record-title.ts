// Resolves a human-readable title for a record, replacing the raw id
// wherever the runtime shows one: the Detail page header, record drawers,
// and reference-field renderers on other forms pointing at this record.
//
// Priority order:
//   1. Every field with is_record_title set (see FieldDef's doc comment),
//      in FormDef.fields order, formatted and joined with " — ".
//   2. Otherwise, the legacy heuristic: whichever of `name` or `label`
//      exists on the record, kept for forms saved before this feature
//      existed.
//   3. Otherwise, the raw id.
import { formatValue } from './format-value'
import type { FieldDef, FormRecord } from '@/features/forms/types'

const TITLE_SEPARATOR = ' — '

/** Resolves a record's display title from its form's field definitions. */
export function resolveRecordTitle(fields: FieldDef[] | undefined, record: FormRecord | null | undefined): string {
  if (!record) return ''

  const titleFields = (fields ?? []).filter((f) => f.is_record_title)
  if (titleFields.length > 0) {
    const parts = titleFields
      .map((f) => record[f.name])
      .filter((v) => v !== null && v !== undefined && v !== '')
      .map((v) => formatValue(v))
    if (parts.length > 0) return parts.join(TITLE_SEPARATOR)
  }

  if (record.name != null && record.name !== '') return String(record.name)
  if (record.label != null && record.label !== '') return String(record.label)
  return (record.id as string) ?? ''
}

/** Resolves the label to show for one reference field's linked record.
 *
 * Priority order:
 *   1. `displayField`, when the reference field explicitly configured one
 *      (Config Panel's "Display Field" picker) — a single named field on the
 *      target form.
 *   2. Otherwise, resolveRecordTitle()'s own priority (record-title fields,
 *      then the legacy name/label/id heuristic).
 *
 * Shared by every reference-field render site (search comboboxes, read-only
 * table/detail cells, Linked Records previews) so they can't drift into
 * different label choices for the same reference. */
export function resolveReferenceLabel(
  targetFields: FieldDef[] | undefined,
  record: FormRecord | null | undefined,
  displayField?: string,
): string {
  if (!record) return ''
  if (displayField && record[displayField] != null && record[displayField] !== '') {
    return formatValue(record[displayField])
  }
  return resolveRecordTitle(targetFields, record)
}
