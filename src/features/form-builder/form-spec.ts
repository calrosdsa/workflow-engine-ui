// The JSON form specification — a documented, round-trippable contract for
// describing a form as data instead of by dragging it onto a canvas.
//
// This backs the "JSON specification" option in Add Form, and is the shape
// an AI agent is expected to emit when asked to create or edit a form.
//
// TWO SHAPES, ONE ENTRY POINT
// ---------------------------
// `parseFormSpec` accepts either and tells you which it got:
//
//   • COMPACT — what an agent (or a person) writes by hand. A form name and
//     a flat list of fields; everything else is defaulted. Field `type` is a
//     builder component type, with generous aliases for the backend's own
//     FieldType names (see TYPE_ALIASES) so a spec written against either
//     vocabulary parses.
//
//         { "name": "Purchase Order",
//           "fields": [ { "label": "Vendor", "type": "text", "required": true },
//                       { "label": "Amount", "type": "number" } ] }
//
//   • NATIVE — the lossless shape, identical to what the backend stores and
//     to `FormSnapshotItem` (internal/appbuilder/versions.go): name/slug/
//     description plus the full `layout` FormSchema. This is what export
//     emits, so an agent can read a real form, change one thing, and hand it
//     back without the round trip flattening anything it didn't understand.
//
// Detection is by the presence of a structurally valid `layout` — NOT by
// sniffing field types, which genuinely overlap between the two vocabularies
// ("text", "date", "email" and others mean something in both).
//
// WHY A GENERATOR AND NOT JUST fields[]
// -------------------------------------
// The builder's source of truth is `layout` (sections → columns → elements);
// the backend's flat `fields[]` is only a PROJECTION of it (projection.ts).
// A spec carrying just field definitions would therefore create a form whose
// canvas is empty — real columns in Postgres, nothing to see or edit in the
// builder. So the compact shape is expanded into a genuine FormSchema here,
// through the same createSection/createElement factories the canvas itself
// uses, rather than being written to `fields[]` directly.

import {
  type ComponentType, type FormSchema, type FormSection, type FormElement,
  type ColumnLayout, type SelectOption, COLUMN_LAYOUTS, emptyFormSettings,
} from './schema'
import { COMPONENT_REGISTRY, supportsUnique, supportsRecordTitle, supportsSearchable } from './component-registry'
import { createSection, createElement, slugifyKey, RESERVED_FIELD_KEYS } from './factory'
import { parseLayout } from './parse-layout'
import type { BuilderFormState } from './serialize'

// ---------------------------------------------------------------------------
// The compact shape
// ---------------------------------------------------------------------------

/** One field in a compact spec. Only `label` (or `key`) and `type` matter;
 *  everything else refines the generated element. */
export interface FormSpecField {
  /** Machine key. Falls back to a slug of `label`. `name` is accepted as a
   *  synonym because that's what the backend's own FieldDef calls it. */
  key?: string
  name?: string
  label?: string
  /** Component type, or one of TYPE_ALIASES' accepted synonyms. */
  type?: string
  required?: boolean
  unique?: boolean
  /** Creates a btree index on this column for faster queries/sorts. No
   *  component-type restriction. */
  index?: boolean
  description?: string
  placeholder?: string
  /** Static default. Ignored for types that can't express one in SQL. */
  default?: unknown
  defaultValue?: unknown
  /** Choice types only. Either ["A","B"] or [{label,value}]. */
  options?: (string | SelectOption)[]
  /** Include this field in the form's full-text search column. */
  searchable?: boolean
  /** Use this field (possibly with others) as the record's display title. */
  recordTitle?: boolean
  is_record_title?: boolean
  /** Rendering width hint. */
  width?: 'full' | 'half' | 'third' | 'quarter' | 'auto'
  /** Never shown to the filler (still stored). */
  hidden?: boolean
  readOnly?: boolean
  /** Validation. minLength/maxLength/pattern are frontend-only (matching the
   *  builder itself); min/max apply to numeric types. */
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  /** For type "form" (a reference): the target form's id. */
  formRef?: string
  reference?: string
}

