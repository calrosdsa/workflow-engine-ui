import { useBuilderStore, type FlowEdge, type FlowNode } from './store'
import { computeExecutionOrder, type NodeExecutionInfo } from './executionOrder'

// "Route set" (DESIGN.md § Workflow Builder identity): selecting a step lights
// every edge and step upstream of it, back to the trigger — exactly the steps
// whose output can feed its input. Pure so it is testable without a canvas.
export interface Route {
  edgeIds: Set<string>
  nodeIds: Set<string>
}

export function upstreamRoute(edges: FlowEdge[], nodeId: string): Route {
  const incoming = new Map<string, FlowEdge[]>()
  for (const edge of edges) {
    const list = incoming.get(edge.target)
    if (list) list.push(edge)
    else incoming.set(edge.target, [edge])
  }
  const edgeIds = new Set<string>()
  const nodeIds = new Set<string>([nodeId])
  const stack = [nodeId]
  while (stack.length > 0) {
    const current = stack.pop()!
    for (const edge of incoming.get(current) ?? []) {
      edgeIds.add(edge.id)
      // The seen-check is what keeps a loop's back edge from spinning forever.
      if (!nodeIds.has(edge.source)) {
        nodeIds.add(edge.source)
        stack.push(edge.source)
      }
    }
  }
  return { edgeIds, nodeIds }
}

// Every node and edge component asks for the route, so it is computed once
// per (edges array, selected node) pair rather than once per component. The
// store replaces the edges array on every change, which is what invalidates.
const routeCache = new WeakMap<FlowEdge[], Map<string, Route>>()

export function useSelectedRoute(): Route | null {
  const edges = useBuilderStore((s) => s.edges)
  // React Flow's own selection, the one the plate border shows. The store's
  // selectedNodeId only lives while the config workbench is open, and the
  // workbench covers the canvas, so keying on it would hide the route
  // exactly when it could be seen.
  const selectedNodeId = useBuilderStore((s) => s.nodes.find((n) => n.selected)?.id ?? s.selectedNodeId)
  if (!selectedNodeId) return null
  let byNode = routeCache.get(edges)
  if (!byNode) {
    byNode = new Map()
    routeCache.set(edges, byNode)
  }
  let route = byNode.get(selectedNodeId)
  if (!route) {
    route = upstreamRoute(edges, selectedNodeId)
    byNode.set(selectedNodeId, route)
  }
  return route
}

// The graph's static step order (the numbers on the step plates), shared the
// same way. A run's route draws on in this order when the run has no
// execution logs to give its real one.
const orderCache = new WeakMap<FlowNode[], WeakMap<FlowEdge[], Map<string, NodeExecutionInfo>>>()

export function useStepOrder(): Map<string, NodeExecutionInfo> {
  const nodes = useBuilderStore((s) => s.nodes)
  const edges = useBuilderStore((s) => s.edges)
  let byEdges = orderCache.get(nodes)
  if (!byEdges) {
    byEdges = new WeakMap()
    orderCache.set(nodes, byEdges)
  }
  let order = byEdges.get(edges)
  if (!order) {
    order = computeExecutionOrder(nodes, edges)
    byEdges.set(edges, order)
  }
  return order
}
