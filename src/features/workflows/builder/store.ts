import { create } from 'zustand'
import {
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import { nanoid } from './nanoid'
import type { GraphNode, GraphEdge, VariableDecl, NodeType, WorkflowDefinitionGraph } from '../types'
import { defaultPorts, defaultConfig, defaultLabel } from './node-registry'

// ---------------------------------------------------------------------------
// Dagre auto-layout
// ---------------------------------------------------------------------------

const NODE_WIDTH  = 180
const NODE_HEIGHT = 80

function dagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB',
): Node[] {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80 })

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
  edges.forEach((e) => g.setEdge(e.source, e.target))

  dagre.layout(g)

  return nodes.map((n) => {
    const pos = g.node(n.id)
    if (!pos) return n
    return {
      ...n,
      position: {
        x: pos.x - NODE_WIDTH  / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    }
  })
}

// ---------------------------------------------------------------------------
// XYFlow uses its own Node/Edge types — we embed our GraphNode data inside
// ---------------------------------------------------------------------------

export type FlowNode = Node<GraphNode>
export type FlowEdge = Edge<{ condition?: string }>

// Picker context — what triggered the node picker
export type PickerContext =
  | { kind: 'edge';      edgeId: string }
  | { kind: 'node';      sourceNodeId: string; sourceHandle: string }
  | null

// Where a dragged node is dropped relative to a target node.
//   before / after → insert in sequence (re-chains the line)
//   left / right   → make a parallel sibling (shares the target's parent)
export type DropPosition = 'before' | 'after' | 'left' | 'right'

export interface BuilderState {
  workflowId:    string
  name:          string
  variables:     VariableDecl[]
  nodes:         FlowNode[]
  edges:         FlowEdge[]
  selectedNodeId: string | null
  isDirty:       boolean
  validationErrors: Record<string, string[]>  // nodeId → errors

  // sidebar collapse state
  varsPanelOpen:    boolean
  configPanelOpen:  boolean
  toggleVarsPanel:  () => void
  toggleConfigPanel:() => void

  // drag-to-reorder state
  draggingNodeId:    string | null
  activeDropTarget:  { nodeId: string; position: DropPosition } | null
  setDraggingNode:   (id: string | null) => void
  setActiveDropTarget: (t: { nodeId: string; position: DropPosition } | null) => void

  // node picker
  pickerContext: PickerContext
  openPicker:   (ctx: PickerContext) => void
  closePicker:  () => void

  // actions
  setName:              (name: string) => void
  setVariables:         (vars: VariableDecl[]) => void
  onNodesChange:        (changes: NodeChange<FlowNode>[]) => void
  onEdgesChange:        (changes: EdgeChange<FlowEdge>[]) => void
  onConnect:            (connection: Connection) => void
  addNode:              (type: NodeType, position?: { x: number; y: number }) => void
  addConnectedNode:     (type: NodeType, sourceNodeId: string, sourceHandle?: string) => void
  insertNodeOnEdge:     (type: NodeType, edgeId: string) => void
  reorderNode:          (draggedId: string, targetId: string, position: DropPosition) => void
  updateNodeConfig:     (nodeId: string, config: unknown) => void
  updateNodeLabel:      (nodeId: string, label: string) => void
  selectNode:           (id: string | null) => void
  deleteSelected:       () => void
  applyDagreLayout:     (direction?: 'TB' | 'LR') => void
  loadDefinition:       (id: string, name: string, def: WorkflowDefinitionGraph) => void
  toDefinition:         () => WorkflowDefinitionGraph
  markSaved:            () => void
}

