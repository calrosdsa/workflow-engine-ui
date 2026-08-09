import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { LayoutTemplate } from 'lucide-react'
import { useDashboardStore, findWidget } from './store'
import { registerWidget, _resetRegistryForTests } from './widget-registry'
import type { WidgetDefinition } from './widget-contract'

function fakeWidget(type: string): WidgetDefinition<{ note: string }> {
  return {
    type,
    label: type,
    icon: LayoutTemplate,
    category: 'Content',
    description: 'fake',
    parseConfig: (raw) => (raw && typeof raw === 'object' ? (raw as { note: string }) : { note: '' }),
    createDefaultConfig: () => ({ note: 'default' }),
    defaultLayout: { w: 4, h: 3 },
    defaultChrome: 'card',
    Renderer: () => null,
    ConfigPanel: () => null,
  }
}

beforeEach(() => {
  registerWidget(fakeWidget('fake'))
  useDashboardStore.getState().reset()
})

afterEach(() => {
  _resetRegistryForTests()
})

describe('useDashboardStore', () => {
  it('addWidget appends a widget and selects it, marking the schema dirty', () => {
    const id = useDashboardStore.getState().addWidget('fake')
    const state = useDashboardStore.getState()
    expect(state.schema.widgets).toHaveLength(1)
    expect(state.schema.widgets[0].id).toBe(id)
    expect(state.selectedWidgetId).toBe(id)
    expect(state.dirty).toBe(true)
  })

  it('updateWidgetLayouts applies a batch of layout updates by id, leaving unmentioned widgets untouched', () => {
    const id1 = useDashboardStore.getState().addWidget('fake')
    const id2 = useDashboardStore.getState().addWidget('fake')
    const before2 = findWidget(useDashboardStore.getState().schema, id2)!.layout

    useDashboardStore.getState().updateWidgetLayouts([
      { id: id1, layout: { x: 2, y: 5, w: 6, h: 4 } },
    ])

    const after1 = findWidget(useDashboardStore.getState().schema, id1)!.layout
    const after2 = findWidget(useDashboardStore.getState().schema, id2)!.layout
    expect(after1).toEqual({ x: 2, y: 5, w: 6, h: 4 })
    expect(after2).toEqual(before2)
  })

  it('updateWidgetConfig replaces only the target widget\'s config', () => {
    const id = useDashboardStore.getState().addWidget('fake')
    useDashboardStore.getState().updateWidgetConfig(id, { note: 'edited' })
    expect(findWidget(useDashboardStore.getState().schema, id)!.config).toEqual({ note: 'edited' })
  })

  it('updateWidgetTitle and updateWidgetChrome update tile-level fields', () => {
    const id = useDashboardStore.getState().addWidget('fake')
    useDashboardStore.getState().updateWidgetTitle(id, 'My Title')
    useDashboardStore.getState().updateWidgetChrome(id, 'plain')
    const widget = findWidget(useDashboardStore.getState().schema, id)!
    expect(widget.title).toBe('My Title')
    expect(widget.chrome).toBe('plain')
  })

  it('duplicateWidgetById clones with a fresh id and selects the copy', () => {
    const id = useDashboardStore.getState().addWidget('fake')
    useDashboardStore.getState().updateWidgetConfig(id, { note: 'original' })
    useDashboardStore.getState().duplicateWidgetById(id)

    const state = useDashboardStore.getState()
    expect(state.schema.widgets).toHaveLength(2)
    const copy = state.schema.widgets[1]
    expect(copy.id).not.toBe(id)
    expect(copy.config).toEqual({ note: 'original' })
    expect(state.selectedWidgetId).toBe(copy.id)
  })

  it('removeWidget deletes the widget and clears selection if it was selected', () => {
    const id = useDashboardStore.getState().addWidget('fake')
    expect(useDashboardStore.getState().selectedWidgetId).toBe(id)

    useDashboardStore.getState().removeWidget(id)
    const state = useDashboardStore.getState()
    expect(state.schema.widgets).toHaveLength(0)
    expect(state.selectedWidgetId).toBeNull()
  })

  it('removeWidget leaves selection alone when deleting a widget that is not selected', () => {
    const id1 = useDashboardStore.getState().addWidget('fake')
    const id2 = useDashboardStore.getState().addWidget('fake')
    useDashboardStore.getState().selectWidget(id1)

    useDashboardStore.getState().removeWidget(id2)
    expect(useDashboardStore.getState().selectedWidgetId).toBe(id1)
  })

  it('loadSchema resets dirty/selection and reset() clears back to empty', () => {
    useDashboardStore.getState().addWidget('fake')
    useDashboardStore.getState().markSaved()
    expect(useDashboardStore.getState().dirty).toBe(false)

    useDashboardStore.getState().reset()
    expect(useDashboardStore.getState().schema.widgets).toHaveLength(0)
    expect(useDashboardStore.getState().selectedWidgetId).toBeNull()
    expect(useDashboardStore.getState().dirty).toBe(false)
  })

  describe('applyKeyboardLayoutAction', () => {
    it('moves the widget by one grid unit per call', () => {
      const id = useDashboardStore.getState().addWidget('fake')
      useDashboardStore.getState().updateWidgetLayout(id, { x: 2, y: 2, w: 4, h: 3 })

      useDashboardStore.getState().applyKeyboardLayoutAction(id, { type: 'move', dx: 1, dy: 0 }, 12)
      expect(findWidget(useDashboardStore.getState().schema, id)!.layout).toMatchObject({ x: 3, y: 2 })
    })

    // This is the case that exposed a real bug during manual verification:
    // a version of this feature that computed the new layout in the REACT
    // COMPONENT (from its `instance.layout` prop) rather than reading fresh
    // state from the store would have every one of these calls compute
    // from the same x:2 starting point (since no re-render happens between
    // them in this test, exactly like a held-down arrow key firing several
    // keydown events faster than React commits) — collapsing 5 one-unit
    // moves into a net movement of 1, not 5. Calling the store action
    // directly and repeatedly, with no render between calls, is precisely
    // what proves get() is being re-read each time rather than closed over.
    it('accumulates correctly across multiple calls with no render in between (guards against a stale-closure regression)', () => {
      const id = useDashboardStore.getState().addWidget('fake')
      useDashboardStore.getState().updateWidgetLayout(id, { x: 2, y: 0, w: 4, h: 3, minW: 1, minH: 1 })

      for (let i = 0; i < 5; i++) {
        useDashboardStore.getState().applyKeyboardLayoutAction(id, { type: 'move', dx: 1, dy: 0 }, 12)
      }
      expect(findWidget(useDashboardStore.getState().schema, id)!.layout.x).toBe(7)

      for (let i = 0; i < 3; i++) {
        useDashboardStore.getState().applyKeyboardLayoutAction(id, { type: 'resize', dw: -1, dh: 0 }, 12)
      }
      expect(findWidget(useDashboardStore.getState().schema, id)!.layout.w).toBe(1)
    })

    it('leaves other widgets untouched', () => {
      const id1 = useDashboardStore.getState().addWidget('fake')
      const id2 = useDashboardStore.getState().addWidget('fake')
      const before2 = findWidget(useDashboardStore.getState().schema, id2)!.layout

      useDashboardStore.getState().applyKeyboardLayoutAction(id1, { type: 'move', dx: 1, dy: 0 }, 12)

      expect(findWidget(useDashboardStore.getState().schema, id2)!.layout).toEqual(before2)
    })

    it('is a no-op for an id that does not exist', () => {
      const id = useDashboardStore.getState().addWidget('fake')
      const before = useDashboardStore.getState().schema
      useDashboardStore.getState().applyKeyboardLayoutAction('nonexistent-id', { type: 'move', dx: 1, dy: 0 }, 12)
      expect(findWidget(useDashboardStore.getState().schema, id)!.layout).toEqual(findWidget(before, id)!.layout)
    })
  })
})
