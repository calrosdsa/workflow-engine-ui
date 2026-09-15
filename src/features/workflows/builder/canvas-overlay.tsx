import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Where canvas-scoped overlays (the node picker, the Ctrl+K command bar)
 * mount. The Workflow Builder points this at a layer spanning the whole
 * canvas COLUMN — the canvas plus the Logs dock under it — so an expanded
 * dock neither squeezes the picker into whatever height is left above it nor
 * paints over the command bar's backdrop. Without a provider (any other host
 * of FlowLayout) overlays render in place, exactly as before.
 */
export const CanvasOverlayContext = createContext<HTMLElement | null>(null)

export function CanvasOverlayPortal({ children }: { children: ReactNode }) {
  const target = useContext(CanvasOverlayContext)
  return target ? createPortal(children, target) : <>{children}</>
}
