// @vitest-environment jsdom
//
// Pins the RUNTIME ARIA wiring of this repo's combobox pattern (shadcn
// Popover + cmdk Command, with `role="combobox"` on an `asChild` Button).
//
// Why this test exists: oxlint's `jsx-a11y/role-has-required-aria-props`
// flags all 12 of these components for "combobox role is missing required
// aria props `aria-controls`". That is a STATIC-ANALYSIS FALSE POSITIVE.
// `PopoverTrigger` passes `aria-controls={contentId}` down through `asChild`,
// so the attribute only exists in the rendered DOM, never in the JSX the
// linter reads.
//
// It matters that this is pinned rather than argued: Radix's Slot merges as
// `mergeProps(slotProps, childProps)` where CHILD props win for non-handler
// props (@radix-ui/react-slot). So "fixing" the lint by writing a literal
// `aria-controls="..."` on the Button would OVERRIDE Radix's real content id
// with an invented one that resolves to nothing — turning a false positive
// into a genuine accessibility regression. If this test ever fails, the
// pattern really did break; do not silence it by adding the literal prop.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { FormReferenceSelect } from './FormReferenceSelect'

Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}
Element.prototype.scrollIntoView = () => {}
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub

afterEach(cleanup)

vi.mock('@/features/forms/hooks', () => ({
  useForms: () => ({
    data: [{ id: 'f1', name: 'Order', slug: 'order', parent_form_id: undefined, fields: [] }],
    isLoading: false,
  }),
}))

describe('combobox pattern — runtime ARIA (oxlint false-positive guard)', () => {
  it('omits aria-controls while closed, which is Radix\'s deliberate behavior', () => {
    render(<I18nProvider><FormReferenceSelect value="" onChange={() => {}} /></I18nProvider>)
    const trigger = screen.getByRole('combobox')

    // Radix emits `aria-controls={open ? contentId : undefined}`. Pointing at
    // an unmounted element would be worse than omitting it, so absence here
    // is correct, not the gap the linter reports.
    expect(trigger.getAttribute('aria-controls')).toBeNull()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('wires aria-controls to the real popover element once open', () => {
    render(<I18nProvider><FormReferenceSelect value="" onChange={() => {}} /></I18nProvider>)
    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)

    // Proves the popover actually opened — without this, the assertions
    // below could pass vacuously against a still-closed trigger.
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    const controls = trigger.getAttribute('aria-controls')
    expect(controls).toBeTruthy()

    // The contract the lint rule is really about: the id must RESOLVE.
    const target = document.getElementById(controls as string)
    expect(target).not.toBeNull()
    expect(trigger).not.toBe(target)
  })

  it('declares aria-haspopup="dialog", which ARIA 1.2 permits for combobox', () => {
    render(<I18nProvider><FormReferenceSelect value="" onChange={() => {}} /></I18nProvider>)

    // Recorded so a future session does not "correct" this to listbox: the
    // popup genuinely is a dialog containing the listbox, and ARIA 1.2 allows
    // combobox to declare dialog here. This is valid, not tolerated-broken.
    expect(screen.getByRole('combobox').getAttribute('aria-haspopup')).toBe('dialog')
  })
})
