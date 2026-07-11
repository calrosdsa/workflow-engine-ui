import { useState, useCallback, type ReactNode } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor,
  useSensor, useSensors,
  pointerWithin, rectIntersection,
  type DragStartEvent, type DragEndEvent, type CollisionDetection,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useFormBuilderStore, findElement } from '../store'
import { COMPONENT_REGISTRY } from '../component-registry'
import type { ComponentType } from '../schema'

// Id helpers for column droppables.
const isColumnId = (id: string) => id.startsWith('column:')
const columnIdFrom = (id: string) => id.slice('column:'.length)

type ActiveDrag =
  | { kind: 'new-component'; component: ComponentType }
  | { kind: 'element'; elementId: string }
  | { kind: 'section'; sectionId: string }
  | null

/**
 * Owns the single DndContext for the entire builder (toolbox + canvas).
 * Both the draggable toolbox items and the droppable columns MUST live inside
 * this one context, otherwise drops never register.
 */
export function FormBuilderDnd({ children }: { children: ReactNode }) {
  const schema = useFormBuilderStore((s) => s.schema)
  const addElement = useFormBuilderStore((s) => s.addItem)
  const moveElement = useFormBuilderStore((s) => s.moveItem)
  const moveSection = useFormBuilderStore((s) => s.moveSection)

  const [activeDrag, setActiveDrag] = useState<ActiveDrag>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Collision strategy: prefer what's under the pointer (works for empty
  // columns and precise drops), fall back to rectangle intersection. This is
  // far more reliable than closestCenter for column/element targets.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) return pointerCollisions
    return rectIntersection(args)
  }, [])

  function handleDragStart(e: DragStartEvent) {
    const data = e.active.data.current
    if (!data) return
    if (data.kind === 'new-component') setActiveDrag({ kind: 'new-component', component: data.component })
    else if (data.kind === 'element')  setActiveDrag({ kind: 'element', elementId: data.elementId })
    else if (data.kind === 'section')  setActiveDrag({ kind: 'section', sectionId: data.sectionId })
  }

  // Resolve a drop target into { sectionId, columnId, index }.
  // `over` may be a column droppable, an element (sortable), or nothing.
  function resolveTarget(overId: string, overData: Record<string, unknown> | undefined):
    { sectionId: string; columnId: string; index: number } | null {
    // Over a column container → append to its end.
    if (isColumnId(overId)) {
      const columnId = columnIdFrom(overId)
      for (const section of schema.sections) {
        const col = section.columns.find((c) => c.id === columnId)
        if (col) return { sectionId: section.id, columnId, index: col.elements.length }
      }
      return null
    }
    // Over another element → insert at that element's slot.
    if (overData?.kind === 'element') {
      const targetId = overData.elementId as string
      const found = findElement(schema, targetId)
      if (found) return { sectionId: found.loc.sectionId, columnId: found.loc.columnId, index: found.loc.index }
    }
    return null
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveDrag(null)
    if (!over) return

    const activeData = active.data.current
    const overData = over.data.current
    const overId = String(over.id)

    // 1. Section reorder
    if (activeData?.kind === 'section') {
      // Over either a section or an element inside a section → resolve to a section.
      let toSectionId: string | null = null
      if (overData?.kind === 'section') toSectionId = overData.sectionId as string
      else if (overData?.kind === 'element') toSectionId = (overData.sectionId as string) ?? null
      else if (isColumnId(overId)) {
        const cid = columnIdFrom(overId)
        toSectionId = schema.sections.find((s) => s.columns.some((c) => c.id === cid))?.id ?? null
      }
      if (toSectionId) {
        const from = schema.sections.findIndex((s) => s.id === activeData.sectionId)
        const to = schema.sections.findIndex((s) => s.id === toSectionId)
        if (from !== -1 && to !== -1 && from !== to) moveSection(from, to)
      }
      return
    }

    // 2. New component dropped from the toolbox
    if (activeData?.kind === 'new-component') {
      const target = resolveTarget(overId, overData)
      if (target) addElement(activeData.component as ComponentType, target.sectionId, target.columnId, target.index)
      return
    }

    // 3. Existing element moved
    if (activeData?.kind === 'element') {
      const target = resolveTarget(overId, overData)
      if (target) moveElement(activeData.elementId as string, target)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      {children}

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2,0,0,1)' }}>
        {activeDrag?.kind === 'new-component' && <ComponentDragPreview component={activeDrag.component} />}
        {activeDrag?.kind === 'element' && <ElementDragPreview elementId={activeDrag.elementId} />}
        {activeDrag?.kind === 'section' && (
          <div className="rounded-xl border border-indigo-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-xl">
            Moving section…
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

// ---------------------------------------------------------------------------
// Drag overlay previews
// ---------------------------------------------------------------------------

function ComponentDragPreview({ component }: { component: ComponentType }) {
  const reg = COMPONENT_REGISTRY[component]
  const Icon = reg.icon
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-indigo-300 bg-white px-3 py-2 shadow-xl">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-100 text-indigo-600">
        <Icon size={15} />
      </span>
      <span className="text-[12px] font-medium text-slate-700">{reg.label}</span>
    </div>
  )
}

function ElementDragPreview({ elementId }: { elementId: string }) {
  const schema = useFormBuilderStore((s) => s.schema)
  const found = findElement(schema, elementId)
  if (!found) return null
  const reg = COMPONENT_REGISTRY[found.item.component]
  const Icon = reg.icon
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-indigo-300 bg-white px-3 py-2 shadow-xl">
      <Icon size={14} className="text-indigo-500" />
      <span className="text-[12px] font-medium text-slate-700">{found.item.label}</span>
    </div>
  )
}
