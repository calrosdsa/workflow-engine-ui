// Bridges the builder's rich schema with the backend FormDefinition.
//
//  • toBuilder(def)   — hydrate the builder from a saved FormDefinition.
//  • toPayload(state) — produce the Create/Update payload: derives fields[] from
//                       the schema (for SQL) and embeds the full schema in layout.

import { type FormSchema, emptySchema } from './schema'
import { projectToFields } from './projection'
import { parseLayout } from './parse-layout'
import { healSchema, type HealableForm } from './heal'
import type { FormDefinition, CreateFormPayload, FieldDef } from '@/features/forms/types'

// parseLayout lives in its own leaf module now (see parse-layout.ts for the
// import-cycle reason); re-exported so existing importers keep working.
export { parseLayout } from './parse-layout'

/** THE way to turn a stored form into a renderable FormSchema. Parses the
 *  layout blob AND heals it against the backend's fields[] (see heal.ts):
 *  a form created or edited through the API — no layout, or a layout that
 *  predates a field change — still renders every real field, drops ghosts of
 *  deleted ones, and shows the true create-user settings. Pure and
 *  idempotent, so render paths call it every time. */
export function resolveFormSchema(form: (HealableForm & { layout?: unknown }) | null | undefined): FormSchema {
  if (!form) return emptySchema()
  return healSchema(parseLayout(form.layout), form)
}

export interface BuilderFormState {
  name: string
  slug: string
  description: string
  schema: FormSchema
}

/** Hydrate builder state from a saved form definition.
 *
 *  Critically, this threads each persisted field's immutable physical `column`
 *  back onto its layout element (matched by `key`). That is what lets a re-save
 *  preserve physical identity — without it, editing a field would orphan its
 *  data. New elements (no matching backend field) simply stay column-less and
 *  get one assigned by the backend on the next save. */
export function toBuilder(def: FormDefinition): BuilderFormState {
  // Heal BEFORE hydrating, so an API-written form opens showing its real
  // fields and true settings, and ghost elements of API-deleted fields can't
  // be resurrected by the next save (see heal.ts).
  const parsed = healSchema(parseLayout(def.layout), def)
  const columnByKey = new Map<string, string>()
  for (const f of def.fields ?? ([] as FieldDef[])) {
    if (f.column) columnByKey.set(f.name, f.column)
  }
  // Builds fresh section/column/element objects rather than mutating what
  // parseLayout returned in place — that object may alias the schema still
  // living in the form-builder's Zustand store, which Immer's `produce`
  // (features/builder-kit/tree-store.ts) deep-freezes as a side effect of
  // any canvas edit. Mutating a frozen `el` here threw "Cannot assign to
  // read only property 'column'" in production use, right after a save
  // (toPayload embeds `state.schema` into the request verbatim, and that
  // same reference round-trips back as `def.layout` once the update
  // mutation's cache settles) — confirmed live.
  const schema: FormSchema = {
    ...parsed,
    sections: parsed.sections.map((section) => ({
      ...section,
      columns: section.columns.map((column) => ({
        ...column,
        elements: column.elements.map((el) => {
          const col = columnByKey.get(el.key)
          return col ? { ...el, column: col } : el
        }),
      })),
    })),
  }
  return {
    name: def.name,
    slug: def.slug,
    description: def.description ?? '',
    schema,
  }
}

/** Build the Create/Update payload from builder state. */
export function toPayload(state: BuilderFormState): CreateFormPayload {
  const { fields } = projectToFields(state.schema)
  const cu = state.schema.settings?.createUser
  return {
    name: state.name,
    slug: state.slug,
    description: state.description || undefined,
    fields,
    layout: state.schema,
    // Explicit, backend-readable mirror of schema.settings.createUser — see
    // FormDefinition's doc comment. The builder's own source of truth stays
    // schema.settings.createUser (hydrated from `layout` by toBuilder); these
    // exist purely so the Go backend can read the setting without parsing
    // the opaque layout blob.
    create_user_on_submit: cu?.enabled ?? false,
    create_user_name_field: cu?.nameFieldKey,
    create_user_email_field: cu?.emailFieldKey,
    create_user_role_field: cu?.roleFieldKey,
  }
}