/** One section in a compact spec. */
export interface FormSpecSection {
  title?: string
  description?: string
  /** A ColumnLayout key ('1', '2', '2-30-70', '2-70-30', '3', '4') or a
   *  plain column count 1–4. Fields are dealt across the columns in order. */
  layout?: string | number
  columns?: string | number
  fields?: FormSpecField[]
}

/** The compact spec as a whole. `sections` and a top-level `fields` are both
 *  accepted; a bare `fields` list becomes one section. */
export interface CompactFormSpec {
  name?: string
  slug?: string
  description?: string
  sections?: FormSpecSection[]
  fields?: FormSpecField[]
}

/** The native (lossless) spec — what `toNativeSpec` emits. */
export interface NativeFormSpec {
  name?: string
  slug?: string
  description?: string
  layout?: unknown
}

// ---------------------------------------------------------------------------
// Type vocabulary
// ---------------------------------------------------------------------------

/** Accepted synonyms for a component type.
 *
 *  Note "text": in the BUILDER's vocabulary it's a single-line input, in the
 *  BACKEND's it's a textarea hint (COMPONENT_REGISTRY.text.fieldType is
 *  'string'; 'textarea'.fieldType is 'text'). The compact spec is component-
 *  first, so "text" means single-line here, and "longtext"/"textarea" is how
 *  you ask for the multi-line one. */
export const TYPE_ALIASES: Record<string, ComponentType> = {
  // Backend FieldType names
  string: 'text',
  integer: 'number',
  decimal: 'number',
  boolean: 'checkbox',
  enum: 'select',
  reference: 'form',
  json: 'multiselect',
  // Everyday synonyms
  int: 'number',
  float: 'number',
  double: 'number',
  bool: 'checkbox',
  toggle: 'switch',
  longtext: 'textarea',
  multiline: 'textarea',
  dropdown: 'select',
  multi_select: 'multiselect',
  ref: 'form',
  lookup: 'form',
  attachment: 'file',
  photo: 'image',
  timestamp: 'datetime',
}

/** Resolves a spec `type` string to a real ComponentType, or null.
 *
 *  Tries the separated form first ("multi select" → multi_select, an alias)
 *  and the collapsed form second ("long-text" → long_text → longtext, also
 *  an alias). Both are needed: some names in these two vocabularies carry a
 *  separator and some don't, and an author has no way to know which. */
export function resolveComponentType(raw: string | undefined): ComponentType | null {
  if (!raw) return null
  const separated = String(raw).trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (separated in COMPONENT_REGISTRY) return separated as ComponentType
  if (separated in TYPE_ALIASES) return TYPE_ALIASES[separated]

  const collapsed = separated.replace(/_/g, '')
  if (collapsed in COMPONENT_REGISTRY) return collapsed as ComponentType
  return TYPE_ALIASES[collapsed] ?? null
}

/** Every type name a spec may use, for error messages and documentation. */
export function acceptedTypeNames(): string[] {
  return [...Object.keys(COMPONENT_REGISTRY), ...Object.keys(TYPE_ALIASES)].sort()
}

const CHOICE_COMPONENTS = new Set<ComponentType>(['select', 'radio', 'multiselect', 'autocomplete'])

// ---------------------------------------------------------------------------
// Parse result
// ---------------------------------------------------------------------------

export interface FormSpecParseSuccess {
  ok: true
  /** Which shape was recognised — surfaced in the import preview so the
   *  author can tell when their "native" spec silently read as compact
   *  because its layout was malformed. */
  mode: 'compact' | 'native'
  form: BuilderFormState
  /** Non-fatal: the spec parsed, but something in it was ignored or
   *  defaulted. Shown to the author before they commit the import. */
  warnings: string[]
}

export interface FormSpecParseFailure {
  ok: false
  errors: string[]
}

export type FormSpecParseResult = FormSpecParseSuccess | FormSpecParseFailure

