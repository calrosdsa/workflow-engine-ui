import { nanoid } from 'nanoid'
import {
  type PageComponentType, type PageComponent, type PageSection, type PageColumn,
  type ColumnLayout, COLUMN_LAYOUTS,
} from './schema'
import { PAGE_COMPONENT_REGISTRY } from './component-registry'

// Direct mirror of features/form-builder/factory.ts, trimmed to this
// feature's presentational-only component set — same defaults-via-switch
// pattern, same structuredClone-based duplication with fresh nanoid ids, same
// relayoutSection round-robin redistribution guaranteeing no component is
// ever lost on a layout-preset change.

export function createComponent(component: PageComponentType): PageComponent {
  const reg = PAGE_COMPONENT_REGISTRY[component]
  const base: PageComponent = { id: nanoid(), component }

  switch (component) {
    case 'heading':
      base.text = 'Heading'
      base.level = 2
      break
    case 'paragraph':
      base.text = 'Paragraph text. Use this for descriptions or instructions.'
      break
    case 'image':
      base.alt = ''
      base.width = 'full'
      break
    case 'spacer':
      base.height = 24
      break
    case 'button':
      // reg.label, not a t() lookup: this seeds PageComponent.label, which
      // is persisted the moment this component is created — a button
      // created under the Spanish UI would otherwise be permanently
      // labeled "Botón/Enlace" and render that way for English viewers
      // too. Same exclusion class as menu-registry.ts's entry.label — see
      // component-registry.ts's own comment on this field.
      base.label = reg.label
      base.linkType = 'external'
      base.variant = 'primary'
      break
    case 'divider':
      break
  }
  return base
}

export function createColumns(layout: ColumnLayout): PageColumn[] {
  return COLUMN_LAYOUTS[layout].ratios.map((ratio) => ({
    id: nanoid(),
    ratio,
    components: [],
  }))
}

export function createSection(title = 'New Section', layout: ColumnLayout = '1'): PageSection {
  return {
    id: nanoid(),
    title,
    layout,
    columns: createColumns(layout),
    collapsed: false,
  }
}

/** Deep-clones a component with a fresh id. */
export function duplicateComponent(c: PageComponent): PageComponent {
  return { ...structuredClone(c), id: nanoid() }
}

/** Deep-clones a section with fresh ids throughout. */
export function duplicateSection(section: PageSection): PageSection {
  return {
    ...structuredClone(section),
    id: nanoid(),
    title: `${section.title} (copy)`,
    columns: section.columns.map((col) => ({
      ...structuredClone(col),
      id: nanoid(),
      components: col.components.map((c) => ({ ...structuredClone(c), id: nanoid() })),
    })),
  }
}

/** Re-distributes a section's components when its column layout changes.
 *  Existing components are preserved and re-flowed left-to-right into the new
 *  column set so no component is ever lost. */
export function relayoutSection(section: PageSection, layout: ColumnLayout): PageSection {
  const allComponents = section.columns.flatMap((c) => c.components)
  const newColumns = createColumns(layout)
  allComponents.forEach((c, i) => {
    newColumns[i % newColumns.length].components.push(c)
  })
  return { ...section, layout, columns: newColumns }
}
