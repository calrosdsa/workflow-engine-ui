import { useState } from 'react'
import { Menu as MenuIcon, X } from 'lucide-react'
import { runtimeRouter } from '@/runtime-router'
import { ThemeProvider } from '@/features/theme/ThemeProvider'
import { mergeTheme } from '@/features/theme/default-theme'
import { useAuthStore } from '@/stores/auth'
import { hasPermission } from '@/features/auth/permissions'
import { buildRuntimeNavTree, runtimeAncestors, toMenu } from './nav'
import { RuntimeSidebar } from './RuntimeSidebar'
import { RuntimeBreadcrumbs } from './RuntimeBreadcrumbs'
import { PermissionDeniedPage } from './PermissionDeniedPage'
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
  const permissions = session?.memberships?.find(
    (m) => m.client_id === clientId && m.app_id === appId,
  )?.permissions ?? []

  const navTree = buildRuntimeNavTree(snapshot.menus, permissions)
  const breadcrumbs = runtimeAncestors(snapshot.menus, currentMenu.id)

  const canViewCurrent = !currentMenu.required_permission || hasPermission(permissions, currentMenu.required_permission)

  const theme = mergeTheme(snapshot.theme)
  const RuntimeRenderer = MENU_TYPE_REGISTRY[currentMenu.menu_type].runtimeRenderer

  return (
    // Scoped to #runtime-root (runtime.html's mount node, guaranteed to
    // exist before this renders) rather than the default
    // document.documentElement. Otherwise the runtime's theme — including
    // its dark class and inline --foreground/--background — writes onto
    // <html>, which is shared with the builder's index.html DOM whenever
    // both are visited in the same tab, silently breaking the builder's own
    // (unthemed) text contrast. Same leak the preview pane in
    // ThemeSection.tsx already guards against for the same reason.
    <ThemeProvider theme={theme} scopeElement={document.getElementById('runtime-root')}>
      <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
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
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} />
            <div className="relative">
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
            <button onClick={() => setMobileNavOpen((o) => !o)} aria-label="Toggle navigation">
              {mobileNavOpen ? <X size={18} /> : <MenuIcon size={18} />}
            </button>
            <span className="text-sm font-semibold">{snapshot.app.name}</span>
          </header>

          <div className="border-b px-4 py-2" style={{ borderColor: 'hsl(var(--border))' }}>
            <RuntimeBreadcrumbs appName={snapshot.app.name} ancestors={breadcrumbs} current={currentMenu} clientId={clientId} appId={appId} />
          </div>

          <main className="min-h-0 flex-1 overflow-y-auto">
            {canViewCurrent ? (
              <RuntimeRenderer
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
    </ThemeProvider>
  )
}
