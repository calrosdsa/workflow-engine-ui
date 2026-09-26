import { useMemo, useRef, useState } from 'react'
import { useBlocker } from '@tanstack/react-router'
import { Menu as MenuIcon, X, ArrowLeft, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { runtimeRouter } from '@/runtime-router'
import { useAuthStore } from '@/stores/auth'
import { usePermission } from '@/features/auth/permissions'
import { resolveSidebarNav } from './nav'
import { RuntimeSidebar } from './RuntimeSidebar'
import { PermissionDeniedPage } from './PermissionDeniedPage'
import { NotificationBell } from './notifications/NotificationBell'
import { ProfileMenu } from './ProfileMenu'
import { FormRenderer } from '@/features/forms/runtime/FormRenderer'
import { useForm as useFormDef, useCreateRecord } from '@/features/forms/hooks'
import { resolveFormSchema } from '@/features/form-builder/serialize'
import { localizeFormSchema, localizeFormName } from '@/features/form-builder/localize-schema'
import { useI18n } from '@/features/i18n/I18nProvider'
import { useAfterSubmitWorkflow } from '@/features/ui-workflows/useAfterSubmitWorkflow'
import type { AppSnapshot } from './types'

interface RuntimeFormCreatePageProps {
  snapshot: AppSnapshot
  clientId: string
  appId: string
  formId: string
  /** The Search menu whose "+ Create" button led here, if any (see
   *  runtimeFormCreateRoute's validateSearch) — used only to keep the
   *  sidebar scoped to that menu's module; never to borrow its chrome or
   *  permissions (see the "thinner chrome" note below, still true). */
  fromMenuId?: string
}

// The formId-keyed counterpart to AddMenuRuntime — reachable for ANY form,
// regardless of whether an Add menu happens to be built for it, the same way
// RuntimeFormRecordPage is reachable regardless of a Search menu. Read/create
// access is gated on the form's own forms:{id}:create permission directly,
// since there's no menu here to borrow chrome/permissions from — same
// thinner-chrome tradeoff RuntimeFormRecordPage already makes (no breadcrumb
// trail, no sidebar active-item highlight, "Back" is browser history rather
// than a specific list). That tradeoff is specifically about menu-derived
// chrome, though — it doesn't extend to ProfileMenu/NotificationBell, which
// have nothing to do with menu ownership and are still rendered here (see
// below): ProfileMenu's theme toggle is the only place in the whole runtime
// app to switch light/dark/system mode, so a page that omitted it would be
// an escape-hatch dead end for anyone who lands here in a theme that doesn't
// suit them.
export function RuntimeFormCreatePage({ snapshot, clientId, appId, formId, fromMenuId }: RuntimeFormCreatePageProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [result, setResult] = useState<'error' | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  // Flips true right before the post-save redirect below — without it, that
  // programmatic navigate() would immediately trip the same "unsaved
  // changes" prompt the blocker exists to protect against, on a form that
  // was, in fact, just saved.
  const submittedRef = useRef(false)
  useBlocker({
    shouldBlockFn: () => {
      if (submittedRef.current || !isDirty) return false
      return !window.confirm('You have unsaved changes. Leave this page and discard them?')
    },
    enableBeforeUnload: () => !submittedRef.current && isDirty,
  })
  const session = useAuthStore((s) => s.session)
  const membership = session?.memberships?.find(
    (m) => m.client_id === clientId && m.app_id === appId,
  )
  const permissions = membership?.permissions ?? []
  const roleId = membership?.role_id

  const { navTree, scopedRoot } = resolveSidebarNav(snapshot.menus, fromMenuId ?? '', roleId, permissions)
  const canCreate = usePermission(`forms:${formId}:create`)

  const { data: form } = useFormDef(formId)
  const createRecord = useCreateRecord(formId)
  const { t, tc } = useI18n()
  const newTitle = form?.name
    ? t('runtime.form_create.title', { name: localizeFormName(form.id, form.name, tc) })
    : t('runtime.form_create.fallback_title')

  // The form's own after-submit steps. Undefined-tolerant on both counts: the
  // definition may still be loading, and most forms configure none at all.
  const schema = useMemo(() => (form ? localizeFormSchema(resolveFormSchema(form), form.id, tc) : undefined), [form, tc])
  const runAfterSubmit = useAfterSubmitWorkflow(formId, schema?.settings?.afterSubmitWorkflow)

  const handleSubmit = async (values: Record<string, unknown>) => {
    setResult(null)
    try {
      const record = await createRecord.mutateAsync(values)
      // See the useBlocker call above: this must flip before the navigate()
      // below runs, or the unsaved-changes prompt fires on our own redirect.
      submittedRef.current = true
      // A toast, not page state: this handler always navigates away on
      // success (see below), which would unmount an inline banner before a
      // user could ever see it. Sonner's host is mounted once above the
      // route outlet (see components/ui/sonner.tsx), so it survives the
      // redirect and the confirmation actually gets seen.
      toast.success(t('forms.create.success_message'))

      // Runs AFTER the write and cannot undo it — the record exists by now.
      // Awaited before this page's own redirect so a workflow that navigates
      // somewhere specific wins over the generic "go look at what you made"
      // destination below.
      const { navigated } = await runAfterSubmit({ ...values, ...record })
      if (navigated) return

      // Same "go look at what you just made" behavior AddMenuRuntime's own
      // redirect option offers, except this page has no configured redirect
      // target (no menu config to read one from) — the one destination that's
      // always valid for a freshly created record, menu or no menu, is its
      // own formId-keyed detail page (RuntimeFormRecordPage).
      // Passed as a pre-typed variable, not an inline object literal — see
      // RuntimeLink.tsx's own `search` variable for why: runtimeRouter.navigate's
      // param types resolve against the BUILDER app's Register.router (the only
      // global route registry TS can see), so a literal `{ fromMenu: ... }` here
      // fails excess-property-checking against that unrelated route's search
      // shape even though this is really runtimeRouter, not router.
      const search: Record<string, string> | undefined = fromMenuId ? { fromMenu: fromMenuId } : undefined
      runtimeRouter.navigate({ to: `/${clientId}/${appId}/forms/${formId}/${record.id as string}`, search })
    } catch {
      setResult('error')
    }
  }

  return (
    // Theming is provided once by the shared ThemeProvider in
    // runtime-router.tsx's RuntimeAppRouteComponent — see that file's
    // comment for why this page doesn't own its own instance.
    <>
      <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
        <div className="hidden md:block">
          <RuntimeSidebar appName={snapshot.app.name} navTree={navTree} scopedRoot={scopedRoot} clientId={clientId} appId={appId} activeMenuId="" />
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
                activeMenuId=""
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
              className="-ml-1.5 rounded-md p-1.5 transition-colors hover:bg-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            >
              {mobileNavOpen ? <X size={18} /> : <MenuIcon size={18} />}
            </button>
            <span className="truncate text-sm font-semibold">{snapshot.app.name}</span>
          </header>

          <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--ink)/0.12)] px-4 py-2">
            <span className="truncate text-xs font-medium text-[hsl(var(--muted-foreground))]">
              {newTitle}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              {session && (
                <>
                  <NotificationBell clientId={clientId} appId={appId} />
                  <ProfileMenu session={session} showThemeToggle />
                </>
              )}
              <button
                onClick={() => runtimeRouter.history.back()}
                className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                style={{ color: 'hsl(var(--muted-foreground))' }}
              >
                <ArrowLeft size={12} />{t('runtime.record.back')}
              </button>
            </div>
          </div>

          <main className="min-h-0 flex-1 overflow-y-auto">
            {!canCreate ? (
              <PermissionDeniedPage />
            ) : !form ? null : (
              <div className="mx-auto max-w-xl space-y-4 p-6">
                <h1 data-slot="page-title" className="text-lg font-semibold text-[hsl(var(--foreground))]">{newTitle}</h1>
                {result === 'error' && (
                  <div className="flex items-center gap-2 rounded-md border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 p-3 text-sm text-[hsl(var(--destructive))]">
                    <AlertCircle size={16} />
                    {t('forms.create.error_message')}
                  </div>
                )}
                <FormRenderer
                  schema={schema!}
                  fields={form.fields}
                  formId={form.id}
                  onSubmit={handleSubmit}
                  submitting={createRecord.isPending}
                  submitLabel="Save"
                  onDirtyChange={setIsDirty}
                />
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  )
}
