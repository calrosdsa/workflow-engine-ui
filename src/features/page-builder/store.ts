import {
  type PageSchema, type PageComponent, type PageSection, type PageColumn,
  type PageComponentType, type ColumnLayout, emptyPageSchema,
} from './schema'
import { createComponent, createSection, duplicateComponent, duplicateSection, relayoutSection } from './factory'
import { createTreeStore, findItem, type ItemLocation } from '@/features/builder-kit/tree-store'

export type ComponentLocation = ItemLocation

// Sections -> columns -> components, built on the generic builder-kit core
// (see features/builder-kit/tree-store.ts). No form-level metadata and no
// onMutate hook — unlike form-builder, a page schema has no name/slug/
// isDirty of its own (CustomMenuConfigPanel owns hydrating/persisting
// `schema` from/to the enclosing Menu row).

const accessors = {
  getItems: (column: PageColumn) => column.components,
  setItems: (column: PageColumn, components: PageComponent[]) => ({ ...column, components }),
}

export const usePageBuilderStore = createTreeStore<PageSchema, PageSection, PageColumn, PageComponent, PageComponentType, ColumnLayout>({
  emptySchema: emptyPageSchema,
  createSection,
  duplicateSection,
  relayoutSection,
  createItem: createComponent,
  duplicateItem: duplicateComponent,
  accessors,
})

export function findComponent(schema: PageSchema, id: string) {
  return findItem(schema, id, accessors)
}