export interface ParseFormSpecOptions {
  /** Carry each element's immutable physical `column` through, matched by
   *  key against this schema. Pass the CURRENT schema when applying a spec
   *  to an existing form — without it every field looks new to the backend
   *  and gets a fresh column, orphaning the data in the old one. Omit when
   *  creating a form, where there is no physical identity to preserve. */
  existingSchema?: FormSchema
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/** Parses a JSON form specification (string or already-parsed object) into
 *  builder state ready to load onto the canvas.
 *
 *  Never throws: malformed input comes back as `{ ok: false, errors }` so a
 *  caller can render the problems next to the text the author typed. */
export function parseFormSpec(raw: string | unknown, opts: ParseFormSpecOptions = {}): FormSpecParseResult {
  let obj: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return { ok: false, errors: ['Paste a JSON form specification to import.'] }
    try {
      obj = JSON.parse(trimmed)
    } catch (e) {
      return { ok: false, errors: [`Not valid JSON: ${e instanceof Error ? e.message : String(e)}`] }
    }
  }

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, errors: ['Expected a JSON object describing one form.'] }
  }
  const spec = obj as CompactFormSpec & NativeFormSpec

  const name = typeof spec.name === 'string' ? spec.name.trim() : ''
  if (!name) return { ok: false, errors: ['"name" is required and must be a non-empty string.'] }

  const warnings: string[] = []
  const native = hasUsableLayout(spec.layout)
  const schema = native
    ? adoptNativeLayout(spec.layout, warnings)
    : compactToSchema(spec, warnings)

  if (schema.sections.length === 0) {
    warnings.push('This spec has no fields — it will create an empty form you can build on.')
  }

  if (opts.existingSchema) carryColumnsForward(schema, opts.existingSchema, warnings)

  const slug = typeof spec.slug === 'string' && spec.slug.trim() ? slugifyKey(spec.slug) : slugifyKey(name)

  return {
    ok: true,
    mode: native ? 'native' : 'compact',
    warnings,
    form: {
      name,
      slug,
      description: typeof spec.description === 'string' ? spec.description : '',
      schema,
    },
  }
}

/** True when `layout` is structurally a FormSchema we can adopt verbatim.
 *  A `layout` that's present but malformed deliberately falls through to the
 *  compact reader (and warns) rather than failing the whole import. */
function hasUsableLayout(layout: unknown): boolean {
  if (!layout || typeof layout !== 'object') return false
  const sections = (layout as FormSchema).sections
  return Array.isArray(sections)
}

function adoptNativeLayout(layout: unknown, warnings: string[]): FormSchema {
  const schema = parseLayout(layout)
  let repaired = 0
  for (const section of schema.sections) {
    if (!Array.isArray(section.columns) || section.columns.length === 0) {
      section.columns = [{ id: freshId(), ratio: 1, elements: [] }]
      section.layout = section.layout ?? '1'
      repaired++
    }
    for (const column of section.columns) {
      if (!Array.isArray(column.elements)) column.elements = []
    }
  }
  if (repaired > 0) {
    warnings.push(`${repaired} section${repaired === 1 ? '' : 's'} had no columns and were given a single-column layout.`)
  }
  return schema
}

// ---------------------------------------------------------------------------
// Compact → FormSchema
// ---------------------------------------------------------------------------

