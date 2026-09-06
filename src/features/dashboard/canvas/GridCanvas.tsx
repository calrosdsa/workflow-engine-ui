// The ONLY file in this feature that imports react-grid-layout — see
// docs/dashboard-system-plan.md section 3's containment rule. Widgets never
// see RGL's props; they render inside WidgetTile's plain div, and
// WidgetInstance.layout is our own {x,y,w,h,minW,minH} type (schema.ts),
// mapped to/from RGL's LayoutItem ({i,x,y,w,h,...}) only at this boundary.
// Swapping the layout engine later means rewriting this one file.
//
// Imported from the `legacy` entry point deliberately: react-grid-layout 2.x
// rewrote its main API around composable config objects (gridConfig/
// dragConfig/resizeConfig), but also ships a `legacy` compatibility layer
// that preserves the classic v1 flat-prop API (cols/rowHeight/margin/
// onLayoutChange) — the same shape virtually every example, tutorial, and
// existing integration of this library assumes. Using it directly here
// avoids re-deriving the composable-config mapping ourselves for no
// behavioral gain.
import { ReactGridLayout, WidthProvider, type Layout as RglLayout } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import { useCallback, useEffect, useRef } from 'react'
import { LayoutGrid, Plus } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import { Button } from '@/components/ui/button'
import { useDashboardStore } from '../store'
import { WidgetTile } from './WidgetTile'

const GridLayoutWithWidth = WidthProvider(ReactGridLayout)

export const CANVAS_DROPPABLE_ID = 'dashboard-canvas'

interface GridCanvasProps {
  clientId: string
  appId: string
  onAddFirstWidget: () => void
}

/**
 * The droppable, drag/resize-enabled canvas for the dashboard builder.
 * Registers a dnd-kit droppable zone (for drops from the widget toolbox —
 * new-widget placement is handled by the parent's onDragEnd, same pattern as
 * PageBuilderDnd/PageCanvas) while delegating existing-tile drag/resize/
 * compaction entirely to react-grid-layout.
 */
