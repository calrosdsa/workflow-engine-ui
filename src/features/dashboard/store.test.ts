import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { LayoutTemplate } from 'lucide-react'
import { useDashboardStore, findWidget } from './store'
import { registerWidget, resetRegistry } from './widget-registry'
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
  resetRegistry()
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

  // FR-C3-009: undo/redo. Test names below map to the FR's own §7 TC-01
  // through TC-04 where a direct correspondence exists.
  describe('undo/redo', () => {
    it('canUndo/canRedo are both false on a freshly reset store', () => {
      expect(useDashboardStore.getState().canUndo).toBe(false)
      expect(useDashboardStore.getState().canRedo).toBe(false)
    })

    it('TC-01: undo reverts a single mutation, redo re-applies it', () => {
      const id = useDashboardStore.getState().addWidget('fake')
      expect(useDashboardStore.getState().schema.widgets).toHaveLength(1)
      expect(useDashboardStore.getState().canUndo).toBe(true)

      useDashboardStore.getState().undo()
      expect(useDashboardStore.getState().schema.widgets).toHaveLength(0)
      expect(useDashboardStore.getState().canUndo).toBe(false)
      expect(useDashboardStore.getState().canRedo).toBe(true)

      useDashboardStore.getState().redo()
      expect(useDashboardStore.getState().schema.widgets).toHaveLength(1)
      expect(useDashboardStore.getState().schema.widgets[0].id).toBe(id)
      expect(useDashboardStore.getState().canRedo).toBe(false)
    })

    it('undo restores prior field values exactly (title/chrome), not just widget count', () => {
      const id = useDashboardStore.getState().addWidget('fake')
      useDashboardStore.getState().updateWidgetTitle(id, 'Original')
      // A distinct coalesce key (title vs chrome) means this opens its own
      // new entry rather than folding into the title edit above.
      useDashboardStore.getState().updateWidgetChrome(id, 'plain')

      useDashboardStore.getState().undo()
      expect(findWidget(useDashboardStore.getState().schema, id)!.chrome).toBe('card')
      expect(findWidget(useDashboardStore.getState().schema, id)!.title).toBe('Original')

      useDashboardStore.getState().undo()
      expect(findWidget(useDashboardStore.getState().schema, id)!.title).toBeUndefined()
    })

    it('coalesces rapid same-key mutations (e.g. keystrokes) into a single undo step', () => {
      const id = useDashboardStore.getState().addWidget('fake')
      useDashboardStore.getState().updateWidgetTitle(id, 'H')
      useDashboardStore.getState().updateWidgetTitle(id, 'He')
      useDashboardStore.getState().updateWidgetTitle(id, 'Hel')
      useDashboardStore.getState().updateWidgetTitle(id, 'Hell')
      useDashboardStore.getState().updateWidgetTitle(id, 'Hello')
      expect(findWidget(useDashboardStore.getState().schema, id)!.title).toBe('Hello')

      // One undo should revert the WHOLE burst (title unset), not step back
      // one keystroke at a time — confirms coalescing, not just correctness
      // of the final state.
      useDashboardStore.getState().undo()
      expect(findWidget(useDashboardStore.getState().schema, id)!.title).toBeUndefined()
    })

    it('does not coalesce mutations targeting different widgets, even with the same mutation kind', () => {
      const id1 = useDashboardStore.getState().addWidget('fake')
      const id2 = useDashboardStore.getState().addWidget('fake')
      useDashboardStore.getState().updateWidgetTitle(id1, 'First')
      useDashboardStore.getState().updateWidgetTitle(id2, 'Second')

      useDashboardStore.getState().undo()
      expect(findWidget(useDashboardStore.getState().schema, id2)!.title).toBeUndefined()
      expect(findWidget(useDashboardStore.getState().schema, id1)!.title).toBe('First')

      useDashboardStore.getState().undo()
      expect(findWidget(useDashboardStore.getState().schema, id1)!.title).toBeUndefined()
    })

    it('TC-02 (drag coalescing, store-level equivalent): one updateWidgetLayouts call is one undo step regardless of how many widgets it touches', () => {
      const id1 = useDashboardStore.getState().addWidget('fake')
      const id2 = useDashboardStore.getState().addWidget('fake')
      const before1 = findWidget(useDashboardStore.getState().schema, id1)!.layout
      const before2 = findWidget(useDashboardStore.getState().schema, id2)!.layout

      useDashboardStore.getState().updateWidgetLayouts([
        { id: id1, layout: { x: 5, y: 5, w: 4, h: 3 } },
        { id: id2, layout: { x: 0, y: 8, w: 4, h: 3 } },
      ])

      useDashboardStore.getState().undo()
      expect(findWidget(useDashboardStore.getState().schema, id1)!.layout).toEqual(before1)
      expect(findWidget(useDashboardStore.getState().schema, id2)!.layout).toEqual(before2)
    })

    it('TC-03: a new mutation after undo clears the redo stack (branching history)', () => {
      useDashboardStore.getState().addWidget('fake')
      useDashboardStore.getState().addWidget('fake')
      useDashboardStore.getState().undo()
      useDashboardStore.getState().undo()
      expect(useDashboardStore.getState().canRedo).toBe(true)

      useDashboardStore.getState().addWidget('fake')
      expect(useDashboardStore.getState().canRedo).toBe(false)

      useDashboardStore.getState().redo()
      expect(useDashboardStore.getState().schema.widgets).toHaveLength(1)
    })

    it('TC-04: undo is unavailable past the state as loaded (session boundary)', () => {
      useDashboardStore.getState().addWidget('fake')
      expect(useDashboardStore.getState().canUndo).toBe(true)

      useDashboardStore.getState().undo()
      expect(useDashboardStore.getState().canUndo).toBe(false)

      const before = useDashboardStore.getState().schema
      useDashboardStore.getState().undo()
      expect(useDashboardStore.getState().schema).toBe(before)
    })

    it('redo is a no-op when the redo stack is empty', () => {
      useDashboardStore.getState().addWidget('fake')
      const before = useDashboardStore.getState().schema
      useDashboardStore.getState().redo()
      expect(useDashboardStore.getState().schema).toBe(before)
    })

    it('loadSchema clears undo/redo history (session-scoped only, per FR-C3-009 §8)', () => {
      useDashboardStore.getState().addWidget('fake')
      expect(useDashboardStore.getState().canUndo).toBe(true)

      useDashboardStore.getState().loadSchema(useDashboardStore.getState().schema)
      expect(useDashboardStore.getState().canUndo).toBe(false)
      expect(useDashboardStore.getState().canRedo).toBe(false)
    })

    it('reset clears undo/redo history', () => {
      useDashboardStore.getState().addWidget('fake')
      useDashboardStore.getState().reset()
      expect(useDashboardStore.getState().canUndo).toBe(false)
      expect(useDashboardStore.getState().canRedo).toBe(false)
    })

    it('mutations with no coalesce key (add/duplicate/remove) always open a new entry', () => {
      const id = useDashboardStore.getState().addWidget('fake')
      useDashboardStore.getState().duplicateWidgetById(id)
      expect(useDashboardStore.getState().schema.widgets).toHaveLength(2)

      useDashboardStore.getState().undo()
      expect(useDashboardStore.getState().schema.widgets).toHaveLength(1)

      useDashboardStore.getState().undo()
      expect(useDashboardStore.getState().schema.widgets).toHaveLength(0)
    })

    it('history is bounded (does not grow unbounded across a very long session)', () => {
      // Distinct coalesce keys (or none) per call so each genuinely opens
      // its own entry — otherwise this would test coalescing, not bounding.
      for (let i = 0; i < 60; i++) {
        useDashboardStore.getState().addWidget('fake')
      }
      let undoCount = 0
      while (useDashboardStore.getState().canUndo) {
        useDashboardStore.getState().undo()
        undoCount++
      }
      expect(undoCount).toBeLessThanOrEqual(50)
    })
  })
})
