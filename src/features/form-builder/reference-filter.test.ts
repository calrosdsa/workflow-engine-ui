// The referenceFilter round trip: builder layout (id-ful) ↔ backend
// FieldDef.reference_filter (id-less). What's pinned here is the anti-
// silent-widening property — a builder save must emit exactly the canonical
// filter, and heal-on-load must adopt an API/MCP-authored filter into the
// layout so the NEXT save round-trips it instead of clobbering it.
import { describe, expect, it } from 'vitest'
import { canonicalReferenceFilter, hydrateReferenceFilter, sameReferenceFilter, countFilterConditions } from './reference-filter'
import { healSchema } from './heal'
import { projectToFields } from './projection'
import { createElement, createSection } from './factory'
import { emptySchema, type FormSchema } from './schema'
import type { FilterGroup } from '@/features/workflows/types'
import type { FieldDef } from '@/features/forms/types'

function schemaWith(elements: ReturnType<typeof createElement>[]): FormSchema {
  const section = createSection('Details', '1')
  section.columns[0].elements = elements
  return { version: 1, sections: [section], settings: emptySchema().settings }
}

function supplierElement(): ReturnType<typeof createElement> {
  const el = createElement('form')
  el.key = 'supplier'
  el.formRef = 'form-suppliers'
  return el
}

/** As the builder holds it: UI ids everywhere, explicit static mode. */
const authored: FilterGroup = {
  id: 'g1',
  combinator: 'and',
  conditions: [
    { id: 'c1', field: 'area', op: 'eq', value_mode: 'current_user', value: 'area' },
    { id: 'c2', field: 'active', op: 'eq', value_mode: 'static', value: true, expression: '' },
  ],
  groups: [{ id: 'g2', combinator: 'or', conditions: [], groups: [] }], // empty — must not survive
}

/** The same filter as the backend echoes it: no ids, no vacuous keys. */
const echoed: FilterGroup = {
  combinator: 'and',
  conditions: [
    { field: 'area', op: 'eq', value_mode: 'current_user', value: 'area' },
    { field: 'active', op: 'eq', value: true },
  ],
  groups: [],
} as unknown as FilterGroup // conditions deliberately lack UI ids — the backend's shape

describe('canonicalReferenceFilter', () => {
  it('strips ids, expression, explicit static mode, and empty sub-groups', () => {
    expect(canonicalReferenceFilter(authored)).toEqual(echoed)
  })

  it('normalizes an empty filter to undefined — it constrains nothing', () => {
    expect(canonicalReferenceFilter({ combinator: 'and', conditions: [], groups: [] })).toBeUndefined()
    expect(canonicalReferenceFilter(undefined)).toBeUndefined()
  })

  it('sameReferenceFilter treats the builder and backend copies as equal', () => {
    expect(sameReferenceFilter(authored, echoed)).toBe(true)
    expect(sameReferenceFilter(authored, undefined)).toBe(false)
    const widened = { ...echoed, conditions: echoed.conditions.slice(1) }
    expect(sameReferenceFilter(authored, widened)).toBe(false)
  })

  it('hydrate adds ids everywhere and defaults value_mode, keeping meaning', () => {
    const hydrated = hydrateReferenceFilter(echoed)
    expect(hydrated.id).toBeTruthy()
    expect(hydrated.conditions.every((c) => !!c.id)).toBe(true)
    expect(hydrated.conditions[0].value_mode).toBe('current_user')
    expect(hydrated.conditions[1].value_mode).toBe('static')
    expect(sameReferenceFilter(hydrated, echoed)).toBe(true)
    expect(countFilterConditions(hydrated)).toBe(2)
  })
})

describe('projection', () => {
  it('emits the canonical filter on the projected reference field', () => {
    const el = supplierElement()
    el.referenceFilter = authored
    const [field] = projectToFields(schemaWith([el])).fields
    expect(field.reference_filter).toEqual(echoed)
  })

  it('omits reference_filter entirely for an empty filter — omission is how a save clears one', () => {
    const el = supplierElement()
    el.referenceFilter = { combinator: 'and', conditions: [], groups: [] }
    const [field] = projectToFields(schemaWith([el])).fields
    expect('reference_filter' in field).toBe(false)
  })
})

describe('heal', () => {
  const backendField: FieldDef = {
    name: 'supplier', label: 'Supplier', type: 'reference',
    reference_table: 'form-suppliers', reference_filter: echoed,
  }

  it('adopts an API-authored filter into the layout element, so the next save round-trips it', () => {
    const el = supplierElement() // layout has NO filter — e.g. MCP added one since
    const healed = healSchema(schemaWith([el]), { fields: [backendField] })
    const healedEl = healed.sections[0].columns[0].elements[0]
    expect(sameReferenceFilter(healedEl.referenceFilter, echoed)).toBe(true)
    // Hydrated for the editor, not raw: FilterBuilder needs the ids.
    expect(healedEl.referenceFilter?.conditions.every((c) => !!c.id)).toBe(true)
    // And the property that matters — projecting the healed schema reproduces
    // the backend's filter instead of silently dropping (widening) it.
    expect(projectToFields(healed).fields[0].reference_filter).toEqual(echoed)
  })

  it('adopts an API-side REMOVAL too, instead of resurrecting the layout copy', () => {
    const el = supplierElement()
    el.referenceFilter = authored
    const healed = healSchema(schemaWith([el]), {
      fields: [{ ...backendField, reference_filter: undefined }],
    })
    const projected = projectToFields(healed).fields[0]
    expect('reference_filter' in projected).toBe(false)
  })

  it('is identity-stable when the two copies already agree', () => {
    const el = supplierElement()
    el.referenceFilter = authored
    const schema = schemaWith([el])
    const healed = healSchema(schema, { fields: [backendField] })
    expect(healed).toBe(schema)
  })

  it('threads the filter through element synthesis for an API-created form', () => {
    const healed = healSchema(emptySchema(), { fields: [backendField] })
    const els = healed.sections.flatMap((s) => s.columns.flatMap((c) => c.elements))
    expect(els).toHaveLength(1)
    expect(sameReferenceFilter(els[0].referenceFilter, echoed)).toBe(true)
    expect(els[0].referenceFilter?.id).toBeTruthy()
  })
})
