import { describe, it, expect } from 'vitest'
import { createTreeStore, findItem } from './tree-store'

// A minimal fake schema shape — the smallest Section[] -> Column[] -> Item[]
// tree that exercises the core without dragging in FormSchema/PageSchema.
interface FakeItem {
  id: string
  label: string
}

interface FakeColumn {
  id: string
  items: FakeItem[]
}

interface FakeSection {
  id: string
  title: string
  layout: 'solo' | 'pair'
  columns: FakeColumn[]
  collapsed?: boolean
}

interface FakeSchema {
  sections: FakeSection[]
}

let nextId = 0
const freshId = (prefix: string) => `${prefix}_${nextId++}`

function makeColumns(layout: FakeSection['layout']): FakeColumn[] {
  const count = layout === 'pair' ? 2 : 1
  return Array.from({ length: count }, () => ({ id: freshId('col'), items: [] }))
}

function makeSection(title = 'Section'): FakeSection {
  return { id: freshId('sec'), title, layout: 'solo', columns: makeColumns('solo') }
}

function makeItem(label: string): FakeItem {
  return { id: freshId('item'), label }
}

const accessors = {
  getItems: (column: FakeColumn) => column.items,
  setItems: (column: FakeColumn, items: FakeItem[]) => ({ ...column, items }),
}

function emptySchema(): FakeSchema {
  return { sections: [] }
}

function duplicateSection(section: FakeSection): FakeSection {
  return {
    ...structuredClone(section),
    id: freshId('sec'),
    title: `${section.title} (copy)`,
    columns: section.columns.map((col) => ({
      ...structuredClone(col),
      id: freshId('col'),
      items: col.items.map((it) => ({ ...structuredClone(it), id: freshId('item') })),
    })),
  }
}

function relayoutSection(section: FakeSection, layout: FakeSection['layout']): FakeSection {
  const allItems = section.columns.flatMap((c) => c.items)
  const newColumns = makeColumns(layout)
  allItems.forEach((it, i) => { newColumns[i % newColumns.length].items.push(it) })
  return { ...section, layout, columns: newColumns }
}

function makeStore() {
  return createTreeStore<FakeSchema, FakeSection, FakeColumn, FakeItem, string, FakeSection['layout']>({
    emptySchema,
    createSection: (title) => makeSection(title),
    duplicateSection,
    relayoutSection,
    createItem: (label: string) => makeItem(label),
    duplicateItem: (item) => ({ ...structuredClone(item), id: freshId('item') }),
    accessors,
  })
}

describe('findItem', () => {
  it('locates an item by id, wherever it is in the tree', () => {
    const section = makeSection()
    const item = makeItem('hello')
    section.columns[0].items.push(item)
    const schema: FakeSchema = { sections: [section] }

    const found = findItem(schema, item.id, accessors)

    expect(found).not.toBeNull()
    expect(found?.item.label).toBe('hello')
    expect(found?.loc).toEqual({ sectionId: section.id, columnId: section.columns[0].id, index: 0 })
  })

  it('returns null for an id that does not exist', () => {
    const schema: FakeSchema = { sections: [makeSection()] }
    expect(findItem(schema, 'nonexistent', accessors)).toBeNull()
  })
})

describe('addSection / addItem', () => {
  it('adds a section and an item into one of its columns', () => {
    const store = makeStore()
    store.getState().addSection()
    const [section] = store.getState().schema.sections
    expect(section).toBeDefined()

    store.getState().addItem('widget', section.id, section.columns[0].id)
    const items = store.getState().schema.sections[0].columns[0].items
    expect(items).toHaveLength(1)
    expect(store.getState().selectedItemId).toBe(items[0].id)
  })
})

