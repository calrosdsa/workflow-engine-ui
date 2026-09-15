import { useState } from 'react'
import { PencilRuler, HelpCircle } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { hasPermission } from '@/features/auth/permissions'
import { getMenuType } from '@/features/menus/menu-registry'
import { MenuIconTile } from '@/features/menus/MenuIconTile'
import { runtimeRouter } from '@/runtime-router'
import { RuntimeLink } from './RuntimeLink'
import { NotificationBell } from './notifications/NotificationBell'
import { ProfileMenu } from './ProfileMenu'
import { openDesignHub } from './designHub'
import { ModuleDrilldownDialog } from './ModuleDrilldownDialog'
import type { AppSnapshot } from './types'
import type { MenuTreeNode } from '@/features/menus/types'

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
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4" style={{ borderColor: 'hsl(var(--border))' }}>
        <span className="truncate text-sm font-semibold">{snapshot.app.name}</span>
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

      <main className="min-h-0 flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {homeTiles.map((tile) => {
            // Already permission-filtered (homeTiles came from
            // buildRuntimeNavTree), so a module whose only module-child is
            // invisible to this viewer correctly becomes a leaf FOR THEM —
            // intentional, not a bug: they simply have nothing to drill into.
            const moduleChildren = tile.children.filter((c) => c.menu_type === 'module')
            const isDrilldownTile = tile.menu_type === 'module' && moduleChildren.length > 0
            const fallbackIcon = getMenuType(tile.menu_type)?.icon

            if (isDrilldownTile) {
              return (
                <button
                  key={tile.id}
                  onClick={() => setDrilldownRoot(tile)}
                  className="flex flex-col items-center gap-2 rounded-lg p-3 text-center transition-colors hover:bg-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                >
                  <MenuIconTile icon={tile.icon} fallback={fallbackIcon ?? HelpCircle} size="lg" />
                  <span className="line-clamp-2 text-sm font-medium">{tile.name}</span>
                </button>
              )
            }

            return (
              <RuntimeLink
                key={tile.id}
                to={`/${clientId}/${appId}/${tile.slug}`}
                className="flex flex-col items-center gap-2 rounded-lg p-3 text-center transition-colors hover:bg-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              >
                <MenuIconTile icon={tile.icon} fallback={fallbackIcon ?? HelpCircle} size="lg" />
                <span className="line-clamp-2 text-sm font-medium">{tile.name}</span>
              </RuntimeLink>
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
