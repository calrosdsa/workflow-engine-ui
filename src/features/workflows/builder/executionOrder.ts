import type { FlowNode, FlowEdge } from './store'

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
