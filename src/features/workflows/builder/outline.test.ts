import { describe, expect, it } from 'vitest'
import { deriveOutline } from './outline'
import type { FlowNode, FlowEdge } from './store'

function node(id: string, type: string, label = '', configuration: Record<string, unknown> = {}): FlowNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { id, type, label, position: { x: 0, y: 0 }, configuration, inputs: [], outputs: [] },
  } as unknown as FlowNode
}

function edge(source: string, target: string, sourceHandle = ''): FlowEdge {
  return { id: `${source}->${target}:${sourceHandle}`, source, target, sourceHandle } as unknown as FlowEdge
}

describe('deriveOutline', () => {
  it('reads an if/else as an indented tree, hiding structural nodes', () => {
    const nodes = [
      node('t', 'trigger', 'Trigger'),
      node('cond', 'condition', 'Company exists?'),
      node('a', 'set_variable', 'Use existing'),
      node('b', 'save_records', 'Create company'),
      node('m', 'merge'),
      node('after', 'set_variable', 'After join'),
    ]
    const edges = [
      edge('t', 'cond'),
      edge('cond', 'a', 'true'),
      edge('cond', 'b', 'false'),
      edge('a', 'm'),
      edge('b', 'm'),
      edge('m', 'after'),
    ]

    const outline = deriveOutline(nodes, edges)
    expect(outline.structured).toBe(true)
    expect(outline.rows).toEqual([
      { kind: 'step', depth: 0, id: 't', type: 'trigger', label: 'Trigger' },
      { kind: 'step', depth: 0, id: 'cond', type: 'condition', label: 'Company exists?' },
      { kind: 'tag', depth: 1, text: 'then' },
      { kind: 'step', depth: 1, id: 'a', type: 'set_variable', label: 'Use existing' },
      { kind: 'tag', depth: 1, text: 'else' },
      { kind: 'step', depth: 1, id: 'b', type: 'save_records', label: 'Create company' },
      { kind: 'step', depth: 0, id: 'after', type: 'set_variable', label: 'After join' },
    ])
  })

  it('reads an iterator body as a nested block ending at its loop_end', () => {
    const nodes = [
      node('t', 'trigger', 'Trigger'),
      node('iter', 'iterator', 'Each lead', { loop_end_id: 'le' }),
      node('x', 'http_request', 'Notify'),
      node('le', 'loop_end'),
      node('after', 'debug', 'Done'),
    ]
    const edges = [edge('t', 'iter'), edge('iter', 'x'), edge('x', 'le'), edge('le', 'after')]

    const outline = deriveOutline(nodes, edges)
    expect(outline.structured).toBe(true)
    expect(outline.rows.map((r) => r.kind === 'tag' ? `#${r.text}` : `${r.depth}:${r.id}`)).toEqual([
      '0:t', '0:iter', '#each item', '1:x', '0:after',
    ])
  })

  it('gives an empty branch no header tag', () => {
    const nodes = [
      node('t', 'trigger', 'Trigger'),
      node('cond', 'condition', 'Gate'),
      node('b', 'debug', 'Only on false'),
      node('m', 'merge'),
    ]
    const edges = [
      edge('t', 'cond'),
      edge('cond', 'm', 'true'), // empty then — straight to the join
      edge('cond', 'b', 'false'),
      edge('b', 'm'),
    ]

    const outline = deriveOutline(nodes, edges)
    expect(outline.structured).toBe(true)
    const tags = outline.rows.filter((r) => r.kind === 'tag').map((r) => r.text)
    expect(tags).toEqual(['else'])
  })

  it('falls back to a flat run-order list for free-form graphs, hiding nothing', () => {
    const nodes = [
      node('t', 'trigger', 'Trigger'),
      node('a', 'debug', 'A'),
      node('b', 'debug', 'B'),
      node('c', 'debug', 'C'),
    ]
    // Plain node fanning out — no flow form.
    const edges = [edge('t', 'a'), edge('a', 'b'), edge('a', 'c')]

    const outline = deriveOutline(nodes, edges)
    expect(outline.structured).toBe(false)
    expect(outline.rows).toHaveLength(4)
    expect(outline.rows.every((r) => r.kind === 'step' && r.depth === 0)).toBe(true)
  })

  it('falls back when a disconnected node would otherwise be hidden', () => {
    const nodes = [node('t', 'trigger', 'Trigger'), node('a', 'debug', 'A'), node('island', 'debug', 'Island')]
    const edges = [edge('t', 'a')]

    const outline = deriveOutline(nodes, edges)
    expect(outline.structured).toBe(false)
    expect(outline.rows.map((r) => r.id)).toContain('island')
  })
})