function compactToSchema(spec: CompactFormSpec, warnings: string[]): FormSchema {
  const rawSections: FormSpecSection[] = Array.isArray(spec.sections) && spec.sections.length > 0
    ? spec.sections
    : Array.isArray(spec.fields) && spec.fields.length > 0
      ? [{ title: 'Details', fields: spec.fields }]
      : []

  if (Array.isArray(spec.sections) && spec.sections.length > 0 && Array.isArray(spec.fields) && spec.fields.length > 0) {
    warnings.push('Both "sections" and a top-level "fields" list were given — "sections" wins and the top-level list was ignored.')
  }

  // Keys are deduplicated across the WHOLE form, not per section: the key is
  // the record's wire field name, and two sections holding the same key would
  // collide the moment the projection ran.
  const usedKeys = new Set<string>()
  const sections: FormSection[] = []

  rawSections.forEach((rawSection, sectionIndex) => {
    const fields = Array.isArray(rawSection.fields) ? rawSection.fields : []
    const layout = resolveColumnLayout(rawSection.layout ?? rawSection.columns, warnings, sectionIndex)
    const section = createSection(
      typeof rawSection.title === 'string' && rawSection.title.trim() ? rawSection.title.trim() : 'Details',
      layout,
    )
    if (typeof rawSection.description === 'string' && rawSection.description) {
      section.description = rawSection.description
    }

    fields.forEach((rawField, fieldIndex) => {
      const el = specFieldToElement(rawField, usedKeys, warnings, `section ${sectionIndex + 1}, field ${fieldIndex + 1}`)
      if (!el) return
      // Deal fields across the section's columns in order, the same way
      // relayoutSection does when a layout changes on the canvas.
      section.columns[fieldIndex % section.columns.length].elements.push(el)
    })

    sections.push(section)
  })

  return { version: 1, sections, settings: emptyFormSettings() }
}

function resolveColumnLayout(raw: unknown, warnings: string[], sectionIndex: number): ColumnLayout {
  if (raw === undefined || raw === null) return '1'
  const asString = String(raw)
  if (asString in COLUMN_LAYOUTS) return asString as ColumnLayout
  const n = Number(raw)
  if (Number.isInteger(n) && n >= 1 && n <= 4) return String(n) as ColumnLayout
  warnings.push(`Section ${sectionIndex + 1}: unknown layout "${asString}" — used a single column instead.`)
  return '1'
}

/** Expand one compact-spec field into a real canvas element. Exported for
 *  heal-on-load (heal.ts), which funnels backend FieldDefs through the same
 *  expansion so healed canvases and spec-imported canvases are built by one
 *  code path. */
export function specFieldToElement(
  raw: FormSpecField,
  usedKeys: Set<string>,
  warnings: string[],
  where: string,
): FormElement | null {
  if (!raw || typeof raw !== 'object') {
    warnings.push(`${where}: not an object — skipped.`)
    return null
  }

  const component = resolveComponentType(raw.type)
  if (!component) {
    warnings.push(
      raw.type
        ? `${where}: unknown type "${raw.type}" — skipped. Accepted types: ${acceptedTypeNames().join(', ')}.`
        : `${where}: no "type" given — skipped.`,
    )
    return null
  }

  const label = firstString(raw.label, raw.key, raw.name) ?? COMPONENT_REGISTRY[component].label
  const explicitKey = firstString(raw.key, raw.name)
  const el = createElement(component)
  el.label = label
  el.key = uniqueKey(explicitKey ?? label, usedKeys, explicitKey !== undefined)

  if (typeof raw.description === 'string' && raw.description) el.description = raw.description
  if (typeof raw.placeholder === 'string') el.placeholder = raw.placeholder

  // Behavior
  if (raw.required === true) el.behavior.required = 'always'
  if (raw.hidden === true) el.behavior.visibility = 'hidden'
  if (raw.readOnly === true) el.behavior.readOnly = 'always'

  // Appearance
  if (raw.width) el.appearance.width = raw.width

  // Flags, each re-checked against what the component actually supports so a
  // spec can't set a flag the config panel would never have offered (the
  // projection re-checks these too — this just keeps the canvas honest).
  if (raw.unique === true && supportsUnique(component)) el.unique = true
  if (raw.index === true) el.index = true
  if ((raw.recordTitle === true || raw.is_record_title === true) && supportsRecordTitle(component)) el.isRecordTitle = true
  if (raw.searchable === true && supportsSearchable(component)) el.searchable = true

  // Validation
  if (typeof raw.min === 'number') el.validation.min = raw.min
  if (typeof raw.max === 'number') el.validation.max = raw.max
  if (typeof raw.minLength === 'number') el.validation.minLength = raw.minLength
  if (typeof raw.maxLength === 'number') el.validation.maxLength = raw.maxLength
  if (typeof raw.pattern === 'string' && raw.pattern) el.validation.pattern = raw.pattern

  // Default value
  const def = raw.defaultValue !== undefined ? raw.defaultValue : raw.default
  if (def !== undefined) el.defaultValue = def

  // Choice options
  if (Array.isArray(raw.options) && raw.options.length > 0) {
    el.options = raw.options.map(normalizeOption).filter((o): o is SelectOption => o !== null)
    if (el.options.length === 0) {
      warnings.push(`${where} ("${label}"): none of the options were usable — kept the defaults.`)
      el.options = createElement(component).options
    }
  } else if (CHOICE_COMPONENTS.has(component)) {
    warnings.push(`${where} ("${label}"): a ${component} with no "options" — placeholder options were used.`)
  }

  // Form reference target
  const formRef = firstString(raw.formRef, raw.reference)
  if (component === 'form') {
    if (formRef) {
      el.formRef = formRef
    } else {
      warnings.push(`${where} ("${label}"): a reference field with no "formRef" — pick its target form in the builder before saving.`)
    }
  }

  return el
}

