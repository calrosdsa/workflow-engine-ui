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

/** Slugify a label into a safe machine key (letters/digits/underscores). */
export function slugifyKey(label: string): string {
  const s = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, '_$1') // can't start with a digit
  return s || 'field'
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

/** Deep-clones an element with fresh ids and a de-duplicated key. */
export function duplicateElement(el: FormElement): FormElement {
  return {
    ...structuredClone(el),
    id: nanoid(),
    key: `${el.key}_copy`,
    label: `${el.label} (copy)`,
  }
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
      elements: col.elements.map((el) => ({ ...structuredClone(el), id: nanoid() })),
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
