// duplicateElement/duplicateSection must never carry a field's backend-
// assigned `column` (schema.ts's immutable physical storage slot) onto the
// clone. EnsureIdentity (internal/forms/field) only fills EMPTY columns, so
// echoing the original's non-empty column would silently alias the new
// field onto the same underlying data on save — the bug this file pins.
import { describe, expect, it } from 'vitest'
import { createElement, createSection, duplicateElement, duplicateSection } from './factory'

function withColumn(el: ReturnType<typeof createElement>, column: string): ReturnType<typeof createElement> {
  return { ...el, column }
}

describe('duplicateElement', () => {
  it('clears the backend-assigned column so a fresh one is minted on save', () => {
    const original = withColumn(createElement('text'), 'col_abc123')
    const copy = duplicateElement(original)
    expect(copy.column).toBeUndefined()
    expect(original.column).toBe('col_abc123') // the source element is untouched
  })

  it('still gives the clone a fresh id and a de-duplicated key/label', () => {
    const original = withColumn(createElement('text'), 'col_abc123')
    original.key = 'ssn'
    original.label = 'SSN'
    const copy = duplicateElement(original)
    expect(copy.id).not.toBe(original.id)
    expect(copy.key).toBe('ssn_copy')
    expect(copy.label).toBe('SSN (copy)')
  })

  it('leaves an element with no column yet (brand new, unsaved) still columnless', () => {
    const copy = duplicateElement(createElement('text'))
    expect(copy.column).toBeUndefined()
  })
})

describe('duplicateSection', () => {
  it('clears the column on every cloned element, not just the top-level element path', () => {
    const section = createSection('Details', '1')
    section.columns[0].elements = [
      withColumn(createElement('text'), 'col_one'),
      withColumn(createElement('number'), 'col_two'),
    ]
    const copy = duplicateSection(section)
    const clonedColumns = copy.columns[0].elements.map((el) => el.column)
    expect(clonedColumns).toEqual([undefined, undefined])
  })

  it('gives every cloned element a fresh id, distinct from the source', () => {
    const section = createSection('Details', '1')
    const original = withColumn(createElement('text'), 'col_one')
    section.columns[0].elements = [original]
    const copy = duplicateSection(section)
    expect(copy.columns[0].elements[0].id).not.toBe(original.id)
  })
})
