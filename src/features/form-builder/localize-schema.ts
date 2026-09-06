import type { FormSchema, FormSection, FormElement, SelectOption, DetailTabConfig, CustomActionConfig } from './schema'

// Runtime-only content translation for a form's own authored text (label,
// placeholder, help text, choice-option labels, custom validation message,
// section titles/descriptions).
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

// Sections have no "editable machine name" the way FormElement.key is —
// only `id` — so their key uses the section's own id directly. Collision
// with a nested Line Items grid's own sections is not a concern: section
// ids are generated independently of nesting depth (unlike element keys,
// which a designer could plausibly reuse across a parent form and one of
// its generated grids), so `formId` + `section.id` alone is unique.
function sectionKeyPrefix(formId: string, sectionId: string): string {
  return `form.${formId}.section.${sectionId}`
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
  return sections.map((section) => {
    const sectionPrefix = sectionKeyPrefix(formId, section.id)
    return {
      ...section,
      title: section.title ? tc(`${sectionPrefix}.title`, section.title) : section.title,
      description: section.description ? tc(`${sectionPrefix}.description`, section.description) : section.description,
      columns: section.columns.map((column) => ({
        ...column,
        elements: column.elements.map((el) => localizeElement(el, formId, [...parentPath, el.key], tc)),
      })),
    }
  })
}

// A detail tab's `id` is only documented unique within whichever single
// array it lives in (top-level detailTabs, or one 'group'/'details' tab's
// own nested tabs/childTabs) — not globally across the whole nested tree,
// since two unrelated groups could each legally contain a child id
// "comments". The full ancestor id-path is the key, not the bare leaf id,
// for the identical collision reason localizeElement's fieldKeyPrefix
// already joins a full ancestor `path` for a nested Line Items grid's own
// columns rather than just the leaf FormElement.key.
function detailTabKeyPrefix(formId: string, idPath: string[]): string {
  return `form.${formId}.detail_tab.${idPath.join('.')}`
}

// A tab's nested children live inside its own opaque, type-owned `config`
// (parsed only by that type's own DetailTabDefinition.parseConfig) — but
// the two nesting shapes that exist today ('group'.config.tabs and the
// built-in 'details'.config.childTabs) both hold a plain DetailTabConfig[],
// so this recurses by duck-typing those two property names directly rather
// than importing the runtime detail-tabs registry into this lower-level,
// registry-agnostic file.
function localizeDetailTabs(
  tabs: DetailTabConfig[] | undefined,
  formId: string,
  parentPath: string[],
  tc: Resolver,
): DetailTabConfig[] | undefined {
  if (!tabs?.length) return tabs
  return tabs.map((t) => {
    const path = [...parentPath, t.id]
    const next: DetailTabConfig = t.label ? { ...t, label: tc(`${detailTabKeyPrefix(formId, path)}.label`, t.label) } : t
    const config = next.config as { tabs?: DetailTabConfig[]; childTabs?: DetailTabConfig[] } | undefined
    if (Array.isArray(config?.tabs)) {
      return { ...next, config: { ...config, tabs: localizeDetailTabs(config.tabs, formId, path, tc) } }
    }
    if (Array.isArray(config?.childTabs)) {
      return { ...next, config: { ...config, childTabs: localizeDetailTabs(config.childTabs, formId, path, tc) } }
    }
    return next
  })
}

// Unlike DetailTabConfig.id, a CustomActionConfig.id is a nanoid generated
// once at creation and never re-derived from array position — safe to use
// bare, no ancestor path needed (custom actions don't nest).
function actionKeyPrefix(formId: string, actionId: string): string {
  return `form.${formId}.action.${actionId}`
}

function localizeCustomActions(actions: CustomActionConfig[] | undefined, formId: string, tc: Resolver): CustomActionConfig[] | undefined {
  if (!actions?.length) return actions
  return actions.map((a) => (a.label ? { ...a, label: tc(`${actionKeyPrefix(formId, a.id)}.label`, a.label) } : a))
}

/** Apply this app's per-field translation overrides (design-app Localization
 *  tab) to a schema already produced by resolveFormSchema(). `formId` scopes
 *  the generated keys so the same field key on two different forms never
 *  collides. Call this at every RUNTIME render site, never at design/editing
 *  time — see this file's own doc comment.
 *
 *  Also covers the record-detail page's own settings-level content — detail
 *  tab labels (FormSettings.detailTabs, recursing into 'group'/'details'
 *  nesting) and custom action labels (FormSettings.customActions) — so every
 *  existing call site picks these up for free, the same way adding section/
 *  field coverage here needed no changes at any render site. A detail tab's
 *  REGISTRY-DEFAULT label (shown when no instance override is set) is a
 *  separate, fixed platform string keyed by tab type, not per-app content —
 *  DetailTabList.tsx localizes that half directly via t(), since resolving
 *  it needs the runtime detail-tabs registry this schema-only file doesn't
 *  import. */