export const useBuilderStore = create<BuilderState>((set, get) => ({
  workflowId:       '',
  name:             'Untitled Workflow',
  variables:        [],
  nodes:            [],
  edges:            [],
  selectedNodeId:   null,
  isDirty:          false,
  validationErrors: {},

  varsPanelOpen:     true,
  configPanelOpen:   true,
  toggleVarsPanel:   () => set((s) => ({ varsPanelOpen:   !s.varsPanelOpen })),
  toggleConfigPanel: () => set((s) => ({ configPanelOpen: !s.configPanelOpen })),

  draggingNodeId:      null,
  activeDropTarget:    null,
  setDraggingNode:     (id) => set({ draggingNodeId: id }),
  setActiveDropTarget: (t)  => set({ activeDropTarget: t }),

  pickerContext: null,
  openPicker:   (ctx) => set({ pickerContext: ctx }),
  closePicker:  ()    => set({ pickerContext: null }),

  setName: (name) => set({ name, isDirty: true }),

  setVariables: (variables) => set({ variables, isDirty: true }),

  onNodesChange: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes), isDirty: true })),

  onEdgesChange: (changes) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges), isDirty: true })),

  onConnect: (connection) => {
    set((s) => ({
      edges: [
        ...s.edges,
        {
          id:           nanoid(),
          source:       connection.source ?? '',
          target:       connection.target ?? '',
          sourceHandle: connection.sourceHandle ?? 'out',
          targetHandle: connection.targetHandle ?? 'in',
          data:         { condition: '' },
          animated:     false,
          style:        { strokeWidth: 2 },
        } satisfies FlowEdge,
      ],
      isDirty: true,
    }))
  },

  addNode: (type, position = { x: 200 + Math.random() * 200, y: 100 + Math.random() * 200 }) => {
    const id = nanoid()
    const { inputs, outputs } = defaultPorts(type)
    const newNode: FlowNode = {
      id,
      type,                          // XYFlow uses this to pick the custom component
      position,
      data: {
        id,
        type,
        label:         defaultLabel(type),
        position:      { x: position.x, y: position.y },
        configuration: defaultConfig(type),
        inputs,
        outputs,
      },
    }
    set((s) => ({
      nodes:         [...s.nodes, newNode],
      selectedNodeId: id,
      isDirty:       true,
    }))
  },

  // Add a node connected FROM an existing node's output handle (vertical layout: below).
  addConnectedNode: (type, sourceNodeId, sourceHandle = 'out') => {
    const id = nanoid()
    const { inputs, outputs } = defaultPorts(type)
    const s = get()
    const sourceNode = s.nodes.find((n) => n.id === sourceNodeId)
    const position = sourceNode
      ? { x: sourceNode.position.x, y: sourceNode.position.y + 160 }
      : { x: 300, y: 200 }

    const newNode: FlowNode = {
      id, type, position,
      data: {
        id, type,
        label:         defaultLabel(type),
        position:      { x: position.x, y: position.y },
        configuration: defaultConfig(type),
        inputs, outputs,
      },
    }
    const newEdge: FlowEdge = {
      id:           nanoid(),
      source:       sourceNodeId,
      target:       id,
      sourceHandle: sourceHandle,
      targetHandle: 'in',
      data:         { condition: '' },
      animated:     false,
      style:        { strokeWidth: 2 },
    }
    set((s) => ({
      nodes:          [...s.nodes, newNode],
      edges:          [...s.edges, newEdge],
      selectedNodeId: id,
      isDirty:        true,
    }))
  },

  // Insert a new node in the middle of an existing edge (splits the edge in two).
  insertNodeOnEdge: (type, edgeId) => {
    const s = get()
    const edge = s.edges.find((e) => e.id === edgeId)
    if (!edge) return

    const id = nanoid()
    const { inputs, outputs } = defaultPorts(type)
    const sourceNode = s.nodes.find((n) => n.id === edge.source)
    const targetNode = s.nodes.find((n) => n.id === edge.target)
    const position = sourceNode && targetNode
      ? {
          x: (sourceNode.position.x + targetNode.position.x) / 2,
          y: (sourceNode.position.y + targetNode.position.y) / 2,
        }
      : { x: 300, y: 200 }

    const newNode: FlowNode = {
      id, type, position,
      data: {
        id, type,
        label:         defaultLabel(type),
        position:      { x: position.x, y: position.y },
        configuration: defaultConfig(type),
        inputs, outputs,
      },
    }
    const edgeToSource: FlowEdge = {
      id:           nanoid(),
      source:       edge.source,
      target:       id,
      sourceHandle: edge.sourceHandle ?? 'out',
      targetHandle: 'in',
      data:         { condition: '' },
      animated:     false,
      style:        { strokeWidth: 2 },
    }
    const edgeToTarget: FlowEdge = {
      id:           nanoid(),
      source:       id,
      target:       edge.target,
      sourceHandle: 'out',
      targetHandle: edge.targetHandle ?? 'in',
      data:         { condition: '' },
      animated:     false,
      style:        { strokeWidth: 2 },
    }
    set((s) => ({
      nodes:          [...s.nodes, newNode],
      edges:          [...s.edges.filter((e) => e.id !== edgeId), edgeToSource, edgeToTarget],
      selectedNodeId: id,
      isDirty:        true,
    }))
  },

  // Reorder: detach draggedId from its current position and re-attach it
  // relative to targetId, rewiring all edges automatically.
  //   before / after → splice into the sequence (re-chain the line)
  //   left / right   → make a parallel sibling sharing the target's parents
  reorderNode: (draggedId, targetId, position) => {
    if (draggedId === targetId) return
    const s = get()

    const incomingToDragged   = s.edges.filter((e) => e.target === draggedId)
    const outgoingFromDragged = s.edges.filter((e) => e.source === draggedId)
    const incomingToTarget    = s.edges.filter((e) => e.target === targetId)
    const outgoingFromTarget   = s.edges.filter((e) => e.source === targetId)

    const mk = (source: string, target: string, sourceHandle = 'out', targetHandle = 'in'): FlowEdge => ({
      id:           nanoid(),
      source, target, sourceHandle, targetHandle,
      data:         { condition: '' },
      animated:     false,
      style:        { strokeWidth: 2 },
    })

    // Edge ids to remove + new edges to add, decided per drop position.
    const removeIds = new Set<string>()
    const newEdges: FlowEdge[] = []

    if (position === 'left' || position === 'right') {
      // Parallel sibling: detach dragged from its own parents/children and
      // attach it to the SAME parents as the target (fan-out branch).
      // Target keeps its own edges untouched.
      for (const e of incomingToDragged)   removeIds.add(e.id)
      for (const e of outgoingFromDragged) removeIds.add(e.id)

      // Bridge dragged's old parents → dragged's old children so the line
      // dragged was sitting in doesn't break.
      for (const pe of incomingToDragged) {
        for (const ce of outgoingFromDragged) {
          newEdges.push(mk(pe.source, ce.target, pe.sourceHandle ?? 'out', ce.targetHandle ?? 'in'))
        }
      }

      // Attach dragged under each of the target's parents → sibling of target.
      for (const e of incomingToTarget) {
        newEdges.push(mk(e.source, draggedId, e.sourceHandle ?? 'out', 'in'))
      }
    } else if (position === 'before') {
      // Insert dragged immediately before target in the chain.
      for (const e of incomingToDragged)   removeIds.add(e.id)
      for (const e of outgoingFromDragged) removeIds.add(e.id)
      for (const e of incomingToTarget)    removeIds.add(e.id)

      // dragged's old parents → dragged
      for (const e of incomingToDragged) {
        newEdges.push(mk(e.source, draggedId, e.sourceHandle ?? 'out', 'in'))
      }
      // target's old parents → dragged
      for (const e of incomingToTarget) {
        if (!incomingToDragged.some((de) => de.source === e.source)) {
          newEdges.push(mk(e.source, draggedId, e.sourceHandle ?? 'out', 'in'))
        }
      }
      // dragged → target
      newEdges.push(mk(draggedId, targetId))
      // dragged's old children rerouted from target
      for (const e of outgoingFromDragged) {
        if (e.target !== targetId) {
          newEdges.push(mk(targetId, e.target, 'out', e.targetHandle ?? 'in'))
        }
      }
    } else {
      // position === 'after': insert dragged immediately after target.
      for (const e of incomingToDragged)   removeIds.add(e.id)
      for (const e of outgoingFromDragged) removeIds.add(e.id)
      for (const e of outgoingFromTarget)  removeIds.add(e.id)

      // target → dragged
      newEdges.push(mk(targetId, draggedId))
      // dragged's old parents → target's old children
      for (const e of outgoingFromTarget) {
        if (e.target !== draggedId) {
          for (const pe of incomingToDragged) {
            newEdges.push(mk(pe.source, e.target, pe.sourceHandle ?? 'out', 'in'))
          }
        }
      }
      // dragged → its old children
      for (const e of outgoingFromDragged) {
        newEdges.push(mk(draggedId, e.target, 'out', e.targetHandle ?? 'in'))
      }
    }

    const keptEdges = s.edges.filter((e) => !removeIds.has(e.id))

    // Merge kept + new edges, then dedup self-loops and duplicate
    // source→target pairs, and drop any edge whose endpoints don't both exist.
    const nodeIds = new Set(s.nodes.map((n) => n.id))
    const seen = new Set<string>()
    const finalEdges = [...keptEdges, ...newEdges].filter((e) => {
      if (e.source === e.target) return false
      if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) return false
      const key = `${e.source}→${e.target}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    set(() => ({
      edges:   finalEdges,
      isDirty: true,
    }))
  },

  updateNodeConfig: (nodeId, config) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, configuration: config } } : n,
      ),
      isDirty: true,
    })),

  updateNodeLabel: (nodeId, label) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, label } } : n,
      ),
      isDirty: true,
    })),

  selectNode: (id) => set({ selectedNodeId: id }),

  deleteSelected: () =>
    set((s) => ({
      nodes: s.nodes.filter((n) => !n.selected),
      edges: s.edges.filter((e) => !e.selected),
      selectedNodeId: null,
      isDirty: true,
    })),

  applyDagreLayout: (direction = 'TB') =>
    set((s) => ({
      nodes: dagreLayout(s.nodes, s.edges, direction) as FlowNode[],
      isDirty: true,
    })),

  loadDefinition: (id, name, def) => {
    const nodes: FlowNode[] = def.nodes.map((gn) => ({
      id:       gn.id,
      type:     gn.type,
      position: { x: gn.position.x, y: gn.position.y },
      data:     gn,
    }))

    const edges: FlowEdge[] = def.edges.map((ge) => ({
      id:           ge.id,
      source:       ge.source,
      target:       ge.target,
      sourceHandle: ge.source_handle,
      targetHandle: ge.target_handle,
      data:         { condition: ge.condition ?? '' },
      animated:     false,
      style:        { strokeWidth: 2 },
    }))

    set({
      workflowId:    id,
      name,
      variables:     def.variables ?? [],
      nodes,
      edges,
      selectedNodeId: null,
      isDirty:       false,
    })
  },

  toDefinition: (): WorkflowDefinitionGraph => {
    const s = get()
    const nodeIds = new Set(s.nodes.map((n) => n.id))
    const graphNodes: GraphNode[] = s.nodes.map((n) => ({
      ...n.data,
      position: { x: n.position.x, y: n.position.y },
    }))
    // Drop any edge whose source or target node no longer exists. This guards
    // against dangling edges left behind by deletes or reorders (the backend
    // rejects a definition that references a missing node).
    const graphEdges: GraphEdge[] = s.edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({
        id:            e.id,
        source:        e.source,
        target:        e.target,
        source_handle: e.sourceHandle ?? 'out',
        target_handle: e.targetHandle ?? 'in',
        condition:     e.data?.condition ?? '',
      }))
    return {
      id:        s.workflowId,
      variables: s.variables,
      nodes:     graphNodes,
      edges:     graphEdges,
      metadata:  { version: 1 },
    }
  },

  markSaved: () => set({ isDirty: false }),
}))
