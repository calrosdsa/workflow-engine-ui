import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Copy, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePageBuilderStore } from '../store'
import { PAGE_COMPONENT_REGISTRY } from '../component-registry'
import { ComponentPreview } from '../ComponentPreview'
import type { PageComponent } from '../schema'

interface ComponentCardProps {
  component: PageComponent
  sectionId: string
  columnId: string
}

// Direct mirror of features/form-builder/canvas/ElementCard.tsx — simpler,
// since there's no "conditional" badge (PageComponents have no visibility
// behavior, unlike FormElement) — including its memo() — `component`
// keeps a stable reference across store mutations that don't touch it now
// that builder-kit/tree-store.ts's produce() is real Immer (shared by
// both stores). Still re-renders on its own selectedId store subscription
// regardless of props, which is correct.
export const ComponentCard = memo(function ComponentCard({ component, sectionId, columnId }: ComponentCardProps) {
  const selectedId = usePageBuilderStore((s) => s.selectedItemId)
  const selectComponent = usePageBuilderStore((s) => s.selectItem)
  const duplicate = usePageBuilderStore((s) => s.duplicateItemById)
  const remove = usePageBuilderStore((s) => s.deleteItem)

  const selected = selectedId === component.id
  const reg = PAGE_COMPONENT_REGISTRY[component.component]
  const Icon = reg.icon

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: component.id,
    data: { kind: 'component', componentId: component.id, sectionId, columnId },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => { e.stopPropagation(); selectComponent(component.id) }}
      className={cn(
        'group relative rounded-lg border bg-white transition-shadow',
        selected ? 'border-indigo-400 ring-2 ring-indigo-400/25 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm',
        isDragging && 'opacity-50 shadow-lg',
      )}
    >
      {/* Hover/selected toolbar */}
      <div className={cn(
        'absolute -top-3 right-2 z-10 flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-0.5 py-0.5 shadow-sm transition-opacity',
        selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
      )}>
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="flex h-6 w-6 cursor-grab items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 active:cursor-grabbing"
          title="Drag to move"
        >
          <GripVertical size={13} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); duplicate(component.id) }}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
          title="Duplicate"
        >
          <Copy size={12} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); remove(component.id) }}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Type tag */}
      <div className="flex items-center gap-1.5 border-b border-slate-100 px-2.5 py-1">
        <Icon size={11} className="text-slate-400" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{reg.label}</span>
      </div>

      {/* Preview */}
      <div className="p-2.5">
        <ComponentPreview component={component} />
      </div>
    </div>
  )
})