export function GridCanvas({ clientId, appId, onAddFirstWidget }: GridCanvasProps) {
  const schema = useDashboardStore((s) => s.schema)
  const selectedWidgetId = useDashboardStore((s) => s.selectedWidgetId)
  const selectWidget = useDashboardStore((s) => s.selectWidget)
  const updateWidgetLayouts = useDashboardStore((s) => s.updateWidgetLayouts)
  const applyKeyboardLayoutAction = useDashboardStore((s) => s.applyKeyboardLayoutAction)
  const duplicateWidgetById = useDashboardStore((s) => s.duplicateWidgetById)
  const removeWidget = useDashboardStore((s) => s.removeWidget)

  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_DROPPABLE_ID })

  // react-grid-layout fires onLayoutChange once on its own initial mount/
  // compaction pass, even with zero user interaction — reading schema fresh
  // via a ref (not the closure's `schema`, which would make this callback's
  // identity depend on it and re-run RGL's own memoization more than
  // necessary) lets this skip that call when every reported position
  // already matches the stored one, so opening a dashboard that needs no
  // compaction doesn't immediately flip the store to dirty/"Unsaved".
  const schemaRef = useRef(schema)
  schemaRef.current = schema

  // FR-C3-009: a drag/resize gesture must commit to the (undo-tracked) store
  // exactly once, on gesture-complete — not once per intermediate frame,
  // which is what onLayoutChange alone would produce (RGL fires it
  // continuously during a drag; the tile's on-screen position during the
  // gesture is RGL's own internal state, not driven by the `layout` prop, so
  // nothing is lost visually by not committing every frame). `gestureActive`
  // suppresses onLayoutChange's commits while true; onDragStop/onResizeStop
  // do the one real commit and clear it. onLayoutChange stays wired for the
  // one case a stop-event can't cover: RGL's own initial-mount/compaction
  // pass, which fires with no drag/resize gesture around it at all.
  const gestureActive = useRef(false)

  const commitLayout = useCallback((layout: RglLayout) => {
    const current = schemaRef.current.widgets
    const unchanged = layout.every((item) => {
      const w = current.find((widget) => widget.id === item.i)
      return w && w.layout.x === item.x && w.layout.y === item.y && w.layout.w === item.w && w.layout.h === item.h
    })
    if (unchanged) return

    updateWidgetLayouts(
      layout.map((item) => ({
        id: item.i,
        layout: { x: item.x, y: item.y, w: item.w, h: item.h, minW: item.minW, minH: item.minH },
      })),
    )
  }, [updateWidgetLayouts])

  const handleLayoutChange = useCallback((layout: RglLayout) => {
    if (gestureActive.current) return
    commitLayout(layout)
  }, [commitLayout])

  const handleGestureStart = useCallback(() => {
    gestureActive.current = true
  }, [])

  const handleGestureStop = useCallback((layout: RglLayout) => {
    gestureActive.current = false
    commitLayout(layout)
  }, [commitLayout])

  // FR-C3-009 §6: if a drag/resize is interrupted (tab loses focus, mouse-up
  // lost outside the window) before onDragStop/onResizeStop fires,
  // gestureActive would otherwise stay stuck `true`, silently suppressing
  // onLayoutChange's own commits until the next successful gesture happens
  // to reset it. A window-blur reset is a cheap, low-risk safety net for
  // this specific scenario; it doesn't attempt to recover or commit the
  // interrupted gesture's own in-progress change, only to stop it from
  // wedging future ones.
  useEffect(() => {
    const onBlur = () => { gestureActive.current = false }
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [])

  const rglLayout: RglLayout = schema.widgets.map((w) => ({
    i: w.id,
    x: w.layout.x,
    y: w.layout.y,
    w: w.layout.w,
    h: w.layout.h,
    minW: w.layout.minW,
    minH: w.layout.minH,
  }))

  const hasWidgets = schema.widgets.length > 0

  return (
    // Click empty canvas to deselect — a supplementary pointer gesture
    // (children with a real selectable tile call e.stopPropagation() on
    // their own onClick, so this only ever fires on the background
    // itself). No keyboard equivalent exists yet for deselecting; a
    // keyboard user reaches the same end by selecting a different tile.
    // Turning the whole scrollable canvas into a fake button/tabIndex
    // stop would be a worse regression than the gap it "fixes".
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      ref={setNodeRef}
      className={`flex h-full flex-1 flex-col overflow-auto bg-[hsl(var(--background))] ${isOver ? 'ring-2 ring-inset ring-[hsl(var(--primary))]/50' : ''}`}
      onClick={() => selectWidget(null)}
    >
      <div className="mx-auto w-full max-w-6xl flex-1 p-6" style={{ maxWidth: schema.settings.maxWidth }}>
        {!hasWidgets ? (
          <EmptyCanvas onAdd={onAddFirstWidget} />
        ) : (
          <GridLayoutWithWidth
            className="dashboard-grid"
            layout={rglLayout}
            cols={schema.settings.cols}
            rowHeight={schema.settings.rowHeight}
            margin={[schema.settings.gap, schema.settings.gap]}
            compactType="vertical"
            draggableHandle=".widget-drag-handle,.dashboard-grid-plain-handle"
            onLayoutChange={handleLayoutChange}
            onDragStart={handleGestureStart}
            onDragStop={handleGestureStop}
            onResizeStart={handleGestureStart}
            onResizeStop={handleGestureStop}
          >
            {schema.widgets.map((instance) => (
              <div key={instance.id} className="relative h-full">
                {instance.chrome === 'plain' && (
                  <div className="dashboard-grid-plain-handle absolute inset-x-0 top-0 z-10 h-3 cursor-grab active:cursor-grabbing" />
                )}
                <WidgetTile
                  instance={instance}
                  clientId={clientId}
                  appId={appId}
                  selected={selectedWidgetId === instance.id}
                  onSelect={() => selectWidget(instance.id)}
                  onDuplicate={() => duplicateWidgetById(instance.id)}
                  onDelete={() => removeWidget(instance.id)}
                  onKeyboardLayoutAction={(action) => applyKeyboardLayoutAction(instance.id, action, schema.settings.cols)}
                />
              </div>
            ))}
          </GridLayoutWithWidth>
        )}
      </div>
    </div>
  )
}

function EmptyCanvas({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--muted))]">
        <LayoutGrid size={26} className="text-[hsl(var(--muted-foreground))]/60" />
      </div>
      <div>
        <p className="text-sm font-medium text-[hsl(var(--foreground))]/80">Start building your dashboard</p>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Drag a widget from the left, or add one to get started.</p>
      </div>
      <Button onClick={(e) => { e.stopPropagation(); onAdd() }} className="mt-1 gap-2">
        <Plus size={15} /> Add Widget
      </Button>
    </div>
  )
}
