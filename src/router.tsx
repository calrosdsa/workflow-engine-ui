import {
  createRouter,
  createRootRoute,
  createRoute,
  redirect,
  Outlet,
} from '@tanstack/react-router'
import { AppShell } from '@/components/layout/AppShell'
import { HomePage } from '@/pages/HomePage'
import { DashboardPage } from '@/pages/DashboardPage'
import { WorkflowsPage } from '@/pages/WorkflowsPage'
import { WorkflowBuilderPage } from '@/pages/workflows/WorkflowBuilderPage'
import { ExecutionsPage } from '@/pages/ExecutionsPage'
import { ExecutionDetailPage } from '@/pages/ExecutionDetailPage'
import { FormsPage } from '@/pages/FormsPage'
import { FormRecordsPage } from '@/pages/FormRecordsPage'
import { FormBuilderPage } from '@/pages/forms/FormBuilderPage'
import { ApplicationDesignShell } from '@/pages/applications/ApplicationDesignShell'
import { AppDesignPage } from '@/pages/applications/AppDesignPage'
import { DashboardEditorPage } from '@/pages/applications/DashboardEditorPage'
import { GlobalSettingsSection } from '@/pages/applications/sections/GlobalSettingsSection'
import { TeamPage } from '@/pages/team/TeamPage'
import { KnowledgeBasesPage } from '@/pages/KnowledgeBasesPage'
import { KnowledgeBaseDetailPage } from '@/pages/knowledge/KnowledgeBaseDetailPage'
import { FormRendererHarness } from '@/pages/dev/FormRendererHarness'
import { PageBuilderHarness } from '@/pages/dev/PageBuilderHarness'
import { DashboardBuilderHarness } from '@/pages/dev/DashboardBuilderHarness'
import { LoginPage } from '@/features/auth/LoginPage'
import { AcceptInvitePage } from '@/features/auth/AcceptInvitePage'
import { requireSession } from '@/features/auth/requireSession'
import { qualifiesForBuilder, isSuperAdmin } from '@/features/auth/access'
import { RuntimePortalPage } from '@/pages/portal/RuntimePortalPage'
import { runtimeUrlFor } from '@/features/runtime/urls'
import { useAuthStore } from '@/stores/auth'
import TestLayout from './pages/test/Test'

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
const rootRoute = createRootRoute({ component: () => <Outlet /> })

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

// Must work with zero session — the invited person has no account yet —
// so this is a sibling of loginRoute under rootRoute, not nested inside
// shellRoute (which requires a valid /auth/me before rendering anything).
const acceptInviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/accept-invite',
  component: AcceptInvitePage,
})

// Unlike a bearer-token check, the Limen session lives in an HttpOnly cookie
// (unreadable from JS by design), so the only source of truth for "is there
// a valid session" is the server — beforeLoad supports async, so this fits
// the router's existing lifecycle without new infrastructure.
const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'shell',
  component: AppShell,
  beforeLoad: async () => {
    const me = await requireSession()
    // Not every authenticated user belongs in the App Builder — a Runtime
    // User (no application:design, no team-admin permissions) is bounced to
    // the Runtime Portal instead. This covers both the post-login landing
    // decision AND direct navigation to any builder URL, since beforeLoad
    // runs on every navigation into the shell, not just the first one.
    if (!qualifiesForBuilder(me)) {
      throw redirect({ to: '/portal' })
    }
  },
})

// Sibling of shellRoute, not nested inside it — the Portal replaces the
// builder's chrome entirely rather than living within AppShell's sidebar
// layout, and Runtime Users who land here should never even briefly qualify
// for (or flash) the builder shell.
const portalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/portal',
  beforeLoad: async () => {
    const me = await requireSession()
    // Single-app users skip the picker entirely — redirect straight into
    // that app's runtime.html bundle before RuntimePortalPage ever mounts,
    // so there's no picker-UI flash. This is a full page navigation across
    // Vite bundles (runtimeUrlFor), not a router.navigate — TanStack Router
    // has no primitive for "redirect outside this route tree," so the
    // never-resolving promise below halts this beforeLoad while the browser
    // navigation (already in flight) takes over.
    const appMemberships = (me.memberships ?? []).filter((m) => m.app_id)
    if (appMemberships.length === 1) {
      window.location.replace(runtimeUrlFor(appMemberships[0].client_id, appMemberships[0].app_id!))
      await new Promise(() => {})
    }
  },
  component: RuntimePortalPage,
})

