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
