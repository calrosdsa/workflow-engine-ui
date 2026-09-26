import { useState } from 'react'
import { PencilRuler, HelpCircle, ArrowRight } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { hasPermission } from '@/features/auth/permissions'
import { getMenuType } from '@/features/menus/menu-registry'
import { MenuIcon } from '@/features/menus/MenuIcon'
import { runtimeRouter } from '@/runtime-router'
import { RuntimeLink } from './RuntimeLink'
import { NotificationBell } from './notifications/NotificationBell'
import { ProfileMenu } from './ProfileMenu'
import { openDesignHub } from './designHub'
import { ModuleDrilldownDialog } from './ModuleDrilldownDialog'
import type { AppSnapshot } from './types'
import type { MenuTreeNode } from '@/features/menus/types'

// How many of a section's pages the home directory lists before handing off
// to the section itself.
const DIRECTORY_LIMIT = 6

/** The pages under a home section, in menu order, looking through groups
 *  (parent / nested module menus) rather than listing the groups themselves:
 *  "Customers" is what someone comes for, not "CRM". Built from the
 *  already permission-filtered tree, so nothing listed is out of reach. */
function directoryPages(node: MenuTreeNode): MenuTreeNode[] {
  const out: MenuTreeNode[] = []
  const walk = (n: MenuTreeNode) => {
    for (const child of n.children) {
      if (child.hidden_from_nav) continue
      if ((child.menu_type === 'parent' || child.menu_type === 'module') && child.children.length > 0) walk(child)
      else out.push(child)
    }
  }
  walk(node)
  return out
}

interface RuntimeHomePageProps {
  snapshot: AppSnapshot
  clientId: string
  appId: string
  /** Root-level menus visible to this viewer, already permission-filtered
   *  (built via buildRuntimeNavTree) — one tile per entry. */
  homeTiles: MenuTreeNode[]
}

// The app's home/launcher page: a grid of tiles for every root-level menu
// visible to this viewer. Mounted by RuntimeIndexRedirect once the app has
// at least one root-level 'module' menu (see features/runtime/nav.ts's
// isModulesModeApp) — apps with none never reach this component, keeping
// today's redirect-straight-into-a-menu behavior for everyone else.
export function RuntimeHomePage({ snapshot, clientId, appId, homeTiles }: RuntimeHomePageProps) {
  const t = useTranslation()
  const [drilldownRoot, setDrilldownRoot] = useState<MenuTreeNode | null>(null)
  const session = useAuthStore((s) => s.session)
  const membership = session?.memberships?.find((m) => m.client_id === clientId && m.app_id === appId)
  const permissions = membership?.permissions ?? []
  const canDesign = hasPermission(permissions, 'application:design')

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[hsl(var(--ink)/0.12)] px-4">
        <span className="truncate text-[15px] font-bold tracking-[-0.01em]">{snapshot.app.name}</span>
        <div className="flex shrink-0 items-center gap-2">
          {canDesign && membership && (
            <button
              onClick={() => openDesignHub(membership)}
              className="flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] pointer-coarse:py-3"
              style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
            >
              <PencilRuler size={13} />
              {t('runtime.edit_design')}
            </button>
          )}
          {session && (
            <>
              <NotificationBell clientId={clientId} appId={appId} />
              <ProfileMenu session={session} showThemeToggle />
            </>
          )}
        </div>
      </div>

      {/* A directory, not a launcher: each section of the app with its first
          pages listed under it, so the page someone came for is usually one
          click from home instead of two. */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid w-full max-w-6xl gap-x-10 gap-y-10 px-6 py-8 sm:grid-cols-2 sm:px-8 lg:grid-cols-3">
          {homeTiles.map((tile) => {
            // Already permission-filtered (homeTiles came from
            // buildRuntimeNavTree), so a module whose only module-child is
            // invisible to this viewer correctly becomes a leaf FOR THEM —
            // intentional, not a bug: they simply have nothing to drill into.
            const moduleChildren = tile.children.filter((c) => c.menu_type === 'module')
            const isDrilldownTile = tile.menu_type === 'module' && moduleChildren.length > 0
            const fallbackIcon = getMenuType(tile.menu_type)?.icon
            const pages = isDrilldownTile ? [] : directoryPages(tile)
            const headingId = `home-${tile.id}`
            const head = (
              <>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--ink)/0.08)] text-[hsl(var(--ink))]">
                  <MenuIcon icon={tile.icon} fallback={fallbackIcon ?? HelpCircle} size={17} />
                </span>
                <span id={headingId} className="min-w-0 text-[15px] font-bold leading-snug tracking-[-0.01em]">{tile.name}</span>
              </>
            )
            const headClass = 'flex items-center gap-3 rounded-lg py-1 pr-2 text-left transition-colors hover:text-[hsl(var(--ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]'

            return (
              <section key={tile.id} aria-labelledby={headingId} className="min-w-0">
                {isDrilldownTile ? (
                  <button onClick={() => setDrilldownRoot(tile)} className={headClass}>
                    {head}
                  </button>
                ) : (
                  <RuntimeLink to={`/${clientId}/${appId}/${tile.slug}`} className={headClass}>
                    {head}
                  </RuntimeLink>
                )}
                {isDrilldownTile && (
                  <p className="mt-2 border-t border-[hsl(var(--ink)/0.2)] pt-2 text-[13px] text-[hsl(var(--muted-foreground))]">
                    {t('runtime.home.sections_count', { count: moduleChildren.length })}
                  </p>
                )}
                {pages.length > 0 && (
                  <ul className="mt-2 border-t border-[hsl(var(--ink)/0.2)] pt-1.5">
                    {pages.slice(0, DIRECTORY_LIMIT).map((page) => (
                      <li key={page.id}>
                        <RuntimeLink
                          to={`/${clientId}/${appId}/${page.slug}`}
                          className="block truncate rounded-md px-1 py-1.5 text-[14px] transition-colors hover:bg-[hsl(var(--ink)/0.05)] hover:text-[hsl(var(--ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                        >
                          {page.name}
                        </RuntimeLink>
                      </li>
                    ))}
                    {pages.length > DIRECTORY_LIMIT && (
                      <li>
                        <RuntimeLink
                          to={`/${clientId}/${appId}/${tile.slug}`}
                          aria-label={t('runtime.home.all_pages_in', { count: pages.length, name: tile.name })}
                          className="mt-0.5 inline-flex items-center gap-1 rounded-md px-1 py-1.5 text-[12.5px] font-semibold text-[hsl(var(--ink))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                        >
                          {t('runtime.home.all_pages', { count: pages.length })}
                          <ArrowRight size={13} aria-hidden="true" />
                        </RuntimeLink>
                      </li>
                    )}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      </main>

      {drilldownRoot && (
        <ModuleDrilldownDialog
          open
          root={drilldownRoot}
          onClose={() => setDrilldownRoot(null)}
          onNavigate={(slug) => {
            setDrilldownRoot(null)
            runtimeRouter.navigate({ to: `/${clientId}/${appId}/${slug}` })
          }}
        />
      )}
    </div>
  )
}
