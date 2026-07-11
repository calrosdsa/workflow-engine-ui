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
    <nav className="flex items-center gap-1.5 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
      <RuntimeLink to={`/${clientId}/${appId}`} className="flex items-center gap-1 hover:underline">
        <Home size={12} />{appName}
      </RuntimeLink>
      {ancestors.map((a) => (
        <span key={a.id} className="flex items-center gap-1.5">
          <ChevronRight size={11} />
          <RuntimeLink to={`/${clientId}/${appId}/${a.slug}`} className="hover:underline">
            {a.name}
          </RuntimeLink>
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <ChevronRight size={11} />
        <span className="font-medium" style={{ color: 'hsl(var(--foreground))' }}>{current.name}</span>
      </span>
    </nav>
  )
}
