import { create } from 'zustand'

// A generic Zustand store for the "Section[] -> Column[] -> Item[]" shape
// shared by form-builder and page-builder. Adapters keep their own field
// names (FormColumn.elements vs PageColumn.components, FormSection.layout's
// ColumnLayout vs any future layout type) — this module never assumes a
// field name or a concrete "kind"/"layout" type, it only needs accessors and
// a handful of factory functions supplied by the adapter.
//
// A location address within the schema (which column an item lives in).
export interface ItemLocation {
  sectionId: string
  columnId: string
  index: number
}

interface HasId {
  id: string
}

interface ColumnLike {
  id: string
}

interface SectionLike<Column extends ColumnLike> {
  id: string
  columns: Column[]
  collapsed?: boolean
}

interface SchemaLike<Section extends SectionLike<ColumnLike>> {
  sections: Section[]
}

/** Accessors telling the core how to reach/replace a column's item array,
 *  without assuming a field name. */
export interface ItemAccessors<Column extends ColumnLike, Item extends HasId> {
  getItems: (column: Column) => Item[]
  setItems: (column: Column, items: Item[]) => Column
}

export function findItem<
  Schema extends SchemaLike<Section>,
  Section extends SectionLike<Column>,
  Column extends ColumnLike,
  Item extends HasId,
>(
  schema: Schema,
  id: string,
  accessors: ItemAccessors<Column, Item>,
): { item: Item; loc: ItemLocation } | null {
  for (const section of schema.sections) {
    for (const column of section.columns) {
      const items = accessors.getItems(column)
      const index = items.findIndex((it) => it.id === id)
      if (index !== -1) {
        return { item: items[index], loc: { sectionId: section.id, columnId: column.id, index } }
      }
    }
  }
  return null
}

/** Returns a new schema with `mut` applied to a copy. Sections/columns/items
 *  are shallow-rebuilt along the touched path; React-friendly immutability
 *  (structuredClone + mutate, not the real Immer library). */
export function produce<Schema>(schema: Schema, mut: (draft: Schema) => void): Schema {
  const draft: Schema = structuredClone(schema)
  mut(draft)
  return draft
}

/** Looks up a column by section+column id and replaces its item array via
 *  `setItems`, mutating `sections` in place. No-ops if either id is stale. */
function withColumnItems<
  Section extends SectionLike<Column>,
  Column extends ColumnLike,
  Item extends HasId,
>(
  sections: Section[],
  loc: { sectionId: string; columnId: string },
  accessors: ItemAccessors<Column, Item>,
  mut: (items: Item[]) => Item[],
): void {
  const section = sections.find((s) => s.id === loc.sectionId)
  const column = section?.columns.find((c) => c.id === loc.columnId)
  if (!section || !column) return
  const idx = section.columns.indexOf(column)
  section.columns[idx] = accessors.setItems(column, mut(accessors.getItems(column)))
}

export interface TreeStoreConfig<
  Schema extends SchemaLike<Section>,
  Section extends SectionLike<Column>,
  Column extends ColumnLike,
  Item extends HasId,
  Kind,
  Layout,
> {
  emptySchema: () => Schema
  createSection: (title?: string) => Section
  duplicateSection: (section: Section) => Section
  relayoutSection: (section: Section, layout: Layout) => Section
  createItem: (kind: Kind) => Item
  duplicateItem: (item: Item) => Item
  accessors: ItemAccessors<Column, Item>
  /** Invoked after every mutation, before it's committed to the store.
   *  Adapters that need a side effect alongside a schema change (e.g.
   *  form-builder's isDirty flag) hook in here — this is the single
   *  chokepoint every mutation passes through, so a future concern (undo/
   *  redo history, autosave) has one seam to wrap instead of N actions. */
  onMutate?: () => Record<string, unknown> | void
}

