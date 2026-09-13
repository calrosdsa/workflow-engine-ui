import type { FlowNode, FlowEdge } from './store'
import type { ExecutionNodeLog } from '@/features/executions/types'

export interface NodeExecutionInfo {
  step: number  // 1-based position in the left-to-right depth-first order
  wave: number  // 0-based depth level (how far down the tree the node sits)
}

/**
 * Computes execution order using a **left-to-right, depth-first** walk.
 *
 * Semantics: execution starts at the root(s) and processes a branch fully —
 * top to bottom — before moving on to the next sibling branch to the right.
 * Sibling ordering is decided by each node's horizontal (x) position, so
 * dragging a node left/right directly changes when it runs.
 *
 * `wave` is the node's depth from the root (parents are shallower), which
 * groups nodes by how far down the tree they sit.
 *
 * Returns a map of nodeId → { step, wave }.
 * Returns an empty map if the graph is empty or contains a cycle.
 */
export function computeExecutionOrder(
  nodes: FlowNode[],
  edges: FlowEdge[],
): Map<string, NodeExecutionInfo> {
  if (nodes.length === 0) return new Map()

  const nodeIds = new Set(nodes.map((n) => n.id))
  const xOf = new Map(nodes.map((n) => [n.id, n.position?.x ?? 0]))

  // Build children + in-degree, ignoring edges with missing endpoints.
  const children = new Map<string, string[]>()
  const inDegree = new Map<string, number>()
  for (const n of nodes) {
    children.set(n.id, [])
    inDegree.set(n.id, 0)
  }
  for (const e of edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue
    const ch = children.get(e.source)!
    if (!ch.includes(e.target)) {
      ch.push(e.target)
      inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
    }
  }

  // Sort each node's children left-to-right by x position (ties broken by id
  // for determinism). Left branch is processed before the right one.
  const byX = (a: string, b: string) => {
    const dx = (xOf.get(a) ?? 0) - (xOf.get(b) ?? 0)
    return dx !== 0 ? dx : a < b ? -1 : a > b ? 1 : 0
  }
  for (const list of children.values()) list.sort(byX)

  // Roots = nodes with no incoming edges, also ordered left-to-right.
  const roots = nodes
    .map((n) => n.id)
    .filter((id) => (inDegree.get(id) ?? 0) === 0)
    .sort(byX)

  // Iterative DFS so a node is numbered the first time it's reached. A node
  // with multiple parents (a merge/join) is numbered when the first branch
  // arrives, and its `wave` is the deepest level among all its parents.
  const order: string[] = []
  const visited = new Set<string>()
  const wave = new Map<string, number>()

  // Stack frames carry the depth so wave = depth from the root.
  type Frame = { id: string; depth: number }
  const stack: Frame[] = []
  // Push roots in reverse so the leftmost root is popped first.
  for (let i = roots.length - 1; i >= 0; i--) {
    stack.push({ id: roots[i], depth: 0 })
  }

  while (stack.length > 0) {
    const { id, depth } = stack.pop()!
    // Track the deepest level any path has reached this node at.
    wave.set(id, Math.max(wave.get(id) ?? 0, depth))
    if (visited.has(id)) continue
    visited.add(id)
    order.push(id)

    const kids = children.get(id) ?? []
    // Push children in reverse so the leftmost child is processed first.
    for (let i = kids.length - 1; i >= 0; i--) {
      stack.push({ id: kids[i], depth: depth + 1 })
    }
  }

  // Any nodes unreachable from a root (e.g. part of a disconnected cycle) mean
  // the order is incomplete — bail out rather than show a partial numbering.
  if (order.length !== nodes.length) return new Map()

  const result = new Map<string, NodeExecutionInfo>()
  order.forEach((id, i) => {
    result.set(id, { step: i + 1, wave: wave.get(id) ?? 0 })
  })
  return result
}

/**
 * Computes REAL chronological execution order (FR-C5-007) from an
 * execution's actual log rows, for the canvas's per-execution mode switch:
 * once a selected overlay execution has log data, its step badges must show
 * real order (this), never the static graph-authoring heuristic above — and
 * the switch is per-EXECUTION, not per-node (see BaseNode.tsx).
 *
 * Returns null when `logs` is empty (no log data for this execution — e.g.
 * a run predating this feature), which the caller uses as the "keep the
 * static heuristic" signal. A non-null result is never empty.
 *
 * De-duping matters here: a node can own multiple log rows (a loop_chunk
 * row per chunk, a retried attempt), so this groups by node_id and ranks by
 * each node's EARLIEST started_at, rather than ranking raw rows (which
 * would produce duplicate/skipped step numbers for any node with >1 row).
 */
export function computeLogOrder(
  logs: Pick<ExecutionNodeLog, 'node_id' | 'started_at'>[],
): Record<string, number> | null {
  if (logs.length === 0) return null

  const earliest = new Map<string, number>()
  for (const log of logs) {
    const t = new Date(log.started_at).getTime()
    if (Number.isNaN(t)) continue
    const current = earliest.get(log.node_id)
    if (current === undefined || t < current) earliest.set(log.node_id, t)
  }
  if (earliest.size === 0) return null

  const ranked = Array.from(earliest.entries()).sort((a, b) => a[1] - b[1])
  const result: Record<string, number> = {}
  ranked.forEach(([nodeId], i) => { result[nodeId] = i + 1 })
  return result
}

/**
 * Returns the set of nodes that execute strictly *before* `targetId` — i.e. its
 * graph ancestors (every node on a path that reaches the target). This excludes
 * the target itself, its descendants, and parallel branches that don't lead to
 * it, so the expression editor only surfaces outputs guaranteed to exist at the
 * target's execution point.
 *
 * Implemented as a reverse BFS over the edges (target → parents → …).
 */
export function computeAncestors(
  nodes: FlowNode[],
  edges: FlowEdge[],
  targetId: string,
): Set<string> {
  const nodeIds = new Set(nodes.map((n) => n.id))
  if (!nodeIds.has(targetId)) return new Set()

  // parents map: nodeId → direct predecessors.
  const parents = new Map<string, string[]>()
  for (const n of nodes) parents.set(n.id, [])
  for (const e of edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue
    parents.get(e.target)!.push(e.source)
  }

  const ancestors = new Set<string>()
  const queue = [...(parents.get(targetId) ?? [])]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (ancestors.has(id)) continue
    ancestors.add(id)
    for (const p of parents.get(id) ?? []) {
      if (!ancestors.has(p)) queue.push(p)
    }
  }
  return ancestors
}
