import { nanoid } from 'nanoid'
import {
  type ComponentType, type FormElement, type FormSection, type FormColumn,
  type ColumnLayout, COLUMN_LAYOUTS, emptyLineItemsConfig,
} from './schema'
import { COMPONENT_REGISTRY } from './component-registry'

// Counter-free unique key generator scoped per build session. We derive a
// readable key from the label later; this is the fallback machine name.
function freshKey(component: ComponentType): string {
  return `${component}_${nanoid(6)}`
}

// Every generated table's fixed audit/identity columns (see the backend's
// selectCols) — a field key matching one of these would alias the field's
// own physical column to the same output name as the real column, silently
// overwriting the real id/timestamps in every record the API returns.
export const RESERVED_FIELD_KEYS = new Set(['id', 'created_at', 'updated_at'])

/** Slugify a label into a safe machine key (letters/digits/underscores). */
export function slugifyKey(label: string): string {
  const s = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, '_$1') // can't start with a digit
  const key = s || 'field'
  return RESERVED_FIELD_KEYS.has(key) ? `${key}_field` : key
}

export function createElement(component: ComponentType): FormElement {
  const reg = COMPONENT_REGISTRY[component]
  const base: FormElement = {
    id: nanoid(),
    component,
    label: reg.label,
    key: freshKey(component),
    validation: {},
    behavior: { visibility: 'always', required: 'optional', readOnly: 'editable' },
    appearance: { width: 'full' },
    binding: { source: 'none' },
  }

  // Component-specific defaults
  switch (component) {
    case 'text': case 'email': case 'url': case 'phone': case 'password':
      base.placeholder = `Enter ${reg.label.toLowerCase()}…`
      break
    case 'textarea':
      base.placeholder = 'Enter text…'
      break
    case 'number':
      base.placeholder = '0'
      break
    case 'select': case 'radio': case 'multiselect': case 'autocomplete':
      base.options = [
        { label: 'Option 1', value: 'option_1' },
        { label: 'Option 2', value: 'option_2' },
      ]
      base.placeholder = 'Select…'
      break
    case 'checkbox': case 'switch':
      base.defaultValue = false
      break
    case 'heading':
      base.content = 'Heading'
      base.level = 2
      break
    case 'paragraph':
      base.content = 'Paragraph text. Use this for instructions or descriptions.'
      break
    case 'spacer':
      base.height = 24
      break
    case 'hidden':
      base.label = 'Hidden Field'
      break
    case 'line_items':
      base.lineItemColumns = []
      base.lineItemConfig = emptyLineItemsConfig()
      break
  }
  return base
}

export function createColumns(layout: ColumnLayout): FormColumn[] {
  return COLUMN_LAYOUTS[layout].ratios.map((ratio) => ({
    id: nanoid(),
    ratio,
    elements: [],
  }))
}

export function createSection(title = 'New Section', layout: ColumnLayout = '1'): FormSection {
  return {
    id: nanoid(),
    title,
    layout,
    columns: createColumns(layout),
    collapsed: false,
  }
}

/** Deep-clones an element with fresh ids and a de-duplicated key.
 *
 *  `column` is the backend-assigned physical storage slot (schema.ts's
 *  `column?: string`) and must NOT be carried over: a duplicated field is a
 *  brand-new field, and echoing the original's column would alias the two
 *  fields onto the same underlying data on save (EnsureIdentity only fills
 *  columns that are empty, so the clone would otherwise keep the original's
 *  forever). Clearing it here lets EnsureIdentity mint a fresh one. */
function cloneElementAsNew(el: FormElement, overrides: Partial<FormElement> = {}): FormElement {
  return { ...structuredClone(el), id: nanoid(), column: undefined, ...overrides }
}

export function duplicateElement(el: FormElement): FormElement {
  return cloneElementAsNew(el, { key: `${el.key}_copy`, label: `${el.label} (copy)` })
}

/** Deep-clones a section with fresh ids throughout. */
export function duplicateSection(section: FormSection): FormSection {
  return {
    ...structuredClone(section),
    id: nanoid(),
    title: `${section.title} (copy)`,
    columns: section.columns.map((col) => ({
      ...structuredClone(col),
      id: nanoid(),
      elements: col.elements.map((el) => cloneElementAsNew(el)),
    })),
  }
}

/** Re-distributes a section's elements when its column layout changes.
 *  Existing elements are preserved and re-flowed left-to-right into the new
 *  column set so no field is ever lost. */
export function relayoutSection(section: FormSection, layout: ColumnLayout): FormSection {
  const allElements = section.columns.flatMap((c) => c.elements)
  const newColumns = createColumns(layout)
  allElements.forEach((el, i) => {
    newColumns[i % newColumns.length].elements.push(el)
  })
  return { ...section, layout, columns: newColumns }
}

/** Builds the "Form Reference" field pointing back at a dependent form's
 *  parent (e.g. Punch -> Employee). Used when a new form is created via "Add
 *  Dependent Form" so the child never starts out silently missing the link
 *  back to its parent record. Required by default since a dependent record
 *  without its parent rarely makes sense. Otherwise a real, ordinary
 *  reference element — what makes it a protected "parent link" specifically
 *  is FormMetaState.parentFormId matching this element's formRef (see
 *  isParentLinkElement below), not anything stored on the element itself. */
export function createParentReferenceField(parentFormId: string, parentName: string): FormElement {
  const base = createElement('form')
  return {
    ...base,
    label: parentName,
    key: slugifyKey(parentName),
    formRef: parentFormId,
    behavior: { ...base.behavior, required: 'always' },
  }
}

/** True when `el` is THE Form Reference field representing a dependent
 *  form's link back to its parent (as opposed to an ordinary reference field
 *  a user added by hand, even one that happens to also point at the same
 *  parent form). Guards against a real, previously-shipped bug: this field
 *  used to be a plain, fully-editable/deletable reference field with nothing
 *  marking it as structural — deleting it and saving would drop its backing
 *  column, silently wiping the reference value from every existing record,
 *  while the form's own parent_form_id was left dangling (pointing at a
 *  relationship the form no longer actually carries data for). Callers use
 *  this to hide/disable the delete action and lock "Referenced Form" for
 *  this specific element, without restricting ordinary reference fields at
 *  all (including ones a user manually re-points at the same parent form —
 *  only the ORIGINAL auto-injected field, matched by formRef, is guarded). */
export function isParentLinkElement(el: FormElement, parentFormId: string | undefined): boolean {
  return !!parentFormId && el.component === 'form' && el.formRef === parentFormId
}

/** Builds the "Account" section injected when the "Create user with each
 *  enrollment" setting is turned on — a real, fully-editable section with
 *  Name/Email/Role fields, indistinguishable from a manually-added one. The
 *  returned keys are stored on CreateUserSettings so the setting can find
 *  these specific fields later (e.g. at runtime, to resolve which submitted
 *  values become the created user's name/email/role). */
export function createAccountSection(): { section: FormSection; nameKey: string; emailKey: string; roleKey: string } {
  const name: FormElement = { ...createElement('text'), label: 'Name', key: 'account_name' }
  const email: FormElement = {
    ...createElement('email'),
    label: 'Email',
    key: 'account_email',
    behavior: { ...createElement('email').behavior, required: 'always' },
  }
  const role: FormElement = {
    ...createElement('role'),
    label: 'Role',
    key: 'account_role',
    behavior: { ...createElement('role').behavior, required: 'always' },
  }
  const section = createSection('Account', '1')
  section.columns[0].elements = [name, email, role]
  return { section, nameKey: name.key, emailKey: email.key, roleKey: role.key }
}
