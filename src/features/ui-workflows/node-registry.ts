// ---------------------------------------------------------------------------
// UI workflow node registry
// ---------------------------------------------------------------------------
//
// Structural analog of custom-actions/registry.ts and detail-tabs/registry.ts:
// same Map-backed registration, same parseConfig/createDefaultConfig split,
// same production-throw/dev-overwrite duplicate handling (Vite's HMR can re-run
// every registerX() call from several propagation paths without disposing the
// old module first).
//
// WHAT THIS CONTRACT DELIBERATELY OMITS
// -------------------------------------
// No ConfigPanel and no renderer. The sibling registries carry both because
// their types are authored and drawn today; a UI workflow node has neither an
// authoring surface nor an interpreter yet. Adding those fields later is
// additive — a registration that compiles now keeps compiling — whereas
// requiring them today would mean writing a dozen panels before a single step
// can execute. `configSchema` is required from the start because it is the
// drift guard, not decoration: a node cannot register without describing its
// own config, which is what lets the generated catalog stay honest.
//
// THE NODE SET IS DELIBERATELY NOT THE SERVER'S
// ---------------------------------------------
// Overlap with the 24 server node types is small, and forcing reuse would be
// wrong: an http_request or connector node needs credentials a client must
// never hold. Anything requiring durability, secrets, connectors, agents or
// long-running work goes through `run_workflow`, which hands off to a real
// server workflow. That one node is what stops this vocabulary from ever
// needing to grow an HTTP node of its own.
//
// Where a node means the SAME thing on both sides it keeps the same type
// string and config shape (show_message, condition, set_variable,
// fetch_records), so the generated catalog stays coherent and an author's
// mental model transfers between the two builders.
import type { LucideIcon } from 'lucide-react'
import type { ConfigSchema } from '@/lib/config-schema'
import type { UiWorkflowHost, UiWorkflowRunContext } from './host'
import type { StepListsOf, UiWorkflowPlatform, UiWorkflowStep } from './types'

/** What a node's executor hands back to the interpreter.
 *
 *  Control flow lives HERE rather than in a switch inside the interpreter, so
 *  a branching node type works without the interpreter learning about it —
 *  the same reason childStepLists exists for traversal. */
export type StepOutcome =
  /** Continue with the next sibling step. The default. */
  | { kind: 'next' }
  /** Run this list, then continue with the next sibling — how `condition`
   *  returns whichever branch matched. */
  | { kind: 'enter'; steps: readonly UiWorkflowStep[] }
  /** End the run here, successfully. */
  | { kind: 'stop' }

export interface StepExecuteArgs<TConfig> {
  config: TConfig
  ctx: UiWorkflowRunContext
  host: UiWorkflowHost
  /** Aborted when the viewer navigates away or the run is cancelled. A node
   *  doing anything long-running must honour it. */
  signal: AbortSignal
}

export interface UiWorkflowNodeDefinition<TConfig = unknown> {
  /** Registry key, stored as UiWorkflowStep.type. */
  type: string
  label: string
  icon: LucideIcon
  description: string
  /** Groups the node in a palette, and says plainly what it is allowed to
   *  touch. 'interface' acts on what's on screen; 'data' goes through the
   *  ordinary record endpoints as the viewer; 'flow' is control flow. */
  category: 'interface' | 'data' | 'flow'
  /** JSON Schema for this node's config, exported to the backend's
   *  /meta/catalog via src/lib/ui-catalog.ts. Required so a new node type
   *  cannot register without describing itself. */
  configSchema: ConfigSchema
  /** Which client runtimes can actually execute this node. A node absent from
   *  a platform must be reported at authoring time, never silently skipped at
   *  runtime — see UiWorkflowPlatform. */
  platforms: readonly UiWorkflowPlatform[]
  /** Retirement policy (workflow-engine/COMPATIBILITY.md): a retired type
   *  keeps working forever but stops being offered for NEW configuration. Set
   *  deprecated (and replacedBy) rather than ever deleting a registration —
   *  stored graphs reference types by name, and a deleted registration turns
   *  every one of them into an unrunnable unknown. */
  deprecated?: boolean
  replacedBy?: string
  /** Parses/heals a possibly-stale or malformed config blob. MUST NEVER
   *  THROW — same contract every other config parser here follows (FR-D-005).
   *  A stored graph is read straight off the wire and predates fields being
   *  added, so healing is the normal case, not the error case. */
  parseConfig: (raw: unknown) => TConfig
  createDefaultConfig: () => TConfig
  /** Step lists nested inside this node's config (a branch's `then`/`else`).
   *  Declared here so traversal never switches on node type — a future
   *  branching node works without touching the walker. */
  childStepLists?: StepListsOf
  /** Runs the step. Mutates `ctx.variables` for nodes that produce values,
   *  and reaches everything else through `host` — never through a direct
   *  import, which is what keeps the interpreter runnable under test and the
   *  capability list honest (see host.ts).
   *
   *  Optional so a node type can be registered and authorable before it is
   *  executable; the interpreter treats a missing executor as an explicit
   *  failure rather than a silent skip, so an unimplemented node can never
   *  quietly do nothing. */
  execute?: (args: StepExecuteArgs<TConfig>) => Promise<StepOutcome> | StepOutcome
}

const REGISTRY = new Map<string, UiWorkflowNodeDefinition<any>>()

export function registerUiWorkflowNode<T>(def: UiWorkflowNodeDefinition<T>): void {
  if (REGISTRY.has(def.type) && !import.meta.hot) {
    throw new Error(`ui workflow node type "${def.type}" is already registered`)
  }
  REGISTRY.set(def.type, def)
}

export function getUiWorkflowNode(type: string): UiWorkflowNodeDefinition | undefined {
  return REGISTRY.get(type)
}

export function allUiWorkflowNodes(): UiWorkflowNodeDefinition[] {
  return Array.from(REGISTRY.values())
}

/** Nodes offered for NEW configuration — retired ones keep running but stop
 *  appearing in a palette (same filter MenusSection applies to menu types). */
export function selectableUiWorkflowNodes(): UiWorkflowNodeDefinition[] {
  return allUiWorkflowNodes().filter((n) => !n.deprecated)
}

/** Every step in a graph, including those nested inside branches. Depth-first
 *  in execution order, which is also the order an author reads them. */
export function walkSteps(steps: readonly UiWorkflowStep[]): UiWorkflowStep[] {
  const out: UiWorkflowStep[] = []
  const visit = (list: readonly UiWorkflowStep[]) => {
    for (const step of list) {
      out.push(step)
      const def = getUiWorkflowNode(step.type)
      // An unknown type contributes itself but no children: this build can't
      // know how it nests. Reported by validateUiWorkflow, not skipped here.
      if (!def?.childStepLists) continue
      for (const child of def.childStepLists(step.config)) visit(child)
    }
  }
  visit(steps)
  return out
}

/** Platforms that can run EVERY node in the graph — the honest answer to
 *  "where will this actually work", since one web-only step makes the whole
 *  workflow web-only. */
export function graphPlatforms(steps: readonly UiWorkflowStep[]): UiWorkflowPlatform[] {
  const all = walkSteps(steps)
  if (all.length === 0) return ['web', 'mobile']
  const candidates: UiWorkflowPlatform[] = ['web', 'mobile']
  return candidates.filter((p) =>
    all.every((s) => getUiWorkflowNode(s.type)?.platforms.includes(p) ?? false),
  )
}
