// The suspension point: a workflow step asks the viewer something and waits.
//
// A module-level store rather than React context, for the same reason sonner's
// `toast()` is: the caller is an interpreter running outside the component
// tree, and threading a provider through every surface that can start a
// workflow — a record toolbar, a form, a menu — would be a lot of plumbing to
// deliver one dialog. `UiWorkflowDialogHost` subscribes and renders; `ask()`
// is callable from anywhere.
//
// SUSPENSION NEEDED NO INTERPRETER CHANGES. runUiWorkflow already awaits each
// executor, so a step that returns a promise resolving on a button click
// parks the run exactly as it stands. What this file adds is the promise, and
// — the part that is easy to get wrong — every path that must settle it.
//
// A run that never settles is the failure mode here: the viewer sees nothing,
// the in-flight guard stays latched, and the workflow is wedged for the rest
// of the page's life. So every exit resolves or rejects:
//   • answering or cancelling      -> resolve
//   • the run's AbortSignal fires  -> reject (navigating away, cancellation)
//   • the host unmounts            -> reject (the dialog can no longer be seen)
//   • a second ask arrives         -> the older one rejects rather than being
//                                     silently replaced
import { create } from 'zustand'

export type DialogKind = 'confirm' | 'prompt' | 'choose'

export interface DialogOption {
  value: string
  label: string
}

export interface DialogRequest {
  kind: DialogKind
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** prompt only. */
  placeholder?: string
  defaultValue?: string
  /** choose only. */
  options?: DialogOption[]
}

export interface DialogAnswer {
  /** False when the viewer dismissed rather than confirmed. */
  confirmed: boolean
  /** The typed text or picked option. Undefined for a plain confirm, and for
   *  any dismissal — a cancelled prompt has no value, not an empty one. */
  value?: string
}

interface PendingAsk {
  id: number
  request: DialogRequest
  settle: (answer: DialogAnswer) => void
  fail: (reason: Error) => void
}

interface AskState {
  pending: PendingAsk | null
}

export const useAskStore = create<AskState>(() => ({ pending: null }))

let nextId = 1

/** Shows a dialog and waits for the viewer.
 *
 *  Rejects rather than resolving on abort, because a run that was cancelled
 *  should not continue as though the viewer had said "no" — those are
 *  different outcomes, and the interpreter reports cancellation distinctly. */
export function ask(request: DialogRequest, signal?: AbortSignal): Promise<DialogAnswer> {
  return new Promise<DialogAnswer>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('cancelled'))
      return
    }

    const id = nextId++
    let done = false
    const finish = () => {
      done = true
      signal?.removeEventListener('abort', onAbort)
      // Only clears if THIS ask is still the pending one — a newer ask may
      // have replaced it, and clearing then would close a live dialog.
      useAskStore.setState((s) => (s.pending?.id === id ? { pending: null } : s))
    }
    const settle = (answer: DialogAnswer) => {
      if (done) return
      finish()
      resolve(answer)
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

    // A second ask while one is open means two runs are competing. The older
    // loses and is told so, rather than being dropped on the floor to hang
    // forever behind the newer dialog.
    const previous = useAskStore.getState().pending
    previous?.fail(new Error('replaced by another prompt'))

    useAskStore.setState({ pending: { id, request, settle, fail } })
  })
}

/** Called by the host component when it unmounts, so a dialog nobody can see
 *  any more doesn't leave its run parked forever. */
export function abandonPendingAsk(reason = 'the dialog closed') {
  const pending = useAskStore.getState().pending
  if (pending) pending.fail(new Error(reason))
  useAskStore.setState({ pending: null })
}
