// @vitest-environment jsdom
//
// Render proof that Advanced Settings actually reach the screen.
//
// The rules, the condition builder and the per-element list all shipped
// already; what never existed was anything that EVALUATED them, so an admin
// could configure a rule, save it, and watch it do nothing. The unit tests in
// advanced-settings.test.ts cover the resolver in isolation — this file covers
// the wiring, which is where a working resolver can still fail to change a
// single pixel.
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, cleanup, screen, waitFor, fireEvent } from '@testing-library/react'
import { FormRenderer } from './FormRenderer'
import { resolveFormSchema } from '@/features/form-builder/serialize'
import { useAuthStore } from '@/stores/auth'
import type { FieldDef } from '@/features/forms/types'
import type { AdvancedSetting, FormSchema } from '@/features/form-builder/schema'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver

afterEach(cleanup)

// A form with a field worth restricting: only managers should see the reason
// a discount was given.
const fields: FieldDef[] = [
  { name: 'customer', label: 'Customer', type: 'string', required: true },
  { name: 'discount_reason', label: 'Discount Reason', type: 'string' },
  { name: 'amount', label: 'Amount', type: 'integer' },
]

/** Signs a viewer in as `roleId` for the app the store is pointed at. */
function signInAs(roleId: string, userId = 'u-1') {
  useAuthStore.setState({
    session: {
      user_id: userId,
      memberships: [{ client_id: 'c-1', app_id: 'a-1', role_id: roleId, permissions: [] }],
    },
    activeMembership: { client_id: 'c-1', app_id: 'a-1' },
  } as unknown as ReturnType<typeof useAuthStore.getState>)
}

function schemaWithRules(fieldKey: string, settings: AdvancedSetting[]): FormSchema {
  const schema = resolveFormSchema({ layout: null, fields })
  for (const section of schema.sections) {
    for (const column of section.columns) {
      for (const el of column.elements) {
        if (el.key === fieldKey) el.advancedSettings = settings
      }
    }
  }
  return schema
}

const hideForSales: AdvancedSetting = {
  id: 's1',
  name: 'Hide discount reason from sales',
  appliesTo: 'specific_role',
  roleIds: ['role-sales'],
  when: { id: 'g1', combinator: 'and', conditions: [], groups: [] },
  actions: [{ id: 'a1', type: 'hidden_in_ui' }],
}

beforeEach(() => signInAs('role-sales'))

describe('hidden_in_ui', () => {
  it('hides the field from a viewer in the rule audience', async () => {
    render(
      <FormRenderer
        schema={schemaWithRules('discount_reason', [hideForSales])}
        fields={fields}
        onSubmit={() => {}}
      />,
    )

    // The unrestricted fields still render...
    expect(screen.getByText('Customer')).toBeTruthy()
    expect(screen.getByText('Amount')).toBeTruthy()
    // ...and the restricted one is gone.
    await waitFor(() => expect(screen.queryByText('Discount Reason')).toBeNull())
  })

  it('leaves the field alone for a viewer outside the audience', () => {
    signInAs('role-manager')
    render(
      <FormRenderer
        schema={schemaWithRules('discount_reason', [hideForSales])}
        fields={fields}
        onSubmit={() => {}}
      />,
    )
    expect(screen.getByText('Discount Reason')).toBeTruthy()
  })

  it('does not block submit when the hidden field was required', async () => {
    // The regression this guards: a required field hidden from a whole role
    // makes the form permanently unsubmittable, with the validation error
    // pinned to a control that isn't on screen. buildZodSchema is fed the
    // hidden keys so the static requirement lifts with the field.
    const requiredAndHidden = resolveFormSchema({ layout: null, fields })
    for (const section of requiredAndHidden.sections) {
      for (const column of section.columns) {
        for (const el of column.elements) {
          if (el.key !== 'discount_reason') continue
          el.behavior.required = 'always'
          el.advancedSettings = [hideForSales]
        }
      }
    }

    const onSubmit = vi.fn()
    const { container } = render(
      <FormRenderer schema={requiredAndHidden} fields={fields} onSubmit={onSubmit} />,
    )

    // Let the hidden set settle into the validator before submitting.
    await waitFor(() => expect(screen.queryByText('Discount Reason')).toBeNull())

    fireEvent.change(screen.getByRole('textbox', { name: /customer/i }), {
      target: { value: 'Acme' },
    })
    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
  })
})

describe('show_exception', () => {
  it('restores a field hidden from everyone for its own audience', async () => {
    const hideAll: AdvancedSetting = {
      ...hideForSales, id: 's2', appliesTo: 'everyone', roleIds: undefined,
    }
    const except: AdvancedSetting = {
      id: 's3',
      name: 'Managers keep it',
      appliesTo: 'specific_role',
      roleIds: ['role-manager'],
      when: { id: 'g2', combinator: 'and', conditions: [], groups: [] },
      actions: [{ id: 'a2', type: 'show_exception' }],
    }
    const schema = schemaWithRules('discount_reason', [hideAll, except])

    // Sales: hidden by the broad rule, no exception applies.
    render(<FormRenderer schema={schema} fields={fields} onSubmit={() => {}} />)
    await waitFor(() => expect(screen.queryByText('Discount Reason')).toBeNull())
    cleanup()

    // Manager: the exception puts it back.
    signInAs('role-manager')
    render(<FormRenderer schema={schema} fields={fields} onSubmit={() => {}} />)
    expect(screen.getByText('Discount Reason')).toBeTruthy()
  })
})

describe('conditional rules over live values', () => {
  it('hides the field only once the condition starts matching', async () => {
    const hideWhenLarge: AdvancedSetting = {
      id: 's4',
      name: 'Hide reason on large amounts',
      appliesTo: 'everyone',
      when: {
        id: 'g3',
        combinator: 'and',
        conditions: [{ id: 'c1', field: 'amount', op: 'gt', value: 1000 }],
        groups: [],
      },
      actions: [{ id: 'a3', type: 'hidden_in_ui' }],
    }

    render(
      <FormRenderer
        schema={schemaWithRules('discount_reason', [hideWhenLarge])}
        fields={fields}
        onSubmit={() => {}}
      />,
    )

    // Condition false at rest — the field is present.
    expect(screen.getByText('Discount Reason')).toBeTruthy()

    // Typing past the threshold hides it, with no server round-trip: the
    // amount input holds the STRING "5000" and the rule compares to the
    // number 1000, which filter-eval coerces.
    fireEvent.change(screen.getByRole('spinbutton', { name: /amount/i }), {
      target: { value: '5000' },
    })

    await waitFor(() => expect(screen.queryByText('Discount Reason')).toBeNull())
  })
})
