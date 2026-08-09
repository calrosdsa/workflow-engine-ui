import { useState, type ReactNode } from 'react'
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { useDashboardStore } from '../store'
import { getWidget } from '../widget-registry'
import { CANVAS_DROPPABLE_ID } from './GridCanvas'

// Scoped-down analog of features/page-builder/canvas/PageBuilderDnd.tsx: the
// dashboard only needs dnd-kit for ONE interaction — dragging a new widget
// from the toolbox onto the canvas — because moving/resizing widgets
// ALREADY on the canvas is handled entirely by react-grid-layout's own drag
// system (see GridCanvas.tsx), not dnd-kit. That's why there's no
// target-resolution logic here like PageBuilderDnd's resolveTarget: the only
// drop target that matters is "somewhere over the canvas", and placement
// within it is just createWidget's bottom-append (factory.ts), same as
// clicking a toolbox item would do.

export function DashboardBuilderDnd({ children }: { children: ReactNode }) {
  const addWidget = useDashboardStore((s) => s.addWidget)
  const [draggingType, setDraggingType] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragStart(e: DragStartEvent) {
    const data = e.active.data.current
    if (data?.kind === 'new-widget') setDraggingType(data.widgetType as string)
  }

  function handleDragEnd(e: DragEndEvent) {
    setDraggingType(null)
    const { active, over } = e
    if (!over || over.id !== CANVAS_DROPPABLE_ID) return
    const data = active.data.current
    if (data?.kind === 'new-widget') addWidget(data.widgetType as string)
  }

  const draggingDef = draggingType ? getWidget(draggingType) : undefined

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingType(null)}
    >
      {children}

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2,0,0,1)' }}>
        {draggingDef && (
          <div className="flex items-center gap-2.5 rounded-lg border border-indigo-300 bg-white px-3 py-2 shadow-xl">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-100 text-indigo-600">
              <draggingDef.icon size={15} />
            </span>
            <span className="text-[12px] font-medium text-slate-700">{draggingDef.label}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