// ---------------------------------------------------------------------------
// Home (lists the active client's apps — replaces the old
// ApplicationsListPage/RuntimePortalPage duplication for builder-qualified
// users specifically; portalRoute above remains the landing page for users
// who don't qualify for the builder shell at all)
// ---------------------------------------------------------------------------
const homeRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/',
  component: HomePage,
})

// ---------------------------------------------------------------------------
// Global: Team (client-wide users + per-app roles) — reached from global
// chrome, not nested under any app. Super-Admin-only: a non-super-admin
// landing here directly (bookmark, stale link) is bounced to Home rather
// than rendering a page whose every underlying API call now 403s (the
// backend's RequireSuperAdmin gate — see api/handler.go — matches this).
// ---------------------------------------------------------------------------
const teamRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/team',
  beforeLoad: async () => {
    const me = await requireSession()
    if (!isSuperAdmin(me)) {
      throw redirect({ to: '/' })
    }
  },
  component: TeamPage,
})

// ---------------------------------------------------------------------------
// App-scoped design shell — /applications/$appId/{workflows,forms,design,settings}
// ---------------------------------------------------------------------------
const applicationShellRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/applications/$appId',
  beforeLoad: async ({ params }) => {
    const me = await requireSession()
    const membership = (me.memberships ?? []).find((m) => m.app_id === params.appId)
    if (!membership) {
      // No access to this app — bounce to Home rather than rendering a
      // half-scoped shell.
      throw redirect({ to: '/' })
    }
    // Sync activeMembership to the URL's $appId — this is what keeps every
    // existing Workflows/Forms/etc. query correctly scoped, since lib/api.ts
    // derives X-Client-ID/X-App-ID from activeMembership alone, not from
    // this route's params. Runs on every navigation into the shell
    // (including a bookmark/refresh landing directly on e.g.
    // /applications/$appId/forms), not just the first Home->card click.
    const current = useAuthStore.getState().activeMembership
    if (current?.client_id !== membership.client_id || current?.app_id !== membership.app_id) {
      useAuthStore.getState().setActiveMembership(membership)
    }
  },
  component: () => {
    const appId = applicationShellRoute.useParams().appId
    return <ApplicationDesignShell appId={appId} />
  },
})

// Dashboard content (workflow/execution/form counts) is inherently per-app
// stats, so it lands here as the design shell's index page rather than at
// the global '/' (which Home now owns).
const applicationIndexRoute = createRoute({
  getParentRoute: () => applicationShellRoute,
  path: '/',
  component: DashboardPage,
})

const appWorkflowsRoute = createRoute({
  getParentRoute: () => applicationShellRoute,
  path: '/workflows',
  component: WorkflowsPage,
})

// /workflows/new — must be declared BEFORE /workflows/$workflowId
const appWorkflowNewRoute = createRoute({
  getParentRoute: () => applicationShellRoute,
  path: '/workflows/new',
  component: () => <WorkflowBuilderPage mode="new" />,
})

const appWorkflowDetailRoute = createRoute({
  getParentRoute: () => applicationShellRoute,
  path: '/workflows/$workflowId',
  component: () => <WorkflowBuilderPage mode="edit" />,
})

const appExecutionsRoute = createRoute({
  getParentRoute: () => applicationShellRoute,
  path: '/executions',
  component: ExecutionsPage,
})

const appExecutionDetailRoute = createRoute({
  getParentRoute: () => applicationShellRoute,
  path: '/executions/$executionId',
  component: ExecutionDetailPage,
})

const appFormsRoute = createRoute({
  getParentRoute: () => applicationShellRoute,
  path: '/forms',
  component: FormsPage,
})

const appFormNewRoute = createRoute({
  getParentRoute: () => applicationShellRoute,
  path: '/forms/new',
  validateSearch: (search: Record<string, unknown>): { parentFormId?: string } => ({
    parentFormId: typeof search.parentFormId === 'string' ? search.parentFormId : undefined,
  }),
  component: () => <FormBuilderPage mode="new" />,
})

