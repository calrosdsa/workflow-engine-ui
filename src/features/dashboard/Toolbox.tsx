import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useDashboardStore } from './store'
import { allWidgets, WIDGET_CATEGORIES } from './widget-registry'
import type { WidgetDefinition, WidgetCategory } from './widget-contract'

// Direct mirror of features/page-builder/Toolbox.tsx, sourced from the
// widget registry (open-ended, populated by whatever widgets/index.ts has
// imported) instead of a fixed Record — the search/category/drag mechanics
// are otherwise identical.

function ToolboxItem({ def }: { def: WidgetDefinition }) {
  const addWidget = useDashboardStore((s) => s.addWidget)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `dashboard-toolbox:${def.type}`,
    data: { kind: 'new-widget', widgetType: def.type },
  })
  const Icon = def.icon

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => addWidget(def.type)}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 py-2 text-left transition-all',
        'hover:border-[hsl(var(--primary))]/40 hover:bg-[hsl(var(--primary))]/5 hover:shadow-sm active:cursor-grabbing cursor-grab',
        isDragging && 'opacity-40',
      )}
      title={`Click to add, or drag to place: ${def.description}`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors group-hover:bg-[hsl(var(--primary))]/15 group-hover:text-[hsl(var(--primary))]">
        <Icon size={15} strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12px] font-medium text-[hsl(var(--foreground))]">{def.label}</span>
        <span className="block truncate text-[10px] text-[hsl(var(--muted-foreground))]">{def.description}</span>
      </span>
    </button>
  )
}

const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  Content: 'Content',
  Data: 'Data',
  Navigation: 'Navigation',
  Embed: 'Embed',
}

export function DashboardToolbox() {
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const widgets = allWidgets()

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="border-b border-[hsl(var(--border))] p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Widgets</p>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search widgets…" className="h-8 pl-7 text-xs" />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-3">
          {widgets.length === 0 && (
            <p className="p-2 text-center text-[11px] text-[hsl(var(--muted-foreground))]">No widget types are registered yet.</p>
          )}
          {WIDGET_CATEGORIES.map((cat) => {
            const items = widgets.filter(
              (w) => w.category === cat && (!q || w.label.toLowerCase().includes(q) || w.description.toLowerCase().includes(q)),
            )
            if (items.length === 0) return null
            return (
              <div key={cat}>
                <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{CATEGORY_LABELS[cat]}</p>
                <div className="space-y-1.5">
                  {items.map((def) => <ToolboxItem key={def.type} def={def} />)}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
