import { describe, it, expect } from 'vitest'
import { projectToFields } from './projection'
import { createSection, createElement } from './factory'
import type { FormSchema, ComponentType } from './schema'

/** A one-field schema carrying a static default. */
function schemaWithDefault(component: ComponentType, key: string, defaultValue: unknown): FormSchema {
  const section = createSection('Details', '1')
  const el = createElement(component)
  el.key = key
  el.label = key
  el.defaultValue = defaultValue
  section.columns[0].elements.push(el)
  return { version: 1, sections: [section] }
}

const defaultOf = (component: ComponentType, value: unknown) =>
  projectToFields(schemaWithDefault(component, 'f', value)).fields[0].default

// Until 2026-09-02 this projection SQL-quoted every string default ('foo') and
// stringified numbers, because the backend embedded FieldDef.default verbatim
// into CREATE TABLE. That made the form builder the only sanitizer in front of
// an arbitrary-DDL primitive, which every other API client bypassed. Defaults
// are now typed values the backend binds as query arguments, so quoting here
// would store the quotes.
describe('projectToFields — field defaults', () => {
  it('emits a string default unquoted', () => {
    expect(defaultOf('text', 'draft')).toBe('draft')
  })

  it('does not escape quotes inside a string default', () => {
    expect(defaultOf('text', "O'Brien")).toBe("O'Brien")
  })

  it('emits a number default as a number, not a string', () => {
    expect(defaultOf('number', 42)).toBe(42)
  })

  it('emits a boolean default as a boolean, not "true"/"false"', () => {
    expect(defaultOf('checkbox', true)).toBe(true)
  })

  it('omits the default when the element has none', () => {
    expect(defaultOf('text', '')).toBeUndefined()
    expect(defaultOf('text', undefined)).toBeUndefined()
  })

  it('passes SQL-looking text through as an ordinary value', () => {
    expect(defaultOf('text', "'; DROP TABLE users; --")).toBe("'; DROP TABLE users; --")
  })
})
