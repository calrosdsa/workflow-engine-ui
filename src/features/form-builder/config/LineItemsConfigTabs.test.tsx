// @vitest-environment jsdom
//
// Covers two things now:
//
// 1. FR-C1-004's mode-switch data-orphaning warning: switching a Line Items
//    field's sourceMode while a generated child form (childFormId) already
//    exists must warn before applying the change, since syncLineItemsChildren
//    silently orphans (or, on a round-trip, overwrites) that child form with
//    zero cleanup path.
// 2. The dependent-forms-only refactor: a NEW element defaults to 'existing'
//    with no 'Generated' option ever offered (factory.ts), and once an
//    element has moved to 'existing' mode, 'Generated' stops being offered
//    even if it still carries a stale childFormId from before the switch —
//    "only source should be existing form" is a one-way door, not a toggle.
//    'Generated' stays selectable only for an element genuinely still IN
//    that mode (sourceMode: 'generated', or a never-migrated element with no
//    sourceMode at all defaulting to it) — i.e. existing generated grids
//    keep working exactly as before.
//
// No global cleanup wiring in this project (see content-empty-states.test.tsx's
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

describe('LineItemsConfigTabs — new elements default to adopted mode', () => {
  it('a freshly created element already has sourceMode "existing"', () => {
    const element: FormElement = createElement('line_items')
    expect(element.sourceMode).toBe('existing')
  })

  it('offers only "Existing form" — no "Generated" option — for a new element', () => {
    const element: FormElement = createElement('line_items')
    renderWithQueryClient(
      <LineItemsConfigTabs element={element} formId="form_1" onChange={() => {}} />,
    )

    // A fresh element already defaults to 'existing' mode, so the adopted-
    // form/reference-field pickers render alongside the Source select —
    // three comboboxes total; the Source select is rendered first.
    fireEvent.click(screen.getAllByRole('combobox')[0])
    expect(screen.queryByRole('option', { name: /^Generated/i })).toBeNull()
    expect(screen.getByRole('option', { name: /Existing form/i })).toBeTruthy()
  })
})

describe('LineItemsConfigTabs — mode-switch data-orphaning warning (FR-C1-004)', () => {
  it('warns before generate→adopt switch when a child form already exists, and cancel leaves it unchanged', () => {
    const element: FormElement = { ...createElement('line_items'), sourceMode: 'generated', childFormId: 'child_123' }
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
    const element: FormElement = { ...createElement('line_items'), sourceMode: 'generated', childFormId: 'child_123' }
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

  it('does not warn when re-selecting the current (generated) mode', () => {
    const element: FormElement = { ...createElement('line_items'), sourceMode: 'generated', childFormId: 'child_123' }
    let patchCalled = false
    render(
      <LineItemsConfigTabs element={element} formId="form_1" onChange={() => { patchCalled = true }} />,
    )

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: /^Generated/i }))

    expect(patchCalled).toBe(false)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a never-migrated element (no sourceMode at all) with a childFormId is still treated as generated', () => {
    // Predates the sourceMode field entirely — element.sourceMode ?? 'generated'
    // is what makes an ancient element keep behaving as generated, not a
    // stored 'generated' value.
    const element: FormElement = { ...createElement('line_items'), childFormId: 'child_123' }
    delete (element as Partial<FormElement>).sourceMode
    render(
      <LineItemsConfigTabs element={element} formId="form_1" onChange={() => {}} />,
    )

    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.getByRole('option', { name: /^Generated/i })).toBeTruthy()
  })
})

describe('LineItemsConfigTabs — switching to adopted mode is a one-way door', () => {
  it('never offers "Generated" again once an element is in existing mode, even with a stale childFormId', () => {
    // An element previously switched away from a generated child (the
    // childFormId is stale — left behind exactly as the warning above
    // describes) must not be switchable back through this UI: "only source
    // should be existing form" going forward.
    const element: FormElement = {
      ...createElement('line_items'),
      sourceMode: 'existing',
      adoptedFormRef: 'form_2',
      childFormId: 'child_123', // stale, from before the switch to 'existing'
    }
    renderWithQueryClient(
      <LineItemsConfigTabs element={element} formId="form_1" onChange={() => {}} />,
    )

    // Two comboboxes render in 'existing' mode (the Source select, then the
    // adopted-form picker below it) — the Source select is rendered first.
    fireEvent.click(screen.getAllByRole('combobox')[0])
    expect(screen.queryByRole('option', { name: /^Generated/i })).toBeNull()
  })
})
