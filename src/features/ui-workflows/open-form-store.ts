// The second suspension point: a workflow opens a form and waits for the
// viewer to save or dismiss it.
//
// Structurally the twin of ask-store.ts — same module-level store, same
// settle-on-every-path discipline, same reason (the caller is an interpreter
// running outside the component tree). The differences are what make this one
// harder, and both are about the thing it opens being a REAL form:
//
//   • It runs its own workflows. A form opened by a step is still a form, and
//     an author who put an after-submit workflow on "Customer" expects it when
//     a customer is created — however that happened. So this can start further
//     runs, which is why depth is carried and bounded (see MAX_FORM_DEPTH).
//   • It can itself suspend. The inner form's own workflow may show a dialog
//     while the outer run is parked here. That is fine: the outer run is
//     suspended on THIS store, not on the ask store, so the two never contend
//     for the same single pending slot.
import { create } from 'zustand'

export interface OpenFormRequest {
  formId: string
  /** Values the form opens with, already resolved by the step. */
  prefill: Record<string, unknown>
  title?: string
  /** Nesting level for the form being opened — one deeper than the run that
   *  asked for it. Read by the workflows the opened form itself starts. */
  depth: number
}

export interface OpenFormResult {
  /** False when the viewer closed without saving. */
  created: boolean
  /** The new record's id, when they saved. */
  recordId?: string
}

interface PendingForm {
  id: number
  request: OpenFormRequest
  settle: (result: OpenFormResult) => void
  fail: (reason: Error) => void
}

interface OpenFormState {
  pending: PendingForm | null
}

export const useOpenFormStore = create<OpenFormState>(() => ({ pending: null }))

let nextId = 1

/** Opens the form and waits. Every exit settles — see ask-store.ts for why
 *  that list is the important part rather than the happy path. */
export function openForm(request: OpenFormRequest, signal?: AbortSignal): Promise<OpenFormResult> {
  return new Promise<OpenFormResult>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('cancelled'))
      return
    }

    const id = nextId++
    let done = false
    const finish = () => {
      done = true
      signal?.removeEventListener('abort', onAbort)
      useOpenFormStore.setState((s) => (s.pending?.id === id ? { pending: null } : s))
    }
    const settle = (result: OpenFormResult) => {
      if (done) return
      finish()
      resolve(result)
    }
    const fail = (reason: Error) => {
      if (done) return
      finish()
      reject(reason)
    }
    function onAbort() {
      fail(new Error('cancelled'))
    }
    signal?.addEventListener('abort', onAbort)

    // A second open while one is up means two runs are competing. The older
    // loses and is told, rather than being dropped behind the newer modal to
    // hang forever.
    const previous = useOpenFormStore.getState().pending
    previous?.fail(new Error('replaced by another form'))

    useOpenFormStore.setState({ pending: { id, request, settle, fail } })
  })
}

/** Called by the host component when it unmounts, so a form nobody can see any
 *  more doesn't leave its run parked forever. */
export function abandonPendingForm(reason = 'the form closed') {
  const pending = useOpenFormStore.getState().pending
  if (pending) pending.fail(new Error(reason))
  useOpenFormStore.setState({ pending: null })
}
