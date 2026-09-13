import { describe, it, expect } from 'vitest'
import { detectPayloadShape } from './payload-shape'

describe('detectPayloadShape', () => {
  it('renders a table for an array of uniform objects', () => {
    const shape = detectPayloadShape([{ a: 1, b: 2 }, { a: 3, b: 4 }])
    expect(shape.kind).toBe('table')
    if (shape.kind === 'table') {
      expect(shape.columns).toEqual(['a', 'b'])
      expect(shape.rows).toHaveLength(2)
    }
  })

  it('tolerates one row with an extra field (mostly uniform)', () => {
    const shape = detectPayloadShape([{ a: 1, b: 2 }, { a: 3, b: 4, c: 5 }])
    expect(shape.kind).toBe('table')
  })

  it('falls back to raw for an empty array', () => {
    expect(detectPayloadShape([])).toEqual({ kind: 'raw' })
  })

  it('falls back to raw for a scalar array', () => {
    expect(detectPayloadShape([1, 2, 3])).toEqual({ kind: 'raw' })
  })

  it('falls back to raw for objects with disjoint key sets', () => {
    const shape = detectPayloadShape([{ a: 1 }, { b: 2 }])
    expect(shape.kind).toBe('raw')
  })

  it('falls back to raw for a bare (non-array) object', () => {
    expect(detectPayloadShape({ a: 1 })).toEqual({ kind: 'raw' })
  })

  it('falls back to raw for null', () => {
    expect(detectPayloadShape(null)).toEqual({ kind: 'raw' })
  })

  it('falls back to raw for undefined', () => {
    expect(detectPayloadShape(undefined)).toEqual({ kind: 'raw' })
  })

  it('falls back to raw for an array of arrays', () => {
    expect(detectPayloadShape([[1, 2], [3, 4]])).toEqual({ kind: 'raw' })
  })

  it('falls back to raw for an array containing null', () => {
    expect(detectPayloadShape([{ a: 1 }, null])).toEqual({ kind: 'raw' })
  })

  it('falls back to raw for a very wide object (exceeds column cap)', () => {
    const wide: Record<string, number> = {}
    for (let i = 0; i < 30; i++) wide[`k${i}`] = i
    expect(detectPayloadShape([wide, wide])).toEqual({ kind: 'raw' })
  })

  it('falls back to raw for a single record, not an array', () => {
    expect(detectPayloadShape({ id: '1', name: 'Acme' })).toEqual({ kind: 'raw' })
  })

  // Pins a real bug found by live end-to-end verification against an actual
  // HTTP Request node's logged output, not a hypothetical: the activity's
  // real shape is {"node_output": {"body": [...], "status_code": 200,
  // "headers": {...}, ...}} — the table-shaped array is two levels deep, not
  // at the top, so the original top-level-only check always fell back to a
  // raw JSON dump for the single most common real node type this feature
  // exists to show a table for.
  it('unwraps a table-shaped array nested inside wrapper objects (real HTTP Request output shape)', () => {
    const httpRequestOutput = {
      node_output: {
        body: [
          { id: 1, name: 'Leanne Graham', username: 'Bret' },
          { id: 2, name: 'Ervin Howell', username: 'Antonette' },
        ],
        status_code: 200,
        headers: { 'content-type': 'application/json' },
        ok: true,
      },
    }
    const shape = detectPayloadShape(httpRequestOutput)
    expect(shape.kind).toBe('table')
    if (shape.kind === 'table') {
      expect(shape.columns).toEqual(['id', 'name', 'username'])
      expect(shape.rows).toHaveLength(2)
    }
  })

  it('unwraps the records array of a Fetch/Transform/Save Records output', () => {
    const fetchRecordsOutput = {
      node_output: { records: [{ id: 'r1', total: 10 }, { id: 'r2', total: 20 }], count: 2, first: { id: 'r1', total: 10 } },
    }
    const shape = detectPayloadShape(fetchRecordsOutput)
    expect(shape.kind).toBe('table')
    if (shape.kind === 'table') expect(shape.rows).toHaveLength(2)
  })

  // Pins a real bug found live: HTTP Request's logged INPUT nests its
  // headers array under `configuration`. Unwrapping through any key picked
  // that array as "the" table and hid url/method entirely.
  it('does not unwrap through non-carrier keys (real HTTP Request input shape stays raw)', () => {
    const httpRequestInput = {
      configuration: {
        url: 'https://example.com/users',
        method: 'GET',
        headers: [{ key: 'Authorization', value: '[REDACTED]', enabled: true }],
        params: [],
      },
      variables: {},
    }
    expect(detectPayloadShape(httpRequestInput)).toEqual({ kind: 'raw' })
  })

  it('does not unwrap past MAX_UNWRAP_DEPTH (a table three levels deep stays raw)', () => {
    const tooDeep = { node_output: { body: { records: [{ x: 1 }, { x: 2 }] } } }
    expect(detectPayloadShape(tooDeep)).toEqual({ kind: 'raw' })
  })

  it('stays raw when an object has two sibling carrier arrays and no principled way to prefer one', () => {
    const ambiguous = {
      records: [{ id: 1 }, { id: 2 }],
      items: [{ id: 3 }, { id: 4 }],
    }
    expect(detectPayloadShape(ambiguous)).toEqual({ kind: 'raw' })
  })

  it('still falls back to raw for a bare object with no nested array anywhere', () => {
    expect(detectPayloadShape({ a: { b: { c: 'no array here' } } })).toEqual({ kind: 'raw' })
  })
})
