// Bridges the builder's rich schema with the backend FormDefinition.
//
//  • toBuilder(def)   — hydrate the builder from a saved FormDefinition.
//  • toPayload(state) — produce the Create/Update payload: derives fields[] from
//                       the schema (for SQL) and embeds the full schema in layout.

import { type FormSchema, emptySchema, emptyFormSettings } from './schema'
import { projectToFields } from './projection'
import type { FormDefinition, CreateFormPayload, FieldDef } from '@/features/forms/types'

export interface BuilderFormState {
  name: string
  slug: string
  description: string
  schema: FormSchema
}

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

/** Hydrate builder state from a saved form definition.
 *
 *  Critically, this threads each persisted field's immutable physical `column`
 *  back onto its layout element (matched by `key`). That is what lets a re-save
 *  preserve physical identity — without it, editing a field would orphan its
 *  data. New elements (no matching backend field) simply stay column-less and
 *  get one assigned by the backend on the next save. */
export function toBuilder(def: FormDefinition): BuilderFormState {
  const schema = parseLayout(def.layout)
  const columnByKey = new Map<string, string>()
  for (const f of def.fields ?? ([] as FieldDef[])) {
    if (f.column) columnByKey.set(f.name, f.column)
  }
  for (const section of schema.sections) {
    for (const column of section.columns) {
      for (const el of column.elements) {
        const col = columnByKey.get(el.key)
        if (col) el.column = col
      }
    }
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
