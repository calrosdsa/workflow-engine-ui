import { describe, it, expect, vi } from 'vitest'
import './nodes'
import { runUiWorkflow, MAX_STEPS } from './interpreter'
import { parseUiWorkflow } from './parse'
import { emptyRunContext, type UiWorkflowHost } from './host'
import type { UiWorkflowStep } from './types'

/** A host that records what a run asked for instead of doing it. This is the
 *  point of injecting the host at all: the whole interpreter is exercisable
 *  with no backend, no router and no React — which is also what makes these
 *  the semantics a Kotlin port would have to match. */
function fakeHost(over: Partial<UiWorkflowHost> = {}) {
  const calls: { messages: [string, string][]; navigations: unknown[]; refreshes: number } = {
    messages: [], navigations: [], refreshes: 0,
  }
  const host: UiWorkflowHost = {
    showMessage: (text, type) => { calls.messages.push([text, type]) },
    navigate: (target) => { calls.navigations.push(target) },
    refresh: () => { calls.refreshes++ },
    searchRecords: async () => ({ records: [], total: 0 }),
    createRecord: async () => ({ id: 'new-id' }),
    updateRecord: async () => {},
    runServerWorkflow: async () => ({ status: 'COMPLETED' }),
    ...over,
  }
  return { host, calls }
}

const step = (id: string, type: string, config: unknown = {}): UiWorkflowStep => ({ id, type, config })

function run(steps: UiWorkflowStep[], opts: { host?: UiWorkflowHost; ctx?: ReturnType<typeof emptyRunContext>; signal?: AbortSignal } = {}) {
  const { host } = fakeHost()
  return runUiWorkflow({
    steps,
    ctx: opts.ctx ?? emptyRunContext(),
    host: opts.host ?? host,
    signal: opts.signal,
  })
}

describe('sequential execution', () => {
  it('runs steps in order and reports completion', async () => {
    const { host, calls } = fakeHost()
    const result = await run(
      [
        step('a', 'show_message', { message: 'first', message_type: 'info' }),
        step('b', 'show_message', { message: 'second', message_type: 'success' }),
      ],
      { host },
    )

    expect(result.status).toBe('completed')
    expect(calls.messages).toEqual([['first', 'info'], ['second', 'success']])
    expect(result.trace.map((t) => t.stepId)).toEqual(['a', 'b'])
  })

  it('completes an empty graph rather than treating it as an error', async () => {
    expect((await run([])).status).toBe('completed')
  })
})

describe('failure stops the run', () => {
  it('does not execute steps after a failed one', async () => {
    // The important half: a later step must not act on state the author
    // believed a failed step produced — especially when it writes records.
    const createRecord = vi.fn(async () => ({ id: 'x' }))
    const { host } = fakeHost({
      updateRecord: async () => { throw new Error('403 forbidden') },
      createRecord,
    })

    const result = await runUiWorkflow({
      steps: [
        step('u', 'update_record', { form_id: 'f', values: [{ field: 'a', source: 'static', value: 1 }] }),
        step('c', 'create_record', { form_id: 'f', values: [] }),
      ],
      ctx: emptyRunContext({ formId: 'f', recordId: 'r1' }),
      host,
    })

    expect(result.status).toBe('failed')
    expect(result.failedStepId).toBe('u')
    expect(result.error).toContain('403')
    expect(createRecord).not.toHaveBeenCalled()
  })

  it('never throws out of the run, whatever a node does', async () => {
    const { host } = fakeHost({
      searchRecords: async () => { throw new Error('boom') },
    })
    // The caller is a click handler; an unhandled rejection there is a console
    // message nobody sees.
    await expect(
      runUiWorkflow({ steps: [step('f', 'fetch_records', { form_id: 'f', output_variable: 'r' })], ctx: emptyRunContext(), host }),
    ).resolves.toMatchObject({ status: 'failed' })
  })
})

