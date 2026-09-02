// The TypeScript half of the conformance harness: turns one corpus case into
// a host, runs it, and reports what happened in the corpus's own vocabulary.
//
// Kept separate from the test file so the shapes below are readable as the
// contract a Kotlin equivalent has to match — ConformanceRunner.kt is a
// transliteration of this, and the two staying recognisably parallel is what
// makes a divergence easy to spot in review.
import { runUiWorkflow } from '../interpreter'
import { emptyRunContext, type UiWorkflowHost } from '../host'
import type { UiWorkflowStep } from '../types'

export interface CorpusCase {
  name: string
  why?: string
  steps: UiWorkflowStep[]
  context?: {
    formId?: string
    recordId?: string
    record?: Record<string, unknown>
    variables?: Record<string, unknown>
  }
  host?: {
    searchRecords?: { records?: Record<string, unknown>[]; total?: number; error?: string }[]
    createRecord?: { id?: string; error?: string }[]
    updateRecord?: { error?: string }[]
    askUser?: { confirmed?: boolean; value?: string; error?: string }[]
    runServerWorkflow?: { status?: string; error?: string }[]
  }
  expect: {
    status: 'completed' | 'failed' | 'cancelled'
    failedStepId?: string
    errorContains?: string
    trace?: { stepId: string; status: string }[]
    variables?: Record<string, unknown>
    calls?: Record<string, unknown>[]
  }
}

export interface Corpus {
  cases: CorpusCase[]
}

/** Pops the next scripted response for a host method, or fails loudly.
 *
 *  A case that runs out of responses is a case whose `host` block doesn't
 *  match its own graph — a corpus bug, and one worth failing on rather than
 *  papering over with a default, because a silently-defaulted response makes
 *  the two implementations agree for the wrong reason. */
function nextResponse<T>(queue: T[] | undefined, method: string): T {
  const next = queue?.shift()
  if (next === undefined) {
    throw new Error(`conformance: no scripted ${method} response left for this case`)
  }
  return next
}

export interface RunOutcome {
  status: string
  failedStepId?: string
  error?: string
  trace: { stepId: string; status: string }[]
  variables: Record<string, unknown>
  calls: Record<string, unknown>[]
}

export async function runCase(testCase: CorpusCase): Promise<RunOutcome> {
  const calls: Record<string, unknown>[] = []
  // Copied so a case can be run more than once without its scripted responses
  // having been consumed by the previous run.
  const script = {
    searchRecords: [...(testCase.host?.searchRecords ?? [])],
    createRecord: [...(testCase.host?.createRecord ?? [])],
    updateRecord: [...(testCase.host?.updateRecord ?? [])],
    askUser: [...(testCase.host?.askUser ?? [])],
    runServerWorkflow: [...(testCase.host?.runServerWorkflow ?? [])],
  }

  const host: UiWorkflowHost = {
    showMessage: (text, messageType) => { calls.push({ kind: 'showMessage', text, messageType }) },
    navigate: (target) => {
      // NavigateTarget carries its own `kind` ('menu' | 'record' | 'back'),
      // so it is renamed to `target` here rather than spread — spreading let
      // it overwrite the call's own kind and every navigation recorded as
      // something other than a navigation.
      const { kind, ...rest } = target
      calls.push({ kind: 'navigate', target: kind, ...rest })
    },
    refresh: () => { calls.push({ kind: 'refresh' }) },

    askUser: async (request) => {
      calls.push({ kind: 'askUser', title: request.title })
      const r = nextResponse(script.askUser, 'askUser')
      if (r.error) throw new Error(r.error)
      return { confirmed: r.confirmed === true, value: r.value }
    },

    setFieldValue: (field, value) => { calls.push({ kind: 'setFieldValue', field, value }) },
    setFieldState: (field, patch) => { calls.push({ kind: 'setFieldState', field, patch }) },

    searchRecords: async (req) => {
      calls.push({ kind: 'searchRecords', formId: req.formId, pageSize: req.pageSize })
      const r = nextResponse(script.searchRecords, 'searchRecords')
      if (r.error) throw new Error(r.error)
      return { records: r.records ?? [], total: r.total ?? 0 }
    },

    createRecord: async (formId, values) => {
      calls.push({ kind: 'createRecord', formId, values })
      const r = nextResponse(script.createRecord, 'createRecord')
      if (r.error) throw new Error(r.error)
      return { id: r.id ?? '' }
    },

    updateRecord: async (formId, recordId, values) => {
      calls.push({ kind: 'updateRecord', formId, recordId, values })
      const r = nextResponse(script.updateRecord, 'updateRecord')
      if (r.error) throw new Error(r.error)
    },

    runServerWorkflow: async () => {
      calls.push({ kind: 'runServerWorkflow' })
      const r = nextResponse(script.runServerWorkflow, 'runServerWorkflow')
      if (r.error) throw new Error(r.error)
      return { status: r.status ?? 'COMPLETED' }
    },
  }

  const ctx = emptyRunContext({
    formId: testCase.context?.formId,
    recordId: testCase.context?.recordId,
    record: testCase.context?.record ?? {},
    variables: { ...(testCase.context?.variables ?? {}) },
  })

  const result = await runUiWorkflow({ steps: testCase.steps, ctx, host })

  return {
    status: result.status,
    failedStepId: result.failedStepId,
    error: result.error,
    trace: result.trace.map((t) => ({ stepId: t.stepId, status: t.status })),
    variables: result.variables,
    calls,
  }
}
