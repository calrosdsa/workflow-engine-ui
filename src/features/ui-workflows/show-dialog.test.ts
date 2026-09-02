// The suspending node, and the promise discipline behind it.
//
// A run parked forever is the failure mode: invisible to the viewer, and it
// wedges its trigger's in-flight guard for the life of the page. So most of
// this file is about the paths that must SETTLE.
import { describe, it, expect, vi } from 'vitest'
import './nodes'
import { runUiWorkflow } from './interpreter'
import { emptyRunContext, type UiWorkflowHost } from './host'
import { ask, useAskStore, abandonPendingAsk } from './ask-store'
import type { DialogAnswer } from './ask-store'
import type { UiWorkflowStep } from './types'

function hostWith(askUser?: UiWorkflowHost['askUser']): UiWorkflowHost {
  return {
    showMessage: () => {},
    navigate: () => {},
    refresh: () => {},
    searchRecords: async () => ({ records: [], total: 0 }),
    createRecord: async () => ({ id: 'x' }),
    updateRecord: async () => {},
    runServerWorkflow: async () => ({ status: 'COMPLETED' }),
    ...(askUser ? { askUser } : {}),
  }
}

const step = (id: string, type: string, config: unknown = {}): UiWorkflowStep => ({ id, type, config })
const answering = (answer: DialogAnswer): UiWorkflowHost['askUser'] => async () => answer

describe('show_dialog suspends and resumes', () => {
  it('holds the run until the answer arrives, then carries on', async () => {
    // The suspension itself: steps after the dialog must not run early.
    const order: string[] = []
    let release: ((a: DialogAnswer) => void) | undefined
    const host = hostWith(() => new Promise<DialogAnswer>((r) => { release = r }))
    const spyHost: UiWorkflowHost = { ...host, showMessage: (t) => order.push(t) }

    const run = runUiWorkflow({
      steps: [
        step('d', 'show_dialog', { kind: 'confirm', title: 'Sure?', on_cancel: 'stop' }),
        step('m', 'show_message', { message: 'after', message_type: 'info' }),
      ],
      ctx: emptyRunContext(),
      host: spyHost,
    })

    // Nothing after the dialog has happened yet — the run is parked.
    await Promise.resolve()
    expect(order).toEqual([])

    release!({ confirmed: true })
    const result = await run
    expect(result.status).toBe('completed')
    expect(order).toEqual(['after'])
  })

  it('stores the answer and a separate confirmed flag', async () => {
    // Separate because a dismissed prompt has NO value, and "they cancelled"
    // must stay distinguishable from "they typed nothing".
    const ctx = emptyRunContext()
    await runUiWorkflow({
      steps: [step('d', 'show_dialog', { kind: 'prompt', title: 'Why?', output_variable: 'reason', on_cancel: 'continue' })],
      ctx,
      host: hostWith(answering({ confirmed: true, value: 'late delivery' })),
    })
    expect(ctx.variables.reason).toBe('late delivery')
    expect(ctx.variables.reason_confirmed).toBe(true)
  })

  it('records a dismissal as unconfirmed with no value', async () => {
    const ctx = emptyRunContext()
    await runUiWorkflow({
      steps: [step('d', 'show_dialog', { kind: 'prompt', title: 'Why?', output_variable: 'reason', on_cancel: 'continue' })],
      ctx,
      host: hostWith(answering({ confirmed: false })),
    })
    expect(ctx.variables.reason).toBeUndefined()
    expect(ctx.variables.reason_confirmed).toBe(false)
  })
})

describe('what a dismissal does', () => {
  const graph = (onCancel: string) => [
    step('d', 'show_dialog', { kind: 'confirm', title: 'Delete?', on_cancel: onCancel }),
    step('u', 'update_record', { form_id: 'f', values: [{ field: 'deleted', source: 'static', value: true }] }),
  ]

  it('stops the run by default, so the declined thing does not happen', async () => {
    // The whole point of "are you sure?" — carrying on would do exactly what
    // the viewer just declined.
    const updateRecord = vi.fn(async () => {})
    const result = await runUiWorkflow({
      steps: graph('stop'),
      ctx: emptyRunContext({ formId: 'f', recordId: 'r1' }),
      host: { ...hostWith(answering({ confirmed: false })), updateRecord },
    })
    expect(result.status).toBe('completed')
    expect(updateRecord).not.toHaveBeenCalled()
  })

  it('falls through when the author asked it to', async () => {
    const updateRecord = vi.fn(async () => {})
    await runUiWorkflow({
      steps: graph('continue'),
      ctx: emptyRunContext({ formId: 'f', recordId: 'r1' }),
      host: { ...hostWith(answering({ confirmed: false })), updateRecord },
    })
    expect(updateRecord).toHaveBeenCalled()
  })
})

describe('a host that cannot ask', () => {
  it('fails rather than skipping the question', async () => {
    const result = await runUiWorkflow({
      steps: [step('d', 'show_dialog', { kind: 'confirm', title: 'Sure?', on_cancel: 'stop' })],
      ctx: emptyRunContext(),
      host: hostWith(),
    })
    expect(result.status).toBe('failed')
    expect(result.error).toMatch(/dialog/i)
  })
})

describe('ask() settles on every path', () => {
  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(ask({ kind: 'confirm', title: 'x' }, controller.signal)).rejects.toThrow(/cancelled/)
    expect(useAskStore.getState().pending).toBeNull()
  })

  it('rejects when the signal aborts while waiting', async () => {
    // Rejects rather than resolving "not confirmed": a cancelled run did not
    // get a "no" from anyone, and the interpreter reports the two differently.
    const controller = new AbortController()
    const promise = ask({ kind: 'confirm', title: 'x' }, controller.signal)
    expect(useAskStore.getState().pending).not.toBeNull()

    controller.abort()
    await expect(promise).rejects.toThrow(/cancelled/)
    expect(useAskStore.getState().pending).toBeNull()
  })

  it('rejects the older ask when a second one arrives', async () => {
    // Two runs competing. The older must be told, not dropped behind the
    // newer dialog to hang forever.
    const first = ask({ kind: 'confirm', title: 'first' })
    const second = ask({ kind: 'confirm', title: 'second' })

    await expect(first).rejects.toThrow(/replaced/)
    expect(useAskStore.getState().pending?.request.title).toBe('second')

    useAskStore.getState().pending!.settle({ confirmed: true })
    await expect(second).resolves.toEqual({ confirmed: true })
  })

  it('rejects when the dialog host goes away', async () => {
    const promise = ask({ kind: 'confirm', title: 'x' })
    abandonPendingAsk('the app closed the dialog')
    await expect(promise).rejects.toThrow(/closed/)
    expect(useAskStore.getState().pending).toBeNull()
  })

  it('ignores a second settle rather than throwing', async () => {
    const promise = ask({ kind: 'confirm', title: 'x' })
    const pending = useAskStore.getState().pending!
    pending.settle({ confirmed: true })
    // A stale handler firing after the fact must be inert, not a crash.
    expect(() => pending.settle({ confirmed: false })).not.toThrow()
    await expect(promise).resolves.toEqual({ confirmed: true })
  })

  it('reports a cancelled run as cancelled, not as a refusal', async () => {
    const controller = new AbortController()
    const result = runUiWorkflow({
      steps: [step('d', 'show_dialog', { kind: 'confirm', title: 'Sure?', on_cancel: 'stop' })],
      ctx: emptyRunContext(),
      host: hostWith((request, signal) => ask(request, signal)),
      signal: controller.signal,
    })
    await Promise.resolve()
    controller.abort()
    expect((await result).status).toBe('cancelled')
  })
})