function normalizeOption(raw: string | SelectOption): SelectOption | null {
  if (typeof raw === 'string') {
    const value = raw.trim()
    return value ? { label: value, value: slugifyKey(value) } : null
  }
  if (raw && typeof raw === 'object') {
    const label = typeof raw.label === 'string' ? raw.label : typeof raw.value === 'string' ? raw.value : ''
    const value = typeof raw.value === 'string' && raw.value ? raw.value : slugifyKey(label)
    return label ? { label, value } : null
  }
  return null
}

/** Slugifies (when needed) and de-duplicates a field key across the form.
 *
 *  An EXPLICIT key that already looks like a valid identifier is kept
 *  verbatim, so a spec round-tripped through export doesn't have its keys
 *  rewritten — renaming a key silently re-points the field at a new physical
 *  column, which is exactly what a round trip must never do.
 *
 *  A key DERIVED from a label is always slugified, even when the label
 *  happens to be identifier-shaped: "Status" is a valid identifier but must
 *  still become `status`, or two specs differing only in the label's casing
 *  would produce two different columns. */
function uniqueKey(preferred: string, used: Set<string>, explicit: boolean): string {
  let key = explicit && /^[a-zA-Z_]\w*$/.test(preferred) ? preferred : slugifyKey(preferred)
  if (RESERVED_FIELD_KEYS.has(key)) key = `${key}_field`
  if (used.has(key)) {
    let i = 2
    while (used.has(`${key}_${i}`)) i++
    key = `${key}_${i}`
  }
  used.add(key)
  return key
}

// ---------------------------------------------------------------------------
// Physical identity
// ---------------------------------------------------------------------------

/** Threads each element's immutable physical `column` from the form's
 *  current schema onto the incoming one, matched by key.
 *
 *  This is what makes "edit an existing form as JSON" non-destructive: a
 *  field the spec left alone keeps pointing at the Postgres column that
 *  already holds its data. A field whose key changed (or is new) has no
 *  match, stays column-less, and the backend assigns it a fresh column on
 *  save — the same thing that happens when you rename a key on the canvas. */
export function carryColumnsForward(next: FormSchema, current: FormSchema, warnings: string[]): void {
  const columnByKey = new Map<string, string>()
  for (const el of allElements(current)) {
    if (el.column) columnByKey.set(el.key, el.column)
  }
  if (columnByKey.size === 0) return

  let matched = 0
  for (const el of allElements(next)) {
    const column = columnByKey.get(el.key)
    if (column) {
      el.column = column
      matched++
    }
  }

  const dropped = columnByKey.size - matched
  if (dropped > 0) {
    warnings.push(
      `${dropped} existing field${dropped === 1 ? '' : 's'} ${dropped === 1 ? 'is' : 'are'} missing from this spec — ` +
      `saving will drop ${dropped === 1 ? 'its column' : 'their columns'} and the data in ${dropped === 1 ? 'it' : 'them'}.`,
    )
  }
}

