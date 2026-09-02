import type { FlowNode, FlowEdge } from './store'
import { computeExecutionOrder } from './executionOrder'

// deriveOutline turns the live canvas graph into the flow outline — the
// step-tree reading of the workflow (trigger, then steps top to bottom,
// branches and loop bodies indented). It is DISPLAY-grade: a tolerant
// client-side sibling of the backend's strict flow decompiler, never a
// second source of truth. Structural nodes (merge / exit / loop_end) are
// part of how the graph is wired, not part of what the workflow *does*, so
// they carry no row.
//
// A graph the walker can't read structurally (parallel fan-out, duplicate
// branch edges, tangled joins) falls back to a flat list in execution
// order with `structured: false` — every node still shows, nothing lies.

export interface OutlineRow {
  kind: 'step' | 'tag'
  depth: number
  // step rows
  id?: string
  type?: string
  label?: string
  // tag rows (branch headers)
  text?: 'then' | 'else' | 'each item'
}

export interface Outline {
  structured: boolean
  rows: OutlineRow[]
}

interface walkCtx {
  byId: Map<string, FlowNode>
  children: Map<string, FlowEdge[]>
  visited: Set<string>
  rows: OutlineRow[]
}

// A chain walk ends at a boundary node (merge or loop_end, unconsumed, for
// the enclosing structure to claim), at a dead end (boundary null), or in
// surrender (ok false → flat fallback).
interface chainEnd {
  ok: boolean
  boundary: string | null
}

const surrender: chainEnd = { ok: false, boundary: null }

export function deriveOutline(nodes: FlowNode[], edges: FlowEdge[]): Outline {
  const ctx: walkCtx = {
    byId: new Map(nodes.map((n) => [n.id, n])),
    children: new Map(),
    visited: new Set(),
    rows: [],
  }
  for (const n of nodes) ctx.children.set(n.id, [])
  for (const e of edges) {
    if (ctx.byId.has(e.source) && ctx.byId.has(e.target)) ctx.children.get(e.source)!.push(e)
  }

  const starts = nodes.filter((n) => n.data.type === 'trigger' || n.data.type === 'entry')
  if (starts.length !== 1) return flatFallback(nodes, edges)
  const start = starts[0]

  ctx.visited.add(start.id)
  ctx.rows.push({ kind: 'step', depth: 0, id: start.id, type: start.data.type, label: start.data.label || 'Trigger' })

  const out = ctx.children.get(start.id) ?? []
  if (out.length > 1) return flatFallback(nodes, edges)
  const end = walkChain(ctx, out[0]?.target ?? null, 0)
  if (!end.ok || end.boundary !== null) return flatFallback(nodes, edges)

  // Anything the structural walk never reached (a disconnected island) means
  // the outline would hide real nodes — fall back rather than lie.
  for (const n of nodes) {
    if (!ctx.visited.has(n.id)) return flatFallback(nodes, edges)
  }
  return { structured: true, rows: ctx.rows }
}

function walkChain(ctx: walkCtx, id: string | null, depth: number): chainEnd {
  while (id) {
    if (ctx.visited.has(id)) return surrender
    const node = ctx.byId.get(id)
    if (!node) return surrender
    const type = node.data.type as string

    if (type === 'merge' || type === 'loop_end') {
      return { ok: true, boundary: id } // unconsumed — the enclosing structure claims it
    }

    ctx.visited.add(id)
    const out = ctx.children.get(id) ?? []

    if (type === 'exit') {
      return out.length === 0 ? { ok: true, boundary: null } : surrender
    }

    if (type === 'trigger' || type === 'entry') {
      return surrender // a second start mid-chain
    }

    if (type === 'condition') {
      ctx.rows.push({ kind: 'step', depth, id, type, label: node.data.label || 'If' })
      let trueTarget: string | null = null
      let falseTarget: string | null = null
      for (const e of out) {
        const h = e.sourceHandle ?? ''
        if (h === 'true' || h === '' || h === 'out') {
          if (trueTarget) return surrender
          trueTarget = e.target
        } else if (h === 'false') {
          if (falseTarget) return surrender
          falseTarget = e.target
        } else {
          return surrender
        }
      }
      let boundary: string | null = null
      for (const [tag, target] of [['then', trueTarget], ['else', falseTarget]] as const) {
        if (!target) continue
        const mark = ctx.rows.length
        const end = walkChain(ctx, target, depth + 1)
        if (!end.ok) return surrender
        // Only header a branch that produced visible rows — an empty branch
        // (straight to the join) reads better as nothing at all.
        if (ctx.rows.length > mark) {
          ctx.rows.splice(mark, 0, { kind: 'tag', depth: depth + 1, text: tag })
        }
        if (end.boundary) {
          if (boundary && boundary !== end.boundary) return surrender
          boundary = end.boundary
        }
      }
      if (!boundary) return { ok: true, boundary: null } // both branches terminate
      const joinNode = ctx.byId.get(boundary)
      if (joinNode?.data.type === 'loop_end') {
        return { ok: true, boundary } // branches flow to the enclosing loop end
      }
      ctx.visited.add(boundary)
      const joinOut = ctx.children.get(boundary) ?? []
      if (joinOut.length > 1) return surrender
      id = joinOut[0]?.target ?? null
      continue
    }

    if (type === 'iterator') {
      ctx.rows.push({ kind: 'step', depth, id, type, label: node.data.label || 'For each' })
      const loopEndId = (node.data.configuration as { loop_end_id?: string } | undefined)?.loop_end_id
      if (!loopEndId || out.length > 1) return surrender
      const mark = ctx.rows.length
      const end = walkChain(ctx, out[0]?.target ?? null, depth + 1)
      if (!end.ok || end.boundary !== loopEndId) return surrender
      if (ctx.rows.length > mark) {
        ctx.rows.splice(mark, 0, { kind: 'tag', depth: depth + 1, text: 'each item' })
      }
      ctx.visited.add(loopEndId)
      const afterOut = ctx.children.get(loopEndId) ?? []
      if (afterOut.length > 1) return surrender
      id = afterOut[0]?.target ?? null
      continue
    }

    // Plain step.
    ctx.rows.push({ kind: 'step', depth, id, type, label: node.data.label || type })
    if (out.length > 1) return surrender
    id = out[0]?.target ?? null
  }
  return { ok: true, boundary: null }
}

// flatFallback lists every node in execution order at depth 0 — the honest
// degraded view for free-form graphs. Structural nodes still carry rows
// here: with the structure unreadable, hiding them would hide real wiring.
function flatFallback(nodes: FlowNode[], edges: FlowEdge[]): Outline {
  const order = computeExecutionOrder(nodes, edges)
  const sorted = [...nodes].sort((a, b) => {
    const sa = order.get(a.id)?.step ?? Number.MAX_SAFE_INTEGER
    const sb = order.get(b.id)?.step ?? Number.MAX_SAFE_INTEGER
    return sa !== sb ? sa - sb : a.id < b.id ? -1 : 1
  })
  return {
    structured: false,
    rows: sorted.map((n) => ({
      kind: 'step',
      depth: 0,
      id: n.id,
      type: n.data.type,
      label: n.data.label || n.data.type,
    })),
  }
}
