// ---------------------------------------------------------------------------
// UI workflows — the stored shape
// ---------------------------------------------------------------------------
//
// A UI workflow is authored logic that runs in the END USER'S CLIENT rather
// than on the server: an interaction starts it, a client interprets it, and
// its steps act on the interface and on records through the viewer's own
// session. That last clause is what makes it safe — it can never do more than
// the person looking at the screen could do by hand.
//
// WHY A STEP LIST AND NOT A DAG
// -----------------------------
// Server workflows (features/workflows) are a node+edge graph dispatched in
// waves, because their nodes are independent units of work that can run in
// parallel. UI steps are not: show a dialog, WAIT, branch on the answer. The
// order is the logic. So the stored shape is an ordered list, and branching
// nests child lists inside a step's own config rather than being expressed as
// edges. This also matches the authoring surface it is meant to get — a step
// list with nested branches, not a canvas.
//
// WHY THE GRAPH IS EMBEDDED, NOT ITS OWN ENTITY (FOR NOW)
// -------------------------------------------------------
// A UiWorkflow is a plain value designed to sit INSIDE the config of whatever
// triggers it — a custom record action's config, a button component's config.
// That follows the same "config is opaque JSON" convention detail tabs and
// custom actions already use (internal/menus/config.go), so this needs no
// migration, no table, and no new API to become real. Whether workflows
// should ALSO be standalone, reusable-by-reference entities is a genuine open
// question, deliberately not answered here: embedding first does not foreclose
// it, and answering it now would mean backend work before a single step has
// ever executed.
//
// NOTHING HERE EXECUTES ANYTHING. This module and its registry describe and
// parse the shape; the interpreter is separate and comes next.

import type { FilterGroup } from '@/features/workflows/types'

/** Bumped only for a change a parser cannot infer. `parseUiWorkflow` accepts
 *  an absent version (everything authored before this field existed reads as
 *  1) — see parse.ts for the never-throws contract this shape lives under. */
export const UI_WORKFLOW_VERSION = 1

/** Where a UI workflow can run. Node coverage legitimately differs per
 *  platform: `runtime-app` (Kotlin/Compose) has no DOM, and some interface
 *  nodes have no meaning there. Declared per node so the builder can warn at
 *  DESIGN time rather than letting the mobile app silently no-op — the same
 *  failure mode MenuType.Unknown exists to avoid. */
export type UiWorkflowPlatform = 'web' | 'mobile'

export const ALL_PLATFORMS: readonly UiWorkflowPlatform[] = ['web', 'mobile']

/** One step. `type` resolves through the node registry, which owns `config`'s
 *  shape entirely — this layer never interprets it, exactly as MenuConfig
 *  stays opaque to the menu envelope. */
export interface UiWorkflowStep {
  /** Stable across reorders. Authoring-side identity only; the interpreter
   *  uses it for error reporting and (later) step tracing. */
  id: string
  type: string
  config: unknown
}

export interface UiWorkflow {
  version: number
  steps: UiWorkflowStep[]
}

export function emptyUiWorkflow(): UiWorkflow {
  return { version: UI_WORKFLOW_VERSION, steps: [] }
}

// ---------------------------------------------------------------------------
// Branching
// ---------------------------------------------------------------------------

/** The `condition` node's config. Its branches are STEP LISTS held here
 *  rather than edges in a graph — see this file's header.
 *
 *  `when` is a FilterGroup, the same grammar menus, workflow nodes and saved
 *  views already speak, and it is evaluated CLIENT-SIDE by lib/filter-eval
 *  with no round-trip. That is the whole reason the structured tree was
 *  chosen over an Expr string: an Expr condition would make every branch a
 *  blocking network call, which is not logic running in the browser. */
export interface ConditionStepConfig {
  when: FilterGroup
  then: UiWorkflowStep[]
  else: UiWorkflowStep[]
}

/** Config shapes that nest step lists, so traversal (validation, catalog
 *  checks, the eventual interpreter) can find every step without knowing
 *  which node types branch. A node declares its nesting via the registry's
 *  `childStepLists`, so this stays open to node types that don't exist yet. */
export type StepListsOf = (config: unknown) => UiWorkflowStep[][]
