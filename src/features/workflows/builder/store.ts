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
    const graphNodes: GraphNode[] = s.nodes.map((n) => ({
      ...n.data,
      position: { x: n.position.x, y: n.position.y },
    }))
    const graphEdges: GraphEdge[] = s.edges.map((e) => ({
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
