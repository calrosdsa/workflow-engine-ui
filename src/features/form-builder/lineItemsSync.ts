// Orchestrates the child form backing a Line Items field: on every parent
// form save, each 'line_items' element's configured columns are projected
// into a child FormDefinition (a normal form with is_line_items=true and a
// parent_link system field), created on first save or updated thereafter.
// The child form's id is threaded back onto the element (childFormId) so the
// parent's `layout` and the runtime grid both know which form to read/write.

import { formsApi } from '@/features/forms/api'
import { slugifyKey } from './factory'
import { COMPONENT_REGISTRY } from './component-registry'
import { iterElements, type ProjectionResult } from './projection'
import type { FormSchema, LineItemColumnDef } from './schema'
import type { FieldDef, CreateFormPayload } from '@/features/forms/types'

const PARENT_LINK_FIELD = '_parent_id'
const ROW_ORDER_FIELD = '_row_order'

/** Projects one Line Items column into a backend FieldDef, mirroring
 *  projection.ts's elementToField for the constrained column shape. */
function columnToField(col: LineItemColumnDef, usedNames: Set<string>): FieldDef | null {
  const reg = COMPONENT_REGISTRY[col.component]
  if (!reg.dataBearing || !reg.fieldType) return null
  if (col.component === 'form' && !col.formRef) return null

  let name = col.key && /^[a-zA-Z_]\w*$/.test(col.key) ? col.key : slugifyKey(col.label)
  if (usedNames.has(name)) {
    let i = 2
    while (usedNames.has(`${name}_${i}`)) i++
    name = `${name}_${i}`
  }
  usedNames.add(name)

  const field: FieldDef = {
    name,
    label: col.label || name,
    type: reg.fieldType,
    required: col.behavior.required === 'always',
  }
  if (reg.fieldType === 'enum' && col.options && col.options.length > 0) {
    field.enum_values = col.options.map((o) => o.value)
  }
  if (col.component === 'form' && col.formRef) field.reference_table = col.formRef
  if (col.component === 'form' && col.displayField) field.display_field = col.displayField

  return field
}

/** Builds the full child-form FieldDef[] for a Line Items element: the two
 *  system fields (parent link + row order) prepended to the projected
 *  user-configured columns. */
export function projectLineItemColumns(columns: LineItemColumnDef[]): ProjectionResult {
  const used = new Set<string>([PARENT_LINK_FIELD, ROW_ORDER_FIELD])
  const fields: FieldDef[] = []
  for (const col of columns) {
    const f = columnToField(col, used)
    if (f) fields.push(f)
  }
  return { fields, renamed: [] }
}

/** Builds the system fields prepended to every Line Items child form.
 *  parentFormId is the target of the parent_link FK — the backend resolves
 *  it to the parent's physical table. */
function systemFields(parentFormId: string): FieldDef[] {
  return [
    { name: PARENT_LINK_FIELD, label: 'Parent', type: 'parent_link', required: true, reference_table: parentFormId },
    { name: ROW_ORDER_FIELD, label: 'Row Order', type: 'integer', required: true },
  ]
}

export interface SyncLineItemsResult {
  /** True if any element's childFormId changed (schema needs re-saving). */
  changed: boolean
  schema: FormSchema
}

/** Ensures every 'line_items' element in schema has a live, up-to-date child
 *  form. parentFormId must be a real, already-persisted form id — call this
 *  AFTER the parent's own first save so parent_form_id can be set. Mutates
 *  nothing in place; returns a new schema with childFormId populated. */
export async function syncLineItemsChildren(schema: FormSchema, parentFormId: string, parentSlug: string): Promise<SyncLineItemsResult> {
  let changed = false
  const next: FormSchema = structuredClone(schema)

  for (const el of iterElements(next)) {
    if (el.component !== 'line_items') continue
    const columns = el.lineItemColumns ?? []
    const { fields } = projectLineItemColumns(columns)
    const allFields = [...systemFields(parentFormId), ...fields]

    const childSlug = `${parentSlug}_${slugifyKey(el.key)}`.slice(0, 63)
    const payload: CreateFormPayload = {
      name: `${el.label} (${parentSlug})`,
      slug: childSlug,
      fields: allFields,
      parent_form_id: parentFormId,
      is_line_items: true,
    }

    if (el.childFormId) {
      await formsApi.update(el.childFormId, payload)
    } else {
      const created = await formsApi.create(payload)
      el.childFormId = created.id
      changed = true
    }
  }

  return { changed, schema: next }
}
