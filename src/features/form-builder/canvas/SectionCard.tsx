import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, ChevronDown, ChevronRight, Copy, Trash2, Columns3, MoreVertical,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select-menu'
import { useFormBuilderStore, deleteSectionChecked } from '../store'
import { COLUMN_LAYOUTS, type ColumnLayout, type FormSection } from '../schema'
import { ColumnDropZone } from './ColumnDropZone'

export function SectionCard({ section }: { section: FormSection }) {
  const updateSection = useFormBuilderStore((s) => s.updateSection)
  const setLayout = useFormBuilderStore((s) => s.setSectionLayout)
  const duplicate = useFormBuilderStore((s) => s.duplicateSectionById)
  const remove = deleteSectionChecked
  const toggleCollapsed = useFormBuilderStore((s) => s.toggleSectionCollapsed)
  const selectSection = useFormBuilderStore((s) => s.selectSection)
  const selectedSectionId = useFormBuilderStore((s) => s.selectedSectionId)

  const selected = selectedSectionId === section.id

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    data: { kind: 'section', sectionId: section.id },
  })
  const style = { transform: CSS.Translate.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => { e.stopPropagation(); selectSection(section.id) }}
      className={cn(
        'rounded-xl border bg-[hsl(var(--card))] shadow-sm transition-shadow',
        selected ? 'border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--primary))]/25' : 'border-[hsl(var(--border))]',
        isDragging && 'opacity-60 shadow-lg',
      )}
    >
      {/* Section header */}
      <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-3 py-2.5">
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag to reorder section"
          className="flex h-6 w-5 cursor-grab items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 active:cursor-grabbing"
          title="Drag to reorder section"
        >
          <GripVertical size={14} />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); toggleCollapsed(section.id) }}
          aria-label={section.collapsed ? 'Expand' : 'Collapse'}
          className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
          title={section.collapsed ? 'Expand' : 'Collapse'}
        >
          {section.collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        </button>

        <Input
          value={section.title}
          onChange={(e) => updateSection(section.id, { title: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="h-7 max-w-xs border-transparent bg-transparent px-1 text-sm font-semibold text-[hsl(var(--foreground))] hover:border-[hsl(var(--border))] focus:border-[hsl(var(--ring))]"
        />

        <div className="ml-auto flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {/* Layout picker */}
          <SelectMenu value={section.layout} onValueChange={(v) => setLayout(section.id, v as ColumnLayout)}>
            <SelectTrigger className="h-7 w-auto gap-1.5 border-[hsl(var(--border))] px-2 text-[11px]">
              <Columns3 size={12} className="text-[hsl(var(--muted-foreground))]" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(COLUMN_LAYOUTS) as ColumnLayout[]).map((key) => (
                <SelectItem key={key} value={key} className="text-xs">{COLUMN_LAYOUTS[key].label}</SelectItem>
              ))}
            </SelectContent>
          </SelectMenu>

          {/* Section actions */}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Section actions"
              className="flex h-7 w-7 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            >
              <MoreVertical size={14} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => duplicate(section.id)}>
                <Copy size={13} /> Duplicate section
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onClick={() => remove(section.id)}>
                <Trash2 size={13} /> Delete section
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Columns */}
      {!section.collapsed && (
        <div className="p-3">
          {section.description && <p className="mb-2 px-1 text-[11px] text-[hsl(var(--muted-foreground))]">{section.description}</p>}
          <div className="flex gap-3">
            {section.columns.map((col) => (
              <ColumnDropZone key={col.id} column={col} sectionId={section.id} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
