// The after-submit trigger's semantics, exercised through the interpreter with
// a fake host — the hook itself is a thin React wrapper around exactly this.
//
// The decision these pin: form_submit runs AFTER the save and CANNOT veto it.
// By the time these steps execute the record is written, so a failure reports
// and stops the remaining steps without undoing anything. A client-side check
// that could block a write would be authorization living in the browser, which
// the server has to re-decide regardless; a genuine veto belongs in the form's
// own Before trigger.
import { describe, it, expect, vi } from 'vitest'
import './nodes'
import { runUiWorkflow } from './interpreter'
import { emptyRunContext, type UiWorkflowHost } from './host'
import type { UiWorkflowStep } from './types'

function fakeHost(over: Partial<UiWorkflowHost> = {}) {
  const calls: { messages: [string, string][]; navigations: unknown[] } = { messages: [], navigations: [] }
  const host: UiWorkflowHost = {
    showMessage: (t, ty) => { calls.messages.push([t, ty]) },
    navigate: (t) => { calls.navigations.push(t) },
    refresh: () => {},
    searchRecords: async () => ({ records: [], total: 0 }),
    createRecord: async () => ({ id: 'new' }),
    updateRecord: async () => {},
    runServerWorkflow: async () => ({ status: 'COMPLETED' }),
    ...over,
  }
  return { host, calls }
}

const step = (id: string, type: string, config: unknown = {}): UiWorkflowStep => ({ id, type, config })

/** The context the hook builds: the just-saved record, with its id. */
const savedCtx = (record: Record<string, unknown>) =>
  emptyRunContext({ formId: 'f1', recordId: String(record.id ?? ''), record })

describe('the saved record is in context', () => {
  it('lets a condition branch on what was just entered', async () => {
    const { host, calls } = fakeHost()
    await runUiWorkflow({
      steps: [
        step('if', 'condition', {
          when: { combinator: 'and', conditions: [{ id: 'c', field: 'amount', op: 'gt', value: 1000 }], groups: [] },
          then: [step('t', 'show_message', { message: 'big one', message_type: 'info' })],
          else: [],
        }),
      ],
      ctx: savedCtx({ id: 'r1', amount: 5000 }),
      host,
    })
    expect(calls.messages).toEqual([['big one', 'info']])
  })

  it('lets an update step address the saved record with no configuration', async () => {
    // recordId comes from context, so the common "stamp a field on what was
    // just created" case needs no record_id_variable at all.
    const updateRecord = vi.fn(async () => {})
    const { host } = fakeHost({ updateRecord })
    const result = await runUiWorkflow({
      steps: [step('u', 'update_record', { form_id: '', values: [{ field: 'status', source: 'static', value: 'new' }] })],
      ctx: savedCtx({ id: 'r7', amount: 1 }),
      host,
    })
    expect(result.status).toBe('completed')
    expect(updateRecord).toHaveBeenCalledWith('f1', 'r7', { status: 'new' })
  })
})

describe('it cannot undo the save', () => {
  it('reports a failure without any rollback call', async () => {
    // There is no rollback in the host at all — the absence is the point, and
    // this asserts the interface never grew one by accident.
    const { host } = fakeHost({ updateRecord: async () => { throw new Error('nope') } })
    expect(Object.keys(host)).not.toContain('deleteRecord')

    const result = await runUiWorkflow({
      steps: [step('u', 'update_record', { form_id: 'f1', values: [{ field: 'a', source: 'static', value: 1 }] })],
      ctx: savedCtx({ id: 'r1' }),
      host,
    })
    expect(result.status).toBe('failed')
    expect(result.error).toContain('nope')
  })

  it('still runs the steps before the failing one', async () => {
    // Those effects already happened and are not rewound either — an
    // after-submit run is a sequence of committed effects, not a transaction.
    const { host, calls } = fakeHost({ createRecord: async () => { throw new Error('denied') } })
    const result = await runUiWorkflow({
      steps: [
        step('m', 'show_message', { message: 'saved', message_type: 'success' }),
        step('c', 'create_record', { form_id: 'f2', values: [] }),
      ],
      ctx: savedCtx({ id: 'r1' }),
      host,
    })
    expect(calls.messages).toEqual([['saved', 'success']])
    expect(result.status).toBe('failed')
    expect(result.failedStepId).toBe('c')
  })
})

describe('navigation ownership', () => {
  it('a navigating workflow is detectable so the caller stands down', async () => {
    // Both AddMenuRuntime and RuntimeFormCreatePage have their own post-save
    // redirect. Two navigations racing on one click land the viewer wherever
    // the second resolves, so the workflow — the more specific instruction —
    // has to win, and the caller needs to know it happened.
    let navigated = false
    const { host } = fakeHost()
    const observed: UiWorkflowHost = { ...host, navigate: (t) => { navigated = true; host.navigate(t) } }

    await runUiWorkflow({
      steps: [step('n', 'navigate', { target: 'menu', menu_slug: 'invoices' })],
      ctx: savedCtx({ id: 'r1' }),
      host: observed,
    })
    expect(navigated).toBe(true)
  })

  it('leaves the caller’s own redirect alone when no step navigates', async () => {
    let navigated = false
    const { host } = fakeHost()
    const observed: UiWorkflowHost = { ...host, navigate: (t) => { navigated = true; host.navigate(t) } }

    await runUiWorkflow({
      steps: [step('m', 'show_message', { message: 'done', message_type: 'success' })],
      ctx: savedCtx({ id: 'r1' }),
      host: observed,
    })
    expect(navigated).toBe(false)
  })
})
