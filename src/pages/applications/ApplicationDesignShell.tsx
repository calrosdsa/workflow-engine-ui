import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { ArrowLeft, LayoutDashboard, Workflow, FileText, Palette, KeyRound, Rocket, Loader2, AlertCircle, ListTree } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { useApplication, usePublishApplication } from '@/features/applications/hooks'
import { usePermission } from '@/features/auth/permissions'
import { useState } from 'react'
import type { ValidationIssue } from '@/features/applications/types'

// The app-scoped design shell — replaces the old ApplicationBuilderPage's
// bespoke header+useState tab bar with real nested routes
// (/applications/$appId/{workflows,forms,design,settings}), so each section
// is deep-linkable and the URL reflects what you're editing. Workflows/Forms/
// etc. keep reading "current app" from activeMembership (set by this route's
// parent beforeLoad in router.tsx) rather than being threaded an explicit
// appId prop — see the plan's A3 minimal-risk recommendation.
const NAV_ITEMS = [
  { to: '/applications/$appId', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/applications/$appId/workflows', label: 'Workflows', icon: Workflow, exact: false },
  { to: '/applications/$appId/forms', label: 'Forms', icon: FileText, exact: false },
  { to: '/applications/$appId/design', label: 'App Design', icon: Palette, exact: false },
  { to: '/applications/$appId/settings', label: 'Settings', icon: KeyRound, exact: false },
] as const

// The Workflow Builder (/applications/$appId/workflows/$workflowId) owns its
// own fixed header and manages the full viewport height itself — stacking
// this shell's header above it doubles the chrome and breaks its h-screen
// layout math. Match on the segment rather than a full path so both the
// "new" and "edit" workflow routes are covered.
function isWorkflowEditRoute(pathname: string, appId: string): boolean {
  const escapedAppId = appId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^/applications/${escapedAppId}/workflows/[^/]+/?$`).test(pathname)
}
  // path: '/forms/$formId',
function isFormEditRoute(pathname: string, appId: string): boolean {
  const escapedAppId = appId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^/applications/${escapedAppId}/forms/[^/]+/?$`).test(pathname)
}

export function ApplicationDesignShell({ appId }: { appId: string }) {
  const navigate = useNavigate()
  const { data: app, isLoading } = useApplication()
  const publishMutation = usePublishApplication()
  const canPublish = usePermission('application:publish')
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const hideShellChrome = isWorkflowEditRoute(pathname, appId) || isFormEditRoute(pathname, appId)

  const [publishIssues, setPublishIssues] = useState<ValidationIssue[] | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>
  if (!app) return null

  if (hideShellChrome) return <Outlet />

  const handlePublish = async () => {
    setPublishIssues(null)
    setPublishError(null)
    try {
      await publishMutation.mutateAsync()
      window.open(`/${app.client_id}/${app.id}`, '_blank', 'noopener,noreferrer')
    } catch (e) {
      const { issues, message } = await extractPublishError(e)
      if (issues) setPublishIssues(issues)
      else setPublishError(message ?? 'Publishing failed. Please try again.')
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-white px-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/' })} title="Back to Home">
          <ArrowLeft size={16} />
        </Button>
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <ListTree size={14} />
          </div>
          <span className="max-w-[160px] truncate text-sm font-semibold text-slate-800" title={app.name}>{app.name}</span>
        </div>

        <nav className="ml-4 flex items-center gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => {
            const target = to.replace('$appId', appId)
            const active = exact ? pathname === target : pathname.startsWith(target)
            return (
              <button
                key={to}
                onClick={() => navigate({ to, params: { appId } })}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50',
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {app.published_version != null && (
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-600">
              Live v{app.published_version}
            </span>
          )}
          {canPublish && (
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={publishMutation.isPending}
              className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {publishMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
              Launch Application
            </Button>
          )}
        </div>
      </header>

      {publishIssues && publishIssues.length > 0 && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
          <div className="mb-1 flex items-center gap-2 font-medium">
            <AlertCircle size={14} className="shrink-0" />
            Application cannot be published — fix these issues first:
          </div>
          <ul className="ml-6 list-disc space-y-0.5">
            {publishIssues.map((issue, i) => (
              <li key={i}><span className="font-mono text-[11px] text-red-500">{issue.path}</span> — {issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      {publishError && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-3 text-[12px] font-medium text-red-700">
          <AlertCircle size={14} className="shrink-0" />
          {publishError}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}

async function extractPublishError(e: unknown): Promise<{ issues: ValidationIssue[] | null; message: string | null }> {
  const err = e as { response?: Response; message?: string }
  if (!err.response) return { issues: null, message: err.message ?? null }
  try {
    const body = await err.response.json() as { issues?: ValidationIssue[]; error?: string }
    if (body.issues && body.issues.length > 0) return { issues: body.issues, message: null }
    return { issues: null, message: body.error ?? null }
  } catch {
    return { issues: null, message: err.message ?? null }
  }
}