describe('unknown and unimplemented steps', () => {
  it('skips an unknown step type and keeps going', async () => {
    // A graph authored in a newer client can carry a step this build has
    // never heard of; refusing the whole workflow would be worse than running
    // the parts it does understand.
    const { host, calls } = fakeHost()
    const result = await run(
      [
        step('x', 'from_the_future'),
        step('m', 'show_message', { message: 'still ran', message_type: 'info' }),
      ],
      { host },
    )

    expect(result.status).toBe('completed')
    expect(calls.messages).toEqual([['still ran', 'info']])
    expect(result.trace.find((t) => t.stepId === 'x')).toMatchObject({ status: 'skipped' })
  })
})

describe('branching', () => {
  const graph = (value: unknown) => [
    step('if', 'condition', {
      when: { combinator: 'and', conditions: [{ id: 'c', field: 'stage', op: 'eq', value }], groups: [] },
      then: [step('t', 'show_message', { message: 'matched', message_type: 'success' })],
      else: [step('e', 'show_message', { message: 'did not', message_type: 'info' })],
    }),
  ]

  it('takes the then branch when the condition matches', async () => {
    const { host, calls } = fakeHost()
    await runUiWorkflow({ steps: graph('won'), ctx: emptyRunContext({ record: { stage: 'won' } }), host })
    expect(calls.messages).toEqual([['matched', 'success']])
  })

  it('takes the else branch when it does not', async () => {
    const { host, calls } = fakeHost()
    await runUiWorkflow({ steps: graph('won'), ctx: emptyRunContext({ record: { stage: 'lost' } }), host })
    expect(calls.messages).toEqual([['did not', 'info']])
  })

  it('continues with the following sibling after a branch', async () => {
    const { host, calls } = fakeHost()
    await runUiWorkflow({
      steps: [...graph('won'), step('after', 'show_message', { message: 'after', message_type: 'info' })],
      ctx: emptyRunContext({ record: { stage: 'won' } }),
      host,
    })
    expect(calls.messages.map((m) => m[0])).toEqual(['matched', 'after'])
  })

  it('sees variables set by earlier steps, which win over record fields', async () => {
    // A variable is something this run just computed, so it is the more
    // specific answer — and the alternative would make set_variable silently
    // ineffective whenever it shared a field's name.
    const { host, calls } = fakeHost()
    await runUiWorkflow({
      steps: [
        step('v', 'set_variable', { name: 'stage', source: 'static', value: 'won' }),
        ...graph('won'),
      ],
      ctx: emptyRunContext({ record: { stage: 'lost' } }),
      host,
    })
    expect(calls.messages).toEqual([['matched', 'success']])
  })
})

