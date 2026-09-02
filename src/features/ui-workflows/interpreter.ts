// ---------------------------------------------------------------------------
// The UI workflow interpreter
// ---------------------------------------------------------------------------
//
// SEQUENTIAL, NOT WAVES. Server workflows dispatch a DAG in waves because
// their nodes are independent units of work. UI steps are not: show a dialog,
// WAIT, branch on the answer. The order is the logic, so this walks the list
// one step at a time and lets a node hand back an outcome that redirects
// control (StepOutcome) rather than switching on node type here.
//
// NO DURABILITY, AND IT SAYS SO. A run lives in a closure. Navigate away and
// it is gone mid-flight, with whatever writes already committed left
// committed — there is no rollback and there was never a promise of one.
// Anything that must survive the tab closing belongs behind the run_workflow
// node, which hands off to Temporal.
//
// FAILURE STOPS THE RUN. A step that throws ends the run and reports which
// step failed. Continuing past a failed step would mean later steps acting on
// state the author believed the failed step had produced, which is a worse
// outcome than stopping — especially when the steps after it write records.
// Side-effecting: registers every node type. Imported HERE because this is
// one of the feature's two entry points (running a workflow; the editor is the
// other), and the registry is empty until it loads.
//
// Missing this shipped a build where every step read as "Unknown step type" in
// the real app while every test passed — the tests each import the barrel
// themselves, so they were setting up state the app never did.
import './nodes'
import { getUiWorkflowNode } from './node-registry'
import type { UiWorkflowHost, UiWorkflowRunContext } from './host'
import type { UiWorkflowStep } from './types'

/** Hard ceiling on steps executed in one run, counting every pass through a
 *  branch. Not a performance guard — it is the backstop against an authored
 *  loop that never terminates taking the tab with it. Generous enough that no
 *  legitimate UI flow approaches it. */
export const MAX_STEPS = 1000

export type RunStatus = 'completed' | 'failed' | 'cancelled'

export interface StepTraceEntry {
  stepId: string
  type: string
  status: 'ok' | 'failed' | 'skipped'
  /** Why it failed, or why it was skipped. */
  detail?: string
}

export interface UiWorkflowRunResult {
  status: RunStatus
  /** The step that ended the run, when it ended badly. */
  failedStepId?: string
  error?: string
  /** Every step attempted, in execution order. The only observability a
   *  client-side run has — deliberately returned rather than persisted,
   *  because a run that is not durable should not pretend to be auditable. */
  trace: StepTraceEntry[]
  /** Variables as they stood when the run ended. */
  variables: Record<string, unknown>
}

export interface RunUiWorkflowArgs {
  steps: readonly UiWorkflowStep[]
  ctx: UiWorkflowRunContext
  host: UiWorkflowHost
  signal?: AbortSignal
}

class StepFailure extends Error {
  // Assigned explicitly rather than declared as a constructor parameter
  // property: this project builds with `erasableSyntaxOnly`, which rejects
  // the shorthand because it emits real code rather than erasing.
  stepId: string
  constructor(stepId: string, message: string) {
    super(message)
    this.stepId = stepId
  }
}

class Cancelled extends Error {}

/** Runs a graph to completion, failure, or cancellation. Never throws: every
 *  outcome is reported in the result, because the caller is a click handler
 *  and an unhandled rejection there is just a console message nobody sees. */
export async function runUiWorkflow({
  steps,
  ctx,
  host,
  signal,
}: RunUiWorkflowArgs): Promise<UiWorkflowRunResult> {
  const trace: StepTraceEntry[] = []
  const controller = new AbortController()
  // A run with no external signal still needs one, because executors take an
  // AbortSignal unconditionally.
  const effective = signal ?? controller.signal
  let executed = 0

  const runList = async (list: readonly UiWorkflowStep[]): Promise<void> => {
    for (const step of list) {
      if (effective.aborted) throw new Cancelled()
      if (executed >= MAX_STEPS) {
        throw new StepFailure(
          step.id,
          `This workflow ran more than ${MAX_STEPS} steps and was stopped. Check for a loop that never ends.`,
        )
      }
      executed++

      const def = getUiWorkflowNode(step.type)
      if (!def) {
        // Recorded, not thrown: a graph authored in a newer client can carry
        // a step this build has never heard of, and refusing to run the whole
        // workflow because of one unknown step would be worse than doing the
        // parts it does understand. validateUiWorkflow warns at authoring
        // time, which is where this belongs.
        trace.push({
          stepId: step.id,
          type: step.type,
          status: 'skipped',
          detail: `Unknown step type "${step.type}".`,
        })
        continue
      }
      if (!def.execute) {
        // Distinct from unknown: this build KNOWS the type and cannot run it,
        // which is a gap in this client rather than an authoring mistake.
        // Failing loudly beats a silent no-op that looks like success.
        throw new StepFailure(step.id, `"${def.label}" cannot run in this app yet.`)
      }

      let outcome
      try {
        outcome = await def.execute({ config: step.config as never, ctx, host, signal: effective })
      } catch (e) {
        if (e instanceof Cancelled || effective.aborted) throw new Cancelled()
        const detail = e instanceof Error ? e.message : String(e)
        trace.push({ stepId: step.id, type: step.type, status: 'failed', detail })
        throw new StepFailure(step.id, detail)
      }

      trace.push({ stepId: step.id, type: step.type, status: 'ok' })

      if (outcome.kind === 'stop') return
      // Guarded here too, not only in the node: this is the one place every
      // branching node's steps flow through, so it is where the class of bug
      // stops rather than each new node having to remember.
      if (outcome.kind === 'enter') await runList(outcome.steps ?? [])
    }
  }

  try {
    await runList(steps)
    return { status: 'completed', trace, variables: ctx.variables }
  } catch (e) {
    if (e instanceof Cancelled) {
      return { status: 'cancelled', trace, variables: ctx.variables }
    }
    if (e instanceof StepFailure) {
      return {
        status: 'failed',
        failedStepId: e.stepId,
        error: e.message,
        trace,
        variables: ctx.variables,
      }
    }
    return {
      status: 'failed',
      error: e instanceof Error ? e.message : String(e),
      trace,
      variables: ctx.variables,
    }
  }
}