// /forms/$formId/records must be declared before /forms/$formId so the more
// specific path wins.
const appFormRecordsRoute = createRoute({
  getParentRoute: () => applicationShellRoute,
  path: '/forms/$formId/records',
  component: FormRecordsPage,
})

const appFormDetailRoute = createRoute({
  getParentRoute: () => applicationShellRoute,
  path: '/forms/$formId',
  component: () => <FormBuilderPage mode="edit" />,
})

// App Design (Theme + Menus) — `tab` is a search param (not just local
// state) so a deep link can land directly on a specific tab, e.g. the
// dashboard editor's "back" button returning to the Menus tab specifically
// rather than always resetting to Theme.
const appDesignRoute = createRoute({
  getParentRoute: () => applicationShellRoute,
  path: '/design',
  validateSearch: (search: Record<string, unknown>): { tab?: 'theme' | 'menus' | 'mobile' | 'general' | 'agents' | 'versions' } => ({
    tab: search.tab === 'theme' || search.tab === 'menus' || search.tab === 'mobile' || search.tab === 'general' || search.tab === 'agents' || search.tab === 'versions' ? search.tab : undefined,
  }),
  component: () => <AppDesignPage appId={applicationShellRoute.useParams().appId} />,
})

// Full-screen dashboard editor — /applications/$appId/design/dashboards/$menuId
const dashboardEditorRoute = createRoute({
  getParentRoute: () => applicationShellRoute,
  path: '/design/dashboards/$menuId',
  component: () => {
    const { appId, menuId } = dashboardEditorRoute.useParams()
    return <DashboardEditorPage appId={appId} menuId={menuId} />
  },
})

// Settings (Credentials + Variables)
const appSettingsRoute = createRoute({
  getParentRoute: () => applicationShellRoute,
  path: '/settings',
  component: GlobalSettingsSection,
})

// FR-C9-002: Knowledge Bases move from a global, client-wide route to a
// per-app nested one, matching Workflows/Forms above — a KB now always
// belongs to exactly one owning app, so its screens belong under that
// app's own URL space, not the left GLOBAL sidebar.
const appKnowledgeBasesRoute = createRoute({
  getParentRoute: () => applicationShellRoute,
  path: '/knowledge-bases',
  component: KnowledgeBasesPage,
})

const appKnowledgeBaseDetailRoute = createRoute({
  getParentRoute: () => applicationShellRoute,
  path: '/knowledge-bases/$kbId',
  component: KnowledgeBaseDetailPage,
})

// ---------------------------------------------------------------------------
// Dev-only verification harnesses (not linked from any nav)
// ---------------------------------------------------------------------------
const formRendererHarnessRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/dev/form-renderer',
  component: FormRendererHarness,
})

const pageBuilderHarnessRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/dev/page-builder',
  component: PageBuilderHarness,
})

// A sibling of loginRoute/acceptInviteRoute under rootRoute (not nested
// inside shellRoute) — this harness mounts no menu/backend data, only a
// registry + zustand store, so it has no use for (and shouldn't require) a
// real Limen session the way the rest of shellRoute's routes do.
const dashboardBuilderHarnessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dev/dashboard-builder',
  component: DashboardBuilderHarness,
})

//Test
const testRoute = createRoute({
  getParentRoute: () => shellRoute,
    path: '/test/$workflowId',

  component: () => <TestLayout mode="edit" />,
})

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const routeTree = rootRoute.addChildren([
  loginRoute,
  acceptInviteRoute,
  dashboardBuilderHarnessRoute,
  portalRoute,
  shellRoute.addChildren([
    homeRoute,
    teamRoute,
    applicationShellRoute.addChildren([
      applicationIndexRoute,
      appWorkflowsRoute,
      appWorkflowNewRoute,
      appWorkflowDetailRoute,
      appExecutionsRoute,
      appExecutionDetailRoute,
      appFormsRoute,
      appFormNewRoute,
      appFormDetailRoute,
      appFormRecordsRoute,
      appDesignRoute,
      dashboardEditorRoute,
      appSettingsRoute,
      appKnowledgeBasesRoute,
      appKnowledgeBaseDetailRoute,
    ]),
    formRendererHarnessRoute,
    pageBuilderHarnessRoute,
    testRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
