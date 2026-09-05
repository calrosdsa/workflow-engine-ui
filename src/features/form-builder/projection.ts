// Projects the rich builder schema down to the backend's flat FieldDef[] used
// for SQL table generation. Only data-bearing components become columns;
// presentational components (heading/paragraph/divider/spacer) are skipped.
//
// This is the bridge that keeps the existing backend (column-per-field DDL)
// working while the builder owns a much richer schema in the `layout` column.

import type { FormSchema, FormElement } from './schema'
import { COMPONENT_REGISTRY, supportsUnique, supportsRecordTitle, supportsSearchable } from './component-registry'
import { slugifyKey, RESERVED_FIELD_KEYS } from './factory'
import { canonicalReferenceFilter } from './reference-filter'
import { elementHideRules } from './field-hide'
import { elementReadOnlyRules } from './field-readonly'
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

/** The wire field name this element WOULD project to, or null when it
 *  wouldn't project at all — not data-bearing, or still unconfigured (a
 *  reference with no target form picked, etc.), which projection skips so a
 *  work-in-progress canvas can still save. This is the PRE-deduplication
 *  name; elementToField below layers the collision suffixing on top.
 *
 *  Exported for heal-on-load (heal.ts), whose orphan rule is exactly "would
 *  this element project to a field the backend no longer has?" — sharing the
 *  guards here is what keeps healing and projection agreeing on what counts
 *  as data-bearing. */
export function projectedBaseName(el: FormElement): string | null {
  // A 'line_items' element is data-bearing ONLY in adopted mode ('existing')
  // — it becomes a TypeLineItemAdopted virtual field marking the association
  // on the PARENT's own field list (see schema.ts's sourceMode doc comment).
  // In generated mode (the original, only-ever-existed behavior) it stays
  // non-data-bearing — COMPONENT_REGISTRY's static dataBearing:false for
  // 'line_items' covers that case; this is the one place that overrides it.
  const isAdoptedLineItems = el.component === 'line_items' && el.sourceMode === 'existing'

  // Unknown component (layout written by a newer frontend, or by hand):
  // treat as non-bearing rather than crash — never dropped, never counted.
  const reg = COMPONENT_REGISTRY[el.component]
  if (!reg) return null
  if (!isAdoptedLineItems && (!reg.dataBearing || !reg.fieldType)) return null

  // An unconfigured form reference (no form selected) can't become a valid
  // reference column — the backend requires reference_table. Skip it so the save
  // isn't rejected; the builder's validation surfaces it to the user instead.
  if (el.component === 'form' && !el.formRef) return null

  // Same guard for an unconfigured Line Item Count (no target grid picked
  // yet) — the backend requires reference_table for type line_item_count too.
  if (el.component === 'line_item_count' && !el.formRef) return null

  // Same guard for an unconfigured adopted Line Items grid (no form or
  // reference field picked yet).
  if (isAdoptedLineItems && (!el.adoptedFormRef || !el.adoptedReferenceField)) return null

  // The editable `key` becomes the wire `name`. It is NOT the physical
  // column (which the backend owns and never changes).
  let name = el.key && /^[a-zA-Z_]\w*$/.test(el.key) ? el.key : slugifyKey(el.label)
  // A key can reach here already looking like a valid identifier (e.g. loaded
  // from older data saved before slugifyKey rejected reserved words) — guard
  // again here since this is the actual point where `name` becomes the wire
  // field key that collides with the backend's hardcoded id/created_at/
  // updated_at columns (see RESERVED_FIELD_KEYS's doc comment).
  if (RESERVED_FIELD_KEYS.has(name)) name = `${name}_field`
  return name
}

