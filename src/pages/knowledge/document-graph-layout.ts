import dagre from '@dagrejs/dagre'
import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { GraphEntity, GraphRelation } from '@/features/knowledge/types'

export type DocumentGraphNodeData = Pick<GraphEntity, 'name' | 'type' | 'description'>
export type DocumentGraphNode = Node<DocumentGraphNodeData, 'documentGraphNode'>
export type DocumentGraphEdgeData = { label: string; labelX: number; labelY: number }
export type DocumentGraphEdge = Edge<DocumentGraphEdgeData, 'documentGraphEdge'>

export const DOCUMENT_GRAPH_NODE_WIDTH = 168
export const DOCUMENT_GRAPH_NODE_HEIGHT = 64
const DOCUMENT_GRAPH_LABEL_WIDTH = 152
const DOCUMENT_GRAPH_LABEL_HEIGHT = 28

// The visual cards and labels are deliberately pinned to the same dimensions
// Dagre receives. Letting browser content choose a larger size breaks the
// layout's collision guarantees and makes the graph overlap at runtime.
export function graphFlowData(entities: GraphEntity[], relations: GraphRelation[]): { nodes: DocumentGraphNode[]; edges: DocumentGraphEdge[] } {
  const entityByName = new Map(entities.map((entity) => [entity.name, entity]))
  for (const relation of relations) {
    if (!entityByName.has(relation.source)) entityByName.set(relation.source, { name: relation.source, type: '', description: '' })
    if (!entityByName.has(relation.target)) entityByName.set(relation.target, { name: relation.target, type: '', description: '' })
  }
  const allEntities = [...entityByName.values()].slice(0, 48)
  const visibleNames = new Set(allEntities.map((entity) => entity.name))
  const visibleRelations = relations.filter((relation) => visibleNames.has(relation.source) && visibleNames.has(relation.target))

  const layout = new dagre.graphlib.Graph({ multigraph: true }).setDefaultEdgeLabel(() => ({}))
  layout.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 104, marginx: 24, marginy: 24 })
  allEntities.forEach((entity) => layout.setNode(entity.name, { width: DOCUMENT_GRAPH_NODE_WIDTH, height: DOCUMENT_GRAPH_NODE_HEIGHT }))
  visibleRelations.forEach((relation, index) => layout.setEdge(
    relation.source,
    relation.target,
    { width: DOCUMENT_GRAPH_LABEL_WIDTH, height: DOCUMENT_GRAPH_LABEL_HEIGHT, labelpos: 'c' },
    String(index),
  ))
  dagre.layout(layout)

  const nodes: DocumentGraphNode[] = allEntities.map((entity, index) => {
    const position = layout.node(entity.name)
    // Dagre gives every connected node a position. The fallback grid makes a
    // graph of entities without relations equally inspectable.
    const fallback = { x: (index % 3) * 220, y: Math.floor(index / 3) * 100 }
    return {
      id: entity.name,
      type: 'documentGraphNode',
      data: entity,
      style: { width: DOCUMENT_GRAPH_NODE_WIDTH, height: DOCUMENT_GRAPH_NODE_HEIGHT },
      position: position
        ? { x: position.x - DOCUMENT_GRAPH_NODE_WIDTH / 2, y: position.y - DOCUMENT_GRAPH_NODE_HEIGHT / 2 }
        : fallback,
      ariaLabel: entity.description || entity.name,
    }
  })
  const edges: DocumentGraphEdge[] = visibleRelations.map((relation, index) => {
    const layoutEdge = layout.edge({ v: relation.source, w: relation.target, name: String(index) })
    const source = layout.node(relation.source)
    const target = layout.node(relation.target)
    const labelX = layoutEdge?.x ?? ((source?.x ?? 0) + (target?.x ?? 0)) / 2
    const labelY = layoutEdge?.y ?? ((source?.y ?? 0) + (target?.y ?? 0)) / 2
    return {
      id: `${relation.source}-${relation.target}-${index}`,
      source: relation.source,
      target: relation.target,
      type: 'documentGraphEdge',
      data: { label: relation.keywords, labelX, labelY },
      ariaLabel: relation.description || `${relation.source} to ${relation.target}`,
      markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--muted-foreground))' },
      style: { stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1.5 },
    }
  })
  return { nodes, edges }
}
