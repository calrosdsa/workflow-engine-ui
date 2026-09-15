import {
  createRouter,
  createRootRoute,
  createRoute,
  redirect,
  lazyRouteComponent,
  Outlet,
} from '@tanstack/react-router'
import { AppShell } from '@/components/layout/AppShell'
import { NotFoundPage } from '@/features/runtime/NotFoundPage'
import { Spinner } from '@/components/ui/spinner'
import { LoginPage } from '@/features/auth/LoginPage'
import { AcceptInvitePage } from '@/features/auth/AcceptInvitePage'
import { requireSession } from '@/features/auth/requireSession'
import { qualifiesForBuilder, isSuperAdmin } from '@/features/auth/access'
import { runtimeUrlFor } from '@/features/runtime/urls'
import { useAuthStore } from '@/stores/auth'

// Route-level code splitting. Every screen below this line used to be a
// static top-level import, so ANY route — including the small Forms list
// page — pulled in every other screen's dependencies too: React Flow (the
// Workflow Builder canvas), dnd-kit + the 25-type field registry (the Form
// Builder), and the Univer spreadsheet engine (the Report Builder, ~80
// per-language hyphenation-pattern chunks). A production build showed a
// single ~6.6MB (1.8MB gzip) entry chunk before this change. `lazyRouteComponent`
// gives each route its own chunk, fetched only when that route is visited;
// the router's own Suspense boundary (via `defaultPendingComponent` below)
// covers the fetch. Keep this file's post-login-critical surfaces (AppShell,
// login/invite screens, NotFoundPage) as ordinary eager imports above.
const HomePage = lazyRouteComponent(() =>
  import('@/pages/HomePage').then((m) => ({ default: m.HomePage })),
)
const MarketplaceBrowsePage = lazyRouteComponent(() =>
  import('@/pages/marketplace/MarketplaceBrowsePage').then((m) => ({ default: m.MarketplaceBrowsePage })),
)
const DashboardPage = lazyRouteComponent(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const WorkflowsPage = lazyRouteComponent(() =>
  import('@/pages/WorkflowsPage').then((m) => ({ default: m.WorkflowsPage })),
)
const WorkflowBuilderPage = lazyRouteComponent(() =>
  import('@/pages/workflows/WorkflowBuilderPage').then((m) => ({ default: m.WorkflowBuilderPage })),
)
const ExecutionsPage = lazyRouteComponent(() =>
  import('@/pages/ExecutionsPage').then((m) => ({ default: m.ExecutionsPage })),
)
const ExecutionDetailPage = lazyRouteComponent(() =>
  import('@/pages/ExecutionDetailPage').then((m) => ({ default: m.ExecutionDetailPage })),
)
const EvaluationDatasetPage = lazyRouteComponent(() =>
  import('@/pages/workflows/EvaluationDatasetPage').then((m) => ({ default: m.EvaluationDatasetPage })),
)
const FormsPage = lazyRouteComponent(() =>
  import('@/pages/FormsPage').then((m) => ({ default: m.FormsPage })),
)
const FormRecordsPage = lazyRouteComponent(() =>
  import('@/pages/FormRecordsPage').then((m) => ({ default: m.FormRecordsPage })),
)
const FormBuilderPage = lazyRouteComponent(() =>
  import('@/pages/forms/FormBuilderPage').then((m) => ({ default: m.FormBuilderPage })),
)
const ApplicationDesignShell = lazyRouteComponent(() =>
  import('@/pages/applications/ApplicationDesignShell').then((m) => ({ default: m.ApplicationDesignShell })),
)
const AppDesignPage = lazyRouteComponent(() =>
  import('@/pages/applications/AppDesignPage').then((m) => ({ default: m.AppDesignPage })),
)
const AppConfigurationPage = lazyRouteComponent(() =>
  import('@/pages/applications/AppConfigurationPage').then((m) => ({ default: m.AppConfigurationPage })),
)
const AgentsSection = lazyRouteComponent(() =>
  import('@/pages/applications/sections/AgentsSection').then((m) => ({ default: m.AgentsSection })),
)
const DashboardEditorPage = lazyRouteComponent(() =>
  import('@/pages/applications/DashboardEditorPage').then((m) => ({ default: m.DashboardEditorPage })),
)
const ReportBuilderPage = lazyRouteComponent(() =>
  import('@/pages/applications/ReportBuilderPage').then((m) => ({ default: m.ReportBuilderPage })),
)
const TeamPage = lazyRouteComponent(() =>
  import('@/pages/team/TeamPage').then((m) => ({ default: m.TeamPage })),
)
const ModelProvidersPage = lazyRouteComponent(() =>
  import('@/pages/ModelProvidersPage').then((m) => ({ default: m.ModelProvidersPage })),
)
const KnowledgeBasesPage = lazyRouteComponent(() =>
  import('@/pages/KnowledgeBasesPage').then((m) => ({ default: m.KnowledgeBasesPage })),
)
const KnowledgeBaseDetailPage = lazyRouteComponent(() =>
  import('@/pages/knowledge/KnowledgeBaseDetailPage').then((m) => ({ default: m.KnowledgeBaseDetailPage })),
)
const KnowledgeDocumentDetailPage = lazyRouteComponent(() =>
  import('@/pages/knowledge/KnowledgeDocumentDetailPage').then((m) => ({ default: m.KnowledgeDocumentDetailPage })),
)
const FormRendererHarness = lazyRouteComponent(() =>
  import('@/pages/dev/FormRendererHarness').then((m) => ({ default: m.FormRendererHarness })),
)
const PageBuilderHarness = lazyRouteComponent(() =>
  import('@/pages/dev/PageBuilderHarness').then((m) => ({ default: m.PageBuilderHarness })),
)
const DashboardBuilderHarness = lazyRouteComponent(() =>
  import('@/pages/dev/DashboardBuilderHarness').then((m) => ({ default: m.DashboardBuilderHarness })),
)
const RuntimePortalPage = lazyRouteComponent(() =>
  import('@/pages/portal/RuntimePortalPage').then((m) => ({ default: m.RuntimePortalPage })),
)
const TestLayout = lazyRouteComponent(() =>
  import('./pages/test/Test').then((m) => ({ default: m.default })),
)

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

// Global: Model Providers (client-wide credentials + models — see
// features/model-providers). No beforeLoad permission gate, unlike teamRoute
// above: a providers:read-only user should still see the page (a read-only
// view), matching every other resource page's convention of gating writes
// in-page via usePermission rather than redirecting the whole route.
const modelProvidersRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/model-providers',
  component: ModelProvidersPage,
})

