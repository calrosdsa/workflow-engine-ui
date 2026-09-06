import type { FormSchema, FormSection, FormElement, SelectOption } from './schema'

// Runtime-only content translation for a form's own authored text (label,
// placeholder, help text, choice-option labels, custom validation message).
// Deliberately separate from the form-builder's editing canvas: a designer
// editing the form must see and edit their OWN authored text, in whatever
// language they typed it — resolveFormSchema()/toBuilder() (serialize.ts)
// stay untouched. Every RUNTIME consumer of resolveFormSchema() (FormRenderer,
// RecordsTable, RecordDetailPanel, LineItemsGrid, enum-labels, ...) instead
// calls resolveFormSchema(form) THEN localizeFormSchema(...) on the result —
// one seam, so FieldRenderer/schema-to-zod/FormSectionShell/RecordsTable's
// column-header code all render already-resolved text and need no changes
// of their own.
//
// Keys are built from FormElement.key (the schema's own stable "editable
// machine name / data key", schema.ts's own doc comment on FormElement.key),
// NOT the backend FieldDef.Name — projection.ts derives FieldDef.Name from
// el.key only when el.key already looks like an identifier, falling back to
// a slugified label otherwise, so the two can diverge. Every reader of these
// keys (this file and LocalizationSection.tsx) works at the FormElement
// level exclusively, so that divergence never matters here.
//
// A `line_items` element ('generated' sourceMode) embeds its own row-editor
// columns directly (FormElement.lineItemColumns, same section/column/element
// shape as the main canvas, nesting to unlimited depth per schema.ts's own
// comment) — the key path threads through that element's own key so nested
// fields get distinct, stable keys instead of colliding with the parent's.
type Resolver = (key: string, fallback: string) => string

function fieldKeyPrefix(formId: string, path: string[]): string {
  return `form.${formId}.field.${path.join('.')}`
}

function localizeElement(el: FormElement, formId: string, path: string[], tc: Resolver): FormElement {
  const prefix = fieldKeyPrefix(formId, path)
  const next: FormElement = { ...el }

  if (el.label) next.label = tc(`${prefix}.label`, el.label)
  if (el.placeholder) next.placeholder = tc(`${prefix}.placeholder`, el.placeholder)
  if (el.helpText) next.helpText = tc(`${prefix}.help_text`, el.helpText)
  if (el.content) next.content = tc(`${prefix}.content`, el.content)

  if (el.options?.length) {
    next.options = el.options.map(
      (opt): SelectOption => (opt.label ? { ...opt, label: tc(`${prefix}.option.${opt.value}`, opt.label) } : opt),
    )
  }

  if (el.validation?.customMessage) {
    next.validation = { ...el.validation, customMessage: tc(`${prefix}.validation_message`, el.validation.customMessage) }
  }

  // Recurse into a generated-mode Line Items grid's own row-editor columns —
  // same shape as the top-level sections, so localizeSections handles it
  // directly; each nested element's path is prefixed by this element's own
  // key so e.g. a top-level "unit_price" and a nested-grid "unit_price"
  // never share a translation key.
  if (el.lineItemColumns?.length) {
    next.lineItemColumns = localizeSections(el.lineItemColumns, formId, path, tc)
  }

  return next
}

/** Exported for callers that only have a bare FormSection[] on hand — e.g.
 *  LineItemsGrid's adopted-mode sections, built by a helper that returns
 *  LineItemSection[] (= FormSection[]) rather than a whole FormSchema. */
export function localizeSections(sections: FormSection[], formId: string, parentPath: string[], tc: Resolver): FormSection[] {
  return sections.map((section) => ({
    ...section,
    columns: section.columns.map((column) => ({
      ...column,
      elements: column.elements.map((el) => localizeElement(el, formId, [...parentPath, el.key], tc)),
    })),
  }))
}

/** Apply this app's per-field translation overrides (design-app Localization
 *  tab) to a schema already produced by resolveFormSchema(). `formId` scopes
 *  the generated keys so the same field key on two different forms never
 *  collides. Call this at every RUNTIME render site, never at design/editing
 *  time — see this file's own doc comment. */
export function localizeFormSchema(schema: FormSchema, formId: string, tc: Resolver): FormSchema {
  return { ...schema, sections: localizeSections(schema.sections, formId, [], tc) }
}

// ---------------------------------------------------------------------------
// Design-app enumeration (LocalizationSection.tsx)
// ---------------------------------------------------------------------------

export type FieldContentKind = 'label' | 'placeholder' | 'help_text' | 'content' | 'option' | 'validation_message'

export const FIELD_CONTENT_KIND_LABELS: Record<FieldContentKind, string> = {
  label: 'Label',
  placeholder: 'Placeholder',
  help_text: 'Help text',
  content: 'Text',
  option: 'Option',
  validation_message: 'Validation message',
}

export interface CollectedField {
  key: string
  /** `key` minus its trailing `.label`/`.placeholder`/etc segment — every row
   *  belonging to the same form element shares one fieldPath, so the design
   *  app can group them under one heading. */
  fieldPath: string
  kind: FieldContentKind
  /** Set only when kind === 'option' — the choice's stored value. */
  optionValue?: string
  /** The value this key currently falls back to (the field's own authored
   *  text) — shown as the reference/placeholder column, never edited here. */
  defaultValue: string
}

const OPTION_KEY = /^(.*)\.option\.([^.]*)$/
const SUFFIX_KINDS: [string, FieldContentKind][] = [
  ['.help_text', 'help_text'],
  ['.placeholder', 'placeholder'],
  ['.validation_message', 'validation_message'],
  ['.label', 'label'],
  ['.content', 'content'],
]

function classifyKey(key: string): { fieldPath: string; kind: FieldContentKind; optionValue?: string } {
  const optionMatch = key.match(OPTION_KEY)
  if (optionMatch) return { fieldPath: optionMatch[1], kind: 'option', optionValue: optionMatch[2] }
  for (const [suffix, kind] of SUFFIX_KINDS) {
    if (key.endsWith(suffix)) return { fieldPath: key.slice(0, -suffix.length), kind }
  }
  // localizeElement only ever builds keys matching one of the suffixes
  // above (or the option pattern) — this is unreachable in practice, kept
  // only so the function has a total return type.
  return { fieldPath: key, kind: 'label' }
}

/** Enumerates every translatable key/default-value pair a form's schema
 *  currently contains, for the design-app Localization tab. Reuses
 *  localizeFormSchema's own traversal by running it with a RECORDING
 *  resolver instead of a real one, rather than a hand-duplicated walk — the
 *  exact same code path that produces the runtime lookup keys, so this list
 *  can never drift out of sync with what actually gets resolved at render
 *  time. The recording resolver returns `fallback` unchanged, so
 *  localizeFormSchema's own return value here is just the original schema
 *  and can be discarded. */
export function collectTranslatableFields(schema: FormSchema, formId: string): CollectedField[] {
  const raw: { key: string; defaultValue: string }[] = []
  localizeFormSchema(schema, formId, (key, fallback) => {
    raw.push({ key, defaultValue: fallback })
    return fallback
  })
  return raw.map(({ key, defaultValue }) => ({ key, defaultValue, ...classifyKey(key) }))
}
