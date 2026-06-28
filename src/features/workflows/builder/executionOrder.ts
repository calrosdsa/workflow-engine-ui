import type { FlowNode, FlowEdge } from './store'

export interface NodeExecutionInfo {
  step: number  // 1-based position in topological order
  wave: number  // 0-based parallel wave (nodes in same wave run concurrently)
}

/**
 * Computes topological order + parallel wave for every node.
 * Mirrors the Go DAG.ParallelGroups() + topoSort() logic.
 * Returns a map of nodeId → { step, wave }.
 * Returns an empty map if the graph has a cycle or is empty.
 */
export function computeExecutionOrder(
  nodes: FlowNode[],
  edges: FlowEdge[],
): Map<string, NodeExecutionInfo> {
  if (nodes.length === 0) return new Map()

  const children = new Map<string, string[]>()
  const inDegree  = new Map<string, number>()

  for (const n of nodes) {
    children.set(n.id, [])
    inDegree.set(n.id, 0)
  }

  for (const e of edges) {
    if (!children.has(e.source) || !inDegree.has(e.target)) continue
    const ch = children.get(e.source)!
    if (!ch.includes(e.target)) ch.push(e.target)
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  }

  // Kahn's algorithm — deterministic by sorting ready queue
  const queue: string[] = [...inDegree.entries()]
    .filter(([, d]) => d === 0)
    .map(([id]) => id)
    .sort()

  const order: string[] = []
  while (queue.length > 0) {
    queue.sort()
    const cur = queue.shift()!
    order.push(cur)
    for (const child of (children.get(cur) ?? []).sort()) {
      const d = (inDegree.get(child) ?? 1) - 1
      inDegree.set(child, d)
      if (d === 0) queue.push(child)
    }
  }

  if (order.length !== nodes.length) return new Map() // cycle detected

  // Compute wave (parallel group level) for each node
  const level = new Map<string, number>()
  const parents = new Map<string, string[]>()
  for (const n of nodes) parents.set(n.id, [])
  for (const e of edges) {
    if (parents.has(e.target)) parents.get(e.target)!.push(e.source)
  }

  for (const id of order) {
    const maxParentLevel = (parents.get(id) ?? []).reduce(
      (max, p) => Math.max(max, level.get(p) ?? -1),
      -1,
    )
    level.set(id, maxParentLevel + 1)
  }

  const result = new Map<string, NodeExecutionInfo>()
  order.forEach((id, i) => {
    result.set(id, { step: i + 1, wave: level.get(id) ?? 0 })
  })
  return result
}
