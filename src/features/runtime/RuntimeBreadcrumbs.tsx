import { ChevronRight, Home } from 'lucide-react'
import { RuntimeLink } from './RuntimeLink'
import type { Menu } from '@/features/menus/types'
import type { MenuSnapshotItem } from './types'

interface RuntimeBreadcrumbsProps {
  appName: string
  ancestors: Menu[]
  current: MenuSnapshotItem
  clientId: string
  appId: string
}

export function RuntimeBreadcrumbs({ appName, ancestors, current, clientId, appId }: RuntimeBreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap text-xs"
      style={{ color: 'hsl(var(--muted-foreground))' }}
    >
      <RuntimeLink
        to={`/${clientId}/${appId}`}
        className="flex shrink-0 items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
      >
        <Home size={12} />{appName}
      </RuntimeLink>
      {ancestors.map((a) => (
        <span key={a.id} className="flex shrink-0 items-center gap-1.5">
          <ChevronRight size={11} className="shrink-0 opacity-60" />
          <RuntimeLink
            to={`/${clientId}/${appId}/${a.slug}`}
            className="rounded px-1 py-0.5 transition-colors hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          >
            {a.name}
          </RuntimeLink>
        </span>
      ))}
      <span className="flex min-w-0 shrink-0 items-center gap-1.5">
        <ChevronRight size={11} className="shrink-0 opacity-60" />
        <span className="truncate font-medium" style={{ color: 'hsl(var(--foreground))' }}>{current.name}</span>
      </span>
    </nav>
  )
}
