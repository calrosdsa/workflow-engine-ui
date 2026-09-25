import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, ChevronDown, ChevronRight, Copy, Trash2, Columns3, MoreVertical,
} from 'lucide-react'
import { cn, onKeyboardActivate } from '@/lib/utils'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useTranslation } from '@/features/i18n/I18nProvider'
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

// Memoized on default shallow prop comparison — see ElementCard.tsx's
// identical note: `section` now keeps a stable reference across store
// mutations that don't touch it, now that builder-kit/tree-store.ts's
// produce() is real Immer instead of a structuredClone-the-whole-tree
// stand-in. Still re-renders on its own selectedSectionId store
// subscription regardless of props, which is correct.
export const SectionCard = memo(function SectionCard({ section }: { section: FormSection }) {
  const t = useTranslation()
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
  const reducedMotion = usePrefersReducedMotion()
  const style = { transform: CSS.Translate.toString(transform), transition: reducedMotion ? undefined : transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      // role="group" (not "button") because the card contains its own real
      // interactive descendants (Input, layout picker, add-column, delete —
      // see below) — matches the established in-repo convention for this
      // exact shape, dashboard/canvas/WidgetTile.tsx. onKeyboardActivate's
      // own target-check keeps Enter/Space bubbling up from those
      // descendants from ALSO re-triggering selectSection, the same reason
      // onClick below (and the two stopPropagation shims further down)
      // exist on the mouse side.
      role="group"
      aria-label={`${t('builder.canvas.section_aria', { name: section.title || t('builder.canvas.untitled_section') })}${selected ? ` — ${t('builder.canvas.section_aria_selected')}` : ''}`}
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); selectSection(section.id) }}
      onKeyDown={onKeyboardActivate(() => selectSection(section.id))}
      className={cn(
        'rounded-xl border bg-[hsl(var(--card))] shadow-sm transition-shadow motion-reduce:transition-none',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1',
        selected ? 'border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--primary))]/25' : 'border-[hsl(var(--border))]',
        isDragging && 'opacity-60 shadow-lg',
      )}
    >
      {/* Section header */}
      <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-3 py-2.5">
        <div className="relative">
          <button
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            aria-label={t('builder.canvas.drag_reorder_section')}
            className="peer flex h-6 w-5 cursor-grab items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 active:cursor-grabbing"
            title={t('builder.canvas.drag_reorder_section')}
          >
            <GripVertical size={14} />
          </button>
          {/* Visible-on-keyboard-focus hint — see ElementCard.tsx's identical
              pattern for why: dnd-kit's own sr-only instructions (wired via
              aria-describedby) already cover screen readers, this covers
              the sighted keyboard-only user who can't rely on hover or a
              screen reader. */}
          <span
            role="presentation"
            className="pointer-events-none absolute -bottom-7 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded border border-[hsl(var(--border))] bg-[hsl(var(--popover))] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--popover-foreground))] shadow-sm peer-focus-visible:block"
          >
            {t('builder.canvas.drag_hint')}
          </span>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); toggleCollapsed(section.id) }}
          aria-label={section.collapsed ? t('common.expand') : t('common.collapse')}
          className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
          title={section.collapsed ? t('common.expand') : t('common.collapse')}
        >
          {section.collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        </button>

        <Input
          value={section.title}
          aria-label={t('builder.canvas.section_title')}
          onChange={(e) => updateSection(section.id, { title: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="h-7 max-w-xs border-transparent bg-transparent px-1 text-sm font-semibold text-[hsl(var(--foreground))] hover:border-[hsl(var(--border))] focus:border-[hsl(var(--ring))]"
        />

        {/* Not itself interactive — exists only to keep a click on one of
            these real controls (SelectMenu, the buttons below) from bubbling
            to the card's own onClick and selecting/deselecting the section
            as a side effect. The controls inside are the actual interactive
            surface and are already independently keyboard-operable. */}
        {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
        <div className="ml-auto flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {/* Layout picker */}
          <SelectMenu value={section.layout} onValueChange={(v) => setLayout(section.id, v as ColumnLayout)}>
            <SelectTrigger aria-label={t('builder.canvas.section_layout', { layout: t(`builder.canvas.column_layout.${section.layout}.label`) })} className="h-7 w-auto gap-1.5 border-[hsl(var(--border))] px-2 text-[11px]">
              <Columns3 size={12} aria-hidden="true" className="text-[hsl(var(--muted-foreground))]" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(COLUMN_LAYOUTS) as ColumnLayout[]).map((key) => (
                <SelectItem key={key} value={key} className="text-xs">{t(`builder.canvas.column_layout.${key}.label`)}</SelectItem>
              ))}
            </SelectContent>
          </SelectMenu>

          {/* Section actions */}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t('builder.canvas.section_actions')}
              className="flex h-7 w-7 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            >
              <MoreVertical size={14} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => duplicate(section.id)}>
                <Copy size={13} /> {t('builder.canvas.duplicate_section')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onClick={() => remove(section.id)}>
                <Trash2 size={13} /> {t('builder.canvas.delete_section')}
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
})
