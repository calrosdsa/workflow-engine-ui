import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  COMPONENT_REGISTRY, COMPONENT_CATEGORIES, type ComponentRegistryEntry,
} from './component-registry'
import type { ComponentType, ComponentCategory } from './schema'

// Drag payload identifier for a NEW component dragged from the toolbox.
export const TOOLBOX_DRAG_PREFIX = 'toolbox:'

function ToolboxItem({ entry }: { entry: ComponentRegistryEntry }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${TOOLBOX_DRAG_PREFIX}${entry.type}`,
    data: { kind: 'new-component', component: entry.type as ComponentType },
  })
  const Icon = entry.icon

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 py-2 text-left transition-all',
        'hover:border-[hsl(var(--primary))]/40 hover:bg-[hsl(var(--primary))]/5 hover:shadow-sm active:cursor-grabbing cursor-grab',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1',
        isDragging && 'opacity-40',
      )}
      title={entry.description}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors group-hover:bg-[hsl(var(--primary))]/15 group-hover:text-[hsl(var(--primary))]">
        <Icon size={15} strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12px] font-medium text-[hsl(var(--foreground))]">{entry.label}</span>
        <span className="block truncate text-[10px] text-[hsl(var(--muted-foreground))]">{entry.description}</span>
      </span>
    </button>
  )
}

const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  Input: 'Text Inputs',
  Choice: 'Choice',
  DateTime: 'Date & Time',
  Media: 'Media',
  Layout: 'Layout & Static',
}

export function Toolbox() {
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="border-b border-[hsl(var(--border))] p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Components</p>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search components…" className="h-8 pl-7 text-xs" />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-3">
          {COMPONENT_CATEGORIES.map((cat) => {
            const items = Object.values(COMPONENT_REGISTRY).filter(
              (c) => c.category === cat && (!q || c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)),
            )
            if (items.length === 0) return null
            return (
              <div key={cat}>
                <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{CATEGORY_LABELS[cat]}</p>
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
