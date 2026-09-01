import { useState } from 'react'
import { Menu as MenuIcon, X, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react'
import { runtimeRouter } from '@/runtime-router'
import { useAuthStore } from '@/stores/auth'
import { usePermission } from '@/features/auth/permissions'
import { buildRuntimeNavTree } from './nav'
import { RuntimeSidebar } from './RuntimeSidebar'
import { PermissionDeniedPage } from './PermissionDeniedPage'
import { FormRenderer } from '@/features/forms/runtime/FormRenderer'
import { useForm as useFormDef, useCreateRecord } from '@/features/forms/hooks'
import { resolveFormSchema } from '@/features/form-builder/serialize'
import type { AppSnapshot } from './types'

interface RuntimeFormCreatePageProps {
  snapshot: AppSnapshot
  clientId: string
  appId: string
  formId: string
}

// The formId-keyed counterpart to AddMenuRuntime — reachable for ANY form,
// regardless of whether an Add menu happens to be built for it, the same way
// RuntimeFormRecordPage is reachable regardless of a Search menu. Read/create
// access is gated on the form's own forms:{id}:create permission directly,
// since there's no menu here to borrow chrome/permissions from — same
// thinner-chrome tradeoff RuntimeFormRecordPage already makes (no breadcrumb
// trail, no sidebar active-item highlight, "Back" is browser history rather
// than a specific list).
export function RuntimeFormCreatePage({ snapshot, clientId, appId, formId }: RuntimeFormCreatePageProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [result, setResult] = useState<'success' | 'error' | null>(null)
  const session = useAuthStore((s) => s.session)
  const membership = session?.memberships?.find(
    (m) => m.client_id === clientId && m.app_id === appId,
  )
  const permissions = membership?.permissions ?? []
  const roleId = membership?.role_id

  const navTree = buildRuntimeNavTree(snapshot.menus, roleId, permissions)
  const canCreate = usePermission(`forms:${formId}:create`)

  const { data: form } = useFormDef(formId)
  const createRecord = useCreateRecord(formId)

  const handleSubmit = async (values: Record<string, unknown>) => {
    setResult(null)
    try {
      const record = await createRecord.mutateAsync(values)
      setResult('success')
      // Same "go look at what you just made" behavior AddMenuRuntime's own
      // redirect option offers, except this page has no configured redirect
      // target (no menu config to read one from) — the one destination that's
      // always valid for a freshly created record, menu or no menu, is its
      // own formId-keyed detail page (RuntimeFormRecordPage).
      runtimeRouter.navigate({ to: `/${clientId}/${appId}/forms/${formId}/${record.id as string}` })
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
          <RuntimeSidebar appName={snapshot.app.name} navTree={navTree} clientId={clientId} appId={appId} activeMenuId="" />
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
                activeMenuId=""
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
            <span className="truncate text-xs font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {form?.name ? `New ${form.name}` : 'New Record'}
            </span>
            <button
              onClick={() => runtimeRouter.history.back()}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              style={{ color: 'hsl(var(--muted-foreground))' }}
            >
              <ArrowLeft size={12} />Back
            </button>
          </div>

          <main className="min-h-0 flex-1 overflow-y-auto">
            {!canCreate ? (
              <PermissionDeniedPage />
            ) : !form ? null : (
              <div className="mx-auto max-w-xl space-y-4 p-6">
                {result === 'error' && (
                  <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle size={16} />
                    Something went wrong while saving. Please try again.
                  </div>
                )}
                {result === 'success' && (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                    <CheckCircle2 size={16} />
                    Record created successfully.
                  </div>
                )}
                <FormRenderer
                  schema={resolveFormSchema(form)}
                  fields={form.fields}
                  formId={form.id}
                  onSubmit={handleSubmit}
                  submitting={createRecord.isPending}
                  submitLabel="Save"
                />
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  )
}
