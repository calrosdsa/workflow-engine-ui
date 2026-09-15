import { ChevronRight, Home } from 'lucide-react'
import { useTranslation } from '@/features/i18n/I18nProvider'
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
  const t = useTranslation()
  return (
    <nav
      aria-label={t('runtime.breadcrumbs.aria_label')}
      className="flex min-w-0 items-center gap-1.5 overflow-hidden text-xs"
      style={{ color: 'hsl(var(--muted-foreground))' }}
    >
      <RuntimeLink
        to={`/${clientId}/${appId}`}
        className="flex shrink-0 items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
      >
        <Home size={12} />{appName}
      </RuntimeLink>
      {ancestors.map((a) => (
        // min-w-0 + truncate (not shrink-0) so a deep/long ancestor chain
        // gives way before the row is forced into the horizontal-scroll
        // fallback below — equal flex-shrink with the current crumb means
        // the browser's own shrink math already favors these short menu
        // names staying legible over the (usually longer) current title.
        <span key={a.id} className="flex min-w-0 shrink items-center gap-1.5">
          <ChevronRight size={11} className="shrink-0 opacity-60" />
          <RuntimeLink
            to={`/${clientId}/${appId}/${a.slug}`}
            className="min-w-0 truncate rounded px-1 py-0.5 transition-colors hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          >
            {a.name}
          </RuntimeLink>
        </span>
      ))}
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <ChevronRight size={11} className="shrink-0 opacity-60" />
        <span aria-current="page" className="min-w-0 truncate font-medium" style={{ color: 'hsl(var(--foreground))' }}>{current.name}</span>
      </span>
    </nav>
  )
}