export interface TreeStoreState<
  Schema extends SchemaLike<Section>,
  Section extends SectionLike<ColumnLike>,
  Item extends HasId,
  Kind,
  Layout,
> {
  schema: Schema
  selectedItemId: string | null
  selectedSectionId: string | null

  loadSchema: (schema: Schema) => void
  reset: () => void

  selectItem: (id: string | null) => void
  selectSection: (id: string | null) => void

  addSection: () => void
  updateSection: (id: string, patch: Partial<Omit<Section, 'columns'>>) => void
  setSectionLayout: (id: string, layout: Layout) => void
  duplicateSectionById: (id: string) => void
  deleteSection: (id: string) => void
  moveSection: (fromIndex: number, toIndex: number) => void
  toggleSectionCollapsed: (id: string) => void

  addItem: (kind: Kind, sectionId: string, columnId: string, index?: number) => void
  updateItem: (id: string, patch: Partial<Item>) => void
  duplicateItemById: (id: string) => void
  deleteItem: (id: string) => void
  /** Moves an item to a target column at a target index (drag-and-drop). */
  moveItem: (itemId: string, target: { sectionId: string; columnId: string; index: number }) => void
}

/** Builds a Zustand store for a Section[] -> Column[] -> Item[] schema.
 *  `TreeStoreState` is deliberately NOT generic over an "Extra" metadata
 *  slot — an adapter that needs extra top-level state (e.g. form-builder's
 *  formId/name/slug/isDirty) composes a second, separate store alongside
 *  this one rather than growing this module's return shape. */
export function createTreeStore<
  Schema extends SchemaLike<Section>,
  Section extends SectionLike<Column>,
  Column extends ColumnLike,
  Item extends HasId,
  Kind,
  Layout,
