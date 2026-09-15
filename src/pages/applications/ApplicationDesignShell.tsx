import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Bot, Workflow, FileText, Palette, SlidersHorizontal, Rocket, Loader2, AlertCircle, ListTree, Eye, LogOut, Sun, Moon, BookOpen, Lock, ChevronsUpDown, LayoutGrid, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useApplication, useApplicationVersions, usePublishApplication } from '@/features/applications/hooks'
import { useEnvironmentLinkStatus } from '@/features/environment/hooks'
import { usePermission, hasPermission } from '@/features/auth/permissions'
import { useLogout } from '@/features/auth/hooks'
import { useAuthStore } from '@/stores/auth'
import { useBuilderTheme } from '@/features/theme/useBuilderTheme'
import { runtimeUrlFor } from '@/features/runtime/urls'
import { useState } from 'react'
import type { ValidationIssue } from '@/features/applications/types'
import type { Membership } from '@/features/auth/types'
import { useI18n } from '@/features/i18n/I18nProvider'

// The app-scoped design shell — replaces the old ApplicationBuilderPage's
// bespoke header+useState tab bar with real nested routes
// (/applications/$appId/{workflows,forms,design,settings}), so each section
// is deep-linkable and the URL reflects what you're editing. Workflows/Forms/
// etc. keep reading "current app" from activeMembership (set by this route's
// parent beforeLoad in router.tsx) rather than being threaded an explicit
// appId prop — see the plan's A3 minimal-risk recommendation.
const NAV_ITEMS = [
  // Dashboard is deliberately absent from this bar, NOT removed: the route
  // and DashboardPage are untouched and /applications/$appId still renders
  // it — it just isn't a nav destination for now. Note this is still the
  // shell's index route, so entering an app from Home lands here even
  // though nothing in the bar points at it.
  { to: '/applications/$appId/workflows', labelKey: 'app_design.workflows', icon: Workflow, exact: false },
  { to: '/applications/$appId/forms', labelKey: 'app_design.forms', icon: FileText, exact: false },
  { to: '/applications/$appId/design', labelKey: 'app_design.design', icon: Palette, exact: false },
  // Promoted out of App Design's tab bar to a destination of its own.
  { to: '/applications/$appId/agents', labelKey: 'app_design.agents', icon: Bot, exact: false },
  // FR-C9-002: now a real per-app nested route — a KB always belongs to
  // exactly one owning app, so this is app-scoped like every other item
  // here, not a link out to a global page.
  { to: '/applications/$appId/knowledge-bases', labelKey: 'app_design.knowledge_base', icon: BookOpen, exact: false },
  // App Configuration absorbed the old Settings nav item (credentials +
  // variables are now its 'settings' tab) along with five tabs that used to
  // sit under App Design — see AppConfigurationPage.
  { to: '/applications/$appId/configuration', labelKey: 'app_design.configuration', icon: SlidersHorizontal, exact: false },
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

// A document inspection is a focused workspace: its source preview, chunks,
// and graph need the viewport the same way a canvas editor does. It keeps its
// own Back control, so suppressing this shell's global navigation does not
// remove the user's way back to the knowledge base.
function isKnowledgeDocumentDetailRoute(pathname: string, appId: string): boolean {
  const escapedAppId = appId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^/applications/${escapedAppId}/knowledge-bases/[^/]+/documents/[^/]+/?$`).test(pathname)
}

// The evaluation dataset editor is a focused, full-width workspace (row
// table, run history, results) in the same vein as the workflow/form
// editors above — its own "Back to workflow" link already covers returning,
// so this shell's global nav would only add a second, redundant navigation
// layer above it.
function isEvaluationDatasetRoute(pathname: string, appId: string): boolean {
  const escapedAppId = appId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^/applications/${escapedAppId}/workflows/[^/]+/evaluations/[^/]+/?$`).test(pathname)
}

