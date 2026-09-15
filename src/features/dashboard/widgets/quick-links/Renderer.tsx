import { ExternalLink, FileText } from 'lucide-react'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { WidgetRendererProps } from '../../widget-contract'
import type { QuickLinksWidgetConfig, QuickLink } from './schema'

// A menu-kind link is hidden if its target slug doesn't resolve in the
// `menus` snapshot passed down from the runtime shell — the same list
// RuntimeSidebar/ParentMenuRuntime already filter by visibility
// (permission_mode/required_role_ids) before handing it down, so "not in
// `menus`" already means "this viewer can't see it", not just "doesn't
// exist". Builder mode has no `menus` gating concern (the person editing
// the dashboard can always see every menu in their own app), so links are
// only hidden this way at runtime.
function isVisible(link: QuickLink, menus: WidgetRendererProps<unknown>['menus'], mode: 'builder' | 'runtime'): boolean {
  if (link.kind === 'url') return true
  if (mode === 'builder') return true
  if (!menus) return true
  return menus.some((m) => m.slug === link.menuSlug)
}

const DISPLAY_CONTAINER: Record<QuickLinksWidgetConfig['display'], string> = {
  list: 'flex flex-col gap-1 p-2',
  grid: 'grid grid-cols-2 gap-2 p-2',
  buttons: 'flex flex-wrap gap-2 p-2',
}

export function QuickLinksRenderer({ config, menus, onNavigate, mode }: WidgetRendererProps<QuickLinksWidgetConfig>) {
  const t = useTranslation()
  const visibleLinks = config.links.filter((l) => isVisible(l, menus, mode))

  if (visibleLinks.length === 0) {
    return <div className="flex h-full items-center justify-center p-3 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{t('builder.dashboard_quick-links.no_links_runtime')}</div>
  }

  return (
    <div className={DISPLAY_CONTAINER[config.display]}>
      {visibleLinks.map((link) => (
        <QuickLinkItem key={link.id} link={link} display={config.display} onNavigate={onNavigate} mode={mode} />
      ))}
    </div>
  )
}

function QuickLinkItem({
  link, display, onNavigate, mode,
}: {
  link: QuickLink
  display: QuickLinksWidgetConfig['display']
  onNavigate?: (slug: string) => void
  mode: 'builder' | 'runtime'
}) {
  const Icon = link.kind === 'url' ? ExternalLink : FileText
  const itemClass = display === 'buttons'
    ? 'inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 py-1.5 text-xs font-medium text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))]/40 hover:bg-[hsl(var(--primary))]/5'
    : 'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]'

  if (link.kind === 'url' && link.url) {
    if (mode === 'builder') {
      return <span className={itemClass}><Icon size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />{link.label}</span>
    }
    return (
      <a href={link.url} target={link.newTab === false ? undefined : '_blank'} rel="noopener noreferrer" className={itemClass}>
        <Icon size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />{link.label}
      </a>
    )
  }

  return (
    <button
      type="button"
      className={itemClass}
      onClick={() => { if (mode === 'runtime' && link.menuSlug) onNavigate?.(link.menuSlug) }}
    >
      <Icon size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />{link.label}
    </button>
  )
}
