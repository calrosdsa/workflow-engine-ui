// Parsing and validation for a stored UI workflow graph.
//
// parseUiWorkflow NEVER THROWS. A graph is opaque JSON read straight off the
// wire: it predates fields being added, it can be written by the MCP server
// with no server-side validation of this nested shape (the same gap
// RecordsTable's ensureGroupIds guards for filters), and a throw here would
// blank whatever surface is rendering it behind an error boundary. Healing to
// something runnable is strictly better than that, and it is the contract
// every other config parser in this codebase follows (FR-D-005).
//
// validateUiWorkflow is the OTHER half, and the split matters: parsing gets
// you something safe to run, validation tells an author what is wrong with it.
// A step whose type this build doesn't know survives parsing untouched — so a
// graph round-trips through an older client without losing steps — but is
// reported by validation and refused by the interpreter.
import { nanoid } from 'nanoid'
import { getUiWorkflowNode } from './node-registry'
import { UI_WORKFLOW_VERSION, type UiWorkflow, type UiWorkflowStep } from './types'

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/** Heals one step. An unknown `type` keeps its config VERBATIM: this build
 *  cannot parse it, but it also must not destroy it — a graph opened in a
 *  client that predates a node type has to save back without silently
 *  dropping steps that client couldn't understand. */
export function parseStep(raw: unknown): UiWorkflowStep | null {
  if (!isRecord(raw)) return null
  const type = typeof raw.type === 'string' ? raw.type : ''
  if (!type) return null

  const id = typeof raw.id === 'string' && raw.id ? raw.id : nanoid()
  const def = getUiWorkflowNode(type)
  if (!def) return { id, type, config: raw.config }

  // parseConfig is contractually non-throwing, but it is written per node and
  // this is the last line before a render — a bug in one node's parser should
  // cost that step's config, not the whole graph.
  try {
    return { id, type, config: def.parseConfig(raw.config) }
  } catch {
    return { id, type, config: def.createDefaultConfig() }
  }
}

export function parseSteps(raw: unknown): UiWorkflowStep[] {
  if (!Array.isArray(raw)) return []
  const out: UiWorkflowStep[] = []
  for (const entry of raw) {
    const step = parseStep(entry)
    if (step) out.push(step)
  }
  return out
}

/** Heals a whole stored graph. Total by contract — every input, including
 *  null, undefined and a string, yields a usable (possibly empty) workflow. */
export function parseUiWorkflow(raw: unknown): UiWorkflow {
  if (!isRecord(raw)) return { version: UI_WORKFLOW_VERSION, steps: [] }
  const version =
    typeof raw.version === 'number' && Number.isFinite(raw.version)
      ? raw.version
      : UI_WORKFLOW_VERSION
  return { version, steps: parseSteps(raw.steps) }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface UiWorkflowProblem {
  /** The offending step, or undefined for a whole-graph problem. */
  stepId?: string
  code: 'unknown_node' | 'deprecated_node' | 'empty'
  message: string
}

/** Authoring-time report. Deliberately separate from parsing: this is what a
 *  builder shows an author, and what a save can refuse on — never something
 *  the runtime consults to decide whether to render. */
export function validateUiWorkflow(wf: UiWorkflow): UiWorkflowProblem[] {
  const problems: UiWorkflowProblem[] = []
  if (wf.steps.length === 0) {
    problems.push({ code: 'empty', message: 'This workflow has no steps yet.' })
  }

  // Walks the graph itself rather than using walkSteps: an unknown node's
  // children are unreachable (this build doesn't know how it nests), and the
  // right report for that is the unknown node, not silence about what's inside.
  const visit = (steps: readonly UiWorkflowStep[]) => {
    for (const step of steps) {
      const def = getUiWorkflowNode(step.type)
      if (!def) {
        problems.push({
          stepId: step.id,
          code: 'unknown_node',
          message: `Unknown step type "${step.type}". It will be skipped when this workflow runs.`,
        })
        continue
      }
      if (def.deprecated) {
        problems.push({
          stepId: step.id,
          code: 'deprecated_node',
          message: def.replacedBy
            ? `"${def.label}" is retired — use "${def.replacedBy}" instead.`
            : `"${def.label}" is retired and should be replaced.`,
        })
      }
      for (const child of def.childStepLists?.(step.config) ?? []) visit(child)
    }
  }
  visit(wf.steps)
  return problems
}
