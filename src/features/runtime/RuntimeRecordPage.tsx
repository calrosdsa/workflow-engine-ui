import { useState } from 'react'
import { Menu as MenuIcon, X, ArrowLeft } from 'lucide-react'
import { runtimeRouter } from '@/runtime-router'
import { ThemeProvider } from '@/features/theme/ThemeProvider'
import { mergeTheme } from '@/features/theme/default-theme'
import { useAuthStore } from '@/stores/auth'
import { hasPermission } from '@/features/auth/permissions'
import { buildRuntimeNavTree, runtimeAncestors } from './nav'
import { RuntimeSidebar } from './RuntimeSidebar'
import { RuntimeBreadcrumbs } from './RuntimeBreadcrumbs'
import { PermissionDeniedPage } from './PermissionDeniedPage'
import { RecordDetailPanel } from '@/features/forms/runtime/RecordDetailPanel'
import { useForm as useFormDef } from '@/features/forms/hooks'
import type { AppSnapshot, MenuSnapshotItem } from './types'

interface RuntimeRecordPageProps {
  snapshot: AppSnapshot
  clientId: string
  appId: string
  currentMenu: MenuSnapshotItem
  formId: string
  recordId: string
}

// The "Expand to full page" destination for a Search menu's record-detail
// drawer — reuses RuntimeAppShell's sidebar/breadcrumb chrome but renders
// RecordDetailPanel as main content instead of the current menu's registered
// runtimeRenderer, since this isn't itself a distinct menu (no MENU_TYPE_REGISTRY
// entry needed — it's reached by direct navigation from within SearchMenuRuntime,
// the same way AddMenuRuntime's onNavigate already jumps between menu slugs).
export function RuntimeRecordPage({ snapshot, clientId, appId, currentMenu, formId, recordId }: RuntimeRecordPageProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const session = useAuthStore((s) => s.session)
  const permissions = session?.memberships?.find(
    (m) => m.client_id === clientId && m.app_id === appId,
  )?.permissions ?? []

  const navTree = buildRuntimeNavTree(snapshot.menus, permissions)
  const breadcrumbs = runtimeAncestors(snapshot.menus, currentMenu.id)
  const canView = !currentMenu.required_permission || hasPermission(permissions, currentMenu.required_permission)

  const { data: form } = useFormDef(formId)
  const theme = mergeTheme(snapshot.theme)

  return (
    <ThemeProvider theme={theme} scopeElement={document.getElementById('runtime-root')}>
      <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
        <div className="hidden md:block">
          <RuntimeSidebar appName={snapshot.app.name} navTree={navTree} clientId={clientId} appId={appId} activeMenuId={currentMenu.id} />
        </div>

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

          <div className="flex items-center justify-between border-b px-4 py-2" style={{ borderColor: 'hsl(var(--border))' }}>
            <RuntimeBreadcrumbs appName={snapshot.app.name} ancestors={breadcrumbs} current={currentMenu} clientId={clientId} appId={appId} />
            <button
              onClick={() => runtimeRouter.navigate({ to: `/${clientId}/${appId}/${currentMenu.slug}` })}
              className="flex items-center gap-1.5 text-xs hover:underline"
              style={{ color: 'hsl(var(--muted-foreground))' }}
            >
              <ArrowLeft size={12} />Back to list
            </button>
          </div>

          <main className="min-h-0 flex-1 overflow-y-auto">
            {!canView ? (
              <PermissionDeniedPage />
            ) : !form ? null : (
              <RecordDetailPanel formId={formId} recordId={recordId} fields={form.fields} />
            )}
          </main>
        </div>
      </div>
    </ThemeProvider>
  )
}
