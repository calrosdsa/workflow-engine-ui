import { describe, it, expect } from 'vitest'
import { validateTitleAndSearch } from './projection'
import { createSection, createElement } from './factory'
import type { FormSchema, ComponentType } from './schema'

function schemaOf(...specs: { component: ComponentType; key: string; title?: boolean; search?: boolean }[]): FormSchema {
  const section = createSection('Details', '1')
  for (const s of specs) {
    const el = createElement(s.component)
    el.key = s.key
    el.label = s.key
    if (s.title) el.isRecordTitle = true
    if (s.search) el.searchable = true
    section.columns[0].elements.push(el)
  }
  return { version: 1, sections: [section] }
}

const kinds = (schema: FormSchema, isLineItems = false) =>
  validateTitleAndSearch(schema, isLineItems).map((i) => i.kind).sort()

describe('validateTitleAndSearch', () => {
  it('reports both when a text field carries neither flag', () => {
    expect(kinds(schemaOf({ component: 'text', key: 'name' }))).toEqual(['record_title', 'searchable'])
  })

  it('is satisfied by one field carrying both', () => {
    expect(kinds(schemaOf({ component: 'text', key: 'name', title: true, search: true }))).toEqual([])
  })

  it('accepts the two flags on separate fields', () => {
    expect(kinds(schemaOf(
      { component: 'date', key: 'due', title: true },
      { component: 'textarea', key: 'notes', search: true },
    ))).toEqual([])
  })

  it('reports only the unmet half', () => {
    expect(kinds(schemaOf({ component: 'text', key: 'name', title: true }))).toEqual(['searchable'])
    expect(kinds(schemaOf({ component: 'text', key: 'name', search: true }))).toEqual(['record_title'])
  })

  it('exempts Line Items child forms entirely', () => {
    expect(kinds(schemaOf({ component: 'text', key: 'name' }), true)).toEqual([])
  })

  it('exempts a form with no fields yet', () => {
    expect(kinds({ version: 1, sections: [] })).toEqual([])
  })

  it('skips the half no field could satisfy', () => {
    // A date is Record-Title-capable but never Searchable, so only the
    // title half applies — matching the backend's own rule.
    expect(kinds(schemaOf({ component: 'date', key: 'due' }))).toEqual(['record_title'])
    // A file field is eligible for neither.
    expect(kinds(schemaOf({ component: 'file', key: 'doc' }))).toEqual([])
  })

  it('does not count a flag set on an ineligible component', () => {
    // 'file' supports neither flag; a stale flag on it must not satisfy the
    // rule, exactly as projectToFields refuses to emit it.
    expect(kinds(schemaOf(
      { component: 'file', key: 'doc', title: true, search: true },
      { component: 'text', key: 'name' },
    ))).toEqual(['record_title', 'searchable'])
  })

  it('offers every eligible field as a candidate, in document order', () => {
    const issues = validateTitleAndSearch(schemaOf(
      { component: 'text', key: 'first' },
      { component: 'textarea', key: 'second' },
      { component: 'date', key: 'third' },
    ))
    const title = issues.find((i) => i.kind === 'record_title')!
    const search = issues.find((i) => i.kind === 'searchable')!
    expect(title.candidates.map((c) => c.key)).toEqual(['first', 'second', 'third'])
    // 'date' is not searchable-capable, so it isn't offered for that fix.
    expect(search.candidates.map((c) => c.key)).toEqual(['first', 'second'])
  })
})
