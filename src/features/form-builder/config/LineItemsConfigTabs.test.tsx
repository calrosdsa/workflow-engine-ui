// @vitest-environment jsdom
//
// Covers the FR-C1-004 fix: switching a Line Items field's sourceMode while
// a generated child form (childFormId) already exists must warn before
// applying the change, since syncLineItemsChildren silently orphans (or, on
// a round-trip, overwrites) that child form with zero cleanup path. No
// global cleanup wiring in this project (see content-empty-states.test.tsx's
// own note) — each render() is explicitly unmounted.
import { describe, it, expect, afterEach } from 'vitest'
import { render, fireEvent, cleanup, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LineItemsConfigTabs } from './ConfigPanel'
import { createElement } from '../factory'
import type { FormElement } from '../schema'

afterEach(() => cleanup())

// sourceMode: 'existing' renders FormReferenceSelect/AdoptedReferenceFieldSelect,
// which call useForms()/useQuery — needs a real QueryClient in the tree, even
// though these tests never let their queries resolve.
function renderWithQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('LineItemsConfigTabs — mode-switch data-orphaning warning (FR-C1-004)', () => {
  it('switches mode immediately when no childFormId exists yet (nothing to orphan)', () => {
    const element: FormElement = createElement('line_items')
    let patch: Partial<FormElement> | null = null
    render(
      <LineItemsConfigTabs element={element} formId="form_1" onChange={(p) => { patch = p }} />,
    )

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: /Existing form/i }))

    expect(patch).toEqual({ sourceMode: 'existing' })
    expect(screen.queryByText(/Switch to an existing form\?/i)).toBeNull()
  })

  it('warns before generate→adopt switch when a child form already exists, and cancel leaves it unchanged', () => {
    const element: FormElement = { ...createElement('line_items'), childFormId: 'child_123' }
    let patch: Partial<FormElement> | null = null
    render(
      <LineItemsConfigTabs element={element} formId="form_1" onChange={(p) => { patch = p }} />,
    )

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: /Existing form/i }))

    // No change applied yet — the dialog is gating it.
    expect(patch).toBeNull()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Switch to an existing form\?/i)).toBeTruthy()
    expect(within(dialog).getByText(/will NOT delete or migrate it/i)).toBeTruthy()

    fireEvent.click(within(dialog).getByRole('button', { name: /Cancel/i }))
    expect(patch).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('confirming the warning applies the switch', () => {
    const element: FormElement = { ...createElement('line_items'), childFormId: 'child_123' }
    let patch: Partial<FormElement> | null = null
    render(
      <LineItemsConfigTabs element={element} formId="form_1" onChange={(p) => { patch = p }} />,
    )

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: /Existing form/i }))

    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /Switch anyway/i }))

    expect(patch).toEqual({ sourceMode: 'existing' })
  })

  it('warns before an adopt→generate round-trip switch (the stale-overwrite case)', () => {
    const element: FormElement = {
      ...createElement('line_items'),
      sourceMode: 'existing',
      adoptedFormRef: 'form_2',
      childFormId: 'child_123', // stale, from an earlier generate-mode configuration
    }
    let patch: Partial<FormElement> | null = null
    renderWithQueryClient(
      <LineItemsConfigTabs element={element} formId="form_1" onChange={(p) => { patch = p }} />,
    )

    // Two comboboxes render in 'existing' mode (the Source select, then the
    // adopted-form picker below it) — the Source select is rendered first.
    fireEvent.click(screen.getAllByRole('combobox')[0])
    fireEvent.click(screen.getByRole('option', { name: /^Generated/i }))

    expect(patch).toBeNull()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Switch to a generated form\?/i)).toBeTruthy()
    expect(within(dialog).getByText(/OVERWRITE that old form/i)).toBeTruthy()
  })

  it('does not warn when re-selecting the current mode', () => {
    const element: FormElement = { ...createElement('line_items'), childFormId: 'child_123' }
    let patchCalled = false
    render(
      <LineItemsConfigTabs element={element} formId="form_1" onChange={() => { patchCalled = true }} />,
    )

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: /^Generated/i }))

    expect(patchCalled).toBe(false)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
