// "Unlink Dependent Form" — the reverse of AddDependentFormDialog's link:
// clears the child's parent_form_id AND removes the auto-injected Form
// Reference field pointing at that parent (plus its section, if the section
// becomes empty), so unlinking doesn't leave a dangling required field for a
// relationship the tree no longer shows.

import { toBuilder, toPayload } from '@/features/form-builder/serialize'
import { formsApi } from './api'

/** Fetches childId, strips the Form Reference field/section pointing at its
 *  current parent_form_id (only that field — one the user later repointed at
 *  a different form, or added independently, is left alone), then clears the
 *  link. A form with no parent_form_id, or whose reference field was already
 *  removed/repointed by hand, still gets unlinked — the field removal is a
 *  best-effort cleanup, not a precondition. */
export async function unlinkDependentForm(childId: string): Promise<void> {
  const child = await formsApi.get(childId)
  const parentId = child.parent_form_id

  if (parentId) {
    const builder = toBuilder(child)
    let changed = false

    builder.schema.sections = builder.schema.sections
      .map((section) => ({
        ...section,
        columns: section.columns.map((column) => {
          const kept = column.elements.filter((el) => {
            const isParentRef = el.component === 'form' && el.formRef === parentId
            if (isParentRef) changed = true
            return !isParentRef
          })
          return { ...column, elements: kept }
        }),
      }))
      // Drop sections left with no elements in any column — mirrors how the
      // section was created solely to hold this one field.
      .filter((section) => section.columns.some((c) => c.elements.length > 0))

    if (changed) {
      await formsApi.update(childId, toPayload(builder))
    }
  }

  await formsApi.unlink(childId)
}
