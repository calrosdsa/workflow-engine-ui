import { describe, it, expect } from 'vitest'
import { buildNodeOutputSchema, inferItemFields, outputFieldPath } from './node-output-schema'
import type { FlowNode } from './store'
import type { HttpRequestConfig, IteratorConfig, ResponseSchema } from '../types'

// Minimal FlowNode builder — only the fields node-output-schema.ts actually
// reads (id, data.type, data.configuration, data.label).
function node(id: string, type: string, configuration: unknown, label?: string): FlowNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: {
      id, type,
      label: label ?? type,
      position: { x: 0, y: 0 },
      configuration,
      inputs: [], outputs: [],
    },
  } as unknown as FlowNode
}

function ordersSchema(): ResponseSchema {
  return {
    id: 's1', name: 'Orders', kind: 'list', source: 'body',
    fields: [
      { id: 'f1', path: 'id', type: 'integer', name: 'Id' },
      { id: 'f2', path: 'customer', type: 'string', name: 'Customer' },
      {
        id: 'f3', path: 'items', type: 'list', name: 'Items',
        fields: [
          { id: 'nf1', path: 'id', type: 'string', name: 'Sku' },
          { id: 'nf2', path: 'name', type: 'string', name: 'Name' },
          { id: 'nf3', path: 'qty', type: 'integer', name: 'Qty' },
        ],
      },
    ],
  }
}

const emptyFormsById = new Map()

describe('buildNodeOutputSchema — http_request with a nested-list field', () => {
  it('exposes the nested field as isArray with recursive children', () => {
    const httpNode = node('http1', 'http_request', {
      response_schemas: [ordersSchema()],
    } satisfies Partial<HttpRequestConfig>)

    const schemas = buildNodeOutputSchema(httpNode, emptyFormsById, [httpNode])
    // base entry + one sibling entry per response schema (see the
    // function's own doc comment) — Orders is the second entry.
    const ordersEntry = schemas.find((s) => s.nodeLabel.includes('Orders'))
    expect(ordersEntry).toBeDefined()

    const itemsField = ordersEntry!.fields[0].children?.find((f) => f.key === 'Items')
    expect(itemsField).toBeDefined()
    expect(itemsField!.isArray).toBe(true)
    expect(itemsField!.children?.map((f) => f.key)).toEqual(['Sku', 'Name', 'Qty'])
  })

  it('a deeply nested list field can itself contain another list field', () => {
    const schema: ResponseSchema = {
      id: 's1', name: 'Root', kind: 'single', source: 'body',
      fields: [{
        id: 'f1', path: 'orders', type: 'list', name: 'Orders',
        fields: [{
          id: 'nf1', path: 'items', type: 'list', name: 'Items',
          fields: [{ id: 'nnf1', path: 'id', type: 'string', name: 'Sku' }],
        }],
      }],
    }
    const httpNode = node('http1', 'http_request', { response_schemas: [schema] } satisfies Partial<HttpRequestConfig>)
    const schemas = buildNodeOutputSchema(httpNode, emptyFormsById, [httpNode])
    const rootEntry = schemas.find((s) => s.nodeLabel.includes('Root'))
    const ordersField = rootEntry!.fields[0].children?.find((f) => f.key === 'Orders')
    const itemsField = ordersField!.children?.find((f) => f.key === 'Items')
    expect(itemsField?.isArray).toBe(true)
    expect(itemsField?.children?.map((f) => f.key)).toEqual(['Sku'])
  })
})

