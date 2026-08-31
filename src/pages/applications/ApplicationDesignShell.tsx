import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ArrowLeft, LayoutDashboard, Workflow, FileText, Palette, KeyRound, Rocket, Save, Loader2, AlertCircle, ListTree, Eye, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useApplication, useApplicationVersions, usePublishApplication, useSaveVersion } from '@/features/applications/hooks'
import { useEnvironmentLinkStatus } from '@/features/environment/hooks'
import { usePermission } from '@/features/auth/permissions'
import { runtimeUrlFor } from '@/features/runtime/urls'
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
  const { data: versions } = useApplicationVersions()
  const { data: envStatus } = useEnvironmentLinkStatus()
  const isLockedProduction = envStatus?.linked && envStatus.role === 'production'
  const publishMutation = usePublishApplication()
  const saveVersionMutation = useSaveVersion()
  const canPublish = usePermission('application:publish')
  const canWrite = usePermission('application:write')
  // Everyone who reached this shell at all already holds application:design
  // (it's the same permission that gates the runtime's "Edit Design" link
  // INTO here — see RuntimeAppShell.tsx's canDesign check), but check it
  // explicitly anyway rather than reusing canWrite, since it's the exact
  // permission the backend's GET /application/draft-snapshot route is
  // actually gated on.
  const canPreviewDraft = usePermission('application:design')
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const hideShellChrome = isWorkflowEditRoute(pathname, appId) || isFormEditRoute(pathname, appId)

  const [publishIssues, setPublishIssues] = useState<ValidationIssue[] | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>
  if (!app) return null

  if (hideShellChrome) return <Outlet />

  // Newest version's major_version is the current highest — versions come
  // back newest-first (see VersionStore.List's own ORDER BY). 0 means this
  // app has never had any version at all yet, so the first publish is v1.
  const currentMajor = versions?.[0]?.major_version ?? 0

  const handlePublish = async (requestedVersion?: number) => {
    setPublishIssues(null)
    setPublishError(null)
    try {
      await publishMutation.mutateAsync(requestedVersion != null ? { version: requestedVersion } : undefined)
      setPublishDialogOpen(false)
      window.open(`/${app.client_id}/${app.id}`, '_blank', 'noopener,noreferrer')
    } catch (e) {
      const { issues, message } = await extractPublishError(e)
      if (issues) setPublishIssues(issues)
      else setPublishError(message ?? 'Publishing failed. Please try again.')
    }
  }

  // Quick checkpoint with no label/description — the full Save Version
  // dialog (with label/description fields) lives in the Version History
  // tab; this header button is the low-friction, frequent path, matching
  // git's "commit with no message" default.
  const handleQuickSaveVersion = async () => {
    try {
      const result = await saveVersionMutation.mutateAsync({})
      toast.success(`Checkpoint v${result.major_version}.${result.minor_version} saved`)
    } catch (e) {
      toast.error('Could not save version', { description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <div className="flex h-screen flex-col">
      {/* This header carries the shell chrome for every app screen (Dashboard,
       *  Workflows, Forms, App Design, Settings), not just App Design — the
       *  audit that flagged this measured 776px of un-shrinkable content
       *  (mostly the 5-item text-label nav at 503px, plus the right-side
       *  actions at 189px) forced into a 375px header with no wrap or shrink
       *  anywhere, so the overflow escaped onto the whole page as horizontal
       *  scroll and pushed Settings/Launch off-screen. Fix: nav labels and
       *  the app name collapse to icon-only below `sm`, freeing enough width
       *  that all 5 destinations plus the Live badge and Launch button fit
       *  without any of them needing an overflow menu. */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-white px-2 sm:gap-3 sm:px-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/' })} title="Back to Home">
          <ArrowLeft size={16} />
        </Button>
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <ListTree size={14} />
          </div>
          <span className="hidden max-w-[160px] truncate text-sm font-semibold text-slate-800 sm:inline" title={app.name}>{app.name}</span>
        </div>

        <nav className="flex items-center gap-0.5 sm:ml-2 sm:gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => {
            const target = to.replace('$appId', appId)
            const active = exact ? pathname === target : pathname.startsWith(target)
            return (
              <button
                key={to}
                onClick={() => navigate({ to, params: { appId } })}
                title={label}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-1.5 rounded-md p-2 text-sm font-medium transition-colors sm:px-3 sm:py-1.5',
                  active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50',
                )}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            )
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {app.published_version != null && (
            <span className="hidden shrink-0 whitespace-nowrap rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-600 sm:inline-block">
              Live v{versions?.find((v) => v.version_number === app.published_version)?.major_version ?? currentMajor}.0
            </span>
          )}
          {canPreviewDraft && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => window.open(`${runtimeUrlFor(app.client_id, app.id)}?preview=draft`, '_blank', 'noopener,noreferrer')}
              title="Preview Draft — see your unpublished changes live, without publishing"
              className="h-8 w-8 shrink-0"
            >
              <Eye size={14} />
            </Button>
          )}
          {canWrite && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleQuickSaveVersion}
              disabled={saveVersionMutation.isPending}
              title="Save Version — a deliberate checkpoint, doesn't publish"
              className="gap-1.5 px-2"
            >
              {saveVersionMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {/* One breakpoint later than every other header label (lg, not
               *  sm) — this button is the newest addition to an already
               *  fully-budgeted header (see this header's own doc comment:
               *  776px of content with zero slack at sm+), so its own label
               *  is the one that gives way first under medium widths rather
               *  than reintroducing the horizontal-overflow bug that
               *  comment describes fixing. */}
              <span className="hidden lg:inline">Save Version</span>
            </Button>
          )}
          {canPublish && (
            <Button
              size="sm"
              onClick={() => setPublishDialogOpen(true)}
              disabled={publishMutation.isPending}
              title="Launch Application"
              className="gap-1.5 bg-indigo-600 px-2 text-white hover:bg-indigo-700"
            >
              {publishMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
              {/* Moved from sm to lg alongside Save Version's own label —
               *  see that button's comment: adding a second header action
               *  used up this header's last slack at sm+, so both labels
               *  now collapse together rather than one staying full-text
               *  while the other goes icon-only. */}
              <span className="hidden lg:inline">Launch Application</span>
            </Button>
          )}
        </div>
      </header>

      {isLockedProduction && (
        <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/10 px-4 py-2 text-[12px] font-medium text-[hsl(var(--warning))]">
          <span className="flex items-center gap-2">
            <Lock size={14} className="shrink-0" />
            This app is a linked Production environment — design-time edits are disabled. Make changes in its linked Sandbox and Promote them across.
          </span>
          <Button
            variant="ghost" size="sm" className="h-6 shrink-0 gap-1 px-2 text-[11px] text-[hsl(var(--warning))] hover:bg-[hsl(var(--warning))]/10"
            onClick={() => navigate({ to: '/applications/$appId/design', params: { appId }, search: { tab: 'environment' } })}
          >
            View Environment Link
          </Button>
        </div>
      )}

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

      <PublishDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        currentMajor={currentMajor}
        onPublish={handlePublish}
        isPending={publishMutation.isPending}
      />
    </div>
  )
}

