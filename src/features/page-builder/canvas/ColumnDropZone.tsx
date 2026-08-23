import { memo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import { ComponentCard } from './ComponentCard'
import type { PageColumn } from '../schema'

interface ColumnDropZoneProps {
  column: PageColumn
  sectionId: string
}

// Direct mirror of features/form-builder/canvas/ColumnDropZone.tsx,
// including its memo() — `column` keeps a stable reference across store
// mutations that don't touch it or its own components now that
// builder-kit/tree-store.ts's produce() is real Immer. No store
// subscription of its own (only useDroppable's per-drag-session isOver),
// so a skipped render here is a genuinely full skip.
export const ColumnDropZone = memo(function ColumnDropZone({ column, sectionId }: ColumnDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${column.id}`,
    data: { kind: 'column', columnId: column.id, sectionId },
  })

  const isEmpty = column.components.length === 0

  return (
    <div
      ref={setNodeRef}
      style={{ flex: column.ratio }}
      className={cn(
        'min-w-0 rounded-lg border-2 border-dashed p-2 transition-colors',
        isOver ? 'border-indigo-400 bg-indigo-50/40' : isEmpty ? 'border-slate-200 bg-slate-50/40' : 'border-transparent',
      )}
    >
      <SortableContext items={column.components.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2.5">
          {column.components.map((c) => (
            <ComponentCard key={c.id} component={c} sectionId={sectionId} columnId={column.id} />
          ))}
        </div>
      </SortableContext>

      {isEmpty && (
        <div className={cn(
          'flex min-h-[72px] items-center justify-center rounded-md text-center text-[11px] transition-colors',
          isOver ? 'text-indigo-500' : 'text-slate-300',
        )}>
          {isOver ? 'Drop here' : 'Drag components here'}
        </div>
      )}
    </div>
  )
})
