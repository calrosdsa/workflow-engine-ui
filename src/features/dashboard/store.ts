import { create } from 'zustand'
import type { DashboardSchema, WidgetInstance, WidgetLayout, WidgetChrome } from './schema'
import { emptyDashboardSchema } from './schema'
import { createWidget, duplicateWidget } from './factory'
import { applyLayoutKeyAction, type LayoutKeyAction } from './canvas/keyboardLayout'

// Flat-list analog of features/builder-kit/tree-store.ts for a schema with
// no section/column tree — a dashboard is just WidgetInstance[] positioned
// on a grid, so there's no shared generic to reuse (tree-store.ts's whole
// point is the section->column->item traversal, which doesn't exist here).
//
// Every mutation goes through `mutate()`, the same single-chokepoint
// pattern tree-store.ts documents on its `onMutate` hook — kept here as a
// plain internal helper (no onMutate side-channel needed yet, since nothing
// outside this store currently needs to observe a mutation), but it's the
// one seam a future undo/redo history would wrap.

export interface DashboardStoreState {
  schema: DashboardSchema
  selectedWidgetId: string | null
  dirty: boolean

  loadSchema: (schema: DashboardSchema) => void
  reset: () => void
  markSaved: () => void

  selectWidget: (id: string | null) => void

  addWidget: (type: string) => string
  updateWidgetLayout: (id: string, layout: WidgetLayout) => void
  updateWidgetLayouts: (layouts: Array<{ id: string; layout: WidgetLayout }>) => void
  applyKeyboardLayoutAction: (id: string, action: LayoutKeyAction, cols: number) => void
  updateWidgetConfig: (id: string, config: unknown) => void
  updateWidgetTitle: (id: string, title: string) => void
  updateWidgetChrome: (id: string, chrome: WidgetChrome) => void
  duplicateWidgetById: (id: string) => void
  removeWidget: (id: string) => void
}

export const useDashboardStore = create<DashboardStoreState>((set, get) => {
  function mutate(fn: (schema: DashboardSchema) => DashboardSchema) {
    set((state) => ({ schema: fn(state.schema), dirty: true }))
  }

  return {
    schema: emptyDashboardSchema(),
    selectedWidgetId: null,
    dirty: false,

    loadSchema: (schema) => set({ schema, selectedWidgetId: null, dirty: false }),
    reset: () => set({ schema: emptyDashboardSchema(), selectedWidgetId: null, dirty: false }),
    markSaved: () => set({ dirty: false }),

    selectWidget: (id) => set({ selectedWidgetId: id }),

    addWidget: (type) => {
      const instance = createWidget(type, get().schema.widgets)
      mutate((schema) => ({ ...schema, widgets: [...schema.widgets, instance] }))
      set({ selectedWidgetId: instance.id })
      return instance.id
    },

    updateWidgetLayout: (id, layout) => {
      mutate((schema) => ({
        ...schema,
        widgets: schema.widgets.map((w) => (w.id === id ? { ...w, layout } : w)),
      }))
    },

    // Reads the widget's CURRENT layout from the store (via the `schema`
    // captured inside mutate's updater, which zustand's `set` always calls
    // against the latest state) rather than taking a pre-computed layout
    // from the caller — unlike updateWidgetLayout above, this matters here
    // because keyboard events can fire faster than React re-renders (e.g.
    // holding an arrow key down produces several keydown events before the
    // component tree commits once). A caller that instead read
    // WidgetTile's own `instance.layout` prop and computed the new layout
    // itself would have every rapid-fire keypress compute from the same
    // stale base layout, silently collapsing N keypresses into what looks
    // like just one — see docs/dashboard-system-plan.md section 9's a11y
    // hardening item and keyboardLayout.ts's own doc comment.
    applyKeyboardLayoutAction: (id, action, cols) => {
      mutate((schema) => ({
        ...schema,
        widgets: schema.widgets.map((w) =>
          w.id === id ? { ...w, layout: applyLayoutKeyAction(w.layout, action, cols) } : w,
        ),
      }))
    },

    // Batched form for GridCanvas's onLayoutChange, which reports every
    // tile's position at once (drag/resize compaction can shift siblings) —
    // applying them in a single set() avoids intermediate renders where only
    // some tiles have moved.
    updateWidgetLayouts: (layouts) => {
      const byId = new Map(layouts.map((l) => [l.id, l.layout]))
      mutate((schema) => ({
        ...schema,
        widgets: schema.widgets.map((w) => {
          const layout = byId.get(w.id)
          return layout ? { ...w, layout } : w
        }),
      }))
    },

    updateWidgetConfig: (id, config) => {
      mutate((schema) => ({
        ...schema,
        widgets: schema.widgets.map((w) => (w.id === id ? { ...w, config } : w)),
      }))
    },

    updateWidgetTitle: (id, title) => {
      mutate((schema) => ({
        ...schema,
        widgets: schema.widgets.map((w) => (w.id === id ? { ...w, title } : w)),
      }))
    },

    updateWidgetChrome: (id, chrome) => {
      mutate((schema) => ({
        ...schema,
        widgets: schema.widgets.map((w) => (w.id === id ? { ...w, chrome } : w)),
      }))
    },

    duplicateWidgetById: (id) => {
      const original = get().schema.widgets.find((w) => w.id === id)
      if (!original) return
      const copy = duplicateWidget(original)
      mutate((schema) => ({ ...schema, widgets: [...schema.widgets, copy] }))
      set({ selectedWidgetId: copy.id })
    },

    removeWidget: (id) => {
      mutate((schema) => ({ ...schema, widgets: schema.widgets.filter((w) => w.id !== id) }))
      set((state) => (state.selectedWidgetId === id ? { selectedWidgetId: null } : {}))
    },
  }
})

export function findWidget(schema: DashboardSchema, id: string): WidgetInstance | undefined {
  return schema.widgets.find((w) => w.id === id)
}
