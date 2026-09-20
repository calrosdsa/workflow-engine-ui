import { create } from 'zustand'
import type { DashboardParameter, DashboardSchema, ParameterBinding, WidgetInstance, WidgetLayout, WidgetChrome } from './schema'
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
// outside this store currently needs to observe a mutation).
//
// Undo/redo (FR-C3-009): wraps this one chokepoint, per the seam this
// comment used to describe as future work. History entries hold full
// `schema` snapshots (not diffs/mutation args), matching how `mutate()`
// already produces a full new `schema` object per call. Bounded to
// HISTORY_LIMIT entries — no specific bound was ever specified in the
// original requirement (FR-C3-009 §8), so this is a reasonable, documented
// choice, not a confirmed spec value. Session-scoped only: `loadSchema`/
// `reset` both clear the history, matching how the rest of the dashboard
// builder's in-progress-edit state already doesn't survive a reload.
//
// Coalescing: `mutate()` takes an optional `coalesceKey`. Consecutive calls
// sharing the same key within COALESCE_WINDOW_MS fold into the currently-open
// history entry instead of each pushing a new one — this is what makes one
// undo press revert an entire drag gesture (FR-C3-009 §3 step 8) or an
// entire burst of keystrokes in a title/config field (§6's flagged
// additional coalescing need, beyond the original spec's drag-only framing)
// rather than one tiny fraction of either. A mutation with no coalesceKey
// always opens a new entry (e.g. add/duplicate/remove — one discrete action,
// nothing to coalesce with).

const HISTORY_LIMIT = 50
const COALESCE_WINDOW_MS = 800

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

  addParameter: (parameter: DashboardParameter, binding?: ParameterBinding) => void
  updateParameter: (key: string, patch: Partial<DashboardParameter>) => void
  removeParameter: (key: string) => void
  addBinding: (binding: ParameterBinding) => void
  updateBinding: (index: number, patch: Partial<ParameterBinding>) => void
  removeBinding: (index: number) => void

  undo: () => void
  redo: () => void
  // Reactive booleans (not `() => boolean` accessor functions) so a toolbar
  // button's `disabled` prop can subscribe to them directly via a selector
  // and re-render when the stacks change — an accessor function would read
  // fine but wouldn't trigger a re-render on its own, since zustand only
  // notifies subscribers on `set()`, not on closure-variable mutation.
  canUndo: boolean
  canRedo: boolean
}

interface HistoryEntry {
  schema: DashboardSchema
  key: string | null
  at: number
}

