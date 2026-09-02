// ---------------------------------------------------------------------------
// The host contract — everything a UI workflow can reach outside itself
// ---------------------------------------------------------------------------
//
// The interpreter imports NOTHING from React, the router, or the API layer.
// Every effect goes through this interface, for two reasons that both matter:
//
//   1. Testability. The backend is not always up and jsdom is not a runtime;
//      a fake host makes the whole interpreter exercisable as a pure function
//      of (graph, context) -> trace. That is the only way the semantics get
//      pinned before an interpreter exists in Kotlin too.
//   2. It is the security boundary written down. This interface IS the
//      complete list of what authored client logic can do — there is no
//      method here that takes a credential, names a connector, or runs
//      arbitrary code, and adding one would be a visible change to this file
//      rather than a quiet import somewhere in a node.
//
// Every data method goes through the ORDINARY record endpoints as the viewer,
// so their own per-form permissions, field validation, server-side triggers
// and the audit log all apply exactly as if they had done it by hand. A UI
// workflow can never do more than the person looking at the screen could.
import type { FilterGroup, SortRule } from '@/features/workflows/types'
import type { DialogRequest, DialogAnswer } from './ask-store'
import type { OpenFormRequest, OpenFormResult } from './open-form-store'

export type UiMessageType = 'info' | 'success' | 'warning' | 'error'

export type NavigateTarget =
  | { kind: 'menu'; slug: string }
  | { kind: 'record'; formId: string; recordId: string }
  | { kind: 'back' }

export interface FetchRecordsRequest {
  formId: string
  filter?: FilterGroup
  sort?: SortRule[]
  pageSize: number
}

/** What a step may assert about a field being filled in. Every key is
 *  optional: a step sets only what it means to, and leaves the rest to the
 *  form's own rules. */
export interface FieldStatePatch {
  visible?: boolean
  required?: boolean
  readOnly?: boolean
}

export interface UiWorkflowHost {
  /** A toast on the web, a snackbar on mobile. */
  showMessage(text: string, type: UiMessageType): void
  navigate(target: NavigateTarget): void
  /** Re-fetch whatever the current surface is showing. */
  refresh(): void

  // -------------------------------------------------------------------------
  // OPTIONAL capabilities. Each is absent on surfaces that genuinely cannot
  // provide it, rather than stubbed to a no-op — a step that quietly does
  // nothing looks like success, and the nodes needing these say so plainly
  // instead.
  // -------------------------------------------------------------------------

  /** Asks the viewer something and waits — the one capability that SUSPENDS a
   *  run rather than completing during it. Present wherever a dialog host is
   *  mounted, which is every app root.
   *
   *  Rejects rather than resolving when the run is aborted: a cancelled run
   *  did not get a "no" from anyone, and reporting it as one would let the
   *  steps after a cancel branch run on a decision nobody made. */
  askUser?(request: DialogRequest, signal?: AbortSignal): Promise<DialogAnswer>

  /** Opens a form for the viewer to fill in and waits for them to save or
   *  dismiss — the second suspending capability, and the only one that can
   *  start further workflow runs of its own (the opened form's).
   *
   *  Rejects on abort for the same reason askUser does: a cancelled run did
   *  not get a "they dismissed it" from anyone. */
  openForm?(request: OpenFormRequest, signal?: AbortSignal): Promise<OpenFormResult>

  // Live-form capabilities: absent unless a form is actually being filled. A
  // record action runs against a SAVED record, where there is no field on
  // screen to write into.

  /** Writes a value into the form currently being filled. */
  setFieldValue?(key: string, value: unknown): void
  /** Overrides a field's visible/required/readOnly for the rest of this fill.
   *  Layered ON TOP of the form's own behavior rules and Advanced Settings,
   *  which continue to apply — this asserts, it does not replace them. */
  setFieldState?(key: string, patch: FieldStatePatch): void

  searchRecords(req: FetchRecordsRequest): Promise<{ records: Record<string, unknown>[]; total: number }>
  createRecord(formId: string, values: Record<string, unknown>): Promise<{ id: string }>
  updateRecord(formId: string, recordId: string, values: Record<string, unknown>): Promise<void>

  /** Hands off to a server workflow. `wait` polls to completion; otherwise
   *  this resolves as soon as the run is accepted. The host owns the polling
   *  because it also owns the progress UI. */
  runServerWorkflow(args: {
    formId: string
    recordId: string
    workflowDefinitionId: string
    inputs: Record<string, unknown>
    wait: boolean
  }): Promise<{ status: string; message?: string; messageType?: UiMessageType }>
}

/** Everything a run reads and writes as it goes.
 *
 *  `record` is the record the workflow was triggered on, and is what a
 *  `condition` step evaluates against — the same values a field-visibility
 *  rule would see. `variables` is run-local scratch that dies with the run:
 *  a UI workflow has no durability whatsoever, by design. */
export interface UiWorkflowRunContext {
  formId?: string
  recordId?: string
  record: Record<string, unknown>
  variables: Record<string, unknown>
  /** How many forms deep this run is.
   *
   *  An `open_form` step opens a real form, and a real form runs its OWN
   *  workflows — an author who put an after-submit workflow on "Customer"
   *  expects it to run when a customer is created, however that happened.
   *  Which means form A's workflow can open form B, whose workflow can open
   *  form C, and so on.
   *
   *  Bounded rather than forbidden, for the same reason MAX_STEPS bounds step
   *  count rather than banning loops: one level of nesting ("add a customer
   *  while writing an order") is the whole point of the node, and only
   *  runaway depth is the problem. */
  depth: number
}

/** Deeper than this and `open_form` refuses. Three is enough for the nesting
 *  anyone means on purpose and short of the stack of modals nobody does. */
export const MAX_FORM_DEPTH = 3

export function emptyRunContext(over: Partial<UiWorkflowRunContext> = {}): UiWorkflowRunContext {
  return { record: {}, variables: {}, depth: 0, ...over }
}
