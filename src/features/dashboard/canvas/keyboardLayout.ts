import type { WidgetLayout } from '../schema'

// Keyboard move/resize for the selected tile — react-grid-layout (this
// feature's pointer-drag/resize engine, see GridCanvas.tsx) has no
// keyboard-interaction support of its own, so this is a from-scratch
// mapping of key events to layout mutations, going straight through the
// same store.updateWidgetLayout single-widget mutation point the mouse
// path (GridCanvas's onLayoutChange, batched) ultimately updates too — see
// docs/dashboard-system-plan.md section 9's a11y hardening item.
//
// Bindings, chosen to avoid colliding with normal page/text-field
// navigation:
//   Arrow keys           move the tile by 1 grid unit
//   Shift + Arrow keys    resize the tile by 1 grid unit (right/down grow,
//                         left/up shrink — matches how dragging a
//                         bottom/right resize handle behaves visually)
//
// Every result is clamped to the grid's bounds (0..cols) and to the
// widget's own minW/minH — the same constraints react-grid-layout enforces
// for a mouse drag, so a keyboard move/resize can never produce a layout
// state a mouse interaction couldn't also produce.
export type LayoutKeyAction =
  | { type: 'move'; dx: number; dy: number }
  | { type: 'resize'; dw: number; dh: number }

const KEY_ACTIONS: Record<string, { move: LayoutKeyAction; resize: LayoutKeyAction }> = {
  ArrowLeft:  { move: { type: 'move', dx: -1, dy: 0 }, resize: { type: 'resize', dw: -1, dh: 0 } },
  ArrowRight: { move: { type: 'move', dx: 1, dy: 0 },  resize: { type: 'resize', dw: 1, dh: 0 } },
  ArrowUp:    { move: { type: 'move', dx: 0, dy: -1 }, resize: { type: 'resize', dw: 0, dh: -1 } },
  ArrowDown:  { move: { type: 'move', dx: 0, dy: 1 },  resize: { type: 'resize', dw: 0, dh: 1 } },
}

/** Resolves a keyboard event to a layout action, or undefined if the key
 *  isn't one of the four arrow keys this feature binds. Doesn't itself
 *  read event.shiftKey — callers pass it explicitly so this stays a pure
 *  function of (key, shiftKey), easy to unit test without a real KeyboardEvent. */
export function resolveLayoutKeyAction(key: string, shiftKey: boolean): LayoutKeyAction | undefined {
  const entry = KEY_ACTIONS[key]
  if (!entry) return undefined
  return shiftKey ? entry.resize : entry.move
}

/** Applies a resolved action to a layout, clamping to the grid's column
 *  count and the widget's own minW/minH — never below 1 for either
 *  dimension regardless of minW/minH, since a 0-width or 0-height tile
 *  isn't a valid layout state for react-grid-layout to render either. */
export function applyLayoutKeyAction(layout: WidgetLayout, action: LayoutKeyAction, cols: number): WidgetLayout {
  const minW = Math.max(1, layout.minW ?? 1)
  const minH = Math.max(1, layout.minH ?? 1)

  if (action.type === 'move') {
    const maxX = Math.max(0, cols - layout.w)
    return {
      ...layout,
      x: clamp(layout.x + action.dx, 0, maxX),
      y: Math.max(0, layout.y + action.dy),
    }
  }

  const maxW = Math.max(minW, cols - layout.x)
  const w = clamp(layout.w + action.dw, minW, maxW)
  const h = Math.max(minH, layout.h + action.dh)
  return { ...layout, w, h }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max)
}
