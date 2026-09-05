// Orchestrates the child form backing a Line Items field: on every parent
// form save, each 'line_items' element's configured columns are projected
// into a child FormDefinition (a normal form with is_line_items=true and a
// parent_link system field), created on first save or updated thereafter.
// The child form's id is threaded back onto the element (childFormId) so the
// parent's `layout` and the runtime grid both know which form to read/write.

import { formsApi } from '@/features/forms/api'
import { slugifyKey } from './factory'
import { COMPONENT_REGISTRY, supportsRecordTitle } from './component-registry'
import { iterElements, type ProjectionResult } from './projection'
import type { FormSchema, FormElement, LineItemSection, LineItemsConfig } from './schema'
import type { FieldDef, CreateFormPayload } from '@/features/forms/types'

export const PARENT_LINK_FIELD = '_parent_id'
export const ROW_ORDER_FIELD = '_row_order'

/** Walks a Line Items grid's own sections->columns->elements in document
 *  order — the same shape iterElements walks for the main canvas, just
 *  scoped to one grid's row-editor sections instead of a whole FormSchema. */
export function* iterLineItemElements(sections: LineItemSection[]): Generator<FormElement> {
  for (const section of sections) {
    for (const column of section.columns) {
      for (const el of column.elements) {
        yield el
      }
    }
  }
}

/** Projects one Line Items row field into a backend FieldDef, mirroring
 *  projection.ts's elementToField for the constrained field shape. A nested
 *  'line_items' field is never data-bearing on ITS OWN row — same as a
 *  top-level Line Items element never becoming a field on its parent form —
 *  it gets its own child form via syncOneGrid's recursion instead. */
function columnToField(el: FormElement, usedNames: Set<string>): FieldDef | null {
  if (el.component === 'line_items') return null
  const reg = COMPONENT_REGISTRY[el.component]
  if (!reg.dataBearing || !reg.fieldType) return null
  if (el.component === 'form' && !el.formRef) return null

  let name = el.key && /^[a-zA-Z_]\w*$/.test(el.key) ? el.key : slugifyKey(el.label)
  if (usedNames.has(name)) {
    let i = 2
    while (usedNames.has(`${name}_${i}`)) i++
    name = `${name}_${i}`
  }
  usedNames.add(name)

  const field: FieldDef = {
    name,
    label: el.label || name,
    type: reg.fieldType,
    required: el.behavior.required === 'always',
  }
  if (reg.fieldType === 'enum' && el.options && el.options.length > 0) {
    field.enum_values = el.options.map((o) => o.value)
  }
  if (el.component === 'form' && el.formRef) field.reference_table = el.formRef
  if (el.component === 'form' && el.displayField) field.display_field = el.displayField
  if (el.isRecordTitle && supportsRecordTitle(el.component)) field.is_record_title = true

  return field
}

/** Builds the full child-form FieldDef[] for a Line Items element: the two
 *  system fields (parent link + row order) prepended to the projected
 *  user-configured fields (flattened out of their authored sections/columns —
 *  physical columns have no concept of the row-editor's visual layout). */
export function projectLineItemColumns(sections: LineItemSection[]): ProjectionResult {
  const used = new Set<string>([PARENT_LINK_FIELD, ROW_ORDER_FIELD])
  const fields: FieldDef[] = []
  for (const el of iterLineItemElements(sections)) {
    const f = columnToField(el, used)
    if (f) fields.push(f)
  }
  return { fields, renamed: [] }
}

/** Builds the system fields prepended to every Line Items child form.
 *  parentFormId is the target of the parent_link FK — the backend resolves
 *  it to the parent's physical table. */
function systemFields(parentFormId: string): FieldDef[] {
  return [
    { name: PARENT_LINK_FIELD, label: 'Parent', type: 'parent_link', required: true, reference_table: parentFormId, index: true },
    { name: ROW_ORDER_FIELD, label: 'Row Order', type: 'integer', required: true },
  ]
}

export interface SyncLineItemsResult {
  /** True if any element's childFormId changed (schema needs re-saving). */
  changed: boolean
  schema: FormSchema
}

/** Creates or updates the child form backing ONE Line Items node — a
 *  top-level canvas element or a nested 'line_items' field, both carry the
 *  same childFormId/lineItemColumns/label/key shape (see FormElement's doc
 *  comments), so this one function handles both. parentFormId is whichever
 *  form this node's rows attach to: the actual parent form for a top-level
 *  grid, or the ENCLOSING grid's own just-synced child form for a nested
 *  field — a nested grid's "parent" is the row it lives inside, not the
 *  top-level form. Mutates node in place (assigning childFormId/key) and
 *  recurses into any of its own nested 'line_items' fields before
 *  returning, so by the time this resolves the whole subtree rooted at node
 *  is fully synced. Returns true if anything changed. */
