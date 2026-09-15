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
import type { FieldDef } from '@/features/forms/types'

interface ColumnsPickerProps {
  fields: FieldDef[]
  /** Field names currently visible, in display order — mirrors
   *  SavedViewConfig.columns exactly (empty array means "all fields", the
   *  same convention SearchMenuConfig.columns already uses, per RecordsTable's
   *  visibleColumns fallback). */
  columns: string[]
  onChange: (columns: string[]) => void
}

// Two drag-reorderable lists — Visible Columns and Hidden Columns — letting
// a saved view both pick which columns show AND their order, in one control.
// Dragging a field between lists shows/hides it; dragging within Visible
// Columns reorders it. Mirrors DataTable's own drag-reorder mechanics
// (@dnd-kit, vertical strategy here vs. horizontal for table headers) rather
// than introducing a second drag library.
export function ColumnsPicker({ fields, columns, onChange }: ColumnsPickerProps) {
  const t = useTranslation()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Empty columns means "all fields, form order" (SearchMenuConfig's
  // existing convention) — resolve that to an explicit list here so the
  // picker always has real, orderable, checkable rows to show.
  const visibleNames = columns.length > 0 ? columns : fields.map((f) => f.name)
  const visible = visibleNames.map((name) => fields.find((f) => f.name === name)).filter((f): f is FieldDef => !!f)
  const hidden = fields.filter((f) => !visibleNames.includes(f.name))

  const hide = (name: string) => onChange(visibleNames.filter((n) => n !== name))
  const show = (name: string) => onChange([...visibleNames, name])

  function handleVisibleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = visibleNames.indexOf(active.id as string)
    const newIndex = visibleNames.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    onChange(arrayMove(visibleNames, oldIndex, newIndex))
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
            <SortableContext items={visibleNames} strategy={verticalListSortingStrategy}>
              {visible.map((f) => (
                <ColumnRow key={f.name} field={f} draggable onAction={() => hide(f.name)} actionIcon={EyeOff} actionTitle={t('menus.saved_views.columns_picker.hide_column')} />
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
          {hidden.map((f) => (
            <ColumnRow key={f.name} field={f} onAction={() => show(f.name)} actionIcon={Eye} actionTitle={t('menus.saved_views.columns_picker.show_column')} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ColumnRow({ field, draggable, onAction, actionIcon: ActionIcon, actionTitle }: {
  field: FieldDef
  draggable?: boolean
  onAction: () => void
  actionIcon: typeof Eye
  actionTitle: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.name, disabled: !draggable })
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
      <span className="flex-1 truncate" style={{ color: 'hsl(var(--foreground))' }}>{field.label || field.name}</span>
      <button
        type="button"
        onClick={onAction}
        title={actionTitle}
        className="shrink-0 rounded p-0.5 opacity-60 hover:bg-[hsl(var(--accent))] hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
      >
        <ActionIcon size={12} />
      </button>
    </div>
  )
}
