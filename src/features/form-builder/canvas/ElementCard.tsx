import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Copy, Trash2, Asterisk } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFormBuilderStore } from '../store'
import { COMPONENT_REGISTRY } from '../component-registry'
import { ElementPreview } from '../ElementPreview'
import type { FormElement } from '../schema'

interface ElementCardProps {
  element: FormElement
  sectionId: string
  columnId: string
}

export function ElementCard({ element, sectionId, columnId }: ElementCardProps) {
  const selectedId = useFormBuilderStore((s) => s.selectedItemId)
  const selectElement = useFormBuilderStore((s) => s.selectItem)
  const duplicate = useFormBuilderStore((s) => s.duplicateItemById)
  const remove = useFormBuilderStore((s) => s.deleteItem)

  const selected = selectedId === element.id
  const reg = COMPONENT_REGISTRY[element.component]
  const Icon = reg.icon

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: element.id,
    data: { kind: 'element', elementId: element.id, sectionId, columnId },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => { e.stopPropagation(); selectElement(element.id) }}
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
          className="flex h-6 w-6 cursor-grab items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
          title="Drag to move"
        >
          <GripVertical size={13} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); duplicate(element.id) }}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          title="Duplicate"
        >
          <Copy size={12} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); remove(element.id) }}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-500"
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Type tag */}
      <div className="flex items-center gap-1.5 border-b border-slate-100 px-2.5 py-1">
        <Icon size={11} className="text-slate-400" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{reg.label}</span>
        {element.behavior.required === 'always' && <Asterisk size={8} className="text-red-400" />}
        {element.behavior.visibility !== 'always' && (
          <span className="ml-auto rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-600">conditional</span>
        )}
      </div>

      {/* Preview */}
      <div className="p-2.5">
        <ElementPreview element={element} />
      </div>
    </div>
  )
}
