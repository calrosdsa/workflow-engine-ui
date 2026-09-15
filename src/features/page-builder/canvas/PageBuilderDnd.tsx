import { useState, useCallback, type ReactNode } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor,
  useSensor, useSensors,
  pointerWithin, rectIntersection,
  type DragStartEvent, type DragEndEvent, type CollisionDetection,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { usePageBuilderStore, findComponent } from '../store'
import { PAGE_COMPONENT_REGISTRY } from '../component-registry'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { PageComponentType } from '../schema'

// Direct mirror of features/form-builder/canvas/FormBuilderDnd.tsx — same
// collision-detection strategy, same column:${id} droppable-id convention,
// same ActiveDrag discriminated union (renamed 'element' -> 'component' to
// match this feature's vocabulary).

// Id helpers for column droppables.
const isColumnId = (id: string) => id.startsWith('column:')
const columnIdFrom = (id: string) => id.slice('column:'.length)

type ActiveDrag =
  | { kind: 'new-component'; component: PageComponentType }
  | { kind: 'component'; componentId: string }
  | { kind: 'section'; sectionId: string }
  | null

/**
 * Owns the single DndContext for the entire page builder (toolbox + canvas).
 * Both the draggable toolbox items and the droppable columns MUST live inside
 * this one context, otherwise drops never register.
 */
export function PageBuilderDnd({ children }: { children: ReactNode }) {
  const t = useTranslation()
  const schema = usePageBuilderStore((s) => s.schema)
  const addComponent = usePageBuilderStore((s) => s.addItem)
  const moveComponent = usePageBuilderStore((s) => s.moveItem)
  const moveSection = usePageBuilderStore((s) => s.moveSection)

  const [activeDrag, setActiveDrag] = useState<ActiveDrag>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Collision strategy: prefer what's under the pointer (works for empty
  // columns and precise drops), fall back to rectangle intersection. This is
  // far more reliable than closestCenter for column/component targets.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) return pointerCollisions
    return rectIntersection(args)
  }, [])

  function handleDragStart(e: DragStartEvent) {
    const data = e.active.data.current
    if (!data) return
    if (data.kind === 'new-component') setActiveDrag({ kind: 'new-component', component: data.component })
    else if (data.kind === 'component') setActiveDrag({ kind: 'component', componentId: data.componentId })
    else if (data.kind === 'section')   setActiveDrag({ kind: 'section', sectionId: data.sectionId })
  }

  // Resolve a drop target into { sectionId, columnId, index }.
  // `over` may be a column droppable, a component (sortable), or nothing.
  function resolveTarget(overId: string, overData: Record<string, unknown> | undefined):
    { sectionId: string; columnId: string; index: number } | null {
    // Over a column container → append to its end.
    if (isColumnId(overId)) {
      const columnId = columnIdFrom(overId)
      for (const section of schema.sections) {
        const col = section.columns.find((c) => c.id === columnId)
        if (col) return { sectionId: section.id, columnId, index: col.components.length }
      }
      return null
    }
    // Over another component → insert at that component's slot.
    if (overData?.kind === 'component') {
      const targetId = overData.componentId as string
      const found = findComponent(schema, targetId)
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
      // Over either a section or a component inside a section → resolve to a section.
      let toSectionId: string | null = null
      if (overData?.kind === 'section') toSectionId = overData.sectionId as string
      else if (overData?.kind === 'component') toSectionId = (overData.sectionId as string) ?? null
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
      if (target) addComponent(activeData.component as PageComponentType, target.sectionId, target.columnId, target.index)
      return
    }

    // 3. Existing component moved
    if (activeData?.kind === 'component') {
      const target = resolveTarget(overId, overData)
      if (target) moveComponent(activeData.componentId as string, target)
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
        {activeDrag?.kind === 'component' && <ExistingComponentDragPreview componentId={activeDrag.componentId} />}
        {activeDrag?.kind === 'section' && (
          <div className="rounded-xl border border-indigo-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-xl">
            {t('builder.pages.canvas.moving_section')}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

// ---------------------------------------------------------------------------
// Drag overlay previews
// ---------------------------------------------------------------------------

function ComponentDragPreview({ component }: { component: PageComponentType }) {
  const t = useTranslation()
  const reg = PAGE_COMPONENT_REGISTRY[component]
  const Icon = reg.icon
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-indigo-300 bg-white px-3 py-2 shadow-xl">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-100 text-indigo-600">
        <Icon size={15} />
      </span>
      <span className="text-[12px] font-medium text-slate-700">{t(`builder.pages.${component}.label`)}</span>
    </div>
  )
}

function ExistingComponentDragPreview({ componentId }: { componentId: string }) {
  const t = useTranslation()
  const schema = usePageBuilderStore((s) => s.schema)
  const found = findComponent(schema, componentId)
  if (!found) return null
  const reg = PAGE_COMPONENT_REGISTRY[found.item.component]
  const Icon = reg.icon
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-indigo-300 bg-white px-3 py-2 shadow-xl">
      <Icon size={14} className="text-indigo-500" />
      <span className="text-[12px] font-medium text-slate-700">{t(`builder.pages.${found.item.component}.label`)}</span>
    </div>
  )
}
