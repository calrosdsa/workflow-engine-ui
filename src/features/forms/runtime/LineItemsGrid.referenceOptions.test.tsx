// @vitest-environment jsdom
//
// A GENERATED Line Items grid's own reference columns must filter through
// the server's reference-options endpoint against the GENERATED CHILD
// form's real id (FormElement.childFormId) -- not fall back to the legacy
// unfiltered search, and not be confused with the ADOPTED grid's target
// form id. See LineItemsGridInner's referenceSourceFormId comment.
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
import { LineItemsGrid } from './LineItemsGrid'
import { formsApi } from '@/features/forms/api'
import type { FormElement, LineItemSection } from '@/features/form-builder/schema'

vi.mock('@/features/forms/hooks', () => ({
  useForm: (id: string) => ({
    data: id === 'suppliers-form' ? { id: 'suppliers-form', fields: [{ name: 'name', type: 'string' }] } : undefined,
    isLoading: false,
  }),
  useUpdateRecord: () => ({ mutate: vi.fn() }),
}))

const supplierElement = {
  id: 'el-supplier',
  key: 'supplier',
  component: 'form',
  label: 'Supplier',
  formRef: 'suppliers-form',
  validation: {},
  behavior: { visibility: 'always', required: 'optional', readOnly: 'editable' },
  appearance: { width: 'full' },
  binding: { source: 'none' },
} as unknown as FormElement

const sections: LineItemSection[] = [
  {
    id: 'sec-1',
    title: 'Row',
    layout: '1',
    columns: [{ id: 'col-1', ratio: 1, elements: [supplierElement] }],
  },
]

function renderGrid(el: { childFormId?: string; sourceMode?: 'generated' | 'existing' }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <LineItemsGrid
        el={{ ...el, lineItemColumns: sections, lineItemConfig: { rowEditMode: 'inline' } }}
        field={{ value: [{ id: 'row-1', supplier: '' }], onChange: () => {} }}
        parentFormId="parent-form"
        disabled={false}
      />
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.restoreAllMocks())
afterEach(cleanup)

describe('LineItemsGrid reference-options filtering (generated grid)', () => {
  it('queries reference-options against the generated child form id (childFormId)', async () => {
    const spy = vi.spyOn(formsApi, 'referenceOptions').mockResolvedValue({ records: [], total: 0 })

    renderGrid({ childFormId: 'generated-child-form-1' })
    fireEvent.click(screen.getByRole('combobox'))

    await waitFor(() => expect(spy).toHaveBeenCalled())
    const [formId, fieldName] = spy.mock.calls[0]
    expect(formId).toBe('generated-child-form-1')
    expect(fieldName).toBe('supplier')
  })

  it('falls back to the legacy unfiltered search when childFormId is absent', async () => {
    const filtered = vi.spyOn(formsApi, 'referenceOptions')
    const legacy = vi.spyOn(formsApi, 'searchRecords').mockResolvedValue({ records: [] } as never)

    renderGrid({})
    fireEvent.click(screen.getByRole('combobox'))

    await waitFor(() => expect(legacy).toHaveBeenCalled())
    expect(filtered).not.toHaveBeenCalled()
  })
})
