// Runs a form's field-change workflow while someone is filling it in.
//
// THE LOOP IS THE WHOLE PROBLEM. A field change starts a run; a run can call
// set_field; that writes a field; that is another change. Three guards, each
// closing a different door:
//
//   1. A DECLARED WATCH LIST. Only the fields an author names start a run, so
//      a step writing to some other field cannot re-trigger at all. This is
//      also why it isn't "any field changed": running a workflow on every
//      keystroke of every field would be both wasteful and unpredictable.
//   2. A DEBOUNCE. Typing "5000" is four changes; the author means the value,
//      not each digit.
//   3. AN IN-FLIGHT GUARD. While a run is going, further changes do not start
//      another. A run that writes a watched field therefore cannot recurse
//      into itself, and the trailing change it produces is swallowed by the
//      same guard rather than queued.
//
// Guard 3 means a change arriving mid-run is dropped, not deferred. That is
// deliberate: re-running on the values that existed a moment ago is worse than
// not running, and the next real edit will start a fresh run with the current
// state anyway.
import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { runUiWorkflow } from './interpreter'
import { emptyRunContext, type UiWorkflowHost } from './host'
import { useUiWorkflowDepth } from './depth'
import type { UiWorkflow } from './types'

/** How long the values must hold still before a run starts. Long enough to
 *  cover typing a number, short enough to feel immediate on a select. */
export const FIELD_CHANGE_DEBOUNCE_MS = 300

export interface FieldChangeWorkflowConfig {
  /** Field keys whose change starts a run. Empty means the workflow never
   *  runs — deliberately, since "every field" is how you get a run per
   *  keystroke across the whole form. */
  watch: string[]
  workflow: UiWorkflow
}

export function emptyFieldChangeWorkflow(): FieldChangeWorkflowConfig {
  return { watch: [], workflow: { version: 1, steps: [] } }
}

export function parseFieldChangeWorkflowConfig(
  raw: unknown,
  parseWorkflow: (raw: unknown) => UiWorkflow,
): FieldChangeWorkflowConfig {
  if (!raw || typeof raw !== 'object') return emptyFieldChangeWorkflow()
  const r = raw as Record<string, unknown>
  return {
    watch: Array.isArray(r.watch) ? r.watch.filter((w): w is string => typeof w === 'string') : [],
    workflow: parseWorkflow(r.workflow),
  }
}

export interface UseFieldChangeWorkflowArgs {
  config: FieldChangeWorkflowConfig | undefined
  /** Live form values — the run's record context, and what the watch list is
   *  compared against. */
  values: Record<string, unknown>
  host: UiWorkflowHost
  formId?: string
  /** Present when editing an existing record; absent on a create form. */
  recordId?: string
}

export function useFieldChangeWorkflow({ config, values, host, formId, recordId }: UseFieldChangeWorkflowArgs) {
  const depth = useUiWorkflowDepth()
  const runningRef = useRef(false)
  // Last seen values for the watched fields. Starts unset so the first render
  // establishes a baseline WITHOUT running — otherwise every form would fire
  // its workflow on open, before anyone had touched anything.
  const lastRef = useRef<Record<string, unknown> | null>(null)

  const watch = config?.watch ?? []
  const steps = config?.workflow.steps ?? []
  // Compared by content rather than identity: `values` is a fresh object every
  // render, so an identity check would re-run the effect constantly.
  const watchedKey = JSON.stringify(watch.map((k) => values[k] ?? null))

  const run = useCallback(async (changedField: string) => {
    if (runningRef.current) return
    runningRef.current = true
    try {
      const result = await runUiWorkflow({
        steps,
        ctx: emptyRunContext({
          formId,
          recordId,
          record: values,
          // Inherited, so a form opened by a workflow cannot restart the
          // nesting count at zero.
          depth,
          // Named so a condition can branch on WHICH field changed — the one
          // piece of context a field-change run has that others don't.
          variables: { changed_field: changedField },
        }),
        host,
      })
      if (result.status === 'failed') {
        toast.error('A form rule didn’t finish.', { description: result.error })
      }
    } finally {
      runningRef.current = false
    }
    // `values` is intentionally read fresh at call time via the closure this
    // callback is rebuilt with; watchedKey is what actually gates the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, host, formId, recordId, values, depth])

  useEffect(() => {
    if (watch.length === 0 || steps.length === 0) return

    const current: Record<string, unknown> = {}
    for (const key of watch) current[key] = values[key]

    // First pass only records the baseline. Running here would fire on open.
    if (lastRef.current === null) {
      lastRef.current = current
      return
    }

    const changed = watch.find((k) => !Object.is(lastRef.current![k], current[k]))
    if (!changed) return

    const timer = setTimeout(() => {
      lastRef.current = current
      void run(changed)
    }, FIELD_CHANGE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedKey, watch.length, steps.length])
}