/** Maps a single element to a backend FieldDef, or null if it isn't data-bearing. */
function elementToField(el: FormElement, usedNames: Set<string>): FieldDef | null {
  const isAdoptedLineItems = el.component === 'line_items' && el.sourceMode === 'existing'
  const reg = COMPONENT_REGISTRY[el.component]

  const baseName = projectedBaseName(el)
  if (baseName === null) return null

  // Deduplicate: the key is the record's wire field name, and two elements
  // sharing one would collide the moment records were written.
  let name = baseName
  if (usedNames.has(name)) {
    let i = 2
    while (usedNames.has(`${name}_${i}`)) i++
    name = `${name}_${i}`
  }
  usedNames.add(name)

  const field: FieldDef = {
    name,
    label: el.label || name,
    type: isAdoptedLineItems ? 'line_item_adopted' : reg.fieldType!,
    required: el.behavior.required === 'always',
  }

  // Carry the immutable physical column through so a re-save preserves identity.
  // New elements have no column yet — the backend assigns one on first save.
  if (el.column) field.column = el.column

  // UNIQUE constraint — string/number-typed fields that opted in via the
  // config panel's toggle, plus 'form' reference fields, whose `unique` is
  // set programmatically (not via that toggle) to model a one-to-one
  // dependent-form relationship: at most one child record per parent.
  if (el.unique && (supportsUnique(el.component) || el.component === 'form')) field.unique = true

  // Btree index — no component-type restriction, unlike unique/searchable,
  // mirroring FieldDef.Index's own lack of a type gate on the backend.
  if (el.index) field.index = true

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

  // Line Item Count: formRef holds the target Line Items grid's childFormId —
  // the backend resolves it to that child form to count rows against.
  if (el.component === 'line_item_count' && el.formRef) {
    field.reference_table = el.formRef
  }

  // Line Item Count: which aggregate to compute (undefined/'count' is the
  // original count-only behavior) and, for sum/avg/min/max, which numeric
  // column on the target grid to aggregate.
  if (el.component === 'line_item_count' && el.aggregateFn && el.aggregateFn !== 'count') {
    field.aggregate_fn = el.aggregateFn
    if (el.aggregateField) field.aggregate_field = el.aggregateField
  }

  // Adopted Line Items: which existing form this grid targets, and which
  // field on that form points back at this parent.
  if (isAdoptedLineItems) {
    field.reference_table = el.adoptedFormRef
    field.adopted_reference_field = el.adoptedReferenceField
  }

  // Optional: which field of the referenced form to display/search instead
  // of the runtime's name/label/id fallback heuristic.
  if (el.component === 'form' && el.displayField) {
    field.display_field = el.displayField
  }

  // Viewer-scoped option filter — emitted in the backend's canonical, id-free
  // form (see reference-filter.ts) so the stored value equals what the API
  // echoes back. An empty filter projects to NO reference_filter at all:
  // omitting the key on a full-replace save is how the builder clears one.
  if (el.component === 'form' && el.referenceFilter) {
    const rf = canonicalReferenceFilter(el.referenceFilter)
    if (rf) field.reference_filter = rf
  }

  // Server-enforced audience-hide — every 'hidden_in_ui' Advanced Setting
  // action on this element, regardless of field type (unlike reference_filter,
  // this isn't reference-only). An empty result omits the key entirely: a
  // full-replace save is how the builder clears a field's hide rules.
  const hideRules = elementHideRules(el.advancedSettings)
  if (hideRules) field.hide_rules = hideRules

  // Server-enforced write-protection (SEC-1) — every 'read_only' Advanced
  // Setting action on this element, same projection shape as hide_rules.
  const readOnlyRules = elementReadOnlyRules(el.advancedSettings)
  if (readOnlyRules) field.read_only_rules = readOnlyRules

  // Marks this field as part of the record's title (see FieldDef.is_record_title's
  // doc comment). Re-checked against supportsRecordTitle here (not just trusted
  // from the config panel's own gating) so a field that was flagged before its
  // component type changed can't silently project a stale, no-longer-valid flag.
  if (el.isRecordTitle && supportsRecordTitle(el.component)) {
    field.is_record_title = true
  }

  // Marks this field as part of the form's full-text search index (see
  // FieldDef.searchable's doc comment). Re-checked against supportsSearchable
  // for the same reason as is_record_title above.
  if (el.searchable && supportsSearchable(el.component)) {
    field.searchable = true
  }

  // File/Image Upload's size/type rule (FR-C1-012) — unlike minLength/
  // maxLength/pattern (frontend-Zod-only, never projected to FieldDef at
  // all), these two ARE backend-enforced (api/content's Upload handler is
  // the real gate, before any bytes are stored), so they must reach the
  // saved FieldDef or the backend has nothing to look up.
  if (reg.fieldType === 'file') {
    if (el.validation.maxFileSizeBytes !== undefined) field.max_file_size_bytes = el.validation.maxFileSizeBytes
    if (el.validation.allowedMimeTypes && el.validation.allowedMimeTypes.length > 0) field.allowed_mime_types = el.validation.allowedMimeTypes
  }

  // Field default — only emit for primitive static defaults the backend
  // accepts for this field type.
  const def = staticDefaultValue(el)
  if (def !== undefined) field.default = def

  return field
}

