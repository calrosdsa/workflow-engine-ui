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
// fetch_records serialisation — strip UI-only `id` keys from filter/sort
// ---------------------------------------------------------------------------

interface RawGroup {
  id?: string
  combinator?: string
  conditions?: Array<{ id?: string } & Record<string, unknown>>
  groups?: RawGroup[]
}

function stripGroupIds(g: RawGroup): Record<string, unknown> {
  return {
    combinator: g.combinator ?? 'and',
    conditions: (g.conditions ?? []).map(({ id: _id, ...rest }) => rest),
    groups: (g.groups ?? []).map(stripGroupIds),
  }
}

function stripFetchRecordsIds(cfg: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...cfg }
  if (cfg.filter && typeof cfg.filter === 'object') {
    out.filter = stripGroupIds(cfg.filter as RawGroup)
  }
  if (Array.isArray(cfg.sort)) {
    out.sort = (cfg.sort as Array<{ id?: string } & Record<string, unknown>>).map(({ id: _id, ...rest }) => rest)
  }
  return out
}

// http_request serialisation — strip UI-only `id` keys from every
// KeyValuePair list (params/headers/body_form). Same purpose as
// stripFetchRecordsIds above.
function stripIdKey<T extends { id?: string }>(rows: T[] | undefined): Omit<T, 'id'>[] {
  return (rows ?? []).map(({ id: _id, ...rest }) => rest)
}

// Strips response_schemas' UI-only ids one level deeper than the flat lists
// above: each schema itself has an id, and each of its field rows has its own.
function stripResponseSchemaIds(schemas: unknown): Record<string, unknown>[] {
  if (!Array.isArray(schemas)) return []
  return (schemas as Array<{ id?: string; fields?: Array<{ id?: string }> } & Record<string, unknown>>)
    .map(({ id: _id, fields, ...rest }) => ({ ...rest, fields: stripIdKey(fields) }))
}

function stripHttpRequestIds(cfg: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...cfg }
  if (Array.isArray(cfg.params)) out.params = stripIdKey(cfg.params as Array<{ id?: string }>)
  if (Array.isArray(cfg.headers)) out.headers = stripIdKey(cfg.headers as Array<{ id?: string }>)
  if (Array.isArray(cfg.body_form)) out.body_form = stripIdKey(cfg.body_form as Array<{ id?: string }>)
  if (Array.isArray(cfg.response_schemas)) out.response_schemas = stripResponseSchemaIds(cfg.response_schemas)
  return out
}

// trigger serialisation — strip UI-only `id` keys from the (optional) filter
// tree. Same shape/purpose as stripFetchRecordsIds' filter handling above.
function stripTriggerIds(cfg: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...cfg }
  if (cfg.filter && typeof cfg.filter === 'object') {
    out.filter = stripGroupIds(cfg.filter as RawGroup)
  }
  return out
}

// ---------------------------------------------------------------------------
// Node construction helpers
// ---------------------------------------------------------------------------

function makeNode(type: NodeType | (string & {}), position: { x: number; y: number }): FlowNode {
  const id = nanoid()
  const { inputs, outputs } = defaultPorts(type)
  return {
    id, type, position,
    data: {
      id, type,
      label:         defaultLabel(type),
      position:      { x: position.x, y: position.y },
      configuration: defaultConfig(type),
      inputs, outputs,
    },
  }
}

function makeEdge(source: string, target: string, sourceHandle = 'out', targetHandle = 'in'): FlowEdge {
  return {
    id: nanoid(),
    source, target, sourceHandle, targetHandle,
    data: { condition: '' },
    animated: false,
    style: { strokeWidth: 2 },
  }
}

// Builds an iterator + its paired Loop End node, linked iterator→loop_end, with
// the iterator's config pointing at the loop_end id. The Loop End sits below so
// body nodes can be dropped between them.
function makeIteratorPair(position: { x: number; y: number }) {
  const iterator = makeNode('iterator', position)
  const loopEnd = makeNode('loop_end', { x: position.x, y: position.y + 220 })
  iterator.data.configuration = {
    ...(iterator.data.configuration as Record<string, unknown>),
    loop_end_id: loopEnd.id,
  }
  const edge = makeEdge(iterator.id, loopEnd.id)
  return { iterator, loopEnd, edge }
}

