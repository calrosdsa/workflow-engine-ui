// open_form: the second suspending node, and the only one that can start
// further workflow runs.
import { describe, it, expect, vi } from 'vitest'
import './nodes'
import { runUiWorkflow } from './interpreter'
import { emptyRunContext, MAX_FORM_DEPTH, type UiWorkflowHost } from './host'
import { openForm, useOpenFormStore, abandonPendingForm } from './open-form-store'
import type { OpenFormRequest, OpenFormResult } from './open-form-store'
import type { UiWorkflowStep } from './types'

function hostWith(openFormImpl?: UiWorkflowHost['openForm']): UiWorkflowHost {
  return {
    showMessage: () => {},
    navigate: () => {},
    refresh: () => {},
    searchRecords: async () => ({ records: [], total: 0 }),
    createRecord: async () => ({ id: 'x' }),
    updateRecord: async () => {},
    runServerWorkflow: async () => ({ status: 'COMPLETED' }),
    ...(openFormImpl ? { openForm: openFormImpl } : {}),
  }
}

const step = (id: string, type: string, config: unknown = {}): UiWorkflowStep => ({ id, type, config })
const opened = (result: OpenFormResult): UiWorkflowHost['openForm'] => async () => result

describe('open_form suspends and resumes', () => {
  it('holds the run until the form is saved or closed', async () => {
    const order: string[] = []
    let release: ((r: OpenFormResult) => void) | undefined
    const host: UiWorkflowHost = {
      ...hostWith(() => new Promise<OpenFormResult>((r) => { release = r })),
      showMessage: (t) => order.push(t),
    }

    const run = runUiWorkflow({
      steps: [
        step('f', 'open_form', { form_id: 'customers', on_cancel: 'stop' }),
        step('m', 'show_message', { message: 'after', message_type: 'info' }),
      ],
      ctx: emptyRunContext(),
      host,
    })

    await Promise.resolve()
    expect(order).toEqual([])

    release!({ created: true, recordId: 'rec-9' })
    expect((await run).status).toBe('completed')
    expect(order).toEqual(['after'])
  })

  it('stores the new record id and a separate created flag', async () => {
    // Separate for the same reason show_dialog splits its two: "they closed
    // it" has to stay distinguishable from "they saved something with no id".
    const ctx = emptyRunContext()
    await runUiWorkflow({
      steps: [step('f', 'open_form', { form_id: 'customers', output_variable: 'made', on_cancel: 'stop' })],
      ctx,
      host: hostWith(opened({ created: true, recordId: 'rec-9' })),
    })
    expect(ctx.variables.made).toBe('rec-9')
    expect(ctx.variables.made_created).toBe(true)
  })

  it('carries the created record into a later step', async () => {
    // "Add a customer, then attach it" is the flow the node exists for.
    const updateRecord = vi.fn(async () => {})
    const result = await runUiWorkflow({
      steps: [
        step('f', 'open_form', { form_id: 'customers', output_variable: 'made', on_cancel: 'stop' }),
        step('u', 'update_record', {
          form_id: 'orders',
          values: [{ field: 'customer_id', source: 'variable', variable: 'made' }],
        }),
      ],
      ctx: emptyRunContext({ formId: 'orders', recordId: 'o-1' }),
      host: { ...hostWith(opened({ created: true, recordId: 'rec-9' })), updateRecord },
    })
    expect(result.status).toBe('completed')
    expect(updateRecord).toHaveBeenCalledWith('orders', 'o-1', { customer_id: 'rec-9' })
  })
})

describe('closing without saving', () => {
  const graph = (onCancel: string) => [
    step('f', 'open_form', { form_id: 'customers', output_variable: 'made', on_cancel: onCancel }),
    step('u', 'update_record', {
      form_id: 'orders',
      values: [{ field: 'customer_id', source: 'variable', variable: 'made' }],
    }),
  ]

  it('stops the run by default, so nothing acts on a record that was never made', async () => {
    const updateRecord = vi.fn(async () => {})
    const result = await runUiWorkflow({
      steps: graph('stop'),
      ctx: emptyRunContext({ formId: 'orders', recordId: 'o-1' }),
      host: { ...hostWith(opened({ created: false })), updateRecord },
    })
    expect(result.status).toBe('completed')
    expect(updateRecord).not.toHaveBeenCalled()
  })

  it('falls through when the author asked it to', async () => {
    const updateRecord = vi.fn(async () => {})
    await runUiWorkflow({
      steps: graph('continue'),
      ctx: emptyRunContext({ formId: 'orders', recordId: 'o-1' }),
      host: { ...hostWith(opened({ created: false })), updateRecord },
    })
    // The step still ran, but with no id to write — buildRecordValues drops
    // an unresolved reference rather than sending null, so nothing is sent
    // and the update is skipped entirely.
    expect(updateRecord).not.toHaveBeenCalled()
  })
})

