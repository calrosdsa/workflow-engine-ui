// Projects the rich builder schema down to the backend's flat FieldDef[] used
// for SQL table generation. Only data-bearing components become columns;
// presentational components (heading/paragraph/divider/spacer) are skipped.
//
// This is the bridge that keeps the existing backend (column-per-field DDL)
// working while the builder owns a much richer schema in the `layout` column.

import type { FormSchema, FormElement } from './schema'
import { COMPONENT_REGISTRY, supportsUnique } from './component-registry'
import { slugifyKey } from './factory'
import type { FieldDef } from '@/features/forms/types'

/** Walks the schema in document order and yields every element. */
export function* iterElements(schema: FormSchema): Generator<FormElement> {
  for (const section of schema.sections) {
    for (const column of section.columns) {
      for (const el of column.elements) {
        yield el
      }
    }
  }
}

/** Maps a single element to a backend FieldDef, or null if it isn't data-bearing. */
function elementToField(el: FormElement, usedNames: Set<string>): FieldDef | null {
  const reg = COMPONENT_REGISTRY[el.component]
  if (!reg.dataBearing || !reg.fieldType) return null

  // An unconfigured form reference (no form selected) can't become a valid
  // reference column — the backend requires reference_table. Skip it so the save
  // isn't rejected; the builder's validation surfaces it to the user instead.
  if (el.component === 'form' && !el.formRef) return null

  // The editable `key` becomes the wire `name`. It's deduplicated only so the
  // backend's key-based record contract stays unambiguous — it is NOT the
  // physical column (which the backend owns and never changes).
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

  // Carry the immutable physical column through so a re-save preserves identity.
  // New elements have no column yet — the backend assigns one on first save.
  if (el.column) field.column = el.column

  // UNIQUE constraint — only for string/number-typed fields that opted in.
  if (el.unique && supportsUnique(el.component)) field.unique = true

  if (el.description) field.description = el.description

  // Enum-typed components carry their option values as the CHECK constraint set.
  if (reg.fieldType === 'enum' && el.options && el.options.length > 0) {
    field.enum_values = el.options.map((o) => o.value)
  }

  // Form-reference components store the referenced form's id in reference_table.
  // The backend resolves it to that form's physical table for the FK.
  if (el.component === 'form' && el.formRef) {
    field.reference_table = el.formRef
  }

  // SQL default — only emit for primitive static defaults we can express safely.
  const def = staticDefaultLiteral(el)
  if (def !== undefined) field.default = def

  return field
}

/** Returns a SQL literal string for an element's static default, or undefined. */
function staticDefaultLiteral(el: FormElement): string | undefined {
  const reg = COMPONENT_REGISTRY[el.component]
  if (el.defaultValue === undefined || el.defaultValue === null || el.defaultValue === '') return undefined
  // Don't emit defaults for expression-driven values.
  if (el.behavior.dynamicDefault) return undefined

  switch (reg.fieldType) {
    case 'boolean':
      return el.defaultValue ? 'true' : 'false'
    case 'integer':
    case 'decimal': {
      const n = Number(el.defaultValue)
      return Number.isFinite(n) ? String(n) : undefined
    }
    case 'string':
    case 'text':
    case 'email':
    case 'phone': {
      // Single-quote and escape for SQL.
      const s = String(el.defaultValue).replace(/'/g, "''")
      return `'${s}'`
    }
    default:
      return undefined
  }
}

export interface ProjectionResult {
  fields: FieldDef[]
  /** Names of data-bearing elements that had to be renamed for uniqueness. */
  renamed: { from: string; to: string }[]
}

/** A form-reference problem found before save. */
export interface FormRefIssue {
  label: string
  kind: 'missing' | 'broken'
}

/** Validates every form-reference element. `validIds`, when provided, is the set
 *  of existing form ids; a reference outside it is flagged as broken. Without it,
 *  only unconfigured (no form selected) references are reported. */
export function validateFormRefs(schema: FormSchema, validIds?: Set<string>): FormRefIssue[] {
  const issues: FormRefIssue[] = []
  for (const el of iterElements(schema)) {
    if (el.component !== 'form') continue
    if (!el.formRef) {
      issues.push({ label: el.label || el.key, kind: 'missing' })
    } else if (validIds && !validIds.has(el.formRef)) {
      issues.push({ label: el.label || el.key, kind: 'broken' })
    }
  }
  return issues
}

/** Derives the backend FieldDef[] from the builder schema. */
export function projectToFields(schema: FormSchema): ProjectionResult {
  const used = new Set<string>()
  const fields: FieldDef[] = []
  const renamed: { from: string; to: string }[] = []

  for (const el of iterElements(schema)) {
    const original = el.key
    const f = elementToField(el, used)
    if (f) {
      fields.push(f)
      if (original && f.name !== original) renamed.push({ from: original, to: f.name })
    }
  }
  return { fields, renamed }
}
