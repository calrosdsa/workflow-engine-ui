import { useDraggable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { PAGE_COMPONENT_REGISTRY } from './component-registry'
import type { PageComponentType } from './schema'
import { useTranslation } from '@/features/i18n/I18nProvider'

// A horizontal chip-row alternative to Toolbox.tsx's fixed-width left rail,
// for width-constrained embedding contexts (CustomMenuConfigPanel, mounted
// inside MenusSection.tsx's MenuDetail at max-w-xl — confirmed too narrow
// for Toolbox's w-64 rail to leave a usable canvas alongside it). Same
// useDraggable wiring/data.kind convention as ToolboxItem in Toolbox.tsx,
// just laid out as wrapping chips instead of a scrollable category list.
function CompactToolboxItem({ type }: { type: PageComponentType }) {
  const t = useTranslation()
  const entry = PAGE_COMPONENT_REGISTRY[type]
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `page-toolbox:${type}`,
    data: { kind: 'new-component', component: type },
  })
  const Icon = entry.icon

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-left transition-all',
        'hover:border-indigo-300 hover:bg-indigo-50/50 active:cursor-grabbing cursor-grab',
        isDragging && 'opacity-40',
      )}
      title={t(`builder.pages.${entry.type}.description`)}
    >
      <Icon size={13} className="shrink-0 text-slate-500" />
      <span className="whitespace-nowrap text-[11px] font-medium text-slate-700">{t(`builder.pages.${entry.type}.label`)}</span>
    </button>
  )
}

export function CompactToolbox() {
  return (
    <div className="flex flex-wrap gap-1.5 border-b border-slate-200 bg-white p-2">
      {Object.values(PAGE_COMPONENT_REGISTRY).map((entry) => (
        <CompactToolboxItem key={entry.type} type={entry.type} />
      ))}
    </div>
  )
}
