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
import { usePageBuilderStore } from '../store'
import { COLUMN_LAYOUTS, type ColumnLayout, type PageSection } from '../schema'
import { ColumnDropZone } from './ColumnDropZone'

// Direct mirror of features/form-builder/canvas/SectionCard.tsx.
export function SectionCard({ section }: { section: PageSection }) {
  const updateSection = usePageBuilderStore((s) => s.updateSection)
  const setLayout = usePageBuilderStore((s) => s.setSectionLayout)
  const duplicate = usePageBuilderStore((s) => s.duplicateSectionById)
  const remove = usePageBuilderStore((s) => s.deleteSection)
  const toggleCollapsed = usePageBuilderStore((s) => s.toggleSectionCollapsed)
  const selectSection = usePageBuilderStore((s) => s.selectSection)
  const selectedSectionId = usePageBuilderStore((s) => s.selectedSectionId)

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
        'rounded-xl border bg-white shadow-sm transition-shadow',
        selected ? 'border-indigo-300 ring-2 ring-indigo-300/25' : 'border-slate-200',
        isDragging && 'opacity-60 shadow-lg',
      )}
    >
      {/* Section header */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="flex h-6 w-5 cursor-grab items-center justify-center rounded text-slate-300 hover:bg-slate-100 hover:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 active:cursor-grabbing"
          title="Drag to reorder section"
        >
          <GripVertical size={14} />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); toggleCollapsed(section.id) }}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
          title={section.collapsed ? 'Expand' : 'Collapse'}
        >
          {section.collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        </button>

        <Input
          value={section.title}
          onChange={(e) => updateSection(section.id, { title: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="h-7 max-w-xs border-transparent bg-transparent px-1 text-sm font-semibold text-slate-800 hover:border-slate-200 focus:border-indigo-300"
        />

        <div className="ml-auto flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {/* Layout picker */}
          <SelectMenu value={section.layout} onValueChange={(v) => setLayout(section.id, v as ColumnLayout)}>
            <SelectTrigger className="h-7 w-auto gap-1.5 border-slate-200 px-2 text-[11px]">
              <Columns3 size={12} className="text-slate-400" />
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
            <DropdownMenuTrigger className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600">
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
