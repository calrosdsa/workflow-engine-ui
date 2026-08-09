import { describe, it, expect } from 'vitest'
import { resolveLayoutKeyAction, applyLayoutKeyAction } from './keyboardLayout'
import type { WidgetLayout } from '../schema'

describe('resolveLayoutKeyAction', () => {
  it('maps each arrow key to a move action without shift', () => {
    expect(resolveLayoutKeyAction('ArrowLeft', false)).toEqual({ type: 'move', dx: -1, dy: 0 })
    expect(resolveLayoutKeyAction('ArrowRight', false)).toEqual({ type: 'move', dx: 1, dy: 0 })
    expect(resolveLayoutKeyAction('ArrowUp', false)).toEqual({ type: 'move', dx: 0, dy: -1 })
    expect(resolveLayoutKeyAction('ArrowDown', false)).toEqual({ type: 'move', dx: 0, dy: 1 })
  })

  it('maps each arrow key to a resize action with shift', () => {
    expect(resolveLayoutKeyAction('ArrowLeft', true)).toEqual({ type: 'resize', dw: -1, dh: 0 })
    expect(resolveLayoutKeyAction('ArrowRight', true)).toEqual({ type: 'resize', dw: 1, dh: 0 })
    expect(resolveLayoutKeyAction('ArrowUp', true)).toEqual({ type: 'resize', dw: 0, dh: -1 })
    expect(resolveLayoutKeyAction('ArrowDown', true)).toEqual({ type: 'resize', dw: 0, dh: 1 })
  })

  it('returns undefined for a non-arrow key', () => {
    expect(resolveLayoutKeyAction('Enter', false)).toBeUndefined()
    expect(resolveLayoutKeyAction('a', false)).toBeUndefined()
    expect(resolveLayoutKeyAction('Tab', true)).toBeUndefined()
  })
})

describe('applyLayoutKeyAction', () => {
  const base: WidgetLayout = { x: 4, y: 4, w: 4, h: 3, minW: 2, minH: 2 }

  it('moves right/left/up/down by 1 unit', () => {
    expect(applyLayoutKeyAction(base, { type: 'move', dx: 1, dy: 0 }, 12)).toMatchObject({ x: 5, y: 4 })
    expect(applyLayoutKeyAction(base, { type: 'move', dx: -1, dy: 0 }, 12)).toMatchObject({ x: 3, y: 4 })
    expect(applyLayoutKeyAction(base, { type: 'move', dx: 0, dy: 1 }, 12)).toMatchObject({ x: 4, y: 5 })
    expect(applyLayoutKeyAction(base, { type: 'move', dx: 0, dy: -1 }, 12)).toMatchObject({ x: 4, y: 3 })
  })

  it('clamps horizontal movement to the grid (never past x=0 or past cols - w)', () => {
    const atLeftEdge: WidgetLayout = { x: 0, y: 0, w: 4, h: 3 }
    expect(applyLayoutKeyAction(atLeftEdge, { type: 'move', dx: -1, dy: 0 }, 12).x).toBe(0)

    const atRightEdge: WidgetLayout = { x: 8, y: 0, w: 4, h: 3 } // 8 + 4 = 12, already flush right
    expect(applyLayoutKeyAction(atRightEdge, { type: 'move', dx: 1, dy: 0 }, 12).x).toBe(8)
  })

  it('clamps vertical movement to never go above y=0 (no upper grid bound)', () => {
    const atTop: WidgetLayout = { x: 0, y: 0, w: 4, h: 3 }
    expect(applyLayoutKeyAction(atTop, { type: 'move', dx: 0, dy: -1 }, 12).y).toBe(0)
  })

  it('grows/shrinks width and height by 1 unit on resize', () => {
    expect(applyLayoutKeyAction(base, { type: 'resize', dw: 1, dh: 0 }, 12)).toMatchObject({ w: 5, h: 3 })
    expect(applyLayoutKeyAction(base, { type: 'resize', dw: -1, dh: 0 }, 12)).toMatchObject({ w: 3, h: 3 })
    expect(applyLayoutKeyAction(base, { type: 'resize', dw: 0, dh: 1 }, 12)).toMatchObject({ w: 4, h: 4 })
    expect(applyLayoutKeyAction(base, { type: 'resize', dw: 0, dh: -1 }, 12)).toMatchObject({ w: 4, h: 2 })
  })

  it('never shrinks width/height below the widget\'s own minW/minH', () => {
    const atMin: WidgetLayout = { x: 0, y: 0, w: 2, h: 2, minW: 2, minH: 2 }
    expect(applyLayoutKeyAction(atMin, { type: 'resize', dw: -1, dh: 0 }, 12).w).toBe(2)
    expect(applyLayoutKeyAction(atMin, { type: 'resize', dw: 0, dh: -1 }, 12).h).toBe(2)
  })

  it('defaults minW/minH to 1 when unset, never allowing a 0-size tile', () => {
    const noMin: WidgetLayout = { x: 0, y: 0, w: 1, h: 1 }
    expect(applyLayoutKeyAction(noMin, { type: 'resize', dw: -1, dh: 0 }, 12).w).toBe(1)
    expect(applyLayoutKeyAction(noMin, { type: 'resize', dw: 0, dh: -1 }, 12).h).toBe(1)
  })

  it('never grows width past the grid\'s right edge (cols - x)', () => {
    const nearRightEdge: WidgetLayout = { x: 9, y: 0, w: 3, h: 3, minW: 1 } // 9 + 3 = 12, flush right
    expect(applyLayoutKeyAction(nearRightEdge, { type: 'resize', dw: 1, dh: 0 }, 12).w).toBe(3)
  })

  it('height has no upper bound from the grid (rows are unbounded)', () => {
    const tall: WidgetLayout = { x: 0, y: 0, w: 4, h: 100 }
    expect(applyLayoutKeyAction(tall, { type: 'resize', dw: 0, dh: 1 }, 12).h).toBe(101)
  })

  it('preserves fields not touched by the action (minW/minH pass through unchanged)', () => {
    const result = applyLayoutKeyAction(base, { type: 'move', dx: 1, dy: 0 }, 12)
    expect(result.minW).toBe(2)
    expect(result.minH).toBe(2)
    expect(result.w).toBe(4)
    expect(result.h).toBe(3)
  })
})
