import { create } from 'zustand'
import { produce as immerProduce } from 'immer'

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

/** Returns a new schema with `mut` applied to a draft, structurally sharing
 *  everything `mut` didn't touch (real Immer, not a hand-rolled
 *  structuredClone-the-whole-tree stand-in — that version gave every
 *  section/column/item a fresh object identity on EVERY mutation, anywhere
 *  in the tree, which made ElementCard/SectionCard/ColumnDropZone
 *  React.memo unable to ever skip a re-render: their props were never
 *  reference-equal across renders even when genuinely unchanged. Immer's
 *  draft-mutation contract is why every call site below can keep mutating
 *  the draft in place (.push/.splice/Object.assign/nested reassignment) —
 *  that's the whole point of a producer function, not a workaround. */
export function produce<Schema>(schema: Schema, mut: (draft: Schema) => void): Schema {
  return immerProduce(schema, (draft) => {
    mut(draft)
  })
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
   *  form-builder's isDirty flag) hook in here. Undo/redo history itself is
   *  handled by this module directly (see past/future/undo/redo below), not
   *  through this hook — every tree-store instance gets it for free, since
   *  it's purely a function of the Schema shape this module already owns. */
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

  // undo/redo — every tree-store instance gets this for free (see
  // TreeStoreConfig.onMutate's doc comment). Boolean canUndo/canRedo fields,
  // not accessor functions, so components re-render on history changes —
  // same convention as dashboard/store.ts's own undo/redo.
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void

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

const HISTORY_LIMIT = 50
// Rapid same-key mutations within this window (e.g. every keystroke of a
// section-title edit) coalesce into one undo step — same window Workflow
// Builder's own history uses (features/workflows/builder/store.ts).
const COALESCE_WINDOW_MS = 1200

/** Builds a Zustand store for a Section[] -> Column[] -> Item[] schema.
 *  `TreeStoreState` is deliberately NOT generic over an "Extra" metadata
 *  slot — an adapter that needs extra top-level state (e.g. form-builder's
 *  formId/name/slug/isDirty) composes a second, separate store alongside
 *  this one rather than growing this module's return shape. Undo/redo is
 *  the one exception: it's built into this core (not left to adapters),
 *  since it's purely a function of the Schema shape every adapter shares. */
export function createTreeStore<
  Schema extends SchemaLike<Section>,
  Section extends SectionLike<Column>,
  Column extends ColumnLike,
  Item extends HasId,
  Kind,
  Layout,
>(config: TreeStoreConfig<Schema, Section, Column, Item, Kind, Layout>) {
  const { emptySchema, createSection, duplicateSection, relayoutSection, createItem, duplicateItem, accessors, onMutate } = config

  // History arrays live outside the store's typed state (TreeStoreState
  // deliberately exposes only canUndo/canRedo, not the raw stacks) but
  // still need to survive across calls — module-scoped per createTreeStore
  // invocation, i.e. one pair per store instance, exactly like
  // lastHistoryKey/lastHistoryTime below.
  let past: Schema[] = []
  let future: Schema[] = []
  let lastCoalesceKey: string | null = null
  let lastPushTime = 0

  return create<TreeStoreState<Schema, Section, Item, Kind, Layout>>((set, get) => {
    /** Call BEFORE mutating, with the schema as it stood before this
     *  mutation. coalesceKey groups rapid same-key pushes (e.g. every
     *  keystroke of one section's title) into a single undo step; omit it
     *  for structural changes (add/delete/move), which always push their
     *  own step. Any push clears redo, per standard undo/redo semantics. */
    const pushHistory = (prevSchema: Schema, coalesceKey?: string) => {
      const now = Date.now()
      if (coalesceKey && coalesceKey === lastCoalesceKey && now - lastPushTime < COALESCE_WINDOW_MS) {
        lastPushTime = now
        return
      }
      lastCoalesceKey = coalesceKey ?? null
      lastPushTime = now
      past = [...past, prevSchema].slice(-HISTORY_LIMIT)
      future = []
    }

    /** The one place every content-mutating action funnels through: record
     *  history, apply `mut` to a cloned schema, then run `onMutate` (see
     *  TreeStoreConfig). coalesceKey is forwarded to pushHistory. */
    const applyMutation = (mut: (draft: Schema) => void, coalesceKey?: string) =>
      set((s) => {
        pushHistory(s.schema, coalesceKey)
        return {
          schema: produce(s.schema, mut),
          canUndo: true, canRedo: false,
          ...(onMutate?.() ?? {}),
        }
      })

    return {
      schema: emptySchema(),
      selectedItemId: null,
      selectedSectionId: null,
      canUndo: false,
      canRedo: false,

      undo: () => {
        const prev = past.pop()
        if (!prev) return
        const current = get().schema
        future = [...future, current]
        lastCoalesceKey = null
        set({
          schema: prev,
          selectedItemId: null, selectedSectionId: null,
          canUndo: past.length > 0, canRedo: true,
          ...(onMutate?.() ?? {}),
        })
      },

      redo: () => {
        const next = future.pop()
        if (!next) return
        const current = get().schema
        past = [...past, current]
        lastCoalesceKey = null
        set({
          schema: next,
          selectedItemId: null, selectedSectionId: null,
          canUndo: true, canRedo: future.length > 0,
          ...(onMutate?.() ?? {}),
        })
      },

      loadSchema: (schema) => {
        past = []
        future = []
        lastCoalesceKey = null
        set({
          schema: schema.sections.length ? schema : emptySchema(),
          selectedItemId: null, selectedSectionId: null,
          canUndo: false, canRedo: false,
        })
      },

      reset: () => {
        past = []
        future = []
        lastCoalesceKey = null
        set({
          schema: emptySchema(),
          selectedItemId: null, selectedSectionId: null,
          canUndo: false, canRedo: false,
        })
      },

      selectItem: (id) => set({ selectedItemId: id, selectedSectionId: null }),
      selectSection: (id) => set({ selectedSectionId: id, selectedItemId: null }),

      addSection: () =>
        set((s) => {
          pushHistory(s.schema)
          const section = createSection(`Section ${s.schema.sections.length + 1}`)
          return {
            schema: produce(s.schema, (d) => { d.sections.push(section) }),
            selectedSectionId: section.id,
            selectedItemId: null,
            canUndo: true, canRedo: false,
            ...(onMutate?.() ?? {}),
          }
        }),

      // Coalesced per-section: a burst of keystrokes editing the same
      // section's title/config collapses into one undo step, but editing
      // section A then section B within the coalesce window still produces
      // two steps (the key changes).
      updateSection: (id, patch) =>
        applyMutation((d) => {
          const sec = d.sections.find((x) => x.id === id)
          if (sec) Object.assign(sec, patch)
        }, `updateSection:${id}`),

      setSectionLayout: (id, layout) =>
        applyMutation((d) => {
          const idx = d.sections.findIndex((x) => x.id === id)
          if (idx !== -1) d.sections[idx] = relayoutSection(d.sections[idx], layout)
        }),

      duplicateSectionById: (id) =>
        set((s) => {
          const idx = s.schema.sections.findIndex((x) => x.id === id)
          if (idx === -1) return s
          pushHistory(s.schema)
          const copy = duplicateSection(s.schema.sections[idx])
          return {
            schema: produce(s.schema, (d) => { d.sections.splice(idx + 1, 0, copy) }),
            selectedSectionId: copy.id,
            canUndo: true, canRedo: false,
            ...(onMutate?.() ?? {}),
          }
        }),

      deleteSection: (id) =>
        set((s) => {
          pushHistory(s.schema)
          return {
            schema: produce(s.schema, (d) => { d.sections = d.sections.filter((x) => x.id !== id) }),
            selectedSectionId: s.selectedSectionId === id ? null : s.selectedSectionId,
            canUndo: true, canRedo: false,
            ...(onMutate?.() ?? {}),
          }
        }),

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
          pushHistory(s.schema)
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
            canUndo: true, canRedo: false,
            ...(onMutate?.() ?? {}),
          }
        }),

      // Coalesced per-item — same reasoning as updateSection above.
      updateItem: (id, patch) =>
        applyMutation((d) => {
          const found = findItem(d, id, accessors)
          if (found) {
            withColumnItems(d.sections, found.loc, accessors, (items) =>
              items.map((it, i) => (i === found.loc.index ? { ...it, ...patch } : it)))
          }
        }, `updateItem:${id}`),

      duplicateItemById: (id) =>
        set((s) => {
          const found = findItem(s.schema, id, accessors)
          if (!found) return s
          pushHistory(s.schema)
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
            canUndo: true, canRedo: false,
            ...(onMutate?.() ?? {}),
          }
        }),

      deleteItem: (id) =>
        set((s) => {
          pushHistory(s.schema)
          return {
            schema: produce(s.schema, (d) => {
              const found = findItem(d, id, accessors)
              if (found) {
                withColumnItems(d.sections, found.loc, accessors, (items) =>
                  items.filter((_, i) => i !== found.loc.index))
              }
            }),
            selectedItemId: s.selectedItemId === id ? null : s.selectedItemId,
            canUndo: true, canRedo: false,
            ...(onMutate?.() ?? {}),
          }
        }),

      moveItem: (itemId, target) =>
        set((s) => {
          pushHistory(s.schema)
          return {
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
            canUndo: true, canRedo: false,
            ...(onMutate?.() ?? {}),
          }
        }),
    }
  })
}