export function ApplicationDesignShell({ appId }: { appId: string }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { data: app, isLoading } = useApplication()
  const { data: versions } = useApplicationVersions()
  const { data: envStatus } = useEnvironmentLinkStatus()
  const isLockedProduction = envStatus?.linked && envStatus.role === 'production'
  const publishMutation = usePublishApplication()
  const canPublish = usePermission('application:publish')
  // Everyone who reached this shell at all already holds application:design
  // (it's the same permission that gates the runtime's "Edit Design" link
  // INTO here — see RuntimeAppShell.tsx's canDesign check), but check it
  // explicitly because it is the exact
  // permission the backend's GET /application/draft-snapshot route is
  // actually gated on.
  const canPreviewDraft = usePermission('application:design')
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const hideShellChrome = isWorkflowEditRoute(pathname, appId)
    || isFormEditRoute(pathname, appId)
    || isKnowledgeDocumentDetailRoute(pathname, appId)
    || isEvaluationDatasetRoute(pathname, appId)

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
      else setPublishError(message ?? t('app_design.publish_failed'))
    }
  }

  return (
    <div className="flex h-screen flex-col">
      {/* This header carries the shell chrome for every app screen (Dashboard,
       *  Workflows, Forms, App Design, Agents, App Configuration), not just App Design — the
       *  audit that flagged this measured 776px of un-shrinkable content
       *  (mostly the 5-item text-label nav at 503px, plus the right-side
       *  actions at 189px) forced into a 375px header with no wrap or shrink
       *  anywhere, so the overflow escaped onto the whole page as horizontal
       *  scroll and pushed Settings/Launch off-screen. Fix: nav labels and
       *  the app name collapse to icon-only below `sm`, freeing enough width
       *  that all 5 destinations plus the Live badge and Launch button fit
       *  without any of them needing an overflow menu. */}
      <header className="grid h-20 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4">
        <div className="min-w-0">
          <AppSwitcher appId={appId} appName={app.name} appClientId={app.client_id} />
        </div>

        {/* Centered in the header via the grid's own [1fr_auto_1fr] track
         *  layout (an auto-width middle column, flanked by two equal
         *  flexible side columns) rather than ml-auto/absolute-centering —
         *  this keeps the nav visually centered on the FULL header width
         *  regardless of how wide the logo/app-name or the right-side
         *  actions happen to be, instead of centering only within the space
         *  left over after them. */}
        <nav className="relative flex items-center gap-0.5 justify-self-center sm:gap-1">
          {/* One shared floating pill, CSS-anchor-positioned against whichever
           *  item currently carries `nav-pill-anchor` below — see index.css's
           *  .nav-pill / .nav-pill-anchor doc comment (design.md § Motion). */}
          <div className="nav-pill" aria-hidden />
          {NAV_ITEMS.map(({ to, labelKey, icon: Icon, exact }) => {
            const target = to.replace('$appId', appId)
            const active = exact ? pathname === target : pathname.startsWith(target)
            const label = t(labelKey)
            return (
              <button
                key={to}
                onClick={() => navigate({ to, params: { appId } })}
                title={label}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative z-[1] flex items-center gap-1.5 rounded-full p-2 text-sm font-medium transition-colors sm:px-3 sm:py-1.5 lg:py-3',
                  active && 'nav-pill-anchor',
                  active ? 'text-[hsl(var(--background))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]',
                )}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            )
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 justify-self-end sm:gap-2">
          {canPreviewDraft && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => window.open(`${runtimeUrlFor(app.client_id, app.id)}?preview=draft`, '_blank', 'noopener,noreferrer')}
              title={t('app_design.preview_draft_hint')}
              className="h-8 w-8 shrink-0"
            >
              <Eye size={14} />
            </Button>
          )}
          {canPublish && (
            <Button
              size="sm"
              onClick={() => setPublishDialogOpen(true)}
              disabled={publishMutation.isPending}
              title={t('app_design.publish_application')}
              className="gap-1.5 px-2"
            >
              {publishMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
              {/* Moved from sm to lg alongside Save Version's own label —
               *  see that button's comment: adding a second header action
               *  used up this header's last slack at sm+, so both labels
               *  now collapse together rather than one staying full-text
               *  while the other goes icon-only. */}
              <span className="hidden lg:inline">{t('app_design.publish_application')}</span>
            </Button>
          )}
          <ThemeToggle />
          <AccountMenu />
        </div>
      </header>

      {isLockedProduction && (
        <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/10 px-4 py-2 text-[12px] font-medium text-[hsl(var(--warning))]">
          <span className="flex items-center gap-2">
            <Lock size={14} className="shrink-0" />
            {t('app_design.production_locked')}
          </span>
          <Button
            variant="ghost" size="sm" className="h-6 shrink-0 gap-1 px-2 text-[11px] text-[hsl(var(--warning))] hover:bg-[hsl(var(--warning))]/10"
            onClick={() => navigate({ to: '/applications/$appId/configuration', params: { appId }, search: { tab: 'environment' } })}
          >
            {t('app_design.view_environment')}
          </Button>
        </div>
      )}

      {publishIssues && publishIssues.length > 0 && (
        <div className="border-b border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 px-4 py-3 text-[12px] text-[hsl(var(--destructive))]">
          <div className="mb-1 flex items-center gap-2 font-medium">
            <AlertCircle size={14} className="shrink-0" />
            {t('app_design.cannot_publish')}
          </div>
          <ul className="ml-6 list-disc space-y-0.5">
            {publishIssues.map((issue, i) => (
              <li key={i}><span className="font-mono text-[11px] opacity-80">{issue.path}</span> — {issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      {publishError && (
        <div className="flex items-center gap-2 border-b border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 px-4 py-3 text-[12px] font-medium text-[hsl(var(--destructive))]">
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

// Header app icon+name, doubling as a dropdown: jump back to Home, or switch
// directly into another app's design shell without a Home detour. Listed
// apps are scoped to appClientId (the CURRENTLY OPEN app's client), not
// activeClientId from the store — a bookmarked/deep-linked $appId can belong
// to a different client than whatever Home last had active, and
// applicationShellRoute's beforeLoad only re-syncs activeMembership, not
// activeClientId, so activeClientId is not trustworthy here.
export function AppSwitcher({ appId, appName, appClientId }: { appId: string; appName: string; appClientId: string }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const session = useAuthStore((s) => s.session)
  const setActiveMembership = useAuthStore((s) => s.setActiveMembership)
  const t = useI18n().t

  // Only apps this member can actually design — this menu lands directly in
  // the design shell (unlike Home's AppCard, which also lists apps you can
  // only open at runtime).
  const appMemberships = (session?.memberships ?? []).filter(
    (m) => m.app_id && m.client_id === appClientId && hasPermission(m.permissions, 'application:design'),
  )

  const switchTo = (m: Membership) => {
    if (m.app_id === appId) return
    setActiveMembership(m)
    // Every application-scoped query key (applicationKeys in
    // features/applications/hooks.ts) is app-agnostic — it's the
    // activeMembership-derived X-App-ID header, not the key, that scopes the
    // request. This shell stays mounted across the switch (only the $appId
    // route param changes), so without invalidating, Workflows/Forms/etc.
    // would keep rendering the PREVIOUS app's cached data. Same
    // "invalidate everything" precedent as useRollback/useImportApp rather
    // than enumerating every affected key.
    qc.invalidateQueries()
    navigate({ to: '/applications/$appId', params: { appId: m.app_id! } })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          title={appName}
          aria-label={t('app_design.switch_application')}
          className="-ml-1.5 flex w-full min-w-0 items-center gap-1.5 rounded-md py-1 pl-1.5 pr-1 transition-colors hover:bg-[hsl(var(--muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
            <ListTree size={14} />
          </div>
          <span className="hidden max-w-[160px] truncate text-sm font-semibold text-[hsl(var(--foreground))] sm:inline">{appName}</span>
          <ChevronsUpDown size={12} className="hidden shrink-0 opacity-50 sm:inline" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuItem onSelect={() => navigate({ to: '/' })} className="gap-2">
          <LayoutGrid size={14} />
          {t('app_design.back_to_apps')}
        </DropdownMenuItem>
        {appMemberships.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              {t('app_design.switch_application')}
            </div>
            {appMemberships.map((m) => (
              <DropdownMenuItem key={m.app_id} onSelect={() => switchTo(m)} className="justify-between gap-2">
                <span className="truncate">{m.app_name || m.app_id}</span>
                {m.app_id === appId && <Check size={13} className="shrink-0" />}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Builder-shell light/dark switcher — see useBuilderTheme.ts. Icon shows the
// mode a click WOULD switch to (sun while dark, moon while light), matching
// the convention every other icon-toggle button in this codebase already
// uses for its title text (e.g. the theme-editor preview's own sun/moon/
// monitor trio in ThemeSection.tsx).
function ThemeToggle() {
  const { theme, toggle } = useBuilderTheme()
  const t = useI18n().t
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggle}
      title={theme === 'dark' ? t('app_design.switch_light') : t('app_design.switch_dark')}
      aria-label={theme === 'dark' ? t('app_design.switch_light') : t('app_design.switch_dark')}
      className="h-8 w-8 shrink-0"
    >
      {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
    </Button>
  )
}

// Account identity + logout — the "DU"-style circular avatar every screen
// implicitly needs, but which this codebase never actually built anywhere
// (no avatar_url/profile_picture concept exists in the data model — a
// circular initials badge is the only real option). Reads the same
// session the rest of the app already keys off (Sidebar.tsx, HomePage.tsx),
// so it stays correct across every membership/client switch without its
// own fetch. useLogout() is the existing, fully-wired mutation
// (features/auth/hooks.ts) — clears the store, redirects to /login — not a
// new one invented for this menu.
function AccountMenu() {
  const session = useAuthStore((s) => s.session)
  const logoutMutation = useLogout()
  const t = useI18n().t
  if (!session) return null

  const fullName = `${session.first_name ?? ''} ${session.last_name ?? ''}`.trim()
  const initials = (fullName || session.email).slice(0, 2).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          title={fullName || session.email}
          aria-label={t('profile.account_menu')}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[11px] font-semibold text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]"
        >
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[11px] font-semibold text-[hsl(var(--primary-foreground))]">
            {initials}
          </div>
          <div className="min-w-0">
            {fullName && <p className="truncate text-[13px] font-medium text-[hsl(var(--foreground))]">{fullName}</p>}
            <p className="truncate text-[12px] text-[hsl(var(--muted-foreground))]">{session.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          destructive
          disabled={logoutMutation.isPending}
          onSelect={() => logoutMutation.mutate()}
        >
          {logoutMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
          {t('profile.log_out')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
  const t = useI18n().t
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
          <DialogTitle>{t('app_design.launch_application')}</DialogTitle>
          <DialogDescription>
            {currentMajor > 0
              ? t('app_design.currently_live', { version: `${currentMajor}.0` })
              : t('app_design.first_publish')}
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-2">
          <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
            {t('app_design.publish_version')}
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
              <AlertCircle size={12} /> {t('app_design.version_invalid', { current: currentMajor })}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isPending}>{t('common.cancel')}</Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => onPublish(parsed ?? undefined)}
            disabled={!isValid || isPending}
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}
            {t('app_design.launch_version', { version: `${parsed ?? suggestedNext}.0` })}
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
