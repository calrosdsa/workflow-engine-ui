// One draggable card on the Detail Page Builder canvas, representing one
// DetailTabConfig entry — mirrors form-builder/canvas/ElementCard.tsx's
// drag-handle/select/delete chrome, applied to a tab instead of a field.
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Eye, EyeOff, Trash2, Lock, Users2, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { getDetailTab } from '@/features/forms/runtime/detail-tabs/registry'
import type { DetailTabConfig } from '@/features/form-builder/schema'

interface TabCardProps {
  tab: DetailTabConfig
  zoneId: string
  selected: boolean
  canHide: boolean
  onSelect: () => void
  onToggleHidden: () => void
  onRemove: () => void
}

export function TabCard({ tab, zoneId, selected, canHide, onSelect, onToggleHidden, onRemove }: TabCardProps) {
  const def = getDetailTab(tab.type)
  const isConditional = tab.renderIf?.mode === 'expression'
  const hasCustomVisibility = (tab.visibility?.mode ?? 'everyone') !== 'everyone'

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
    data: { kind: 'tab', tabId: tab.id, zoneId },
  })

  const style = { transform: CSS.Translate.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
      className={cn(
        'group relative rounded-lg border bg-[hsl(var(--card))] transition-shadow',
        selected ? 'border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--primary))]/25 shadow-sm' : 'border-[hsl(var(--border))] hover:shadow-sm',
        tab.hidden && 'bg-[hsl(var(--muted))]/40',
        isDragging && 'z-10 opacity-60 shadow-lg',
      )}
    >
      <div className="flex items-center gap-1.5 px-2 py-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab touch-none rounded p-1 text-[hsl(var(--muted-foreground))]/60 hover:text-[hsl(var(--muted-foreground))] active:cursor-grabbing"
          title="Drag to move"
        >
          <GripVertical size={13} />
        </button>

        {def && <def.icon size={14} className="shrink-0 text-[hsl(var(--muted-foreground))]" />}

        <span className={cn('min-w-0 flex-1 truncate text-[13px] font-medium', tab.hidden && 'text-[hsl(var(--muted-foreground))]')}>
          {tab.label || def?.label || tab.type}
        </span>

        <div className="flex shrink-0 items-center gap-1">
          {def?.builtin && (
            <Badge variant="outline" className="h-5 gap-0.5 px-1.5 py-0 text-[9.5px] font-medium text-[hsl(var(--muted-foreground))]">
              <Lock size={9} />
            </Badge>
          )}
          {hasCustomVisibility && (
            <Badge variant="outline" className="h-5 gap-0.5 px-1.5 py-0 text-[9.5px] font-medium text-[hsl(var(--muted-foreground))]">
              <Users2 size={9} />
            </Badge>
          )}
          {isConditional && (
            <Badge variant="outline" className="h-5 gap-0.5 px-1.5 py-0 text-[9.5px] font-medium text-[hsl(var(--muted-foreground))]">
              <GitBranch size={9} />
            </Badge>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleHidden() }}
            disabled={!canHide}
            title={tab.hidden ? 'Show tab' : canHide ? 'Hide tab' : 'At least one tab must stay visible'}
            className="rounded-md p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {tab.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove() }}
            disabled={!canHide}
            title={canHide ? 'Remove tab' : 'At least one tab must stay visible'}
            className="rounded-md p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