describe('nesting is bounded', () => {
  it('refuses once already MAX_FORM_DEPTH forms deep', async () => {
    // The form it opens runs its OWN workflows, so form A can open B can open
    // C. One level is the point of the node; runaway depth is the problem.
    const openFormImpl = vi.fn(opened({ created: true, recordId: 'x' }))
    const result = await runUiWorkflow({
      steps: [step('f', 'open_form', { form_id: 'customers', on_cancel: 'stop' })],
      ctx: emptyRunContext({ depth: MAX_FORM_DEPTH }),
      host: hostWith(openFormImpl),
    })
    expect(result.status).toBe('failed')
    expect(result.error).toMatch(/deep/i)
    expect(openFormImpl).not.toHaveBeenCalled()
  })

  it('opens the form one level deeper than the run that asked', async () => {
    // The opened form's own runs inherit this, which is what makes the bound
    // mean anything.
    let seen: OpenFormRequest | undefined
    await runUiWorkflow({
      steps: [step('f', 'open_form', { form_id: 'customers', on_cancel: 'stop' })],
      ctx: emptyRunContext({ depth: 1 }),
      host: hostWith(async (request) => {
        seen = request
        return { created: true, recordId: 'x' }
      }),
    })
    expect(seen?.depth).toBe(2)
  })

  it('allows the ordinary one-level case', async () => {
    const result = await runUiWorkflow({
      steps: [step('f', 'open_form', { form_id: 'customers', on_cancel: 'stop' })],
      ctx: emptyRunContext(),
      host: hostWith(opened({ created: true, recordId: 'x' })),
    })
    expect(result.status).toBe('completed')
  })
})

describe('prefill', () => {
  it('resolves from the record and from run variables', async () => {
    // This is what makes it more than "go to the Add page": the step already
    // knows the record it is attached to.
    let seen: OpenFormRequest | undefined
    await runUiWorkflow({
      steps: [
        step('v', 'set_variable', { name: 'ref', source: 'static', value: 'ORD-1' }),
        step('f', 'open_form', {
          form_id: 'customers',
          on_cancel: 'stop',
          prefill: [
            { field: 'email', source: 'field', from_field: 'contact_email' },
            { field: 'source_order', source: 'variable', variable: 'ref' },
            { field: 'kind', source: 'static', value: 'walk-in' },
          ],
        }),
      ],
      ctx: emptyRunContext({ record: { contact_email: 'a@b.com' } }),
      host: hostWith(async (request) => {
        seen = request
        return { created: true, recordId: 'x' }
      }),
    })
    expect(seen?.prefill).toEqual({
      email: 'a@b.com',
      source_order: 'ORD-1',
      kind: 'walk-in',
    })
  })

  it('omits a value that resolved to nothing', async () => {
    // A key present with undefined would open the form asserting "clear this",
    // which is not what an unresolved reference means.
    let seen: OpenFormRequest | undefined
    await runUiWorkflow({
      steps: [
        step('f', 'open_form', {
          form_id: 'customers',
          on_cancel: 'stop',
          prefill: [{ field: 'email', source: 'variable', variable: 'never_set' }],
        }),
      ],
      ctx: emptyRunContext(),
      host: hostWith(async (request) => {
        seen = request
        return { created: true, recordId: 'x' }
      }),
    })
    expect(seen?.prefill).toEqual({})
  })
})

describe('a host that cannot open a form', () => {
  it('fails rather than skipping the step', async () => {
    const result = await runUiWorkflow({
      steps: [step('f', 'open_form', { form_id: 'customers', on_cancel: 'stop' })],
      ctx: emptyRunContext(),
      host: hostWith(),
    })
    expect(result.status).toBe('failed')
    expect(result.error).toMatch(/open a form/i)
  })
})

describe('openForm() settles on every path', () => {
  const request: OpenFormRequest = { formId: 'f', prefill: {}, depth: 1 }

  it('rejects when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(openForm(request, controller.signal)).rejects.toThrow(/cancelled/)
    expect(useOpenFormStore.getState().pending).toBeNull()
  })

  it('rejects when the signal aborts while waiting', async () => {
    const controller = new AbortController()
    const promise = openForm(request, controller.signal)
    expect(useOpenFormStore.getState().pending).not.toBeNull()
    controller.abort()
    await expect(promise).rejects.toThrow(/cancelled/)
    expect(useOpenFormStore.getState().pending).toBeNull()
  })

  it('rejects the older open when a second arrives', async () => {
    const first = openForm(request)
    const second = openForm({ ...request, formId: 'other' })
    await expect(first).rejects.toThrow(/replaced/)
    expect(useOpenFormStore.getState().pending?.request.formId).toBe('other')
    useOpenFormStore.getState().pending!.settle({ created: false })
    await expect(second).resolves.toEqual({ created: false })
  })

  it('rejects when the form host goes away', async () => {
    const promise = openForm(request)
    abandonPendingForm('the app closed the form')
    await expect(promise).rejects.toThrow(/closed/)
  })
})
