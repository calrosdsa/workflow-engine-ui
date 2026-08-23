import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import { ElementCard } from './ElementCard'
import type { FormColumn } from '../schema'

interface ColumnDropZoneProps {
  column: FormColumn
  sectionId: string
}

export function ColumnDropZone({ column, sectionId }: ColumnDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${column.id}`,
    data: { kind: 'column', columnId: column.id, sectionId },
  })

  const isEmpty = column.elements.length === 0

  return (
    <div
      ref={setNodeRef}
      style={{ flex: column.ratio }}
      className={cn(
        'min-w-0 rounded-lg border-2 border-dashed p-2 transition-colors',
        isOver ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5' : isEmpty ? 'border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40' : 'border-transparent',
      )}
    >
      <SortableContext items={column.elements.map((e) => e.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2.5">
          {column.elements.map((el) => (
            <ElementCard key={el.id} element={el} sectionId={sectionId} columnId={column.id} />
          ))}
        </div>
      </SortableContext>

      {isEmpty && (
        <div className={cn(
          'flex min-h-[72px] items-center justify-center rounded-md text-center text-[11px] transition-colors',
          isOver ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]',
        )}>
          {isOver ? 'Drop here' : 'Drag components here'}
        </div>
      )}
    </div>
  )
}
