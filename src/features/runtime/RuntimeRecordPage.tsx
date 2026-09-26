import { useState } from 'react'
import { Menu as MenuIcon, X, ArrowLeft } from 'lucide-react'
import { runtimeRouter } from '@/runtime-router'
import { useAuthStore } from '@/stores/auth'
import { canViewMenu } from '@/features/auth/permissions'
import { resolveSidebarNav, runtimeAncestors } from './nav'
import { RuntimeSidebar } from './RuntimeSidebar'
import { RuntimeBreadcrumbs } from './RuntimeBreadcrumbs'
import { PermissionDeniedPage } from './PermissionDeniedPage'
import { RecordDetailPanel, RecordDetailToolbar } from '@/features/forms/runtime/RecordDetailPanel'
import { resolveRecordTitle } from '@/features/forms/runtime/record-title'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { useRecordDetail } from '@/features/forms/runtime/record-detail-hooks'
import { resolveFormSchema } from '@/features/form-builder/serialize'
import { localizeFormSchema } from '@/features/form-builder/localize-schema'
import { useI18n } from '@/features/i18n/I18nProvider'
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

  const { navTree, scopedRoot } = resolveSidebarNav(snapshot.menus, currentMenu.id, roleId, permissions)
  const breadcrumbs = runtimeAncestors(snapshot.menus, currentMenu.id)
  const canView = canViewMenu(currentMenu, roleId, permissions)

  const { data: form } = useFormDef(formId)
  const { data: record } = useRecordDetail(formId, recordId)
  const recordTitle = resolveRecordTitle(form?.fields, record)
  const { t, tc } = useI18n()
  const schema = form ? localizeFormSchema(resolveFormSchema(form), form.id, tc) : undefined

  return (
    // Theming is provided once by the shared ThemeProvider in
    // runtime-router.tsx's RuntimeAppRouteComponent — see that file's
    // comment for why this page doesn't own its own instance.
    <>
      <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
        <div className="hidden md:block">
          <RuntimeSidebar appName={snapshot.app.name} navTree={navTree} scopedRoot={scopedRoot} clientId={clientId} appId={appId} activeMenuId={currentMenu.id} />
        </div>

        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
              {/* Backdrop click-to-close is a supplementary pointer gesture,
                 not the keyboard path — same convention as a Radix/Headless
                 UI dialog overlay. The real keyboard equivalent (Escape) isn't
                 wired for this mobile slide-over yet; today a keyboard user
                 closes it via the same toggle button that opened it. Making
                 this full-viewport div a fake button/tabIndex stop would
                 insert a giant, purposeless tab stop ahead of the sidebar's
                 real nav links, which is worse than leaving it out of the
                 tab order entirely. */}
              {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
            <div
              className="absolute inset-0 bg-black/40 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="relative animate-in slide-in-from-left duration-200 ease-out motion-reduce:animate-none">
              <RuntimeSidebar
                appName={snapshot.app.name}
                navTree={navTree}
                scopedRoot={scopedRoot}
                clientId={clientId}
                appId={appId}
                activeMenuId={currentMenu.id}
                onNavigate={() => setMobileNavOpen(false)}
              />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[hsl(var(--ink)/0.12)] px-4 md:hidden">
            <button
              onClick={() => setMobileNavOpen((o) => !o)}
              aria-label={mobileNavOpen ? t('common.close_navigation') : t('common.open_navigation')}
              aria-expanded={mobileNavOpen}
              className="-ml-2.5 flex h-11 w-11 items-center justify-center rounded-md transition-colors hover:bg-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            >
              {mobileNavOpen ? <X size={18} /> : <MenuIcon size={18} />}
            </button>
            <span className="truncate text-sm font-semibold">{snapshot.app.name}</span>
          </header>

          <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--ink)/0.12)] px-4 py-2">
            <RuntimeBreadcrumbs appName={snapshot.app.name} ancestors={breadcrumbs} current={currentMenu} clientId={clientId} appId={appId} />
            <button
              onClick={() => runtimeRouter.navigate({ to: `/${clientId}/${appId}/${currentMenu.slug}` })}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] pointer-coarse:py-3"
              style={{ color: 'hsl(var(--muted-foreground))' }}
            >
              <ArrowLeft size={12} />{t('runtime.record.back_to_list')}
            </button>
          </div>

          <main className="min-h-0 flex-1 overflow-y-auto">
            {/* Width-capped and centered — matches RuntimeAppShell.tsx's own
               main wrapper, so a record page doesn't stretch full-bleed
               across a wide monitor while every list page it was opened
               from is capped. */}
            <div className="mx-auto w-full max-w-6xl">
              {!canView ? (
                <PermissionDeniedPage />
              ) : !form ? null : (
                <>
                  {/* Always rendered, not gated on recordTitle — resolveRecordTitle
                      only returns '' while `record` is still loading (its own
                      fallback chain bottoms out at the raw id for a loaded
                      record with no title fields or name/label, never at '').
                      Gating this whole block on recordTitle used to hide
                      RecordDetailToolbar's Edit/Delete controls during that
                      loading window too, not just the heading — a titleless
                      flash shouldn't cost the toolbar. */}
                  <div className="flex items-end justify-between gap-3 px-6 pb-4 pt-6">
                    {/* The masthead of the record: which form it is and its
                        number, printed small in the spot colour, above the
                        record's own title. */}
                    <div className="min-w-0">
                      <p className="mb-1 flex items-baseline gap-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--ink))]">
                        <span className="truncate">{form.name}</span>{' '}
                        <span className="shrink-0 font-normal normal-case tracking-normal [font-family:var(--rt-mono)]">#{recordId.slice(0, 8)}</span>
                      </p>
                      <h1 className="truncate text-[26px] font-bold leading-tight tracking-[-0.015em] text-[hsl(var(--foreground))]">{recordTitle || t('common.loading')}</h1>
                    </div>
                    <RecordDetailToolbar
                      formId={formId}
                      recordId={recordId}
                      record={record}
                      createUserSettings={schema?.settings?.createUser}
                      schema={schema}
                      onDeleted={() => runtimeRouter.navigate({ to: `/${clientId}/${appId}/${currentMenu.slug}` })}
                    />
                  </div>
                  <RecordDetailPanel
                    formId={formId}
                    recordId={recordId}
                    fields={form.fields}
                    schema={schema}
                  />
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </>
  )
}
