import { useEffect, useRef, useState } from 'react'

/** Tracks whether `ref`'s element has ever intersected the viewport (of its
 *  nearest scrollable ancestor — `root: null` resolves to that
 *  automatically), and keeps reporting true forever once it has. Never
 *  flips back to false: unmounting a widget's live query/render every time
 *  its tile scrolls out of view would drop in-flight state and refetch on
 *  every scroll back in, which is worse than the mount cost this is meant
 *  to avoid. The `rootMargin` gives tiles a head start — mounted slightly
 *  before they're actually on-screen, not exactly at the viewport edge —
 *  so a normal scroll doesn't visibly pop in unrendered content.
 *
 *  Used by WidgetTile to defer mounting a widget's real Renderer (and
 *  therefore its data query) until the tile is about to be seen — see
 *  docs/dashboard-system-plan.md section 9's "lazy-mount offscreen
 *  widgets" hardening item. A dashboard with many data widgets (table/
 *  chart) only fires the ones actually visible on initial load, instead of
 *  every widget's query firing at once regardless of scroll position. */
export function useIsVisible<T extends Element>(rootMargin = '200px'): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (visible) return // already latched true — no need to keep observing
    const el = ref.current
    if (!el) return

    // No IntersectionObserver (very old browser, or a non-DOM test
    // environment) — fail open rather than permanently hiding content
    // behind a check that can never succeed.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true)
      },
      { rootMargin },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible, rootMargin])

  return [ref, visible]
}