describe('outputFieldPath — nested-list field addressing', () => {
  it('walks two array levels, [0] at each, for a nested-list child', () => {
    const httpNode = node('http1', 'http_request', {
      response_schemas: [ordersSchema()],
    } satisfies Partial<HttpRequestConfig>)
    const schemas = buildNodeOutputSchema(httpNode, emptyFormsById, [httpNode])
    const ordersEntry = schemas.find((s) => s.nodeLabel.includes('Orders'))!
    const recordField = ordersEntry.fields[0] // the 'record' wrapper isArray field itself
    const itemsField = recordField.children!.find((f) => f.key === 'Items')!
    const skuField = itemsField.children!.find((f) => f.key === 'Sku')!

    const path = outputFieldPath('http1', [recordField, itemsField, skuField])
    expect(path).toBe('NodeOutputs["http1"]["Orders"][0]["Items"][0]["Sku"]')
  })
})

describe('inferItemFields — nested iterator over Vars["item"]["Items"]', () => {
  it('resolves a nested-list field on the OUTER iterator\'s http_request-derived item shape', () => {
    const httpNode = node('http1', 'http_request', {
      response_schemas: [ordersSchema()],
    } satisfies Partial<HttpRequestConfig>)
    const outerIterator = node('iter1', 'iterator', {
      source_expr: 'NodeOutputs["http1"]["Orders"]',
      item_var: 'item',
      loop_end_id: 'loopend1',
    } satisfies Partial<IteratorConfig>)
    const nodes = [httpNode, outerIterator]

    const innerItemFields = inferItemFields('Vars["item"]["Items"]', nodes, emptyFormsById)
    expect(innerItemFields).toBeDefined()
    expect(innerItemFields!.map((f) => f.key)).toEqual(['Sku', 'Name', 'Qty'])
  })

  it('returns undefined when the referenced loop var field has no known nested shape', () => {
    const outerIterator = node('iter1', 'iterator', {
      source_expr: 'NodeOutputs["http1"]["Orders"]',
      item_var: 'item',
      loop_end_id: 'loopend1',
    } satisfies Partial<IteratorConfig>)
    const nodes = [outerIterator] // no http1 node present — outer item shape can't be resolved either

    expect(inferItemFields('Vars["item"]["Items"]', nodes, emptyFormsById)).toBeUndefined()
  })

  it('returns undefined for a two-hop Vars path (only one hop is resolved)', () => {
    const httpNode = node('http1', 'http_request', {
      response_schemas: [ordersSchema()],
    } satisfies Partial<HttpRequestConfig>)
    const outerIterator = node('iter1', 'iterator', {
      source_expr: 'NodeOutputs["http1"]["Orders"]',
      item_var: 'item',
      loop_end_id: 'loopend1',
    } satisfies Partial<IteratorConfig>)

    expect(inferItemFields('Vars["item"]["Items"]["extra"]', [httpNode, outerIterator], emptyFormsById)).toBeUndefined()
  })
})

describe('outputFieldPath roots', () => {
  it('emits the labeled TriggerRecord accessor for trigger-record fields', () => {
    // The Variables panel's "(triggering record)" entries carry
    // root: 'trigger_record' so a click inserts an expression that SAYS the
    // data comes from the triggering record — not a bare Vars[""] lookup a
    // same-named workflow variable could shadow.
    expect(outputFieldPath('trigger1', [{ key: 'company_name', type: 'string' }], 'trigger_record'))
      .toBe('TriggerRecord["company_name"]')
    expect(outputFieldPath('ignored', [{ key: 'item', type: 'object' }], 'vars'))
      .toBe('Vars["item"]')
    expect(outputFieldPath('http1', [{ key: 'body', type: 'object' }]))
      .toBe('NodeOutputs["http1"]["body"]')
  })
})

describe('buildNodeOutputSchema — knowledge_retrieval output keys', () => {
  it("lists answer/context/query/chunks/references, matching KnowledgeRetrievalActivity's output map", () => {
    const kbNode = node('kb1', 'knowledge_retrieval', {})
    const schemas = buildNodeOutputSchema(kbNode, emptyFormsById, [kbNode])
    expect(schemas).toHaveLength(1)
    expect(schemas[0].fields.map((f) => f.key)).toEqual(['answer', 'context', 'query', 'chunks', 'references'])
  })
})
