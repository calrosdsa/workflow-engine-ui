// @vitest-environment jsdom
//
// jsdom doesn't implement IntersectionObserver, so this test installs a
// controllable fake on `window` — capturing the callback each `new
// IntersectionObserver(cb)` call registers, then invoking it manually to
// simulate a real intersection event firing.
//
// useIsVisible returns a ref meant to be attached via `ref={...}` on a
// rendered element (so it's populated before the effect runs, the same as
// real usage in WidgetTile.tsx) — so this test renders a real component
// that does exactly that, rather than poking `.current` after the fact
// (which doesn't trigger the effect the way a real ref-attach does).
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useIsVisible } from './useIsVisible'

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = []
  callback: ObserverCallback
  observed: Element[] = []
  disconnected = false

  constructor(callback: ObserverCallback) {
    this.callback = callback
    FakeIntersectionObserver.instances.push(this)
  }
  observe(el: Element) { this.observed.push(el) }
  disconnect() { this.disconnected = true }
  unobserve() {}
}

let originalIO: typeof IntersectionObserver | undefined

beforeEach(() => {
  FakeIntersectionObserver.instances = []
  originalIO = (globalThis as { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver
  // @ts-expect-error -- test-only stand-in; FakeIntersectionObserver implements only what useIsVisible calls
  globalThis.IntersectionObserver = FakeIntersectionObserver
})

afterEach(() => {
  globalThis.IntersectionObserver = originalIO as typeof IntersectionObserver
})

/** A tiny host component mirroring WidgetTile's real usage:
 *  `ref={tileRef}` on a rendered div, visibility exposed via a data
 *  attribute so the test can assert on real DOM rather than closures. */
function Probe() {
  const [ref, visible] = useIsVisible<HTMLDivElement>()
  return <div ref={ref} data-visible={visible} />
}

describe('useIsVisible', () => {
  it('starts false before any intersection is reported', () => {
    const { container } = render(<Probe />)
    expect(container.firstElementChild!.getAttribute('data-visible')).toBe('false')
  })

  it('flips to true once the observed element intersects', () => {
    const { container } = render(<Probe />)
    expect(FakeIntersectionObserver.instances).toHaveLength(1)
    const observer = FakeIntersectionObserver.instances[0]
    expect(observer.observed).toContain(container.firstElementChild)

    act(() => observer.callback([{ isIntersecting: true }]))
    expect(container.firstElementChild!.getAttribute('data-visible')).toBe('true')
  })

  it('never flips back to false once visible, and disconnects (no more work to do)', () => {
    const { container } = render(<Probe />)
    const observer = FakeIntersectionObserver.instances[0]

    act(() => observer.callback([{ isIntersecting: true }]))
    expect(container.firstElementChild!.getAttribute('data-visible')).toBe('true')
    expect(observer.disconnected).toBe(true)

    // A subsequent "not intersecting" report (e.g. scrolled back out) must
    // not un-latch visibility — see useIsVisible's doc comment on why.
    act(() => observer.callback([{ isIntersecting: false }]))
    expect(container.firstElementChild!.getAttribute('data-visible')).toBe('true')
  })

  it('disconnects the observer on unmount even if never visible', () => {
    const { unmount } = render(<Probe />)
    const observer = FakeIntersectionObserver.instances[0]
    expect(observer.disconnected).toBe(false)
    unmount()
    expect(observer.disconnected).toBe(true)
  })

  it('fails open (reports visible immediately) when IntersectionObserver is unavailable', () => {
    globalThis.IntersectionObserver = undefined as unknown as typeof IntersectionObserver
    const { container } = render(<Probe />)
    expect(container.firstElementChild!.getAttribute('data-visible')).toBe('true')
  })
})