describe('variables and data steps', () => {
  it('carries a created record id into a later navigate', async () => {
    // "Create it, then open it" — the flow the output_variable exists for.
    const { host, calls } = fakeHost({ createRecord: async () => ({ id: 'rec-42' }) })
    const result = await runUiWorkflow({
      steps: [
        step('c', 'create_record', { form_id: 'f1', values: [{ field: 'name', source: 'static', value: 'Acme' }], output_variable: 'made' }),
        step('n', 'navigate', { target: 'record', form_id: 'f1', record_id_variable: 'made' }),
      ],
      ctx: emptyRunContext(),
      host,
    })

    expect(result.status).toBe('completed')
    expect(calls.navigations).toEqual([{ kind: 'record', formId: 'f1', recordId: 'rec-42' }])
  })

  it('sends only the configured fields on an update', async () => {
    // Resubmitting a whole fetched record is what broke Kanban's drag: a date
    // round-trips from GET as RFC3339 while the validator demands YYYY-MM-DD.
    const updateRecord = vi.fn(async () => {})
    const { host } = fakeHost({ updateRecord })
    await runUiWorkflow({
      steps: [step('u', 'update_record', { form_id: 'f', values: [{ field: 'stage', source: 'static', value: 'won' }] })],
      ctx: emptyRunContext({ formId: 'f', recordId: 'r9', record: { stage: 'lost', close_date: '2026-11-30T00:00:00Z' } }),
      host,
    })
    expect(updateRecord).toHaveBeenCalledWith('f', 'r9', { stage: 'won' })
  })

  it('stores fetched rows and their total count', async () => {
    const { host } = fakeHost({
      searchRecords: async () => ({ records: [{ id: '1' }, { id: '2' }], total: 7 }),
    })
    const ctx = emptyRunContext()
    await runUiWorkflow({
      steps: [step('f', 'fetch_records', { form_id: 'f1', output_variable: 'rows', page_size: 10 })],
      ctx,
      host,
    })
    expect(ctx.variables.rows).toHaveLength(2)
    expect(ctx.variables.rows_count).toBe(7)
  })

  it('clamps a page size the config never passed through the parser', async () => {
    // Typed with its argument so the assertion below can read it: a config can
    // reach the interpreter without going through parseConfig, so the bound
    // has to hold at execution too, not only at parse.
    const searchRecords: UiWorkflowHost['searchRecords'] = vi.fn(async () => ({ records: [], total: 0 }))
    const { host } = fakeHost({ searchRecords })
    await runUiWorkflow({
      steps: [step('f', 'fetch_records', { form_id: 'f1', output_variable: 'r', page_size: 99999 })],
      ctx: emptyRunContext(),
      host,
    })
    expect(vi.mocked(searchRecords).mock.calls[0][0]).toMatchObject({ pageSize: 500 })
  })

  it('fails a step that names a variable holding no record id', async () => {
    const result = await run([step('u', 'update_record', { form_id: 'f', values: [{ field: 'a', source: 'static', value: 1 }], record_id_variable: 'missing' })])
    expect(result.status).toBe('failed')
    expect(result.error).toContain('missing')
  })
})

describe('navigation ends the run', () => {
  it('does not run steps after a navigate', async () => {
    // The surface later steps would act on is being torn down.
    const { host, calls } = fakeHost()
    const result = await run(
      [
        step('n', 'navigate', { target: 'menu', menu_slug: 'dashboard' }),
        step('m', 'show_message', { message: 'never', message_type: 'info' }),
      ],
      { host },
    )
    expect(result.status).toBe('completed')
    expect(calls.messages).toEqual([])
    expect(calls.navigations).toEqual([{ kind: 'menu', slug: 'dashboard' }])
  })
})

describe('bounds and cancellation', () => {
  it('stops a runaway graph instead of hanging the tab', async () => {
    // A self-entering condition: the authored equivalent of an infinite loop.
    const loop: UiWorkflowStep = step('loop', 'condition', {
      when: { combinator: 'and', conditions: [], groups: [] },
      then: [] as UiWorkflowStep[],
      else: [],
    })
    ;(loop.config as { then: UiWorkflowStep[] }).then.push(loop)

    const result = await run([loop])
    expect(result.status).toBe('failed')
    expect(result.error).toContain(String(MAX_STEPS))
  })

  it('reports cancellation when the signal aborts', async () => {
    const controller = new AbortController()
    controller.abort()
    const result = await run([step('m', 'show_message', { message: 'x', message_type: 'info' })], {
      signal: controller.signal,
    })
    expect(result.status).toBe('cancelled')
  })
})

describe('a parsed graph runs', () => {
  it('goes from stored JSON straight through the interpreter', async () => {
    // End to end for the two halves built so far: parse heals what is stored,
    // the interpreter runs what parsing produced.
    const { host, calls } = fakeHost()
    const wf = parseUiWorkflow({
      steps: [
        { id: 's1', type: 'set_variable', config: { name: 'who', source: 'field', field: 'owner' } },
        { id: 's2', type: 'show_message', config: { message: 'done', message_type: 'success' } },
      ],
    })
    const ctx = emptyRunContext({ record: { owner: 'Dana' } })
    const result = await runUiWorkflow({ steps: wf.steps, ctx, host })

    expect(result.status).toBe('completed')
    expect(ctx.variables.who).toBe('Dana')
    expect(calls.messages).toEqual([['done', 'success']])
  })
})
