import { useState } from 'react'
import { Menu as MenuIcon, X, PencilRuler, Eye } from 'lucide-react'
import { runtimeRouter, useRuntimeDraftPreview, exitDraftPreview } from '@/runtime-router'
import { useAuthStore } from '@/stores/auth'
import { canViewMenu, hasPermission } from '@/features/auth/permissions'
import { buildRuntimeNavTree, runtimeAncestors, toMenu } from './nav'
import { RuntimeSidebar } from './RuntimeSidebar'
import { RuntimeBreadcrumbs } from './RuntimeBreadcrumbs'
import { PermissionDeniedPage } from './PermissionDeniedPage'
import { openDesignHub } from './designHub'
import { NotificationBell } from './notifications/NotificationBell'
import { ProfileMenu } from './ProfileMenu'
import { MENU_TYPE_REGISTRY } from '@/features/menus/menu-registry'
import type { AppSnapshot, MenuSnapshotItem } from './types'

interface RuntimeAppShellProps {
  snapshot: AppSnapshot
  clientId: string
  appId: string
  currentMenu: MenuSnapshotItem
}

// The runtime's top-level layout — themed, navigable chrome around whichever
// menu type's runtimeRenderer is currently resolved. Deliberately separate
// from AppShell.tsx (the builder tool's own authenticated-admin chrome):
// this ships in the runtime.html bundle only, has app-specific theming
// rather than the builder's fixed light theme, and uses the selective-
// gating auth model (see runtime-router.tsx) rather than a hard
// redirect-if-no-session.
export function RuntimeAppShell({ snapshot, clientId, appId, currentMenu }: RuntimeAppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const session = useAuthStore((s) => s.session)
  const membership = session?.memberships?.find(
    (m) => m.client_id === clientId && m.app_id === appId,
  )
  const permissions = membership?.permissions ?? []
  const roleId = membership?.role_id
  const canDesign = hasPermission(permissions, 'application:design')

  const navTree = buildRuntimeNavTree(snapshot.menus, roleId, permissions)
  const breadcrumbs = runtimeAncestors(snapshot.menus, currentMenu.id)

  const canViewCurrent = canViewMenu(currentMenu, roleId, permissions)
  const isDraftPreview = useRuntimeDraftPreview()

  const RuntimeRenderer = MENU_TYPE_REGISTRY[currentMenu.menu_type].runtimeRenderer

  return (
    // Theming (dark class + CSS vars on #runtime-root) is provided once by
    // the shared ThemeProvider in runtime-router.tsx's RuntimeAppRouteComponent
    // — not here — so navigating between this shell and sibling leaf routes
    // (RuntimeRecordPage, RuntimeFormRecordPage) doesn't unmount/remount the
    // provider and cause a light/dark flash. See that file's comment for why.
    <div className="flex h-screen flex-col overflow-hidden">
      {isDraftPreview && (
        <div
          className="flex h-8 shrink-0 items-center justify-center gap-2 text-[12px] font-medium"
          style={{ backgroundColor: 'hsl(var(--warning))', color: 'hsl(var(--warning-foreground))' }}
        >
          <Eye size={13} />
          Previewing draft — unpublished changes are shown here only
          <button
            onClick={() => exitDraftPreview(clientId, appId)}
            className="ml-2 rounded px-1.5 py-0.5 underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          >
            Exit preview
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden" style={{ backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <RuntimeSidebar
            appName={snapshot.app.name}
            navTree={navTree}
            clientId={clientId}
            appId={appId}
            activeMenuId={currentMenu.id}
          />
        </div>

        {/* Mobile slide-over nav */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div
              className="absolute inset-0 bg-black/40 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="relative animate-in slide-in-from-left duration-200 ease-out motion-reduce:animate-none">
              <RuntimeSidebar
                appName={snapshot.app.name}
                navTree={navTree}
                clientId={clientId}
                appId={appId}
                activeMenuId={currentMenu.id}
                onNavigate={() => setMobileNavOpen(false)}
              />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4 md:hidden" style={{ borderColor: 'hsl(var(--border))' }}>
            <button
              onClick={() => setMobileNavOpen((o) => !o)}
              aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={mobileNavOpen}
              className="-ml-2.5 flex h-11 w-11 items-center justify-center rounded-md transition-colors hover:bg-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            >
              {mobileNavOpen ? <X size={18} /> : <MenuIcon size={18} />}
            </button>
            <span className="truncate text-sm font-semibold">{snapshot.app.name}</span>
          </header>

          <div className="flex items-center justify-between gap-3 border-b px-4 py-2" style={{ borderColor: 'hsl(var(--border))' }}>
            <RuntimeBreadcrumbs appName={snapshot.app.name} ancestors={breadcrumbs} current={currentMenu} clientId={clientId} appId={appId} />
            <div className="flex shrink-0 items-center gap-2">
              {canDesign && membership && (
                <button
                  onClick={() => openDesignHub(membership)}
                  className="flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] pointer-coarse:py-3"
                  style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                >
                  <PencilRuler size={13} />
                  Edit Design
                </button>
              )}
              {session && (
                <>
                  <NotificationBell clientId={clientId} appId={appId} />
                  <ProfileMenu session={session} />
                </>
              )}
            </div>
          </div>

          <main className="min-h-0 flex-1 overflow-y-auto">
            {canViewCurrent ? (
              <RuntimeRenderer
                // Keyed by menu id so navigating between two menus of the
                // SAME type (e.g. two Search menus) always remounts the
                // renderer instead of updating it in place. Without this,
                // React reuses the same SearchMenuRuntime/RecordsTable
                // instance across the navigation — RecordsTable seeds its
                // filter/sort/columns from props only on mount (see its own
                // key comment in SearchMenuRuntime.tsx), so an in-place
                // update left it rendering the PREVIOUS menu's field/column
                // state (raw internal field keys instead of labels, blank
                // cells) even though the new menu's data had already loaded
                // correctly over the network.
                key={currentMenu.id}
                menu={toMenu(currentMenu)}
                clientId={clientId}
                appId={appId}
                menus={snapshot.menus.map(toMenu)}
                onNavigate={(slug) => runtimeRouter.navigate({ to: `/${clientId}/${appId}/${slug}` })}
              />
            ) : (
              <PermissionDeniedPage />
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
