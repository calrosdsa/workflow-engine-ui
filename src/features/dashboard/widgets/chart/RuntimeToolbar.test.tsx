// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { RuntimeToolbar } from './RuntimeToolbar'
import { I18nProvider } from '@/features/i18n/I18nProvider'

afterEach(() => cleanup())

// Radix Select measures its trigger even while closed — same jsdom gap
// combobox-aria.test.tsx already established stubs for.
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

function renderToolbar(dataUpdatedAt: number) {
  return render(
    <I18nProvider>
      <RuntimeToolbar
        fields={[]}
        showTimeControls={false}
        bucket={undefined}
        onBucketChange={() => {}}
        range={undefined}
        onRangeChange={() => {}}
        adhocFilter={undefined}
        onAdhocFilterChange={() => {}}
        dataUpdatedAt={dataUpdatedAt}
      />
    </I18nProvider>,
  )
}

describe('RuntimeToolbar — last-synced text', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('updates from "just now" to minutes-ago as real time passes, without any prop change', () => {
    const mountedAt = Date.now()
    renderToolbar(mountedAt)
    expect(screen.getByText(/just now/i)).toBeTruthy()

    // Advance 5 minutes of wall-clock time without ever re-rendering via a
    // prop change — only the toolbar's own 30s tick should cause the text
    // to update. Before this fix, formatSyncedAgo's Date.now() read was
    // frozen at whatever it computed on mount.
    act(() => { vi.advanceTimersByTime(5 * 60_000) })

    expect(screen.getByText(/5m ago/i)).toBeTruthy()
    expect(screen.queryByText(/just now/i)).toBeNull()
  })
})
