// @vitest-environment jsdom
//
// Pins the keyboard-select fix on WidgetTile — the seventh "selectable
// card containing its own real buttons" site fixed this session (see
// detail-page-builder/canvas/TabCard.test.tsx for the other six, all built
// on the same role="group" + tabIndex + onKeyDown calling onKeyboardActivate
// shape from lib/utils.ts). The wrinkle here TabCard didn't have:
// handleKeyDown must ALSO keep running its pre-existing arrow-key
// move/resize logic once the tile is selected, so the fix composes
// onKeyboardActivate with that fall-through instead of replacing
// handleKeyDown outright — see WidgetTile.tsx's own doc comment.
//
// The assertion with real regression risk is the third test: Enter on a
// NESTED button (Duplicate) must NOT also fire the tile's own onSelect.
// That guard is onKeyboardActivate's `e.target === e.currentTarget` check
// — without it, a keydown on Duplicate would bubble up to the tile and
// select it too, which onClick avoids today only via e.stopPropagation()
// on the mouse side (see WidgetTile.tsx's own onClick). The fourth test
// guards the composition itself: adding Enter/Space handling must not
// swallow the arrow-key branch it now sits in front of.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { WidgetTile } from './WidgetTile'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import type { WidgetInstance } from '../schema'

afterEach(cleanup)

const instance: WidgetInstance = {
  id: 'w1',
  type: 'unregistered_test_type',
  layout: { x: 0, y: 0, w: 2, h: 2 },
  chrome: 'card',
  config: {},
  title: 'Revenue',
}

// WidgetTile calls useTranslation, which throws outside an I18nProvider
// ancestor — real provider, no props, same pattern as InsertDataMenu.test.tsx.
function renderTile(overrides: Partial<React.ComponentProps<typeof WidgetTile>> = {}) {
  const onSelect = vi.fn()
  const onDuplicate = vi.fn()
  const onDelete = vi.fn()
  const onKeyboardLayoutAction = vi.fn()
  render(
    <I18nProvider>
      <WidgetTile
        instance={instance}
        clientId="c1"
        appId="a1"
        selected={false}
        onSelect={onSelect}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onKeyboardLayoutAction={onKeyboardLayoutAction}
        {...overrides}
      />
    </I18nProvider>,
  )
  return { onSelect, onDuplicate, onDelete, onKeyboardLayoutAction }
}

describe('WidgetTile — keyboard selection (jsx-a11y/click-events-have-key-events fix)', () => {
  it('is reachable as a group and selects on Enter', () => {
    const { onSelect } = renderTile()
    const tile = screen.getByRole('group', { name: /revenue widget/i })

    expect(tile.getAttribute('tabIndex')).toBe('0')
    fireEvent.keyDown(tile, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('selects on Space too, and preventDefault stops the page from scrolling', () => {
    const { onSelect } = renderTile()
    const tile = screen.getByRole('group', { name: /revenue widget/i })

    const event = fireEvent.keyDown(tile, { key: ' ' })
    expect(onSelect).toHaveBeenCalledTimes(1)
    // fireEvent returns false when the event's default was prevented.
    expect(event).toBe(false)
  })

  it('does NOT re-select when Enter is pressed on a nested button', () => {
    const { onSelect, onDuplicate } = renderTile()

    // Duplicate is always in the DOM (the toolbar's opacity-0 default is
    // CSS-only), so this exercises a real, reachable control.
    fireEvent.keyDown(screen.getByTitle('Duplicate'), { key: 'Enter' })

    expect(onSelect).not.toHaveBeenCalled()
    // Confirms the keydown reached the button itself, not just that
    // nothing happened — Duplicate is wired via onClick+stopPropagation
    // for the mouse path, not onKeyDown, so a real <button> receiving
    // Enter relies on the BROWSER's native activation (jsdom doesn't
    // synthesize that from a raw keyDown the way a real browser does) —
    // asserting onDuplicate was NOT called here would be testing jsdom's
    // fidelity, not this fix.
    expect(onDuplicate).not.toHaveBeenCalled()
  })

  it('still moves the tile on arrow keys once selected — the fix must not swallow this', () => {
    const { onKeyboardLayoutAction, onSelect } = renderTile({ selected: true })
    const tile = screen.getByRole('group', { name: /revenue widget/i })

    fireEvent.keyDown(tile, { key: 'ArrowRight' })

    expect(onKeyboardLayoutAction).toHaveBeenCalledWith({ type: 'move', dx: 1, dy: 0 })
    expect(onSelect).not.toHaveBeenCalled()
  })
})