describe('moveItem', () => {
  it('moves an item from one column to another, at the target index', () => {
    const store = makeStore()
    store.getState().addSection()
    const section = store.getState().schema.sections[0]
    // Give the section a second column to move into.
    store.getState().setSectionLayout(section.id, 'pair')
    const [colA, colB] = store.getState().schema.sections[0].columns

    store.getState().addItem('a', section.id, colA.id)
    store.getState().addItem('b', section.id, colA.id)
    const [itemA] = store.getState().schema.sections[0].columns[0].items

    store.getState().moveItem(itemA.id, { sectionId: section.id, columnId: colB.id, index: 0 })

    const after = store.getState().schema.sections[0].columns
    expect(after[0].items.map((i) => i.id)).not.toContain(itemA.id)
    expect(after[1].items.map((i) => i.id)).toEqual([itemA.id])
  })

  it('puts the item back if the target column no longer exists (target vanished)', () => {
    const store = makeStore()
    store.getState().addSection()
    const section = store.getState().schema.sections[0]
    store.getState().addItem('a', section.id, section.columns[0].id)
    const [item] = store.getState().schema.sections[0].columns[0].items

    store.getState().moveItem(item.id, { sectionId: 'ghost-section', columnId: 'ghost-column', index: 0 })

    const stillThere = store.getState().schema.sections[0].columns[0].items
    expect(stillThere.map((i) => i.id)).toEqual([item.id])
  })

  it('clamps the target index to the destination column length', () => {
    const store = makeStore()
    store.getState().addSection()
    const section = store.getState().schema.sections[0]
    store.getState().setSectionLayout(section.id, 'pair')
    const [colA, colB] = store.getState().schema.sections[0].columns
    store.getState().addItem('a', section.id, colA.id)
    const [item] = store.getState().schema.sections[0].columns[0].items

    store.getState().moveItem(item.id, { sectionId: section.id, columnId: colB.id, index: 999 })

    expect(store.getState().schema.sections[0].columns[1].items.map((i) => i.id)).toEqual([item.id])
  })
})

describe('moveSection', () => {
  it('reorders sections by index', () => {
    const store = makeStore()
    store.getState().addSection()
    store.getState().addSection()
    store.getState().addSection()
    const ids = store.getState().schema.sections.map((s) => s.id)

    store.getState().moveSection(0, 2)

    const after = store.getState().schema.sections.map((s) => s.id)
    expect(after).toEqual([ids[1], ids[2], ids[0]])
  })
})

