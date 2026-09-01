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
  // Live form capabilities — OPTIONAL, because they genuinely don't exist on
  // every surface. A record action runs against a SAVED record with no form
  // being filled anywhere, so there is no field to write into. Absent is the
  // honest representation of that, and the nodes that need these say so
  // plainly rather than appearing to work; the alternative — a no-op stub on
  // every host — would make a step silently do nothing.
  // -------------------------------------------------------------------------

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
}

export function emptyRunContext(over: Partial<UiWorkflowRunContext> = {}): UiWorkflowRunContext {
  return { record: {}, variables: {}, ...over }
}