export function localizeFormSchema(schema: FormSchema, formId: string, tc: Resolver): FormSchema {
  const sections = localizeSections(schema.sections, formId, [], tc)
  if (!schema.settings) return { ...schema, sections }
  return {
    ...schema,
    sections,
    settings: {
      ...schema.settings,
      detailTabs: localizeDetailTabs(schema.settings.detailTabs, formId, [], tc),
      customActions: localizeCustomActions(schema.settings.customActions, formId, tc),
    },
  }
}

// The form's own NAME isn't part of FormSchema at all (FormSchema is just
// {version, sections, variables, settings} — see schema.ts) even though it's
// authored alongside everything else in the same form-builder page. It lives
// on FormDefinition instead, so it gets its own tiny standalone resolver
// rather than being folded into localizeFormSchema's tree walk — callers
// call this ALONGSIDE localizeFormSchema, not through it, and keep their own
// null-form fallback text ('New Record'/'Record'/etc) around the result.
export function localizeFormName(formId: string, name: string, tc: Resolver): string {
  return tc(`form.${formId}.name`, name)
}

// ---------------------------------------------------------------------------
// Design-app enumeration (LocalizationSection.tsx)
// ---------------------------------------------------------------------------

export type FieldContentKind =
  | 'label' | 'placeholder' | 'help_text' | 'content' | 'option' | 'validation_message'
  | 'section_title' | 'section_description' | 'form_name'

export const FIELD_CONTENT_KIND_LABELS: Record<FieldContentKind, string> = {
  label: 'Label',
  placeholder: 'Placeholder',
  help_text: 'Help text',
  content: 'Text',
  option: 'Option',
  validation_message: 'Validation message',
  section_title: 'Section title',
  section_description: 'Section description',
  form_name: 'Form name',
}

export interface CollectedField {
  key: string
  /** `key` minus its trailing `.label`/`.placeholder`/`.title`/etc segment —
   *  every row belonging to the same form element OR section shares one
   *  fieldPath, so the design app can group them under one heading. */
  fieldPath: string
  kind: FieldContentKind
  /** Set only when kind === 'option' — the choice's stored value. */
  optionValue?: string
  /** The value this key currently falls back to (the field's own authored
   *  text) — shown as the reference/placeholder column, never edited here. */
  defaultValue: string
}

const OPTION_KEY = /^(.*)\.option\.([^.]*)$/
// Order matters only where one suffix is a substring of another — none of
// these are today, but '.description' is listed after every field-level
// suffix so a future field-level property ending the same way still
// wouldn't get misclassified as a section description.
const SUFFIX_KINDS: [string, FieldContentKind][] = [
  ['.help_text', 'help_text'],
  ['.placeholder', 'placeholder'],
  ['.validation_message', 'validation_message'],
  ['.label', 'label'],
  ['.content', 'content'],
  ['.title', 'section_title'],
  ['.description', 'section_description'],
  // Bare "form.<id>.name" — no ".field."/".section." in between — so this
  // never matches any field/section key, all of which have one of the
  // suffixes above between the form id and their own trailing segment.
  ['.name', 'form_name'],
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

/** Enumerates every translatable key/default-value pair a form currently
 *  contains — its own name, plus everything in its schema — for the
 *  design-app Localization tab. Reuses localizeFormSchema's own traversal by
 *  running it with a RECORDING resolver instead of a real one, rather than a
 *  hand-duplicated walk — the exact same code path that produces the
 *  runtime lookup keys, so this list can never drift out of sync with what
 *  actually gets resolved at render time. The recording resolver returns
 *  `fallback` unchanged, so localizeFormSchema's own return value here is
 *  just the original schema and can be discarded. The form-name entry is
 *  pushed first (localizeFormName isn't part of that traversal — see its
 *  own doc comment), so it's the first row the design-app table shows. */
export function collectTranslatableFields(schema: FormSchema, formId: string, formName: string): CollectedField[] {
  const raw: { key: string; defaultValue: string }[] = [{ key: `form.${formId}.name`, defaultValue: formName }]
  localizeFormSchema(schema, formId, (key, fallback) => {
    raw.push({ key, defaultValue: fallback })
    return fallback
  })
  return raw.map(({ key, defaultValue }) => ({ key, defaultValue, ...classifyKey(key) }))
}