describe('undo/redo', () => {
  it('canUndo/canRedo are both false on a freshly created store', () => {
    const store = makeStore()
    expect(store.getState().canUndo).toBe(false)
    expect(store.getState().canRedo).toBe(false)
  })

  it('TC-01: undo reverts a single mutation, redo re-applies it', () => {
    const store = makeStore()
    store.getState().addSection()
    expect(store.getState().schema.sections).toHaveLength(1)
    expect(store.getState().canUndo).toBe(true)

    store.getState().undo()
    expect(store.getState().schema.sections).toHaveLength(0)
    expect(store.getState().canUndo).toBe(false)
    expect(store.getState().canRedo).toBe(true)

    store.getState().redo()
    expect(store.getState().schema.sections).toHaveLength(1)
    expect(store.getState().canRedo).toBe(false)
  })

  it('undo restores prior field values exactly, not just section count', () => {
    const store = makeStore()
    store.getState().addSection()
    const section = store.getState().schema.sections[0]
    store.getState().updateSection(section.id, { title: 'Renamed' })

    store.getState().undo()
    expect(store.getState().schema.sections[0].title).toBe(section.title)

    store.getState().undo()
    expect(store.getState().schema.sections).toHaveLength(0)
  })

  it('coalesces rapid same-key mutations (e.g. keystrokes) into a single undo step', () => {
    const store = makeStore()
    store.getState().addSection()
    const id = store.getState().schema.sections[0].id
    store.getState().updateSection(id, { title: 'H' })
    store.getState().updateSection(id, { title: 'He' })
    store.getState().updateSection(id, { title: 'Hel' })
    store.getState().updateSection(id, { title: 'Hello' })
    expect(store.getState().schema.sections[0].title).toBe('Hello')

    // One undo reverts the WHOLE burst (back to the pre-edit title from
    // addSection), not one keystroke at a time — confirms coalescing.
    const preEditTitle = 'Section 1'
    store.getState().undo()
    expect(store.getState().schema.sections[0].title).toBe(preEditTitle)
  })

  it('does not coalesce mutations targeting different sections, even with the same mutation kind', () => {
    const store = makeStore()
    store.getState().addSection()
    store.getState().addSection()
    const [id1, id2] = store.getState().schema.sections.map((s) => s.id)
    store.getState().updateSection(id1, { title: 'First' })
    store.getState().updateSection(id2, { title: 'Second' })

    store.getState().undo()
    const afterOneUndo = store.getState().schema.sections
    expect(afterOneUndo.find((s) => s.id === id1)!.title).toBe('First')
    expect(afterOneUndo.find((s) => s.id === id2)!.title).not.toBe('Second')
  })

  it('TC-03: a new mutation after undo clears the redo stack (branching history)', () => {
    const store = makeStore()
    store.getState().addSection()
    store.getState().addSection()
    store.getState().undo()
    store.getState().undo()
    expect(store.getState().canRedo).toBe(true)

    store.getState().addSection()
    expect(store.getState().canRedo).toBe(false)

    store.getState().redo()
    expect(store.getState().schema.sections).toHaveLength(1)
  })

  it('TC-04: undo is unavailable past the state as created (session boundary)', () => {
    const store = makeStore()
    store.getState().addSection()
    expect(store.getState().canUndo).toBe(true)

    store.getState().undo()
    expect(store.getState().canUndo).toBe(false)

    const before = store.getState().schema
    store.getState().undo()
    expect(store.getState().schema).toBe(before)
  })

  it('redo is a no-op when the redo stack is empty', () => {
    const store = makeStore()
    store.getState().addSection()
    const before = store.getState().schema
    store.getState().redo()
    expect(store.getState().schema).toBe(before)
  })

  it('loadSchema clears undo/redo history', () => {
    const store = makeStore()
    store.getState().addSection()
    expect(store.getState().canUndo).toBe(true)

    store.getState().loadSchema(store.getState().schema)
    expect(store.getState().canUndo).toBe(false)
    expect(store.getState().canRedo).toBe(false)
  })

  it('reset clears undo/redo history', () => {
    const store = makeStore()
    store.getState().addSection()
    store.getState().reset()
    expect(store.getState().canUndo).toBe(false)
    expect(store.getState().canRedo).toBe(false)
  })

  it('undo resets selection state', () => {
    const store = makeStore()
    store.getState().addSection()
    const section = store.getState().schema.sections[0]
    store.getState().selectSection(section.id)
    expect(store.getState().selectedSectionId).toBe(section.id)

    store.getState().undo()
    expect(store.getState().selectedSectionId).toBeNull()
  })

  it('undo/redo triggers onMutate, same as any other content mutation', () => {
    let mutations = 0
    const store = createTreeStore<FakeSchema, FakeSection, FakeColumn, FakeItem, string, FakeSection['layout']>({
      emptySchema,
      createSection: (title) => makeSection(title),
      duplicateSection,
      relayoutSection,
      createItem: (label: string) => makeItem(label),
      duplicateItem: (item) => ({ ...structuredClone(item), id: freshId('item') }),
      accessors,
      onMutate: () => { mutations += 1 },
    })

    store.getState().addSection()
    expect(mutations).toBe(1)

    store.getState().undo()
    expect(mutations).toBe(2)

    store.getState().redo()
    expect(mutations).toBe(3)
  })

  it('deleteSection/deleteItem are undoable', () => {
    const store = makeStore()
    store.getState().addSection()
    const section = store.getState().schema.sections[0]
    store.getState().addItem('a', section.id, section.columns[0].id)
    expect(store.getState().schema.sections[0].columns[0].items).toHaveLength(1)

    store.getState().deleteItem(store.getState().schema.sections[0].columns[0].items[0].id)
    expect(store.getState().schema.sections[0].columns[0].items).toHaveLength(0)
    store.getState().undo()
    expect(store.getState().schema.sections[0].columns[0].items).toHaveLength(1)

    store.getState().deleteSection(section.id)
    expect(store.getState().schema.sections).toHaveLength(0)
    store.getState().undo()
    expect(store.getState().schema.sections).toHaveLength(1)
  })

  it('history is capped at 50 entries', () => {
    const store = makeStore()
    for (let i = 0; i < 60; i++) store.getState().addSection()
    expect(store.getState().schema.sections).toHaveLength(60)

    let undoCount = 0
    while (store.getState().canUndo) {
      store.getState().undo()
      undoCount++
    }
    // Capped at HISTORY_LIMIT (50): only the most recent 50 mutations are
    // undoable, leaving the earliest 10 sections permanently applied.
    expect(undoCount).toBe(50)
    expect(store.getState().schema.sections).toHaveLength(10)
  })
})

