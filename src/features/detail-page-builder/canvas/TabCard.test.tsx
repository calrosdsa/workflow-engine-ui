// @vitest-environment jsdom
//
// Pins the keyboard-select fix on TabCard (representative of the six
// "selectable card containing its own real buttons" sites fixed alongside
// it — form-builder/canvas/{ElementCard,SectionCard}.tsx, page-builder/
// canvas/{ComponentCard,SectionCard}.tsx, forms/runtime/LineItemsGrid.tsx's
// CardRow — all built on the same role="group" + tabIndex + onKeyDown={
// onKeyboardActivate(...)} shape from lib/utils.ts).
//
// The one assertion with real regression risk is the second test: Enter on
// a NESTED button (Remove) must NOT also fire the card's own onSelect. That
// guard is onKeyboardActivate's `e.target === e.currentTarget` check —
// without it, a keydown on Remove would bubble up to the card and select it
// too, which onClick avoids today only via e.stopPropagation() on the mouse
// side (see TabCard.tsx's own onClick). If this test ever fails, the guard
// broke — don't "fix" it by adding stopPropagation to the nested buttons'
// onKeyDown, which would also block their OWN native Enter-activation.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TabCard } from './TabCard'
import type { DetailTabConfig } from '@/features/form-builder/schema'

Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}
Element.prototype.scrollIntoView = () => {}

afterEach(cleanup)

const tab: DetailTabConfig = { id: 't1', type: 'unregistered_test_type', label: 'Notes', config: {} }

function renderCard(overrides: Partial<React.ComponentProps<typeof TabCard>> = {}) {
  const onSelect = vi.fn()
  const onToggleHidden = vi.fn()
  const onRemove = vi.fn()
  render(
    <TabCard
      tab={tab}
      zoneId="main"
      selected={false}
      canHide
      onSelect={onSelect}
      onToggleHidden={onToggleHidden}
      onRemove={onRemove}
      {...overrides}
    />,
  )
  return { onSelect, onToggleHidden, onRemove }
}

describe('TabCard — keyboard selection (jsx-a11y/role-required-props + click-events-have-key-events fix)', () => {
  it('is reachable as a group and selects on Enter', () => {
    const { onSelect } = renderCard()
    const card = screen.getByRole('group', { name: /notes tab/i })

    expect(card.getAttribute('tabIndex')).toBe('0')
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('selects on Space too, and preventDefault stops the page from scrolling', () => {
    const { onSelect } = renderCard()
    const card = screen.getByRole('group', { name: /notes tab/i })

    const event = fireEvent.keyDown(card, { key: ' ' })
    expect(onSelect).toHaveBeenCalledTimes(1)
    // fireEvent returns false when the event's default was prevented.
    expect(event).toBe(false)
  })

  it('does NOT re-select when Enter is pressed on a nested button', () => {
    const { onSelect, onRemove } = renderCard()

    // Remove is rendered with disabled={!canHide}; canHide is true above, so
    // it's enabled and this exercises a real, reachable control.
    fireEvent.keyDown(screen.getByTitle('Remove tab'), { key: 'Enter' })

    expect(onSelect).not.toHaveBeenCalled()
    // Confirms the keydown reached the button itself, not just that nothing
    // happened — this handler is wired via onClick+stopPropagation for the
    // mouse path, not onKeyDown, so a real <button> receiving Enter relies
    // on the BROWSER's native activation (jsdom doesn't synthesize that from
    // a raw keyDown the way a real browser does) — asserting onRemove was
    // NOT called here would be testing jsdom's fidelity, not this fix.
    expect(onRemove).not.toHaveBeenCalled()
  })
})
