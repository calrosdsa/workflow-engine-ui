// @vitest-environment jsdom
//
// The filtered half of the reference picker: with a source form and an RHF
// control, options must come from the server's reference-options endpoint
// (which enforces reference_filter), carrying the draft's sibling reference
// values for this_record hops â€” and a fail-closed empty answer must surface
// its reason instead of reading as "no data".
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

// jsdom has no ResizeObserver; Radix's popover positioning needs one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ReferenceFieldAutocomplete } from './ReferenceFieldAutocomplete'
import { formsApi } from '@/features/forms/api'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import type { FormElement } from '@/features/form-builder/schema'

vi.mock('@/features/forms/hooks', () => ({
  useForm: (id: string) => ({
    data:
      id === 'orders-form'
        ? {
            id: 'orders-form',
            fields: [
              { name: 'manager', type: 'reference' },
              { name: 'supplier', type: 'reference' },
              { name: 'title', type: 'string' },
            ],
          }
        : id === 'suppliers-form'
          ? { id: 'suppliers-form', fields: [{ name: 'name', type: 'string' }] }
          : undefined,
  }),
}))

const el = {
  id: 'el-supplier',
  key: 'supplier',
  component: 'form',
  label: 'Supplier',
  formRef: 'suppliers-form',
} as unknown as FormElement

function Harness({ sourceFormId }: { sourceFormId?: string }) {
  const form = useForm({ defaultValues: { manager: 'emp-42', supplier: '', title: 'PO-1' } })
  return (
    <ReferenceFieldAutocomplete
      el={el}
      field={{ value: '', onChange: () => {} }}
      disabled={false}
      sourceFormId={sourceFormId}
      control={sourceFormId ? form.control : undefined}
    />
  )
}

function renderWith(sourceFormId?: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <Harness sourceFormId={sourceFormId} />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.restoreAllMocks())
afterEach(cleanup)

describe('ReferenceFieldAutocomplete filtered mode', () => {
  it('queries reference-options with the draft sibling references and the search field', async () => {
    const spy = vi
      .spyOn(formsApi, 'referenceOptions')
      .mockResolvedValue({ records: [{ id: 'sup-1', name: 'West Metals' }], total: 1 })

    renderWith('orders-form')
    fireEvent.click(screen.getByRole('combobox'))

    await waitFor(() => expect(spy).toHaveBeenCalled())
    const [formId, fieldName, req] = spy.mock.calls[0]
    expect(formId).toBe('orders-form')
    expect(fieldName).toBe('supplier')
    // Only sibling REFERENCE values ride in the draft â€” the hop can read
    // nothing else, and non-reference values (title) must not leak.
    expect(req.draft).toEqual({ manager: 'emp-42' })
    expect(req.search_field).toBe('name')
    expect(await screen.findByText('West Metals')).toBeTruthy()
  })

  it('surfaces the fail-closed reason instead of "No records found."', async () => {
    vi.spyOn(formsApi, 'referenceOptions').mockResolvedValue({
      records: [],
      total: 0,
      unresolved_reason: 'no record on the user-account form matches you@example.test',
    })

    renderWith('orders-form')
    fireEvent.click(screen.getByRole('combobox'))

    expect(await screen.findByText(/No options available: no record on the user-account form/)).toBeTruthy()
  })

  it('falls back to the legacy target-form search without a source form', async () => {
    const legacy = vi
      .spyOn(formsApi, 'searchRecords')
      .mockResolvedValue({ records: [{ id: 'sup-2', name: 'Anywhere Co' }] } as never)
    const filtered = vi.spyOn(formsApi, 'referenceOptions')

    renderWith(undefined)
    fireEvent.click(screen.getByRole('combobox'))

    await waitFor(() => expect(legacy).toHaveBeenCalled())
    expect(filtered).not.toHaveBeenCalled()
  })
})