function PublishDialog({
  open, onOpenChange, currentMajor, onPublish, isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentMajor: number
  onPublish: (requestedVersion?: number) => void
  isPending: boolean
}) {
  const suggestedNext = currentMajor + 1
  const [versionText, setVersionText] = useState('')

  // Reset the field to the freshly-suggested default each time the dialog
  // opens, rather than remembering whatever was typed the last time it was
  // closed without publishing.
  const handleOpenChange = (next: boolean) => {
    if (next) setVersionText('')
    onOpenChange(next)
  }

  const parsed = versionText.trim() === '' ? null : Number(versionText)
  const isValid = parsed === null || (Number.isInteger(parsed) && parsed > currentMajor)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-sm">
        <DialogHeader>
          <DialogTitle>Launch Application</DialogTitle>
          <DialogDescription>
            {currentMajor > 0
              ? `Currently live: v${currentMajor}.0. Publishing starts a new major version.`
              : 'This will be the first published version of this app.'}
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-2">
          <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
            Version number (optional)
          </label>
          <Input
            value={versionText}
            onChange={(e) => setVersionText(e.target.value)}
            placeholder={`${suggestedNext} (default)`}
            inputMode="numeric"
            className="font-mono"
          />
          {!isValid && (
            <p className="mt-1 flex items-center gap-1.5 text-[12px] text-[hsl(var(--destructive))]">
              <AlertCircle size={12} /> Must be a whole number greater than {currentMajor}.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
          <Button
            size="sm"
            className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700"
            onClick={() => onPublish(parsed ?? undefined)}
            disabled={!isValid || isPending}
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}
            Launch v{parsed ?? suggestedNext}.0
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
