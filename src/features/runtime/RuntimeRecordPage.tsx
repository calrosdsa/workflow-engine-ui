import { useState } from 'react'
import { Menu as MenuIcon, X, ArrowLeft } from 'lucide-react'
import { runtimeRouter } from '@/runtime-router'
import { useAuthStore } from '@/stores/auth'
import { canViewMenu } from '@/features/auth/permissions'
import { buildRuntimeNavTree, runtimeAncestors } from './nav'
import { RuntimeSidebar } from './RuntimeSidebar'
import { RuntimeBreadcrumbs } from './RuntimeBreadcrumbs'
import { PermissionDeniedPage } from './PermissionDeniedPage'
import { RecordDetailPanel, RecordDetailToolbar } from '@/features/forms/runtime/RecordDetailPanel'
import { resolveRecordTitle } from '@/features/forms/runtime/record-title'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { useRecordDetail } from '@/features/forms/runtime/record-detail-hooks'
import { parseLayout } from '@/features/form-builder/serialize'
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
  const membership = session?.memberships?.find(
    (m) => m.client_id === clientId && m.app_id === appId,
  )
  const permissions = membership?.permissions ?? []
  const roleId = membership?.role_id

  const navTree = buildRuntimeNavTree(snapshot.menus, roleId, permissions)
  const breadcrumbs = runtimeAncestors(snapshot.menus, currentMenu.id)
  const canView = canViewMenu(currentMenu, roleId, permissions)

  const { data: form } = useFormDef(formId)
  const { data: record } = useRecordDetail(formId, recordId)
  const recordTitle = resolveRecordTitle(form?.fields, record)
  const schema = form ? parseLayout(form.layout) : undefined

  return (
    // Theming is provided once by the shared ThemeProvider in
    // runtime-router.tsx's RuntimeAppRouteComponent — see that file's
    // comment for why this page doesn't own its own instance.
    <>
      <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
        <div className="hidden md:block">
          <RuntimeSidebar appName={snapshot.app.name} navTree={navTree} clientId={clientId} appId={appId} activeMenuId={currentMenu.id} />
        </div>

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
              className="-ml-1.5 rounded-md p-1.5 transition-colors hover:bg-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            >
              {mobileNavOpen ? <X size={18} /> : <MenuIcon size={18} />}
            </button>
            <span className="truncate text-sm font-semibold">{snapshot.app.name}</span>
          </header>

          <div className="flex items-center justify-between gap-3 border-b px-4 py-2" style={{ borderColor: 'hsl(var(--border))' }}>
            <RuntimeBreadcrumbs appName={snapshot.app.name} ancestors={breadcrumbs} current={currentMenu} clientId={clientId} appId={appId} />
            <button
              onClick={() => runtimeRouter.navigate({ to: `/${clientId}/${appId}/${currentMenu.slug}` })}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              style={{ color: 'hsl(var(--muted-foreground))' }}
            >
              <ArrowLeft size={12} />Back to list
            </button>
          </div>

          <main className="min-h-0 flex-1 overflow-y-auto">
            {!canView ? (
              <PermissionDeniedPage />
            ) : !form ? null : (
              <>
                {recordTitle && (
                  <div className="flex items-center justify-between gap-3 border-b px-6 py-4" style={{ borderColor: 'hsl(var(--border))' }}>
                    <h1 className="truncate text-lg font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{recordTitle}</h1>
                    <RecordDetailToolbar
                      formId={formId}
                      recordId={recordId}
                      record={record}
                      createUserSettings={schema?.settings?.createUser}
                      onDeleted={() => runtimeRouter.navigate({ to: `/${clientId}/${appId}/${currentMenu.slug}` })}
                    />
                  </div>
                )}
                <RecordDetailPanel
                  formId={formId}
                  recordId={recordId}
                  fields={form.fields}
                  schema={schema}
                />
              </>
            )}
          </main>
        </div>
      </div>
    </>
  )
}
