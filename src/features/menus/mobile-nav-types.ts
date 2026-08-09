// Mobile Layout configuration (App Design > Mobile Layout tab) — a separate,
// app-level arrangement of menus for the mobile runtime's bottom-tab/drawer
// nav, independent of the desktop menu tree's sort_order/parent_id. See
// the KMP runtime app plan's Phase 4.1 for the design rationale (a single
// ordered list, not per-menu override fields, since mobile nav is
// fundamentally a reordering/subset operation over the existing menu set).
//
// Stored in apps.mobile_nav_config JSONB (opaque to Go, same treatment as
// apps.theme) and carried inside the published AppSnapshot as `mobile_nav`
// with `omitempty` — absent entirely for every app published before this
// feature existed, which the mobile runtime treats as "synthesize the
// default from the desktop menu tree," not an error.

export interface MobileNavItem {
  menu_id: string
  visible: boolean
  sort_order: number
}

export type MobileNavStyle = 'bottom_tabs' | 'drawer'

export interface MobileNavConfig {
  version: 1
  items: MobileNavItem[]
  style: MobileNavStyle
  max_visible_tabs?: number
}

export const DEFAULT_MAX_VISIBLE_TABS = 5

export function emptyMobileNavConfig(): MobileNavConfig {
  return { version: 1, items: [], style: 'bottom_tabs', max_visible_tabs: DEFAULT_MAX_VISIBLE_TABS }
}

/** Defensive parse of the opaque GET /application/mobile-nav response —
 *  mirrors the shallow-merge-over-defaults posture features/theme/default-theme.ts's
 *  mergeTheme() takes for the same "backend returns Partial<T>-ish JSON"
 *  situation, since mobile_nav_config is untyped JSONB server-side too. */
export function parseMobileNavConfig(raw: unknown): MobileNavConfig {
  if (!raw || typeof raw !== 'object') return emptyMobileNavConfig()
  const r = raw as Partial<MobileNavConfig>
  const items = Array.isArray(r.items)
    ? r.items.filter((i): i is MobileNavItem => !!i && typeof i === 'object' && typeof (i as MobileNavItem).menu_id === 'string')
    : []
  return {
    version: 1,
    items,
    style: r.style === 'drawer' ? 'drawer' : 'bottom_tabs',
    max_visible_tabs: typeof r.max_visible_tabs === 'number' && r.max_visible_tabs > 0 ? r.max_visible_tabs : DEFAULT_MAX_VISIBLE_TABS,
  }
}