async function syncOneGrid(
  node: { label: string; key: string; childFormId?: string; lineItemColumns?: LineItemSection[]; lineItemConfig?: LineItemsConfig },
  parentFormId: string,
  parentSlug: string,
): Promise<boolean> {
  let changed = false
  const sections = node.lineItemColumns ?? []
  const { fields } = projectLineItemColumns(sections)
  const allFields = [...systemFields(parentFormId), ...fields]

  // The backend nests/reads this grid's rows in its parent's JSON under the
  // child form's own slug (attachLineItems/extractLineItemsPayload key by
  // FormRow.Slug) — node.key MUST match it exactly, since node.key is what
  // every other part of the runtime (Controller's field name, defaultValues
  // lookups, expression variables) already uses as this node's wire key.
  // Derived from childFormId presence (not node.key itself) so the slug is
  // computed from the ORIGINAL key exactly once — node.key is reassigned to
  // it below, and re-slugifying an already-synced slug on a later save would
  // double-prefix it (parentSlug_parentSlug_...).
  const childSlug = node.childFormId ? node.key : `${parentSlug}_${slugifyKey(node.key)}`.slice(0, 63)
  if (node.key !== childSlug) {
    node.key = childSlug
    changed = true
  }
  const payload: CreateFormPayload = {
    name: `${node.label} (${parentSlug})`,
    slug: childSlug,
    fields: allFields,
    parent_form_id: parentFormId,
    is_line_items: true,
    line_items_min_rows: node.lineItemConfig?.minRows ?? 0,
    line_items_max_rows: node.lineItemConfig?.maxRows ?? 0,
  }

  if (node.childFormId) {
    await formsApi.update(node.childFormId, payload)
  } else {
    const created = await formsApi.create(payload)
    node.childFormId = created.id
    changed = true
  }

  // Recurse into this grid's own nested 'line_items' fields, if any — each
  // one's "parent" is THIS grid's child form (just created/updated above),
  // not the top-level form, since a nested row's grid belongs to the row,
  // which belongs to this child form.
  for (const el of iterLineItemElements(sections)) {
    if (el.component !== 'line_items') continue
    const nestedChanged = await syncOneGrid(el, node.childFormId!, childSlug)
    if (nestedChanged) changed = true
  }

  return changed
}

/** Ensures every 'line_items' element in schema — and every 'line_items'
 *  column nested inside one, recursively, at any depth — has a live,
 *  up-to-date child form. parentFormId must be a real, already-persisted
 *  form id — call this AFTER the parent's own first save so parent_form_id
 *  can be set. Mutates nothing in place; returns a new schema with every
 *  childFormId in the tree populated.
 *
 *  Elements in adopted mode (sourceMode 'existing') are skipped entirely —
 *  there is no child form to create/update; the association with the
 *  adopted form lives on the PARENT's own field list (a TypeLineItemAdopted
 *  field, added by projection.ts's elementToField), not a synced form. */
export async function syncLineItemsChildren(schema: FormSchema, parentFormId: string, parentSlug: string): Promise<SyncLineItemsResult> {
  let changed = false
  const next: FormSchema = structuredClone(schema)

  for (const el of iterElements(next)) {
    if (el.component !== 'line_items' || el.sourceMode === 'existing') continue
    if (await syncOneGrid(el, parentFormId, parentSlug)) changed = true
  }

  return { changed, schema: next }
}

/** This form's own top-level 'line_items' elements that already have a live,
 *  synced GENERATED child form (childFormId set) -- i.e. "which of this
 *  form's Line Items grids resolve to a real child form id right now."
 *  Excludes adopted-mode grids (sourceMode 'existing'), which never get a
 *  childFormId (see schema.ts's doc comment on that field), and any
 *  in-progress grid added to the canvas but not yet saved. Nested grids (a
 *  'line_items' field inside another grid's row editor) are deliberately
 *  NOT included -- same top-level-only scope as syncLineItemsChildren above
 *  and the Line Item Count target-grid picker (form-builder/config/
 *  ConfigPanel.tsx), which this mirrors for callers with a FormSchema but no
 *  live builder state of their own -- e.g. reports' "related" block, which
 *  resolves a separately-fetched PARENT form's schema (resolveFormSchema)
 *  rather than reading the form builder's own in-memory schema. */
export function generatedLineItemsChildren(schema: FormSchema): FormElement[] {
  return [...iterElements(schema)].filter(
    (el) => el.component === 'line_items' && el.sourceMode !== 'existing' && el.childFormId,
  )
}