/** Returns an element's static default as a typed value, or undefined.
 *
 *  This is a plain JSON value — a boolean, a number, a string — NOT a SQL
 *  literal. It used to be quoted and escaped here, which made this function
 *  the only thing standing between a field definition and arbitrary DDL;
 *  every other client of the API (and the MCP server) wrote straight through
 *  it. The backend now binds the default as a query argument and applies it
 *  at insert time, so quoting here would store the quotes.
 *
 *  Exported for heal-on-load (heal.ts), which needs to know what an element
 *  would CURRENTLY project to in order to detect drift against the backend's
 *  stored FieldDef.default — the same "would this element project to X"
 *  question projectedBaseName answers for orphan detection above. */
export function staticDefaultValue(el: FormElement): string | number | boolean | undefined {
  const reg = COMPONENT_REGISTRY[el.component]
  if (el.defaultValue === undefined || el.defaultValue === null || el.defaultValue === '') return undefined
  // Don't emit defaults for expression-driven values.
  if (el.behavior.dynamicDefault) return undefined

  switch (reg.fieldType) {
    case 'boolean':
      return Boolean(el.defaultValue)
    case 'integer':
    case 'decimal': {
      const n = Number(el.defaultValue)
      return Number.isFinite(n) ? n : undefined
    }
    case 'string':
    case 'text':
    case 'email':
    case 'phone':
      return String(el.defaultValue)
    case 'enum': {
      // Only emit a default that's still one of this element's own options —
      // a stale default left over from a removed/renamed option would
      // otherwise project a value the enum's own enum_values don't contain.
      const value = String(el.defaultValue)
      return el.options?.some((o) => o.value === value) ? value : undefined
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

/** What a form is missing to satisfy the Record Title / Searchable rule. */
export interface TitleSearchIssue {
  kind: 'record_title' | 'searchable'
  /** Elements that COULD carry the missing flag, in document order — the
   *  candidates the builder offers as a one-click fix. Never empty: an issue
   *  is only reported when at least one eligible element exists. */
  candidates: { key: string; label: string }[]
}

/** Checks that the form names at least one Record Title field and at least
 *  one Searchable field — the frontend half of the rule FormDef.Validate
 *  enforces server-side (internal/forms/field/form.go).
 *
 *  Mirrors that function's two exemptions exactly, so the builder never
 *  blocks a save the API would have accepted, or vice versa:
 *
 *    - `isLineItems` forms are skipped entirely (a child grid has no
 *      standalone page, detail view or search surface).
 *    - A flag with no ELIGIBLE element is skipped, including on a form with
 *      no fields at all — requiring a flag nothing could carry would make
 *      the form permanently unsaveable.
 *
 *  Eligibility is re-derived from the component registry rather than trusted
 *  from the element, matching how projectToFields re-checks both flags
 *  before emitting them. */
export function validateTitleAndSearch(schema: FormSchema, isLineItems = false): TitleSearchIssue[] {
  if (isLineItems) return []

  const titleCandidates: { key: string; label: string }[] = []
  const searchCandidates: { key: string; label: string }[] = []
  let hasTitle = false
  let hasSearch = false

  for (const el of iterElements(schema)) {
    const named = { key: el.key, label: el.label || el.key }
    if (supportsRecordTitle(el.component)) {
      titleCandidates.push(named)
      if (el.isRecordTitle) hasTitle = true
    }
    if (supportsSearchable(el.component)) {
      searchCandidates.push(named)
      if (el.searchable) hasSearch = true
    }
  }

  const issues: TitleSearchIssue[] = []
  if (titleCandidates.length > 0 && !hasTitle) {
    issues.push({ kind: 'record_title', candidates: titleCandidates })
  }
  if (searchCandidates.length > 0 && !hasSearch) {
    issues.push({ kind: 'searchable', candidates: searchCandidates })
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
