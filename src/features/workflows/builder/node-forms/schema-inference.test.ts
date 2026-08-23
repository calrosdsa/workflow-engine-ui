import { describe, it, expect } from 'vitest'
import { inferSchemaFromResponse, acceptedFieldsToResponseSchemaFields } from './schema-inference'
import type { InferredField } from './schema-inference'

describe('inferSchemaFromResponse', () => {
  it('detects a top-level array as kind list, inferring from the first element', () => {
    const body = [
      { id: 1, name: 'Widget', active: true },
      { id: 2, name: 'Gadget', active: false },
    ]
    const result = inferSchemaFromResponse(body)
    expect(result?.kind).toBe('list')
    expect(result?.count).toBe(2)
    expect(result?.fields.map((f) => f.name)).toEqual(['Id', 'Name', 'Active'])
    expect(result?.fields.map((f) => f.type)).toEqual(['integer', 'string', 'boolean'])
  })

  it('detects a top-level object as kind single', () => {
    const result = inferSchemaFromResponse({ id: 42, price: 19.99 })
    expect(result?.kind).toBe('single')
    expect(result?.count).toBeUndefined()
    const price = result?.fields.find((f) => f.path === 'price')
    expect(price?.type).toBe('float')
  })

  it('flattens nested objects into dot-paths', () => {
    const body = { name: 'Leanne', address: { city: 'Gwenborough', geo: { lat: '-37.3159' } } }
    const result = inferSchemaFromResponse(body)
    const paths = result?.fields.map((f) => f.path)
    expect(paths).toContain('address.city')
    expect(paths).toContain('address.geo.lat')
    expect(paths).not.toContain('address')
  })

  it('proposes a nested list field for an array of orders each with their own items', () => {
    const body = [
      {
        id: 100, customer: 'Acme',
        items: [
          { id: 'sku-1', name: 'Widget', qty: 2 },
          { id: 'sku-2', name: 'Gadget', qty: 1 },
        ],
      },
      { id: 101, customer: 'Globex', items: [{ id: 'sku-3', name: 'Doohickey', qty: 5 }] },
    ]
    const result = inferSchemaFromResponse(body)
    expect(result?.kind).toBe('list')

    const itemsField = result?.fields.find((f) => f.path === 'items')
    expect(itemsField?.type).toBe('list')
    expect(itemsField?.fields?.map((f) => f.name)).toEqual(['Id', 'Name', 'Qty'])
    // The nested proposal infers from the FIRST order's first item, not
    // some merged union of every order's shape.
    expect(itemsField?.fields?.find((f) => f.name === 'Id')?.sample).toBe('sku-1')
  })

  it('skips an array of scalars (no typed field-level shape to propose)', () => {
    const body = { tags: ['a', 'b', 'c'], id: 1 }
    const result = inferSchemaFromResponse(body)
    expect(result?.fields.map((f) => f.path)).toEqual(['id'])
  })

  it('skips null/undefined values (no type signal)', () => {
    const body = { id: 1, deletedAt: null }
    const result = inferSchemaFromResponse(body)
    expect(result?.fields.map((f) => f.path)).toEqual(['id'])
  })

  it('skips an empty array field entirely', () => {
    const body = { id: 1, items: [] }
    const result = inferSchemaFromResponse(body)
    expect(result?.fields.map((f) => f.path)).toEqual(['id'])
  })

  it('returns undefined for an empty array body', () => {
    expect(inferSchemaFromResponse([])).toBeUndefined()
  })

  it('returns undefined for a scalar body', () => {
    expect(inferSchemaFromResponse('just a string')).toBeUndefined()
    expect(inferSchemaFromResponse(42)).toBeUndefined()
    expect(inferSchemaFromResponse(null)).toBeUndefined()
  })

  it('returns undefined for a top-level array of scalars', () => {
    expect(inferSchemaFromResponse([1, 2, 3])).toBeUndefined()
  })

  it('detects an ISO datetime string as type datetime, not string', () => {
    const body = { created_at: '2026-08-22T12:00:00Z', name: 'x' }
    const result = inferSchemaFromResponse(body)
    expect(result?.fields.find((f) => f.path === 'created_at')?.type).toBe('datetime')
    expect(result?.fields.find((f) => f.path === 'name')?.type).toBe('string')
  })

  it('humanizes snake_case, camelCase, and kebab-case keys', () => {
    const body = { account_email: 'a', createdAt: 'b', 'x-request-id': 'c', id: 'd' }
    const result = inferSchemaFromResponse(body)
    const nameByPath = new Map(result?.fields.map((f) => [f.path, f.name]))
    expect(nameByPath.get('account_email')).toBe('Account Email')
    expect(nameByPath.get('createdAt')).toBe('Created At')
    expect(nameByPath.get('x-request-id')).toBe('X Request Id')
    expect(nameByPath.get('id')).toBe('Id')
  })

  it('every inferred field defaults to selected: true', () => {
    const result = inferSchemaFromResponse({ id: 1, name: 'x' })
    expect(result?.fields.every((f) => f.selected)).toBe(true)
  })
})

describe('acceptedFieldsToResponseSchemaFields', () => {
  it('drops unselected fields', () => {
    const fields: InferredField[] = [
      { id: '1', path: 'id', type: 'integer', name: 'Id', selected: true },
      { id: '2', path: 'internal', type: 'string', name: 'Internal', selected: false },
    ]
    const result = acceptedFieldsToResponseSchemaFields(fields)
    expect(result.map((f) => f.path)).toEqual(['id'])
  })

  it('recursively converts a nested list field, preserving its own fields', () => {
    const fields: InferredField[] = [
      {
        id: '1', path: 'items', type: 'list', name: 'Items', selected: true,
        fields: [
          { id: 'n1', path: 'id', type: 'string', name: 'Sku', selected: true },
          { id: 'n2', path: 'hidden', type: 'string', name: 'Hidden', selected: false },
        ],
      },
    ]
    const result = acceptedFieldsToResponseSchemaFields(fields)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('list')
    expect(result[0].fields?.map((f) => f.path)).toEqual(['id']) // Hidden excluded
  })

  it('assigns fresh ids, never reusing the InferredField id', () => {
    const fields: InferredField[] = [{ id: 'inferred-1', path: 'id', type: 'integer', name: 'Id', selected: true }]
    const result = acceptedFieldsToResponseSchemaFields(fields)
    expect(result[0].id).not.toBe('inferred-1')
  })

  it('disambiguates two fields that humanize to the same name', () => {
    const fields: InferredField[] = [
      { id: '1', path: 'name', type: 'string', name: 'Name', selected: true },
      { id: '2', path: 'full_name', type: 'string', name: 'Name', selected: true },
      { id: '3', path: 'display_name', type: 'string', name: 'Name', selected: true },
    ]
    const result = acceptedFieldsToResponseSchemaFields(fields)
    expect(result.map((f) => f.name)).toEqual(['Name', 'Name (2)', 'Name (3)'])
  })

  it('does not carry a fields array on a non-list field even if present on the input', () => {
    const fields: InferredField[] = [
      { id: '1', path: 'id', type: 'string', name: 'Id', selected: true, fields: [] },
    ]
    const result = acceptedFieldsToResponseSchemaFields(fields)
    expect(result[0].fields).toBeUndefined()
  })
})