// Global: App Marketplace browse. Like modelProvidersRoute (and unlike
// teamRoute) there's no beforeLoad gate — the page is useful read-only to
// anyone, and install is gated in-page via usePermission('marketplace:install'),
// matching this codebase's convention of gating writes in-page rather than
// redirecting the whole route. The backend gates it independently either way.
const marketplaceRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/marketplace',
  component: MarketplaceBrowsePage,
})

// ---------------------------------------------------------------------------
// App-scoped design shell — /applications/$appId/{workflows,forms,design,configuration}
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

// Entering an app lands on App Design. Dashboard used to be this index
// page, but it was taken out of the nav bar, which left the app's own
// entry point on a screen nothing could navigate back to.
const applicationIndexRoute = createRoute({
  getParentRoute: () => applicationShellRoute,
  path: '/',
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/applications/$appId/design',
      params: { appId: (params as { appId: string }).appId },
      replace: true,
    })
  },
})

// Dashboard content (workflow/execution/form counts) is inherently per-app
// stats. Moved off the index path above to an explicit one so it stays
// reachable while it isn't a nav destination — deliberately kept, not
// deleted. `replace: true` on the redirect matters here: without it, Back
// from App Design would return to the index and immediately redirect
// forward again, trapping the user.
const applicationDashboardRoute = createRoute({
  getParentRoute: () => applicationShellRoute,
  path: '/dashboard',
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

const appEvaluationDatasetRoute = createRoute({
  getParentRoute: () => applicationShellRoute,
  path: '/workflows/$workflowId/evaluations/$datasetId',
  component: EvaluationDatasetPage,
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
  // `seed` names a form staged by the JSON specification import (see
  // form-builder/store.ts). It carries only a token, never the spec itself —
  // the schema is far too big for a URL, and a token that outlives its
  // staged entry (a reload, a bookmarked link) simply resolves to nothing
  // and yields the ordinary blank builder.
  validateSearch: (search: Record<string, unknown>): { parentFormId?: string; seed?: string } => ({
    parentFormId: typeof search.parentFormId === 'string' ? search.parentFormId : undefined,
    seed: typeof search.seed === 'string' ? search.seed : undefined,
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

// App Design (design surfaces) — `tab` is a search param (not just local
// state) so a deep link can land directly on a specific tab, e.g. the
// dashboard editor's "back" button returning to the Menus tab specifically
// rather than always resetting to Theme.
//
// The union below narrowed when General/Reports/Version History/Environment
// Link/Marketplace moved to /configuration, and again when Agents was
// promoted to its own top-level route. An old link carrying one of those
// values now validates to `undefined` and lands on Theme rather than
// erroring — the same thing any unrecognised value has always done here.
const DESIGN_TABS = ['theme', 'menus', 'mobile', 'localization'] as const
type DesignTabParam = (typeof DESIGN_TABS)[number]

const appDesignRoute = createRoute({
  getParentRoute: () => applicationShellRoute,
  path: '/design',
  validateSearch: (search: Record<string, unknown>): { tab?: DesignTabParam } => ({
    tab: DESIGN_TABS.includes(search.tab as DesignTabParam) ? (search.tab as DesignTabParam) : undefined,
  }),
  component: () => <AppDesignPage appId={applicationShellRoute.useParams().appId} />,
})

// App Configuration — how the app is set up, released and distributed.
const CONFIG_TABS = ['general', 'settings', 'reports', 'versions', 'environment', 'marketplace'] as const
type ConfigTabParam = (typeof CONFIG_TABS)[number]

const appConfigurationRoute = createRoute({
  getParentRoute: () => applicationShellRoute,
  path: '/configuration',
  validateSearch: (search: Record<string, unknown>): { tab?: ConfigTabParam } => ({
    tab: CONFIG_TABS.includes(search.tab as ConfigTabParam) ? (search.tab as ConfigTabParam) : undefined,
  }),
  component: () => <AppConfigurationPage appId={applicationShellRoute.useParams().appId} />,
})

// Agents — promoted out of App Design's tab bar to a top-level destination.
// A plain route with no tabs of its own; the shell's Outlet already
// provides the scroll container the tab bar used to.
const appAgentsRoute = createRoute({
  getParentRoute: () => applicationShellRoute,
  path: '/agents',
  component: () => <AgentsSection appId={applicationShellRoute.useParams().appId} />,
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

// Full-screen report builder — /applications/$appId/design/reports/$reportId
// (3.3 §J, FR-J1-001). Sibling of dashboardEditorRoute above, but NOT
// menu-backed — a report is its own first-class resource
// (report_definitions), not a Menu subtype, so this takes $reportId rather
// than $menuId.
const reportBuilderRoute = createRoute({
  getParentRoute: () => applicationShellRoute,
  path: '/design/reports/$reportId',
  component: () => {
    const { appId, reportId } = reportBuilderRoute.useParams()
    return <ReportBuilderPage appId={appId} reportId={reportId} />
  },
})

// Settings (Credentials + Variables) is now the "settings" tab of App
// Configuration. This route is kept as a redirect rather than deleted: it
// was a real, linkable destination in the app's nav until now, so a
// bookmark or an open tab pointing at it should land on the same content
// instead of a 404.
const appSettingsRoute = createRoute({
  getParentRoute: () => applicationShellRoute,
  path: '/settings',
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/applications/$appId/configuration',
      params: { appId: (params as { appId: string }).appId },
      search: { tab: 'settings' as const },
      replace: true,
    })
  },
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

const appKnowledgeDocumentDetailRoute = createRoute({
  getParentRoute: () => applicationShellRoute,
  path: '/knowledge-bases/$kbId/documents/$docId',
  component: KnowledgeDocumentDetailPage,
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
    modelProvidersRoute,
    marketplaceRoute,
    applicationShellRoute.addChildren([
      applicationIndexRoute,
      applicationDashboardRoute,
      appWorkflowsRoute,
      appWorkflowNewRoute,
      appWorkflowDetailRoute,
      appEvaluationDatasetRoute,
      appExecutionsRoute,
      appExecutionDetailRoute,
      appFormsRoute,
      appFormNewRoute,
      appFormDetailRoute,
      appFormRecordsRoute,
      appDesignRoute,
      appConfigurationRoute,
      appAgentsRoute,
      dashboardEditorRoute,
      reportBuilderRoute,
      appSettingsRoute,
      appKnowledgeBasesRoute,
      appKnowledgeBaseDetailRoute,
      appKnowledgeDocumentDetailRoute,
    ]),
    formRendererHarnessRoute,
    pageBuilderHarnessRoute,
    testRoute,
  ]),
])

// The builder had neither a catch-all route nor a notFoundComponent, so any
// unmatched builder URL (a stale bookmark, a deleted app's id, a mistyped
// path) rendered the same bare <p>Not Found</p> the runtime did. Reuses the
// runtime's NotFoundPage — it is styled entirely with the shared
// --background/--foreground/--muted-foreground CSS vars, which the builder
// defines too — with builder-appropriate copy, since NotFoundPage's default
// message talks about publishing and nothing here is publishable.
export const router = createRouter({
  routeTree,
  // Shown while a lazyRouteComponent's chunk is in flight. defaultPendingMs
  // delays it briefly so an already-cached/fast chunk swap never flashes a
  // spinner — matching this codebase's existing `isLoading` spinner pattern
  // (see e.g. FormsPage) rather than a bare blank screen.
  defaultPendingComponent: () => (
    <div className="flex h-64 items-center justify-center">
      <Spinner />
    </div>
  ),
  defaultPendingMs: 150,
  defaultNotFoundComponent: () => (
    <NotFoundPage message="This page doesn't exist. It may have been deleted, or the link may be out of date." />
  ),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