export const useDashboardStore = create<DashboardStoreState>((set, get) => {
  let undoStack: HistoryEntry[] = []
  let redoStack: DashboardSchema[] = []

  function mutate(fn: (schema: DashboardSchema) => DashboardSchema, coalesceKey: string | null = null) {
    const prevSchema = get().schema
    const last = undoStack[undoStack.length - 1]
    const canCoalesce =
      coalesceKey !== null &&
      last !== undefined &&
      last.key === coalesceKey &&
      Date.now() - last.at < COALESCE_WINDOW_MS

    if (canCoalesce) {
      // Folding into the open entry: bump its timestamp (extends the
      // coalescing window for the next call) but keep its `schema` — that's
      // the pre-GESTURE snapshot, not the pre-this-call snapshot, which is
      // exactly what makes one undo revert the whole gesture.
      last.at = Date.now()
    } else {
      undoStack.push({ schema: prevSchema, key: coalesceKey, at: Date.now() })
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift()
    }
    redoStack = []
    set(() => ({ schema: fn(prevSchema), dirty: true, canUndo: true, canRedo: false }))
  }

  return {
    schema: emptyDashboardSchema(),
    selectedWidgetId: null,
    dirty: false,
    canUndo: false,
    canRedo: false,

    loadSchema: (schema) => {
      undoStack = []
      redoStack = []
      set({ schema, selectedWidgetId: null, dirty: false, canUndo: false, canRedo: false })
    },
    reset: () => {
      undoStack = []
      redoStack = []
      set({ schema: emptyDashboardSchema(), selectedWidgetId: null, dirty: false, canUndo: false, canRedo: false })
    },
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
    //
    // Coalesced per-widget: holding an arrow key down fires many of these in
    // quick succession, and per FR-C3-009 that should undo as one logical
    // move, not one undo press per keydown event.
    applyKeyboardLayoutAction: (id, action, cols) => {
      mutate((schema) => ({
        ...schema,
        widgets: schema.widgets.map((w) =>
          w.id === id ? { ...w, layout: applyLayoutKeyAction(w.layout, action, cols) } : w,
        ),
      }), `keyboard-layout:${id}`)
    },

    // Batched form for GridCanvas's onDragStop/onResizeStop, called once per
    // completed gesture (not per intermediate frame — see GridCanvas.tsx),
    // so no coalesceKey is needed here: each call is already exactly one
    // history entry's worth of change, matching FR-C3-009 §3 step 8 directly.
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

    // Coalesced per-widget: a config panel can call this once per keystroke
    // (FR-C3-009 §6's flagged additional coalescing need).
    updateWidgetConfig: (id, config) => {
      mutate((schema) => ({
        ...schema,
        widgets: schema.widgets.map((w) => (w.id === id ? { ...w, config } : w)),
      }), `config:${id}`)
    },

    // Coalesced per-widget: fires once per keystroke in the title input.
    updateWidgetTitle: (id, title) => {
      mutate((schema) => ({
        ...schema,
        widgets: schema.widgets.map((w) => (w.id === id ? { ...w, title } : w)),
      }), `title:${id}`)
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
      mutate((schema) => ({
        ...schema,
        widgets: schema.widgets.filter((w) => w.id !== id),
        // A binding to a deleted tile is harmless at runtime — resolution
        // skips it — but leaving it behind means the panel lists a binding
        // pointing at nothing, which reads as a bug to whoever opens it next.
        parameterBindings: schema.parameterBindings?.filter((b) => b.widgetId !== id),
      }))
      set((state) => (state.selectedWidgetId === id ? { selectedWidgetId: null } : {}))
    },

    // Parameters and their bindings. Deliberately the same shape as the
    // report store's argument actions (features/reports/store.ts), since
    // slice 1 lifted the report model rather than inventing a second one.
    //
    // Both lists stay UNDEFINED rather than empty when nothing is declared,
    // so a dashboard authored before parameters existed serializes back out
    // byte-identical instead of gaining two empty arrays on first open.
    addParameter: (parameter, binding) => {
      mutate((schema) => ({
        ...schema,
        parameters: [...(schema.parameters ?? []), parameter],
        parameterBindings: binding
          ? [...(schema.parameterBindings ?? []), binding]
          : schema.parameterBindings,
      }))
    },

    // A key change carries its bindings with it. Not a correctness
    // requirement — slice 1 decided a stale binding is skipped, not an
    // error, so an orphaned one would cost the binding and nothing else.
    // It is that renaming a parameter and silently losing every tile it
    // narrowed is a rotten thing to do to an author mid-edit.
    updateParameter: (key, patch) => {
      mutate((schema) => {
        const nextKey = patch.key ?? key
        return {
          ...schema,
          parameters: (schema.parameters ?? []).map((p) => (p.key === key ? { ...p, ...patch } : p)),
          parameterBindings: schema.parameterBindings?.map((b) => (
            b.parameterKey === key ? { ...b, parameterKey: nextKey } : b
          )),
        }
      // Coalesced so a burst of keystrokes in the label or key field is ONE
      // undo, matching what the drag and title-field mutations already do.
      }, `parameter:${key}`)
    },

    removeParameter: (key) => {
      mutate((schema) => ({
        ...schema,
        parameters: (schema.parameters ?? []).filter((p) => p.key !== key),
        parameterBindings: schema.parameterBindings?.filter((b) => b.parameterKey !== key),
      }))
    },

    addBinding: (binding) => {
      mutate((schema) => ({
        ...schema,
        parameterBindings: [...(schema.parameterBindings ?? []), binding],
      }))
    },

    updateBinding: (index, patch) => {
      mutate((schema) => ({
        ...schema,
        parameterBindings: (schema.parameterBindings ?? []).map((b, i) => (i === index ? { ...b, ...patch } : b)),
      }), `binding:${index}`)
    },

    removeBinding: (index) => {
      mutate((schema) => ({
        ...schema,
        parameterBindings: (schema.parameterBindings ?? []).filter((_, i) => i !== index),
      }))
    },

    // undo/redo intentionally bypass mutate() — navigating history must not
    // itself push a new history entry, and must not clear the redo stack
    // (redo() consuming its own stack would be self-defeating).
    undo: () => {
      const entry = undoStack.pop()
      if (!entry) return
      redoStack.push(get().schema)
      set({ schema: entry.schema, dirty: true, canUndo: undoStack.length > 0, canRedo: true })
    },
    redo: () => {
      const next = redoStack.pop()
      if (next === undefined) return
      undoStack.push({ schema: get().schema, key: null, at: Date.now() })
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift()
      set({ schema: next, dirty: true, canUndo: true, canRedo: redoStack.length > 0 })
    },
  }
})

export function findWidget(schema: DashboardSchema, id: string): WidgetInstance | undefined {
  return schema.widgets.find((w) => w.id === id)
}
