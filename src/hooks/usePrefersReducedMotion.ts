import { useEffect, useState } from 'react'

/** Tracks the OS-level `prefers-reduced-motion: reduce` setting live —
 *  needed anywhere motion is driven by JS/inline styles rather than a
 *  Tailwind class (which `motion-reduce:` already handles on its own).
 *  dnd-kit's useSortable, for one, hands back a `transition` CSS string via
 *  inline `style` that has no Tailwind-variant equivalent to suppress. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = () => setReduced(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return reduced
}
