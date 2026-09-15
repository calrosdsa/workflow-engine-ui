// @vitest-environment jsdom
//
// Covers requireDependentOf — the Line Items refactor's actual frontend
// enforcement of "only forms already nested as a dependent of the parent
// are pickable as a Line Items source." Kept deliberately separate from
// requireReferenceTo (which the unrelated Related Form detail-tab picker
// also uses, with its own looser "any matching reference field" semantics
// this test must NOT affect).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { FormReferenceSelect } from './FormReferenceSelect'

Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}
Element.prototype.scrollIntoView = () => {}
// cmdk (the Command list inside FormReferenceSelect's popover) observes
// element size — jsdom has no ResizeObserver at all.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub

afterEach(cleanup)

const forms = [
  { id: 'dependent-1', name: 'Order Item', slug: 'order_item', parent_form_id: 'parent-1', fields: [{ name: 'order', type: 'reference', reference_table: 'parent-1' }] },
  { id: 'not-dependent', name: 'Unrelated With Ref Field', slug: 'unrelated', parent_form_id: undefined, fields: [{ name: 'order', type: 'reference', reference_table: 'parent-1' }] },
  { id: 'dependent-of-other', name: 'Other Parent Dependent', slug: 'other_dep', parent_form_id: 'parent-2', fields: [] },
]

vi.mock('@/features/forms/hooks', () => ({
  useForms: () => ({ data: forms, isLoading: false }),
}))

function openPicker() {
  // A plain shadcn Popover + Button (role="combobox" is cosmetic ARIA here,
  // not a Radix Select trigger) — an ordinary click opens it, unlike the
  // pointerdown workaround Radix Select triggers elsewhere in this repo need.
  fireEvent.click(screen.getByRole('combobox'))
}

describe('FormReferenceSelect — requireDependentOf', () => {
  it('lists only forms whose parent_form_id matches, excluding one with a merely-matching reference field', () => {
    render(<I18nProvider><FormReferenceSelect value={undefined} onChange={() => {}} requireDependentOf="parent-1" /></I18nProvider>)
    openPicker()

    expect(screen.getByRole('option', { name: /Order Item/i })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /Unrelated With Ref Field/i })).toBeNull()
    expect(screen.queryByRole('option', { name: /Other Parent Dependent/i })).toBeNull()
  })

  it('shows a "no dependents yet" empty state pointing at Add Dependent Form', () => {
    render(<I18nProvider><FormReferenceSelect value={undefined} onChange={() => {}} requireDependentOf="parent-with-no-dependents" /></I18nProvider>)
    openPicker()

    expect(screen.getByText(/nested as dependents of this form yet/i)).toBeTruthy()
    expect(screen.getByText(/Add Dependent Form/i)).toBeTruthy()
  })

  it('requireReferenceTo alone (no requireDependentOf) keeps its original looser behavior', () => {
    render(<I18nProvider><FormReferenceSelect value={undefined} onChange={() => {}} requireReferenceTo="parent-1" /></I18nProvider>)
    openPicker()

    // Both forms with a matching reference field are listed, dependent or not.
    expect(screen.getByRole('option', { name: /Order Item/i })).toBeTruthy()
    expect(screen.getByRole('option', { name: /Unrelated With Ref Field/i })).toBeTruthy()
  })

  it('combining both props requires each candidate to satisfy both', () => {
    render(<I18nProvider><FormReferenceSelect value={undefined} onChange={() => {}} requireReferenceTo="parent-1" requireDependentOf="parent-1" /></I18nProvider>)
    openPicker()

    expect(screen.getByRole('option', { name: /Order Item/i })).toBeTruthy()
    // Has the reference field but is NOT a dependent.
    expect(screen.queryByRole('option', { name: /Unrelated With Ref Field/i })).toBeNull()
  })
})
