// The form-acting nodes, and the guard that makes them safe to reach from a
// field-change trigger.
import { describe, it, expect, vi } from 'vitest'
import './nodes'
import { runUiWorkflow } from './interpreter'
import { emptyRunContext, type FieldStatePatch, type UiWorkflowHost } from './host'
import { getUiWorkflowNode } from './node-registry'
import type { UiWorkflowStep } from './types'

function baseHost(over: Partial<UiWorkflowHost> = {}): UiWorkflowHost {
  return {
    showMessage: () => {},
    navigate: () => {},
    refresh: () => {},
    searchRecords: async () => ({ records: [], total: 0 }),
    createRecord: async () => ({ id: 'x' }),
    updateRecord: async () => {},
    runServerWorkflow: async () => ({ status: 'COMPLETED' }),
    ...over,
  }
}

const step = (id: string, type: string, config: unknown = {}): UiWorkflowStep => ({ id, type, config })

describe('set_field', () => {
  it('writes into the form being filled', async () => {
    const setFieldValue = vi.fn()
    const result = await runUiWorkflow({
      steps: [step('s', 'set_field', { field: 'total', source: 'static', value: '42' })],
      ctx: emptyRunContext(),
      host: baseHost({ setFieldValue }),
    })
    expect(result.status).toBe('completed')
    expect(setFieldValue).toHaveBeenCalledWith('total', '42')
  })

  it('copies from another field', async () => {
    const setFieldValue = vi.fn()
    await runUiWorkflow({
      steps: [step('s', 'set_field', { field: 'ship_to', source: 'field', from_field: 'bill_to' })],
      ctx: emptyRunContext({ record: { bill_to: '10 Main St' } }),
      host: baseHost({ setFieldValue }),
    })
    expect(setFieldValue).toHaveBeenCalledWith('ship_to', '10 Main St')
  })

  it('fails clearly on a surface with no form', async () => {
    // A record action runs against a SAVED record — there is no field on
    // screen. Reporting that beats a silent no-op that looks like success,
    // which is why the host method is absent rather than a stub.
    const result = await runUiWorkflow({
      steps: [step('s', 'set_field', { field: 'total', source: 'static', value: 1 })],
      ctx: emptyRunContext(),
      host: baseHost(),
    })
    expect(result.status).toBe('failed')
    expect(result.error).toMatch(/form is being filled/i)
  })
})

describe('set_field_state', () => {
  it('passes through only the keys that were actually set', async () => {
    // Omitted means "leave it to the form's own rules"; reading a missing key
    // as false would make every step force visible/optional/editable.
    const patches: [string, FieldStatePatch][] = []
    await runUiWorkflow({
      steps: [step('s', 'set_field_state', { field: 'reason', visible: true })],
      ctx: emptyRunContext(),
      host: baseHost({ setFieldState: (k, p) => patches.push([k, p]) }),
    })
    expect(patches).toEqual([['reason', { visible: true }]])
  })

  it('carries an explicit false, which is an assertion not an omission', async () => {
    const patches: [string, FieldStatePatch][] = []
    await runUiWorkflow({
      steps: [step('s', 'set_field_state', { field: 'reason', visible: false, required: false })],
      ctx: emptyRunContext(),
      host: baseHost({ setFieldState: (k, p) => patches.push([k, p]) }),
    })
    expect(patches[0][1]).toEqual({ visible: false, required: false })
  })

  it('drops junk rather than turning it into an assertion', () => {
    const def = getUiWorkflowNode('set_field_state')!
    const parsed = def.parseConfig({ field: 'a', visible: 'yes', required: 1 }) as Record<string, unknown>
    expect('visible' in parsed).toBe(false)
    expect('required' in parsed).toBe(false)
  })

  it('fails clearly on a surface with no form', async () => {
    const result = await runUiWorkflow({
      steps: [step('s', 'set_field_state', { field: 'x', visible: false })],
      ctx: emptyRunContext(),
      host: baseHost(),
    })
    expect(result.status).toBe('failed')
    expect(result.error).toMatch(/form is being filled/i)
  })
})

describe('the field-change shape', () => {
  it('branches on which field changed', async () => {
    // changed_field is the one piece of context a field-change run has that no
    // other trigger does, and it is a variable so a condition can read it.
    const setFieldValue = vi.fn()
    await runUiWorkflow({
      steps: [
        step('if', 'condition', {
          when: { combinator: 'and', conditions: [{ id: 'c', field: 'changed_field', op: 'eq', value: 'country' }], groups: [] },
          then: [step('s', 'set_field', { field: 'state', source: 'static', value: '' })],
          else: [],
        }),
      ],
      ctx: emptyRunContext({ record: { country: 'FR' }, variables: { changed_field: 'country' } }),
      host: baseHost({ setFieldValue }),
    })
    expect(setFieldValue).toHaveBeenCalledWith('state', '')
  })

  it('runs a cascade end to end: read, branch, write', async () => {
    const setFieldValue = vi.fn()
    const setFieldState = vi.fn()
    const result = await runUiWorkflow({
      steps: [
        step('f', 'fetch_records', { form_id: 'rates', output_variable: 'rates', page_size: 1 }),
        step('if', 'condition', {
          when: { combinator: 'and', conditions: [{ id: 'c', field: 'rates_count', op: 'gt', value: 0 }], groups: [] },
          then: [
            step('v', 'set_field', { field: 'rate', source: 'variable', variable: 'rates_count' }),
            step('st', 'set_field_state', { field: 'manual_rate', visible: false }),
          ],
          else: [step('m', 'show_message', { message: 'No rate found', message_type: 'warning' })],
        }),
      ],
      ctx: emptyRunContext({ variables: { changed_field: 'product' } }),
      host: baseHost({
        setFieldValue,
        setFieldState,
        searchRecords: async () => ({ records: [{ id: '1' }], total: 1 }),
      }),
    })

    expect(result.status).toBe('completed')
    expect(setFieldValue).toHaveBeenCalledWith('rate', 1)
    expect(setFieldState).toHaveBeenCalledWith('manual_rate', { visible: false })
  })
})