// An iterator and its loop_end always live and die together: deleting either
// one pulls the partner into the deletion set, so the graph never keeps an
// orphaned half (the backend rejects an iterator without its loop_end).
function expandLoopPairs(nodes: FlowNode[], ids: Set<string>): Set<string> {
  const expanded = new Set(ids)
  for (const n of nodes) {
    if (n.data.type !== 'iterator') continue
    const endId = (n.data.configuration as { loop_end_id?: string } | undefined)?.loop_end_id
    if (!endId) continue
    if (expanded.has(n.id)) expanded.add(endId)
    else if (expanded.has(endId)) expanded.add(n.id)
  }
  return expanded
}

// Removes `ids` from the edge list while healing the chain: each removed
// node's parents are bridged to its children, so deleting a middle node never
// orphans the downstream subtree. Contracting one id at a time makes runs of
// adjacent removed nodes resolve transitively.
function contractNodes(edges: FlowEdge[], ids: Set<string>): FlowEdge[] {
  let out = edges
  for (const id of ids) {
    const incoming = out.filter((e) => e.target === id)
    const outgoing = out.filter((e) => e.source === id)
    const rest     = out.filter((e) => e.source !== id && e.target !== id)
    const bridged: FlowEdge[] = []
    for (const ie of incoming) {
      for (const oe of outgoing) {
        bridged.push(makeEdge(ie.source, oe.target, ie.sourceHandle ?? 'out', oe.targetHandle ?? 'in'))
      }
    }
    out = [...rest, ...bridged]
  }
  // Dedup source→target pairs and drop self-loops introduced by bridging.
  const seen = new Set<string>()
  return out.filter((e) => {
    if (e.source === e.target) return false
    const key = `${e.source}→${e.target}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Node types where "duplicate" makes sense — excludes structural/singleton
// nodes (entry points, exit, merge) and nodes with multi-handle or paired
// semantics (condition, iterator/loop_end) where an insert-after copy would
// corrupt the graph shape.
export const DUPLICABLE_NODE_TYPES: ReadonlySet<NodeType> = new Set<NodeType>([
  'set_variable', 'fetch_records', 'upsert_records', 'update_records',
  'delete_records', 'http_request', 'show_message', 'subflow',
])

// The workflow's entry point can't be re-added from the picker, so deletion
// keeps at least one trigger/entry node alive. Returns the ids allowed to go.
function protectEntryPoint(nodes: FlowNode[], ids: Set<string>): Set<string> {
  const entryIds = nodes
    .filter((n) => n.data.type === 'trigger' || n.data.type === 'entry')
    .map((n) => n.id)
  const survives = entryIds.some((id) => !ids.has(id))
  if (survives || entryIds.length === 0) return ids
  const allowed = new Set(ids)
  for (const id of entryIds) allowed.delete(id)
  return allowed
}

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

  // Add nodes in left-to-right (x) order so dagre's initial within-rank ordering
  // follows the current horizontal layout. This keeps sibling order stable across
  // reorders — a node nudged just left/right of a sibling stays on that side.
  const ordered = [...nodes].sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0))
  ordered.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
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

// A point-in-time copy of everything undo/redo restores. Positions are
// included so undoing a structural change also rolls back the re-layout.
interface HistorySnapshot {
  name:      string
  variables: VariableDecl[]
  nodes:     FlowNode[]
  edges:     FlowEdge[]
}

export interface BuilderState {
  workflowId:    string
  name:          string
  variables:     VariableDecl[]
  nodes:         FlowNode[]
  edges:         FlowEdge[]
  selectedNodeId: string | null
  isDirty:       boolean
  validationErrors: Record<string, string[]>  // nodeId → errors

  // undo/redo
  past:   HistorySnapshot[]
  future: HistorySnapshot[]
  undo: () => void
  redo: () => void

  // Exclusive sidebar state (FR-C5-008) — at most one of Variables/Node
  // Config/Executions open at a time. varsPanelOpen/configPanelOpen/
  // executionsPanelOpen are derived getters kept for call-site compatibility
  // with the three panels, which each still just read "am I open."
  activeSidebar: 'variables' | 'config' | 'executions' | null
  varsPanelOpen:    boolean
  configPanelOpen:  boolean
  executionsPanelOpen: boolean
  /** Widen the config panel (e.g. for the HTTP node's response schema
   *  builder). Orthogonal to which sidebar is active — a global preference,
   *  not scoped per-node (never reset on node selection). */
  configPanelWide:  boolean
  toggleVarsPanel:  () => void
  toggleConfigPanel:() => void
  toggleExecutionsPanel: () => void
  /** Idempotent open (unlike toggleExecutionsPanel) — for programmatic opens
   *  (e.g. a Run completing) where flipping an already-open panel closed
   *  would be wrong. */
  openExecutionsPanel: () => void
  toggleConfigPanelWide: () => void
  closeActiveSidebar: () => void

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
  // `type` accepts NodeType | (string & {}) — every built-in NodeType
  // literal still autocompletes/type-checks normally, but a runtime
  // connector type string (never a real NodeType) is also accepted. The
  // `& {}` intersection is what keeps literal-string autocomplete alive
  // for callers passing a NodeType constant, rather than TypeScript
  // collapsing the union to plain `string` and losing that ergonomics —
  // see connector-registry.ts's header comment for why NodeType itself
  // must stay closed rather than being widened at its own declaration.
  addNode:              (type: NodeType | (string & {}), position?: { x: number; y: number }) => void
  addConnectedNode:     (type: NodeType | (string & {}), sourceNodeId: string, sourceHandle?: string) => void
  insertNodeOnEdge:     (type: NodeType | (string & {}), edgeId: string) => void
  reorderNode:          (draggedId: string, targetId: string, position: DropPosition) => void
  deleteBranch:         (parentId: string, branchRootId: string) => void
  swapLastTwoBranches:  (parentId: string) => void
  updateNodeConfig:     (nodeId: string, config: unknown) => void
  updateNodeLabel:      (nodeId: string, label: string) => void
  selectNode:           (id: string | null) => void
  deleteNode:           (nodeId: string) => void
  duplicateNode:        (nodeId: string) => void
  deleteSelected:       () => void
  seedNew:              () => void
  applyDagreLayout:     (direction?: 'TB' | 'LR') => void
  loadDefinition:       (id: string, name: string, def: WorkflowDefinitionGraph) => void
  toDefinition:         () => WorkflowDefinitionGraph
  markSaved:            () => void
}

const HISTORY_LIMIT = 50

export const useBuilderStore = create<BuilderState>((set, get) => {
  // Coalescing state for keystroke-level edits: consecutive pushes with the
  // same key inside the window collapse into one undo step, so undoing a
  // typed expression removes the whole burst, not one character.
  let lastHistoryKey: string | null = null
  let lastHistoryTime = 0

  const snapshot = (): HistorySnapshot => {
    const s = get()
    return structuredClone({ name: s.name, variables: s.variables, nodes: s.nodes, edges: s.edges })
  }

  /** Call BEFORE mutating. Pass a key for continuous edits (typing) so they
   *  coalesce; structural changes push unconditionally. Clears redo. */
  const pushHistory = (key?: string) => {
    const now = Date.now()
    if (key && key === lastHistoryKey && now - lastHistoryTime < 1200) {
      lastHistoryTime = now
      return
    }
    lastHistoryKey  = key ?? null
    lastHistoryTime = now
    set((s) => ({ past: [...s.past, snapshot()].slice(-HISTORY_LIMIT), future: [] }))
  }

  const resetHistory = () => {
    lastHistoryKey = null
    lastHistoryTime = 0
  }

  return {
  workflowId:       '',
  name:             'Untitled Workflow',
  variables:        [],
  nodes:            [],
  edges:            [],
  selectedNodeId:   null,
  isDirty:          false,
  validationErrors: {},

  past:   [],
  future: [],

  undo: () => {
    const s = get()
    const prev = s.past[s.past.length - 1]
    if (!prev) return
    const current = snapshot()
    resetHistory()
    set({
      name:      prev.name,
      variables: prev.variables,
      nodes:     prev.nodes.map((n) => ({ ...n, selected: false })),
      edges:     prev.edges.map((e) => ({ ...e, selected: false })),
      past:      s.past.slice(0, -1),
      future:    [...s.future, current],
      selectedNodeId:   null,
      pickerContext:    null,
      draggingNodeId:   null,
      activeDropTarget: null,
      isDirty:   true,
    })
  },

  redo: () => {
    const s = get()
    const next = s.future[s.future.length - 1]
    if (!next) return
    const current = snapshot()
    resetHistory()
    set({
      name:      next.name,
      variables: next.variables,
      nodes:     next.nodes.map((n) => ({ ...n, selected: false })),
      edges:     next.edges.map((e) => ({ ...e, selected: false })),
      future:    s.future.slice(0, -1),
      past:      [...s.past, current],
      selectedNodeId:   null,
      pickerContext:    null,
      draggingNodeId:   null,
      activeDropTarget: null,
      isDirty:   true,
    })
  },

  // Variables starts as the active sidebar (matches today's "both open by
  // default" starting impression without violating the new exclusivity rule).
  activeSidebar:       'variables',
  varsPanelOpen:       true,
  configPanelOpen:     false,
  executionsPanelOpen: false,
  configPanelWide:     false,
  toggleVarsPanel: () => set((s) => {
    const next = s.activeSidebar === 'variables' ? null : 'variables'
    return { activeSidebar: next, varsPanelOpen: next === 'variables', configPanelOpen: next === 'config', executionsPanelOpen: next === 'executions' }
  }),
  toggleConfigPanel: () => set((s) => {
    const next = s.activeSidebar === 'config' ? null : 'config'
    return { activeSidebar: next, varsPanelOpen: next === 'variables', configPanelOpen: next === 'config', executionsPanelOpen: next === 'executions' }
  }),
  toggleExecutionsPanel: () => set((s) => {
    const next = s.activeSidebar === 'executions' ? null : 'executions'
    return { activeSidebar: next, varsPanelOpen: next === 'variables', configPanelOpen: next === 'config', executionsPanelOpen: next === 'executions' }
  }),
  openExecutionsPanel: () => set({ activeSidebar: 'executions', varsPanelOpen: false, configPanelOpen: false, executionsPanelOpen: true }),
  toggleConfigPanelWide: () => set((s) => ({ configPanelWide: !s.configPanelWide })),
  closeActiveSidebar: () => set({ activeSidebar: null, varsPanelOpen: false, configPanelOpen: false, executionsPanelOpen: false }),

  draggingNodeId:      null,
  activeDropTarget:    null,
  setDraggingNode:     (id) => set({ draggingNodeId: id }),
  setActiveDropTarget: (t)  => set({ activeDropTarget: t }),

  pickerContext: null,
  openPicker:   (ctx) => set({ pickerContext: ctx }),
  closePicker:  ()    => set({ pickerContext: null }),

  setName: (name) => {
    pushHistory('name')
    set({ name, isDirty: true })
  },

  setVariables: (variables) => {
    pushHistory('vars')
    set({ variables, isDirty: true })
  },

  onNodesChange: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes), isDirty: true })),

  onEdgesChange: (changes) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges), isDirty: true })),

  onConnect: (connection) => {
    pushHistory()
    set((s) => ({
      edges: [
        ...s.edges,
        makeEdge(
          connection.source ?? '',
          connection.target ?? '',
          connection.sourceHandle ?? 'out',
          connection.targetHandle ?? 'in',
        ),
      ],
      isDirty: true,
    }))
  },

  addNode: (type, position = { x: 200 + Math.random() * 200, y: 100 + Math.random() * 200 }) => {
    pushHistory()
    const newNode = makeNode(type, position)
    // An iterator auto-creates its paired Loop End so the body region exists.
    if (type === 'iterator') {
      const { iterator, loopEnd, edge } = makeIteratorPair(position)
      set((s) => ({
        nodes:          [...s.nodes, iterator, loopEnd],
        edges:          [...s.edges, edge],
        selectedNodeId: iterator.id,
        isDirty:        true,
      }))
      return
    }
    set((s) => ({
      nodes:         [...s.nodes, newNode],
      selectedNodeId: newNode.id,
      isDirty:       true,
    }))
  },

  // Add a node connected FROM an existing node's output handle (vertical layout: below).
  addConnectedNode: (type, sourceNodeId, sourceHandle = 'out') => {
    pushHistory()
    const s = get()
    const sourceNode = s.nodes.find((n) => n.id === sourceNodeId)
    const position = sourceNode
      ? { x: sourceNode.position.x, y: sourceNode.position.y + 160 }
      : { x: 300, y: 200 }

    const linkEdge = (target: string): FlowEdge => ({
      id: nanoid(), source: sourceNodeId, target,
      sourceHandle, targetHandle: 'in',
      data: { condition: '' }, animated: false, style: { strokeWidth: 2 },
    })

    // Iterator auto-pairs with a Loop End; the source links into the iterator.
    if (type === 'iterator') {
      const { iterator, loopEnd, edge } = makeIteratorPair(position)
      set((st) => ({
        nodes:          [...st.nodes, iterator, loopEnd],
        edges:          [...st.edges, linkEdge(iterator.id), edge],
        selectedNodeId: iterator.id,
        isDirty:        true,
      }))
      return
    }

    // "+ Add next node" on whatever currently sits at the TAIL of a loop
    // body — the iterator itself (empty body, still wired straight to its
    // own loop_end by makeIteratorPair) or the last node already inside a
    // non-empty body (its one outgoing edge points at that same loop_end) —
    // must land the new node INSIDE the loop, not fork a dead-end sibling
    // branch off it. A plain linkEdge here would give the tail node two
    // children (loop_end, plus this new node going nowhere) — structurally
    // legal (multi-branch fan-out is a real, supported feature for every
    // node type, incl. iterators — see the branch toolbar's own "add a new
    // branch" action, still reachable when a node already has 2+ children)
    // but never what a plain "+" click on a loop-body tail is asking for.
    // Splice the new node onto the tail→loop_end edge instead — the same
    // rewiring insertNodeOnEdge does for "insert here" on an arbitrary edge,
    // just triggered from the source-node side. Both the frontend's own
    // loop-body inference (BaseNode.tsx's isLoopBodyTail, computed the same
    // way) and the backend's (graph.DAG.LoopBody, walked purely from edges)
    // agree that "inside the loop" = topologically between iterator and
    // loop_end, so this is enough to make the node genuinely part of the
    // loop, not just visually near it.
    const loopEndNodeIds = new Set(s.nodes.filter((n) => n.data.type === 'loop_end').map((n) => n.id))
    const sourceOutgoing = s.edges.filter((e) => e.source === sourceNodeId)
    const tailEdge = sourceOutgoing.length === 1 && loopEndNodeIds.has(sourceOutgoing[0].target)
      ? sourceOutgoing[0]
      : undefined
    if (tailEdge) {
      const newNode = makeNode(type, position)
      const edgeToNew: FlowEdge = {
        id: nanoid(), source: sourceNodeId, target: newNode.id,
        sourceHandle: tailEdge.sourceHandle ?? 'out', targetHandle: 'in',
        data: { condition: '' }, animated: false, style: { strokeWidth: 2 },
      }
      const edgeToLoopEnd: FlowEdge = {
        id: nanoid(), source: newNode.id, target: tailEdge.target,
        sourceHandle: 'out', targetHandle: tailEdge.targetHandle ?? 'in',
        data: { condition: '' }, animated: false, style: { strokeWidth: 2 },
      }
      set((st) => ({
        nodes:          [...st.nodes, newNode],
        edges:          [...st.edges.filter((e) => e.id !== tailEdge.id), edgeToNew, edgeToLoopEnd],
        selectedNodeId: newNode.id,
        isDirty:        true,
      }))
      return
    }

    const newNode = makeNode(type, position)
    set((st) => ({
      nodes:          [...st.nodes, newNode],
      edges:          [...st.edges, linkEdge(newNode.id)],
      selectedNodeId: newNode.id,
      isDirty:        true,
    }))
  },

  // Insert a new node in the middle of an existing edge (splits the edge in two).
  insertNodeOnEdge: (type, edgeId) => {
    const s = get()
    const edge = s.edges.find((e) => e.id === edgeId)
    if (!edge) return
    pushHistory()

    const sourceNode = s.nodes.find((n) => n.id === edge.source)
    const targetNode = s.nodes.find((n) => n.id === edge.target)
    const position = sourceNode && targetNode
      ? {
          x: (sourceNode.position.x + targetNode.position.x) / 2,
          y: (sourceNode.position.y + targetNode.position.y) / 2,
        }
      : { x: 300, y: 200 }

    // An Iterator inserted mid-edge needs its paired Loop End auto-created
    // right along with it, same as addNode/addConnectedNode already do for
    // every other iterator-creation entry point — otherwise "insert here"
    // on an edge is the one remaining way to end up with a genuinely
    // invalid Iterator (loop_end_id pointing nowhere), which the backend
    // only catches at save/publish time as a confusing validation error.
    // Splits the edge into source→iterator→loopEnd→target instead of the
    // usual source→node→target, so the loop body starts out empty exactly
    // like a freshly-dropped iterator's does.
    if (type === 'iterator') {
      const { iterator, loopEnd, edge: iterToLoopEnd } = makeIteratorPair(position)
      const edgeToIterator: FlowEdge = {
        id: nanoid(), source: edge.source, target: iterator.id,
        sourceHandle: edge.sourceHandle ?? 'out', targetHandle: 'in',
        data: { condition: '' }, animated: false, style: { strokeWidth: 2 },
      }
      const edgeFromLoopEnd: FlowEdge = {
        id: nanoid(), source: loopEnd.id, target: edge.target,
        sourceHandle: 'out', targetHandle: edge.targetHandle ?? 'in',
        data: { condition: '' }, animated: false, style: { strokeWidth: 2 },
      }
      set((st) => ({
        nodes: [...st.nodes, iterator, loopEnd],
        edges: [...st.edges.filter((e) => e.id !== edgeId), edgeToIterator, iterToLoopEnd, edgeFromLoopEnd],
        selectedNodeId: iterator.id,
        isDirty: true,
      }))
      return
    }

    const id = nanoid()
    const { inputs, outputs } = defaultPorts(type)
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
  //   left / right   → make a parallel sibling sharing the target's parents;
  //                    the dragged node's ENTIRE downstream subtree moves with it
  reorderNode: (draggedId, targetId, position) => {
    if (draggedId === targetId) return
    pushHistory()
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

    // siblingX is set for left/right moves: the x the dragged subtree's root
    // should sit at relative to the target, so execution order (which sorts
    // children by position.x) matches the drop side immediately, before dagre
    // re-runs. left → just left of target; right → just right of target.
    let siblingX: number | null = null

    if (position === 'left' || position === 'right') {
      // Parallel sibling. Detach the dragged node from its OWN parents only —
      // its outgoing edges are LEFT INTACT, so the whole downstream subtree
      // travels with it (Bug 2). Re-attach the dragged node under each of the
      // target's parents, making it a sibling of target.
      for (const e of incomingToDragged) removeIds.add(e.id)
      for (const e of incomingToTarget) {
        newEdges.push(mk(e.source, draggedId, e.sourceHandle ?? 'out', 'in'))
      }

      // Position the dragged root just to the left/right of the target so the
      // left-to-right execution order reflects the drop side (Bug 1). dagre will
      // refine spacing on the subsequent layout pass but preserve this ordering.
      const targetNode = s.nodes.find((n) => n.id === targetId)
      if (targetNode) {
        siblingX = position === 'left'
          ? targetNode.position.x - (NODE_WIDTH + 60)
          : targetNode.position.x + (NODE_WIDTH + 60)
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
    let finalEdges = [...keptEdges, ...newEdges].filter((e) => {
      if (e.source === e.target) return false
      if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) return false
      const key = `${e.source}→${e.target}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // For a left/right move, dagre lays siblings out in edge order — but
    // empirically (verified against @dagrejs/dagre directly) the LAST edge
    // added from a shared parent ends up on the LEFT and the FIRST stays on
    // the RIGHT, the opposite of the naive assumption. So to land the dragged
    // node on the requested side, a 'left' drop must make parent→dragged the
    // LAST edge from that parent (insert after parent→target) and a 'right'
    // drop must make it come BEFORE parent→target.
    if (position === 'left' || position === 'right') {
      const parents = incomingToTarget.map((e) => e.source)
      for (const parent of parents) {
        const di = finalEdges.findIndex((e) => e.source === parent && e.target === draggedId)
        const ti = finalEdges.findIndex((e) => e.source === parent && e.target === targetId)
        if (di === -1 || ti === -1) continue
        const [draggedEdge] = finalEdges.splice(di, 1)
        // Recompute target index after the splice.
        const ti2 = finalEdges.findIndex((e) => e.source === parent && e.target === targetId)
        const insertAt = position === 'left' ? ti2 + 1 : ti2
        finalEdges = [
          ...finalEdges.slice(0, insertAt),
          draggedEdge,
          ...finalEdges.slice(insertAt),
        ]
      }
    }

    // Nudge the dragged subtree's root x so execution order (sorted by x) matches
    // the drop side immediately; dagre refines positions on the next layout pass.
    const nodes = siblingX === null
      ? s.nodes
      : s.nodes.map((n) =>
          n.id === draggedId
            ? { ...n, position: { ...n.position, x: siblingX as number } }
            : n,
        )

    set(() => ({
      nodes,
      edges:   finalEdges,
      isDirty: true,
    }))
  },

  // Removes an entire parallel branch — the branchRootId subtree reachable
  // only through parentId's edge to it (siblings sharing further-downstream
  // nodes, e.g. after a merge, are left intact).
  deleteBranch: (parentId, branchRootId) => {
    pushHistory()
    const s = get()
    const toRemove = new Set<string>([branchRootId])
    const queue = [branchRootId]
    while (queue.length > 0) {
      const cur = queue.shift()!
      for (const e of s.edges) {
        if (e.source !== cur) continue
        // Keep a descendant if it has another parent outside this branch
        // (e.g. a merge node rejoining a sibling branch).
        const hasOtherParent = s.edges.some((pe) => pe.target === e.target && !toRemove.has(pe.source) && pe.source !== cur)
        if (!hasOtherParent && !toRemove.has(e.target)) {
          toRemove.add(e.target)
          queue.push(e.target)
        }
      }
    }
    set(() => ({
      nodes:   s.nodes.filter((n) => !toRemove.has(n.id)),
      edges:   s.edges.filter((e) => !toRemove.has(e.source) && !toRemove.has(e.target)),
      selectedNodeId: s.selectedNodeId && toRemove.has(s.selectedNodeId) ? null : s.selectedNodeId,
      isDirty: true,
    }))
  },

  // Swaps the horizontal position of the two rightmost branches fanning out
  // from parentId, so their left-to-right (execution) order flips.
  swapLastTwoBranches: (parentId) => {
    const s = get()
    const childIds = Array.from(new Set(s.edges.filter((e) => e.source === parentId).map((e) => e.target)))
    if (childIds.length < 2) return
    const sorted = [...childIds].sort((a, b) => {
      const na = s.nodes.find((n) => n.id === a)
      const nb = s.nodes.find((n) => n.id === b)
      return (na?.position.x ?? 0) - (nb?.position.x ?? 0)
    })
    const [secondLast, last] = sorted.slice(-2)
    const nodeA = s.nodes.find((n) => n.id === secondLast)
    const nodeB = s.nodes.find((n) => n.id === last)
    if (!nodeA || !nodeB) return
    pushHistory()
    set(() => ({
      nodes: s.nodes.map((n) => {
        if (n.id === secondLast) return { ...n, position: { ...n.position, x: nodeB.position.x } }
        if (n.id === last)       return { ...n, position: { ...n.position, x: nodeA.position.x } }
        return n
      }),
      isDirty: true,
    }))
  },

  updateNodeConfig: (nodeId, config) => {
    pushHistory(`cfg:${nodeId}`)
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, configuration: config } } : n,
      ),
      isDirty: true,
    }))
  },

  updateNodeLabel: (nodeId, label) => {
    pushHistory(`label:${nodeId}`)
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, label } } : n,
      ),
      isDirty: true,
    }))
  },

  // Selecting a node auto-opens Node Config exclusively (FR-C5-008) — closes
  // Variables/Executions if either was open. Deselecting (id === null, e.g.
  // an empty-canvas click) leaves activeSidebar untouched here; the canvas's
  // own onPaneClick additionally calls closeActiveSidebar for that case.
  selectNode: (id) => set((s) => {
    if (id === null) return { selectedNodeId: null }
    return { selectedNodeId: id, activeSidebar: 'config', varsPanelOpen: false, configPanelOpen: true, executionsPanelOpen: false }
  }),

  // Deletes one node, healing the chain (parents bridged to children).
  // Iterator/loop_end delete as a pair; any body nodes fold into the main chain.
  deleteNode: (nodeId) => {
    const s = get()
    if (!s.nodes.some((n) => n.id === nodeId)) return
    const ids = protectEntryPoint(s.nodes, expandLoopPairs(s.nodes, new Set([nodeId])))
    if (ids.size === 0) return
    pushHistory()
    set(() => ({
      nodes: s.nodes.filter((n) => !ids.has(n.id)),
      edges: contractNodes(s.edges, ids),
      selectedNodeId: s.selectedNodeId && ids.has(s.selectedNodeId) ? null : s.selectedNodeId,
      isDirty: true,
    }))
  },

  // Inserts a configured copy right after the original in the chain.
  duplicateNode: (nodeId) => {
    const s = get()
    const src = s.nodes.find((n) => n.id === nodeId)
    if (!src || !DUPLICABLE_NODE_TYPES.has(src.data.type)) return
    pushHistory()
    const copy = makeNode(src.data.type, { x: src.position.x, y: src.position.y + 160 })
    copy.data.label = src.data.label
    copy.data.configuration = structuredClone(src.data.configuration)
    const outgoing = s.edges.filter((e) => e.source === nodeId)
    set(() => ({
      nodes: [...s.nodes, copy],
      edges: [
        ...s.edges.filter((e) => e.source !== nodeId),
        makeEdge(nodeId, copy.id),
        ...outgoing.map((e) => makeEdge(copy.id, e.target, 'out', e.targetHandle ?? 'in')),
      ],
      selectedNodeId: copy.id,
      isDirty: true,
    }))
  },

  deleteSelected: () => {
    const s = get()
    const selNodeIds = new Set(s.nodes.filter((n) => n.selected).map((n) => n.id))
    const selEdgeIds = new Set(s.edges.filter((e) => e.selected).map((e) => e.id))
    if (selNodeIds.size === 0 && selEdgeIds.size === 0) return
    const ids = protectEntryPoint(s.nodes, expandLoopPairs(s.nodes, selNodeIds))
    if (ids.size === 0 && selEdgeIds.size === 0) return
    pushHistory()
    // Explicitly selected edges are removed as-is (no healing — the user cut
    // the link on purpose); deleted nodes heal so the chain stays connected.
    const keptEdges = s.edges.filter((e) => !selEdgeIds.has(e.id))
    set(() => ({
      nodes: s.nodes.filter((n) => !ids.has(n.id)),
      edges: contractNodes(keptEdges, ids),
      selectedNodeId: null,
      isDirty: true,
    }))
  },

  // Seeds a brand-new workflow: a connected trigger → exit chain, so the
  // edge's + button is immediately available for the first real step.
  seedNew: () => {
    resetHistory()
    const trigger = makeNode('trigger', { x: 0, y: 0 })
    const exit    = makeNode('exit',    { x: 0, y: 240 })
    set({
      workflowId:     '',
      name:           'Untitled Workflow',
      variables:      [],
      nodes:          [trigger, exit],
      edges:          [makeEdge(trigger.id, exit.id)],
      selectedNodeId: null,
      isDirty:        true,
      past:           [],
      future:         [],
    })
  },

  applyDagreLayout: (direction = 'TB') =>
    set((s) => ({
      nodes: dagreLayout(s.nodes, s.edges, direction) as FlowNode[],
      isDirty: true,
    })),

  loadDefinition: (id, name, def) => {
    const nodes: FlowNode[] = def.nodes.map((gn) => {
      // Normalise legacy single-assignment set_variable configs into the new
      // multi-assignment shape expected by the frontend.
      let cfg = gn.configuration
      if (gn.type === 'set_variable') {
        const raw = cfg as Record<string, unknown>
        if (!Array.isArray(raw?.assignments) && raw?.variable_name) {
          cfg = {
            assignments: [{
              id:            nanoid(),
              variable_name: String(raw.variable_name ?? ''),
              mode:          (raw.mode as 'literal' | 'expression') ?? 'literal',
              literal_value: raw.literal_value,
              expression:    String(raw.expression ?? ''),
            }],
          }
        } else if (Array.isArray(raw?.assignments)) {
          // Ensure each assignment has a UI id
          cfg = {
            assignments: (raw.assignments as Record<string, unknown>[]).map((a) => ({
              id: nanoid(),
              ...a,
            })),
          }
        } else {
          cfg = { assignments: [] }
        }
      }
      // A node saved without inputs/outputs (e.g. created via a raw API call
      // rather than the picker's makeNode, which always sets real ports) must
      // still get real handle ids here — otherwise BaseNode renders zero
      // <Handle> elements while def.edges still reference 'in'/'out', and
      // React Flow silently drops every edge touching that node.
      const ports = defaultPorts(gn.type)
      return {
        id:       gn.id,
        type:     gn.type,
        position: { x: gn.position.x, y: gn.position.y },
        data:     { ...gn, configuration: cfg, inputs: gn.inputs ?? ports.inputs, outputs: gn.outputs ?? ports.outputs },
      }
    })

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

    resetHistory()
    set({
      workflowId:    id,
      name,
      variables:     def.variables ?? [],
      nodes,
      edges,
      selectedNodeId: null,
      isDirty:       false,
      past:          [],
      future:        [],
    })
  },

  toDefinition: (): WorkflowDefinitionGraph => {
    const s = get()
    const nodeIds = new Set(s.nodes.map((n) => n.id))
    const graphNodes: GraphNode[] = s.nodes.map((n) => {
      let cfg = n.data.configuration
      // Strip the UI-only `id` field from each assignment before serialising
      // so the backend receives clean { variable_name, mode, ... } objects.
      if (n.data.type === 'set_variable' && cfg) {
        const raw = cfg as { assignments?: { id?: string; variable_name: string; mode: string; literal_value?: unknown; expression?: string }[] }
        if (Array.isArray(raw.assignments)) {
          cfg = {
            assignments: raw.assignments.map(({ id: _id, ...rest }) => rest),
          }
        }
      }
      // Strip UI-only `id` keys from fetch_records filter/sort before serialising.
      if (n.data.type === 'fetch_records' && cfg) {
        cfg = stripFetchRecordsIds(cfg as Record<string, unknown>)
      }
      // Strip UI-only `id` keys from http_request's header/param/body_form rows.
      if (n.data.type === 'http_request' && cfg) {
        cfg = stripHttpRequestIds(cfg as Record<string, unknown>)
      }
      // Strip UI-only `id` keys from trigger's (optional) filter tree.
      if (n.data.type === 'trigger' && cfg) {
        cfg = stripTriggerIds(cfg as Record<string, unknown>)
      }
      return {
        ...n.data,
        configuration: cfg,
        position: { x: n.position.x, y: n.position.y },
      }
    })
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
  }
})
