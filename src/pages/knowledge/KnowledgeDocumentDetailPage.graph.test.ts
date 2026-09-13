// The graph layout must reserve exactly the visual footprint it renders.
// Before this regression test, Dagre arranged 168px-wide nodes while the
// custom cards expanded to fit long entity names; native edge labels also
// received no position or bounded width from the layout. The result was the
// live overlap shown for the Acme Support document.
import { describe, expect, it } from 'vitest'
import type { GraphEntity, GraphRelation } from '@/features/knowledge/types'
import {
  DOCUMENT_GRAPH_NODE_HEIGHT,
  DOCUMENT_GRAPH_NODE_WIDTH,
  graphFlowData,
} from './document-graph-layout'

const entities: GraphEntity[] = [
  { name: 'Online Help Center', type: 'artifact', description: '' },
  { name: 'Initial Response', type: 'event', description: '' },
]

const relations: GraphRelation[] = [
  {
    source: 'Online Help Center',
    target: 'Initial Response',
    keywords: 'provides diagnostic evidence, priority and response time',
    description: '',
  },
]

describe('document graph layout', () => {
  it('pins rendered node and relationship-label geometry to the dimensions reserved by Dagre', () => {
    const { nodes, edges } = graphFlowData(entities, relations)

    for (const node of nodes) {
      expect(node.style).toMatchObject({
        width: DOCUMENT_GRAPH_NODE_WIDTH,
        height: DOCUMENT_GRAPH_NODE_HEIGHT,
      })
    }

    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({
      type: 'documentGraphEdge',
      data: {
        label: 'provides diagnostic evidence, priority and response time',
        labelX: expect.any(Number),
        labelY: expect.any(Number),
      },
    })
  })
})
