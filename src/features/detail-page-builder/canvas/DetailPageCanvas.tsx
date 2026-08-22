// The Detail Page Builder's spatial canvas — one droppable ZoneDropZone per
// zone in the form's active DetailPageLayoutId, sharing a single DndContext
// (form-builder/canvas/FormBuilderDnd.tsx's own pattern: everything
// draggable/droppable must share one context or drops never register).
// Unlike the Form Builder canvas, there's no "drag a new item in from a
// toolbox" case here — a tab is created via "Add Tab"/"Add Field" (this
// component's own header) and appended directly, then optionally
// drag-reordered/moved between zones afterward — so the only ActiveDrag
// kind is an existing tab card.
import { useCallback, useState } from 'react'
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors,
  pointerWithin, rectIntersection, DragOverlay,
  type DragEndEvent, type CollisionDetection,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { getDetailTab } from '@/features/forms/runtime/detail-tabs/registry'
import { ZoneDropZone } from './ZoneDropZone'
import {
  DETAIL_PAGE_LAYOUTS, DEFAULT_DETAIL_PAGE_ZONE,
  type DetailTabConfig, type DetailPageLayoutId,
} from '@/features/form-builder/schema'

const isZoneId = (id: string) => id.startsWith('zone:')
const zoneIdFrom = (id: string) => id.slice('zone:'.length)

interface DetailPageCanvasProps {
  tabs: DetailTabConfig[]
  layout: DetailPageLayoutId
  selectedTabId: string | null
  onSelectTab: (id: string | null) => void
  onChange: (next: DetailTabConfig[]) => void
}

export function DetailPageCanvas({ tabs, layout, selectedTabId, onSelectTab, onChange }: DetailPageCanvasProps) {
  const zones = DETAIL_PAGE_LAYOUTS[layout]?.zones ?? DETAIL_PAGE_LAYOUTS.single.zones
  const zoneIds = new Set(zones.map((z) => z.id))
  const visibleCount = tabs.filter((t) => !t.hidden).length
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const effectiveZone = (t: DetailTabConfig) =>
    t.zone && zoneIds.has(t.zone) ? t.zone : DEFAULT_DETAIL_PAGE_ZONE

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) return pointerCollisions
    return rectIntersection(args)
  }, [])

  // Resolves a drop into a target zone id + insertion index within that
  // zone's own tab order. Over a zone's empty area -> append to that
  // zone's end. Over another card -> insert at that card's slot, using
  // THAT card's own zone — this is what makes dropping onto an existing
  // sidebar card move the dragged tab into the sidebar, not just reorder
  // within the origin zone (same cross-column resolution FormBuilderDnd's
  // own resolveTarget already relies on).
  function resolveTarget(overId: string, overData: Record<string, unknown> | undefined): { zoneId: string; index: number } | null {
    if (isZoneId(overId)) {
      const zoneId = zoneIdFrom(overId)
      const zoneTabs = tabs.filter((t) => effectiveZone(t) === zoneId)
      return { zoneId, index: zoneTabs.length }
    }
    if (overData?.kind === 'tab') {
      const targetZoneId = overData.zoneId as string
      const zoneTabs = tabs.filter((t) => effectiveZone(t) === targetZoneId)
      const index = zoneTabs.findIndex((t) => t.id === overData.tabId)
      return index === -1 ? null : { zoneId: targetZoneId, index }
    }
    return null
  }

  function handleDragEnd(e: DragEndEvent) {
    setDraggingId(null)
    const { active, over } = e
    if (!over) return
    const activeId = String(active.id)
    const target = resolveTarget(String(over.id), over.data.current as Record<string, unknown> | undefined)
    if (!target) return

    const dragged = tabs.find((t) => t.id === activeId)
    if (!dragged) return
    const draggedZone = effectiveZone(dragged)

    // Splice the dragged tab out of the full array, then back in at the
    // position corresponding to `target.index` within the target zone's
    // own filtered subsequence — order stays implicit in the single
    // DetailTabConfig[] array (see schema.ts's zone doc comment), never a
    // separate order-index field.
    const withoutDragged = tabs.filter((t) => t.id !== activeId)
    const targetZoneTabs = withoutDragged.filter((t) => effectiveZone(t) === target.zoneId)
    const clampedIndex = Math.max(0, Math.min(target.index, targetZoneTabs.length))

    let patched = dragged
    if (draggedZone !== target.zoneId) {
      // A dragged tab landing in a non-default zone always gets an
      // explicit `zone` written (never left undefined even if it happens
      // to equal DEFAULT_DETAIL_PAGE_ZONE) — matches how a fresh "Add
      // Field" entry is created directly with `zone` set, so a tab's
      // presence/absence of an explicit zone stays a reliable signal of
      // "user has never touched this" vs. "user explicitly chose main."
      patched = { ...dragged, zone: target.zoneId }
    }

    if (targetZoneTabs.length === 0) {
      onChange([...withoutDragged, patched])
      return
    }
    const anchorId = targetZoneTabs[clampedIndex]?.id ?? targetZoneTabs[targetZoneTabs.length - 1].id
    const anchorGlobalIndex = withoutDragged.findIndex((t) => t.id === anchorId)
    const insertAt = clampedIndex >= targetZoneTabs.length ? anchorGlobalIndex + 1 : anchorGlobalIndex
    const next = [...withoutDragged]
    next.splice(insertAt, 0, patched)
    onChange(next)
  }

  const patchTab = (id: string, patch: Partial<DetailTabConfig>) =>
    onChange(tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)))

  const toggleHidden = (id: string) => {
    const t = tabs.find((x) => x.id === id)
    if (!t) return
    if (!t.hidden && visibleCount <= 1) return
    patchTab(id, { hidden: !t.hidden })
  }

  const removeTab = (id: string) => {
    const t = tabs.find((x) => x.id === id)
    if (!t) return
    if (!t.hidden && visibleCount <= 1) return
    onChange(tabs.filter((x) => x.id !== id))
    if (selectedTabId === id) onSelectTab(null)
  }

  const draggedTab = draggingId ? tabs.find((t) => t.id === draggingId) : null
  const draggedDef = draggedTab ? getDetailTab(draggedTab.type) : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={(e) => setDraggingId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto p-4" onClick={() => onSelectTab(null)}>
        {zones.map((zone) => (
          <ZoneDropZone
            key={zone.id}
            zone={zone}
            tabs={tabs.filter((t) => effectiveZone(t) === zone.id)}
            selectedTabId={selectedTabId}
            visibleCount={visibleCount}
            onSelect={onSelectTab}
            onToggleHidden={toggleHidden}
            onRemove={removeTab}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2,0,0,1)' }}>
        {draggedTab && (
          <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--primary))] bg-[hsl(var(--card))] px-3 py-2 shadow-xl">
            {draggedDef && <draggedDef.icon size={14} className="text-[hsl(var(--primary))]" />}
            <span className="text-[13px] font-medium">{draggedTab.label || draggedDef?.label || draggedTab.type}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
