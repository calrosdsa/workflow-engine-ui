import { cn } from '@/lib/utils'
import type { DropPosition } from '../store'

interface DropZoneProps {
  position: DropPosition
  active: boolean
  onDragOver: (e: React.DragEvent, pos: DropPosition) => void
  onDrop: (e: React.DragEvent, pos: DropPosition) => void
  onDragLeave: () => void
}

// Position → wrapper geometry. before/after are horizontal strips above/below
// the node; left/right are vertical strips beside it.
const ZONE_GEOMETRY: Record<DropPosition, string> = {
  before: '-top-5 left-0 right-0 h-9 flex-col',
  after:  '-bottom-5 left-0 right-0 h-9 flex-col',
  left:   '-left-5 top-0 bottom-0 w-9 flex-row',
  right:  '-right-5 top-0 bottom-0 w-9 flex-row',
}

// The indicator bar inside the zone — horizontal line for before/after,
// vertical line for left/right.
const BAR_GEOMETRY: Record<DropPosition, string> = {
  before: 'h-1 w-full',
  after:  'h-1 w-full',
  left:   'w-1 h-full',
  right:  'w-1 h-full',
}

export function DropZone({ position, active, onDragOver, onDrop, onDragLeave }: DropZoneProps) {
  return (
    <div
      className={cn(
        'absolute z-30 flex items-center justify-center',
        'transition-[opacity] duration-150 nodrag nopan',
        ZONE_GEOMETRY[position],
      )}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onDragOver(e, position) }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(e, position) }}
      onDragLeave={onDragLeave}
    >
      <div
        className={cn(
          'rounded-full transition-[background-color,box-shadow] duration-150',
          BAR_GEOMETRY[position],
          active
            ? 'bg-[hsl(var(--primary))] shadow-[0_0_0_3px_hsl(var(--primary)/0.25)]'
            : 'bg-[hsl(var(--primary))]/25',
        )}
      />
      {active && (
        <div className="absolute flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-[11px] font-bold shadow-md ring-2 ring-[hsl(var(--card))]">
          +
        </div>
      )}
    </div>
  )
}
