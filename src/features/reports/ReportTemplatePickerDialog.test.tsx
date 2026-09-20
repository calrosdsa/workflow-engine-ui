// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { ReportTemplatePickerDialog } from './ReportTemplatePickerDialog'
import type { ReportExample } from './types'

const examplesMock = vi.fn()
const createMock = vi.fn()
vi.mock('./api', () => ({
  metaApi: { examples: (...args: unknown[]) => examplesMock(...args) },
  reportsApi: { create: (...args: unknown[]) => createMock(...args) },
}))

// FormReferenceSelect has its own test file (form-builder/config/
// FormReferenceSelect.test.tsx) — stubbed here so this file tests only the
// picker dialog's own step/gating/substitution logic, not that combobox's
// internal Popover+Command mechanics.
vi.mock('@/features/form-builder/config/FormReferenceSelect', () => ({
  FormReferenceSelect: ({ value, onChange }: { value?: string; onChange: (id: string | undefined) => void }) => (
    <select
      aria-label="form-reference-select-stub"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
    >
      <option value="">-- pick a form --</option>
      <option value="real-customers-form">Customers</option>
      <option value="real-lines-form">Invoice Lines</option>
    </select>
  ),
}))

afterEach(() => {
  cleanup()
  examplesMock.mockReset()
  createMock.mockReset()
})

const invoiceExample: ReportExample = {
  intent: 'An invoice: a title, the customer\'s line items, and a total due',
  note: 'Substitute your own form id and field names.',
  definition: {
    version: 2,
    name: 'Invoice',
    blocks: [{
      id: 'charges', name: 'Charges', type: 'table',
      layout: { row: 3, col: 0, row_span: 4, col_span: 2 },
      config: { form_id: 'your-invoice-lines-form-id', columns: [{ key: 'description', label: 'Description' }] },
    }],
    settings: { default_format: 'pdf' },
    visibility: { mode: 'public' },
  },
}

const blocklessExample: ReportExample = {
  intent: 'A report with nothing to map',
  note: 'No substitution needed.',
  definition: {
    version: 1,
    name: 'Static Report',
    blocks: [],
    settings: {},
    visibility: { mode: 'public' },
  },
}

function renderDialog(examples: ReportExample[] = [invoiceExample]) {
  examplesMock.mockResolvedValue(examples)
  const onClose = vi.fn()
  const onCreated = vi.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ReportTemplatePickerDialog open onClose={onClose} onCreated={onCreated} />
      </I18nProvider>
    </QueryClientProvider>,
  )
  return { onClose, onCreated }
}

describe('ReportTemplatePickerDialog — picking', () => {
  it('always shows Blank immediately, and shows a served example once it loads', async () => {
    renderDialog()
    expect(screen.getByText('Blank')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Invoice')).toBeTruthy())
    expect(screen.getByText(invoiceExample.intent)).toBeTruthy()
  })

  it('creates immediately from Blank, with an empty definition', async () => {
    createMock.mockResolvedValue({ id: 'r1', name: 'Untitled Report' })
    const { onCreated } = renderDialog()

    fireEvent.click(screen.getByText('Blank'))

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1))
    const [payload] = createMock.mock.calls[0]
    expect(payload.name).toBe('Untitled Report')
    expect(payload.definition.blocks).toEqual([])
    expect(onCreated).toHaveBeenCalledWith('r1')
  })

  it('creates immediately from an example with no form_id anywhere to map', async () => {
    createMock.mockResolvedValue({ id: 'r2', name: 'Static Report' })
    const { onCreated } = renderDialog([blocklessExample])

    await waitFor(() => expect(screen.getByText('Static Report')).toBeTruthy())
    fireEvent.click(screen.getByText('Static Report'))

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1))
    expect(createMock.mock.calls[0][0].name).toBe('Static Report')
    expect(onCreated).toHaveBeenCalledWith('r2')
  })
})

describe('ReportTemplatePickerDialog — form mapping (RF-402)', () => {
  it('routes a template with a form_id placeholder to a mapping step instead of creating immediately', async () => {
    renderDialog()
    await waitFor(() => expect(screen.getByText('Invoice')).toBeTruthy())

    fireEvent.click(screen.getByText('Invoice'))

    expect(createMock).not.toHaveBeenCalled()
    expect(screen.getByText('Form for Charges')).toBeTruthy()
  })

  it('disables Create until the placeholder is mapped, then substitutes the real form id (not the placeholder) on create', async () => {
    createMock.mockResolvedValue({ id: 'r3', name: 'Invoice' })
    const { onCreated } = renderDialog()
    await waitFor(() => expect(screen.getByText('Invoice')).toBeTruthy())
    fireEvent.click(screen.getByText('Invoice'))

    const createButton = screen.getByRole('button', { name: 'Create' })
    expect((createButton as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('form-reference-select-stub'), { target: { value: 'real-lines-form' } })
    expect((createButton as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(createButton)

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1))
    const [payload] = createMock.mock.calls[0]
    expect(payload.name).toBe('Invoice')
    expect(payload.definition.blocks[0].config.form_id).toBe('real-lines-form')
    expect(onCreated).toHaveBeenCalledWith('r3')
  })

  it('Back returns to the picker step without creating anything', async () => {
    renderDialog()
    await waitFor(() => expect(screen.getByText('Invoice')).toBeTruthy())
    fireEvent.click(screen.getByText('Invoice'))
    expect(screen.getByText('Form for Charges')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByText('Blank')).toBeTruthy()
    expect(createMock).not.toHaveBeenCalled()
  })
})

describe('ReportTemplatePickerDialog — create failure', () => {
  it('surfaces an error and stays open when create rejects', async () => {
    createMock.mockRejectedValue(new Error('boom'))
    const { onCreated } = renderDialog()

    fireEvent.click(screen.getByText('Blank'))

    await waitFor(() => expect(screen.getByText(/Couldn't create the report/i)).toBeTruthy())
    expect(onCreated).not.toHaveBeenCalled()
  })
})
