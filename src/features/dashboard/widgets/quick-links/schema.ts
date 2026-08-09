export type QuickLinksDisplay = 'list' | 'grid' | 'buttons'
export type QuickLinkKind = 'menu' | 'url'

export interface QuickLink {
  id: string
  label: string
  kind: QuickLinkKind
  menuSlug?: string
  url?: string
  /** kind='url' only — a menu link always navigates in-app (onNavigate),
   *  matching every other in-app link in this codebase (Button widget,
   *  page-builder's button component). */
  newTab?: boolean
}

export interface QuickLinksWidgetConfig {
  display: QuickLinksDisplay
  links: QuickLink[]
}

const VALID_DISPLAYS: QuickLinksDisplay[] = ['list', 'grid', 'buttons']

function isQuickLink(v: unknown): v is QuickLink {
  if (!v || typeof v !== 'object') return false
  const l = v as Record<string, unknown>
  return typeof l.id === 'string' && typeof l.label === 'string' && (l.kind === 'menu' || l.kind === 'url')
}

export function parseQuickLinksConfig(raw: unknown): QuickLinksWidgetConfig {
  if (raw && typeof raw === 'object') {
    const r = raw as Partial<QuickLinksWidgetConfig>
    return {
      display: r.display && VALID_DISPLAYS.includes(r.display) ? r.display : 'list',
      links: Array.isArray(r.links) ? r.links.filter(isQuickLink) : [],
    }
  }
  return createDefaultQuickLinksConfig()
}

export function createDefaultQuickLinksConfig(): QuickLinksWidgetConfig {
  return { display: 'list', links: [] }
}
