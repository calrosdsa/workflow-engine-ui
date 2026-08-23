import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  PAGE_COMPONENT_REGISTRY, PAGE_COMPONENT_CATEGORIES, type PageComponentRegistryEntry,
} from './component-registry'
import type { PageComponentType, PageComponentCategory } from './schema'

// Direct mirror of features/form-builder/Toolbox.tsx.

function ToolboxItem({ entry }: { entry: PageComponentRegistryEntry }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `page-toolbox:${entry.type}`,
    data: { kind: 'new-component', component: entry.type as PageComponentType },
  })
  const Icon = entry.icon

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left transition-all',
        'hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-sm active:cursor-grabbing cursor-grab',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1',
        isDragging && 'opacity-40',
      )}
      title={entry.description}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 transition-colors group-hover:bg-indigo-100 group-hover:text-indigo-600">
        <Icon size={15} strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12px] font-medium text-slate-700">{entry.label}</span>
        <span className="block truncate text-[10px] text-slate-400">{entry.description}</span>
      </span>
    </button>
  )
}

const CATEGORY_LABELS: Record<PageComponentCategory, string> = {
  Text: 'Text',
  Media: 'Media',
  Layout: 'Layout',
  Action: 'Action',
}

export function PageToolbox() {
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Components</p>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search components…" className="h-8 pl-7 text-xs" />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-3">
          {PAGE_COMPONENT_CATEGORIES.map((cat) => {
            const items = Object.values(PAGE_COMPONENT_REGISTRY).filter(
              (c) => c.category === cat && (!q || c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)),
            )
            if (items.length === 0) return null
            return (
              <div key={cat}>
                <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{CATEGORY_LABELS[cat]}</p>
                <div className="space-y-1.5">
                  {items.map((entry) => <ToolboxItem key={entry.type} entry={entry} />)}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