>(config: TreeStoreConfig<Schema, Section, Column, Item, Kind, Layout>) {
  const { emptySchema, createSection, duplicateSection, relayoutSection, createItem, duplicateItem, accessors, onMutate } = config

  return create<TreeStoreState<Schema, Section, Item, Kind, Layout>>((set) => {
    /** The one place every content-mutating action funnels through: apply
     *  `mut` to a cloned schema, then run `onMutate` (see TreeStoreConfig). */
    const applyMutation = (mut: (draft: Schema) => void) =>
      set((s) => ({ schema: produce(s.schema, mut), ...(onMutate?.() ?? {}) }))

    return {
      schema: emptySchema(),
      selectedItemId: null,
      selectedSectionId: null,

      loadSchema: (schema) =>
        set({
          schema: schema.sections.length ? schema : emptySchema(),
          selectedItemId: null, selectedSectionId: null,
        }),

      reset: () => set({ schema: emptySchema(), selectedItemId: null, selectedSectionId: null }),

      selectItem: (id) => set({ selectedItemId: id, selectedSectionId: null }),
      selectSection: (id) => set({ selectedSectionId: id, selectedItemId: null }),

      addSection: () =>
        set((s) => {
          const section = createSection(`Section ${s.schema.sections.length + 1}`)
          return {
            schema: produce(s.schema, (d) => { d.sections.push(section) }),
            selectedSectionId: section.id,
            selectedItemId: null,
            ...(onMutate?.() ?? {}),
          }
        }),

      updateSection: (id, patch) =>
        applyMutation((d) => {
          const sec = d.sections.find((x) => x.id === id)
          if (sec) Object.assign(sec, patch)
        }),

      setSectionLayout: (id, layout) =>
        applyMutation((d) => {
          const idx = d.sections.findIndex((x) => x.id === id)
          if (idx !== -1) d.sections[idx] = relayoutSection(d.sections[idx], layout)
        }),

      duplicateSectionById: (id) =>
        set((s) => {
          const idx = s.schema.sections.findIndex((x) => x.id === id)
          if (idx === -1) return s
          const copy = duplicateSection(s.schema.sections[idx])
          return {
            schema: produce(s.schema, (d) => { d.sections.splice(idx + 1, 0, copy) }),
            selectedSectionId: copy.id,
            ...(onMutate?.() ?? {}),
          }
        }),

      deleteSection: (id) =>
        set((s) => ({
          schema: produce(s.schema, (d) => { d.sections = d.sections.filter((x) => x.id !== id) }),
          selectedSectionId: s.selectedSectionId === id ? null : s.selectedSectionId,
          ...(onMutate?.() ?? {}),
        })),

      moveSection: (fromIndex, toIndex) =>
        applyMutation((d) => {
          if (fromIndex < 0 || fromIndex >= d.sections.length) return
          const [moved] = d.sections.splice(fromIndex, 1)
          d.sections.splice(toIndex, 0, moved)
        }),

      toggleSectionCollapsed: (id) =>
        applyMutation((d) => {
          const sec = d.sections.find((x) => x.id === id)
          if (sec) sec.collapsed = !sec.collapsed
        }),

      addItem: (kind, sectionId, columnId, index) =>
        set((s) => {
          const item = createItem(kind)
          return {
            schema: produce(s.schema, (d) => {
              withColumnItems(d.sections, { sectionId, columnId }, accessors, (items) => {
                const next = items.slice()
                next.splice(index ?? items.length, 0, item)
                return next
              })
            }),
            selectedItemId: item.id,
            selectedSectionId: null,
            ...(onMutate?.() ?? {}),
          }
        }),

      updateItem: (id, patch) =>
        applyMutation((d) => {
          const found = findItem(d, id, accessors)
          if (found) {
            withColumnItems(d.sections, found.loc, accessors, (items) =>
              items.map((it, i) => (i === found.loc.index ? { ...it, ...patch } : it)))
          }
        }),

      duplicateItemById: (id) =>
        set((s) => {
          const found = findItem(s.schema, id, accessors)
          if (!found) return s
          const copy = duplicateItem(found.item)
          return {
            schema: produce(s.schema, (d) => {
              withColumnItems(d.sections, found.loc, accessors, (items) => {
                const next = items.slice()
                next.splice(found.loc.index + 1, 0, copy)
                return next
              })
            }),
            selectedItemId: copy.id,
            ...(onMutate?.() ?? {}),
          }
        }),

      deleteItem: (id) =>
        set((s) => ({
          schema: produce(s.schema, (d) => {
            const found = findItem(d, id, accessors)
            if (found) {
              withColumnItems(d.sections, found.loc, accessors, (items) =>
                items.filter((_, i) => i !== found.loc.index))
            }
          }),
          selectedItemId: s.selectedItemId === id ? null : s.selectedItemId,
          ...(onMutate?.() ?? {}),
        })),

      moveItem: (itemId, target) =>
        set((s) => ({
          schema: produce(s.schema, (d) => {
            const found = findItem(d, itemId, accessors)
            if (!found) return
            let moved: Item | undefined
            withColumnItems(d.sections, found.loc, accessors, (items) => {
              const next = items.slice()
              ;[moved] = next.splice(found.loc.index, 1)
              return next
            })
            if (!moved) return
            const tgtSection = d.sections.find((x) => x.id === target.sectionId)
            const tgtColumn = tgtSection?.columns.find((c) => c.id === target.columnId)
            if (!tgtColumn) {
              // Target vanished — put it back to avoid data loss.
              withColumnItems(d.sections, found.loc, accessors, (items) => {
                const next = items.slice()
                next.splice(found.loc.index, 0, moved as Item)
                return next
              })
              return
            }
            withColumnItems(d.sections, { sectionId: target.sectionId, columnId: target.columnId }, accessors, (items) => {
              const next = items.slice()
              const clamped = Math.max(0, Math.min(target.index, next.length))
              next.splice(clamped, 0, moved as Item)
              return next
            })
          }),
          ...(onMutate?.() ?? {}),
        })),
    }
  })
}