// Regression coverage for the switch from a hand-rolled
// structuredClone-the-whole-tree produce() to real Immer: the whole reason
// for the switch was that ElementCard/SectionCard/ColumnDropZone (React
// components consuming this store) rely on React.memo's default shallow
// prop comparison to skip re-rendering untouched cards. That only works if
// an untouched section/column/item KEEPS its object identity across a
// mutation elsewhere in the tree — structuredClone gave everything a fresh
// identity on every single mutation, which made memo() silently do nothing.
describe('structural sharing (produce via Immer)', () => {
  it('keeps an untouched sibling section referentially identical after another section is edited', () => {
    const store = makeStore()
    store.getState().addSection()
    store.getState().addSection()
    const [sectionA, sectionB] = store.getState().schema.sections

    store.getState().updateSection(sectionB.id, { title: 'Renamed' })

    const after = store.getState().schema.sections
    expect(after[0]).toBe(sectionA) // untouched — same reference
    expect(after[1]).not.toBe(sectionB) // touched — new reference, as expected
    expect(after[1].title).toBe('Renamed')
  })

  it('keeps an untouched item referentially identical after a sibling item in the same column is edited', () => {
    const store = makeStore()
    store.getState().addSection()
    const section = store.getState().schema.sections[0]
    store.getState().addItem('a', section.id, section.columns[0].id)
    store.getState().addItem('b', section.id, section.columns[0].id)
    const [itemA, itemB] = store.getState().schema.sections[0].columns[0].items

    store.getState().updateItem(itemB.id, { label: 'Edited' })

    const afterItems = store.getState().schema.sections[0].columns[0].items
    expect(afterItems[0]).toBe(itemA) // untouched sibling — same reference
    expect(afterItems[1]).not.toBe(itemB)
    expect(afterItems[1].label).toBe('Edited')
  })

  it('keeps an untouched column, and everything in it, referentially identical after a different column is edited', () => {
    const store = makeStore()
    store.getState().addSection()
    const section = store.getState().schema.sections[0]
    store.getState().setSectionLayout(section.id, 'pair')
    const [colA0, colB] = store.getState().schema.sections[0].columns
    store.getState().addItem('untouched', section.id, colA0.id)
    // Re-read colA AFTER seeding it — addItem touches colA itself (its own
    // items array grows), so the pre-seed colA0 reference is stale by
    // definition; colA is the reference we expect to survive the FOLLOWING,
    // unrelated mutation to colB untouched.
    const colA = store.getState().schema.sections[0].columns[0]
    const untouchedItem = colA.items[0]

    store.getState().addItem('new-in-other-column', section.id, colB.id)

    const afterColumns = store.getState().schema.sections[0].columns
    expect(afterColumns[0]).toBe(colA)
    expect(afterColumns[0].items[0]).toBe(untouchedItem)
    expect(afterColumns[1]).not.toBe(colB)
  })

  it('undo restores the exact prior object references, not merely equal values', () => {
    const store = makeStore()
    store.getState().addSection()
    const originalSection = store.getState().schema.sections[0]
    store.getState().updateSection(originalSection.id, { title: 'Changed' })

    store.getState().undo()

    // Undo swaps back to a PAST schema snapshot wholesale (not a re-diffed
    // produce()), so this restores the original reference exactly — not
    // just an equal-by-value copy.
    expect(store.getState().schema.sections[0]).toBe(originalSection)
  })
})

describe('onMutate hook', () => {
  it('fires after every content mutation, not on selection-only changes', () => {
    let mutations = 0
    const store = createTreeStore<FakeSchema, FakeSection, FakeColumn, FakeItem, string, FakeSection['layout']>({
      emptySchema,
      createSection: (title) => makeSection(title),
      duplicateSection,
      relayoutSection,
      createItem: (label: string) => makeItem(label),
      duplicateItem: (item) => ({ ...structuredClone(item), id: freshId('item') }),
      accessors,
      onMutate: () => { mutations += 1 },
    })

    store.getState().addSection()
    expect(mutations).toBe(1)

    store.getState().selectSection(null)
    expect(mutations).toBe(1) // selection alone doesn't count as a content mutation
  })
})