function* allElements(schema: FormSchema): Generator<FormElement> {
  for (const section of schema.sections ?? []) {
    for (const column of section.columns ?? []) {
      for (const el of column.elements ?? []) yield el
    }
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** Emits the NATIVE (lossless) spec for a form — every element, every rule,
 *  exactly as stored. Round-trips through parseFormSpec unchanged. */
export function toNativeSpec(state: BuilderFormState): NativeFormSpec {
  return {
    name: state.name,
    slug: state.slug,
    description: state.description || undefined,
    layout: state.schema,
  }
}

/** Emits the COMPACT spec for a form — readable, editable, and lossy by
 *  design: only what the compact shape can express survives. Expression
 *  rules, advanced settings, bindings and Line Items configuration are all
 *  dropped, which is why the JSON dialog warns before you apply a compact
 *  edit back onto a form that has any of them. */
export function toCompactSpec(state: BuilderFormState): CompactFormSpec {
  return {
    name: state.name,
    slug: state.slug,
    description: state.description || undefined,
    sections: state.schema.sections.map((section) => ({
      title: section.title,
      description: section.description || undefined,
      layout: section.layout,
      // Document order, flattened back out of the section's columns — the
      // same order the projection walks, and the order the fields will be
      // dealt back into columns if this spec is re-imported.
      fields: section.columns.flatMap((c) => c.elements).map(elementToSpecField),
    })),
  }
}

function elementToSpecField(el: FormElement): FormSpecField {
  const out: FormSpecField = {
    key: el.key,
    label: el.label,
    type: el.component,
  }
  if (el.behavior.required === 'always') out.required = true
  if (el.behavior.visibility === 'hidden') out.hidden = true
  if (el.behavior.readOnly === 'always') out.readOnly = true
  if (el.unique) out.unique = true
  if (el.index) out.index = true
  if (el.isRecordTitle) out.recordTitle = true
  if (el.searchable) out.searchable = true
  if (el.description) out.description = el.description
  if (el.placeholder) out.placeholder = el.placeholder
  if (el.defaultValue !== undefined && el.defaultValue !== '') out.default = el.defaultValue
  if (el.appearance.width && el.appearance.width !== 'full') out.width = el.appearance.width
  if (el.options && el.options.length > 0) out.options = el.options
  if (el.formRef) out.formRef = el.formRef
  if (el.validation.min !== undefined) out.min = el.validation.min
  if (el.validation.max !== undefined) out.max = el.validation.max
  if (el.validation.minLength !== undefined) out.minLength = el.validation.minLength
  if (el.validation.maxLength !== undefined) out.maxLength = el.validation.maxLength
  if (el.validation.pattern) out.pattern = el.validation.pattern
  return out
}

/** Names the things a compact export would silently drop, so the JSON dialog
 *  can say so before an author edits in compact mode and applies it back. */
export function compactLossReport(schema: FormSchema): string[] {
  const lost = new Set<string>()
  for (const el of allElements(schema)) {
    if (el.behavior.visibility === 'expression' || el.behavior.required === 'expression' || el.behavior.readOnly === 'expression') {
      lost.add('conditional (expression-driven) visibility, required and read-only rules')
    }
    if (el.behavior.dynamicDefault) lost.add('expression-driven default values')
    if (el.advancedSettings && el.advancedSettings.length > 0) lost.add('Advanced Settings rules')
    if (el.binding && el.binding.source !== 'none') lost.add('field bindings')
    if (el.component === 'line_items') lost.add('Line Items grid configuration')
    if (el.component === 'line_item_count') lost.add('Line Item Count configuration')
  }
  return [...lost]
}

// Local id generator for the one place adoptNativeLayout has to synthesise a
// column — deliberately not importing nanoid for a single repair path.
function freshId(): string {
  return `col_${Math.random().toString(36).slice(2, 10)}`
}

function firstString(...candidates: unknown[]): string | undefined {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return undefined
}
