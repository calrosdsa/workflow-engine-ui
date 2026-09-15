import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Eye, EyeOff } from 'lucide-react'
import { useTranslation } from '@/features/i18n/I18nProvider'

interface KanbanColumnOption {
  value: string
  label: string
}

interface KanbanColumnsPickerProps {
  /** The group field's own enum values, in their natural (field-definition)
   *  order — the fallback order/set whenever columnOrder/visibleColumns
   *  don't (yet) name every one of them. */
  options: KanbanColumnOption[]
  /** Which values render as columns, in display order — mirrors
   *  KanbanLayoutConfig.visibleColumns's own "empty means all" convention. */
  visibleColumns: string[]
  onVisibleColumnsChange: (values: string[]) => void
}

// KanbanLayout's config-time counterpart to ColumnsPicker.tsx — same two
// drag-reorderable Visible/Hidden lists mechanic, applied to a Select
// field's enum values instead of a form's fields, so a saved view's Kanban
// board can both hide specific statuses (e.g. a terminal "Archived" status
// nobody needs a column for) and set the board's left-to-right column order
// without needing to open the live board and drag headers there.
export function KanbanColumnsPicker({ options, visibleColumns, onVisibleColumnsChange }: KanbanColumnsPickerProps) {
  const t = useTranslation()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const visibleValues = visibleColumns.length > 0 ? visibleColumns : options.map((o) => o.value)
  const visible = visibleValues.map((v) => options.find((o) => o.value === v)).filter((o): o is KanbanColumnOption => !!o)
  const hidden = options.filter((o) => !visibleValues.includes(o.value))

  const hide = (value: string) => onVisibleColumnsChange(visibleValues.filter((v) => v !== value))
  const show = (value: string) => onVisibleColumnsChange([...visibleValues, value])

  function handleVisibleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = visibleValues.indexOf(active.id as string)
    const newIndex = visibleValues.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    onVisibleColumnsChange(arrayMove(visibleValues, oldIndex, newIndex))
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>
          <Eye size={12} />
          {t('menus.saved_views.columns_picker.visible_columns')}
        </p>
        <div className="min-h-[3rem] space-y-1 rounded-md border p-1.5" style={{ borderColor: 'hsl(var(--border))' }}>
          {visible.length === 0 && <p className="px-1.5 py-2 text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{t('menus.saved_views.columns_picker.no_visible')}</p>}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleVisibleDragEnd}>
            <SortableContext items={visibleValues} strategy={verticalListSortingStrategy}>
              {visible.map((o) => (
                <ColumnRow key={o.value} option={o} draggable onAction={() => hide(o.value)} actionIcon={EyeOff} actionTitle={t('menus.saved_views.columns_picker.hide_column')} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </div>

      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>
          <EyeOff size={12} />
          {t('menus.saved_views.columns_picker.hidden_columns')}
        </p>
        <div className="min-h-[3rem] space-y-1 rounded-md border p-1.5" style={{ borderColor: 'hsl(var(--border))' }}>
          {hidden.length === 0 && <p className="px-1.5 py-2 text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{t('menus.saved_views.columns_picker.no_hidden')}</p>}
          {hidden.map((o) => (
            <ColumnRow key={o.value} option={o} onAction={() => show(o.value)} actionIcon={Eye} actionTitle={t('menus.saved_views.columns_picker.show_column')} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ColumnRow({ option, draggable, onAction, actionIcon: ActionIcon, actionTitle }: {
  option: KanbanColumnOption
  draggable?: boolean
  onAction: () => void
  actionIcon: typeof Eye
  actionTitle: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: option.value, disabled: !draggable })
  const style = {
    backgroundColor: 'hsl(var(--muted))',
    ...(draggable ? { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 } : {}),
  }

  return (
    <div
      ref={draggable ? setNodeRef : undefined}
      style={style}
      className="flex items-center gap-1.5 rounded px-1.5 py-1 text-[12px]"
    >
      {draggable ? (
        <span {...attributes} {...listeners} className="cursor-grab touch-none opacity-60 hover:opacity-100 active:cursor-grabbing">
          <GripVertical size={12} />
        </span>
      ) : (
        <span className="w-3" />
      )}
      <span className="flex-1 truncate" style={{ color: 'hsl(var(--foreground))' }}>{option.label}</span>
      <button
        type="button"
        onClick={onAction}
        title={actionTitle}
        className="shrink-0 rounded p-0.5 opacity-60 hover:bg-[hsl(var(--accent))] hover:opacity-100"
      >
        <ActionIcon size={12} />
      </button>
    </div>
  )
}
