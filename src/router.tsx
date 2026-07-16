import {
  createRouter,
  createRootRoute,
  createRoute,
  redirect,
  Outlet,
} from '@tanstack/react-router'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/pages/DashboardPage'
import { WorkflowsPage } from '@/pages/WorkflowsPage'
import { WorkflowBuilderPage } from '@/pages/workflows/WorkflowBuilderPage'
import { ExecutionsPage } from '@/pages/ExecutionsPage'
import { ExecutionDetailPage } from '@/pages/ExecutionDetailPage'
import { FormsPage } from '@/pages/FormsPage'
import { FormRecordsPage } from '@/pages/FormRecordsPage'
import { FormBuilderPage } from '@/pages/forms/FormBuilderPage'
import { ApplicationsListPage } from '@/pages/applications/ApplicationsListPage'
import { ApplicationBuilderPage } from '@/pages/applications/ApplicationBuilderPage'
import { TeamPage } from '@/pages/team/TeamPage'
import { KnowledgeBasesPage } from '@/pages/KnowledgeBasesPage'
import { KnowledgeBaseDetailPage } from '@/pages/knowledge/KnowledgeBaseDetailPage'
import { FormRendererHarness } from '@/pages/dev/FormRendererHarness'
import { PageBuilderHarness } from '@/pages/dev/PageBuilderHarness'
import { LoginPage } from '@/features/auth/LoginPage'
import { AcceptInvitePage } from '@/features/auth/AcceptInvitePage'
import { requireSession } from '@/features/auth/requireSession'
import { qualifiesForBuilder } from '@/features/auth/access'
import { RuntimePortalPage, runtimeUrlFor } from '@/pages/portal/RuntimePortalPage'
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
// Dashboard
// ---------------------------------------------------------------------------
const dashboardRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/',
  component: DashboardPage,
})

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------
const workflowsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/workflows',
  component: WorkflowsPage,
})

// /workflows/new — must be declared BEFORE /workflows/$workflowId
const workflowNewRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/workflows/new',
  component: () => <WorkflowBuilderPage mode="new" />,
})

const workflowDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/workflows/$workflowId',
  component: () => <WorkflowBuilderPage mode="edit" />,
})

// ---------------------------------------------------------------------------
// Executions
// ---------------------------------------------------------------------------
const executionsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/executions',
  component: ExecutionsPage,
})

const executionDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/executions/$executionId',
  component: ExecutionDetailPage,
})

//Test
const testRoute = createRoute({
  getParentRoute: () => shellRoute,
    path: '/test/$workflowId',
  
  component: () => <TestLayout mode="edit" />,
})

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------
const formsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/forms',
  component: FormsPage,
})

const formNewRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/forms/new',
  validateSearch: (search: Record<string, unknown>): { parentFormId?: string } => ({
    parentFormId: typeof search.parentFormId === 'string' ? search.parentFormId : undefined,
  }),
  component: () => <FormBuilderPage mode="new" />,
})

// /forms/$formId/records must be declared before /forms/$formId so the more
// specific path wins.
const formRecordsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/forms/$formId/records',
  component: FormRecordsPage,
})

const formDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/forms/$formId',
  component: () => <FormBuilderPage mode="edit" />,
})

// ---------------------------------------------------------------------------
// Applications (App Builder)
// ---------------------------------------------------------------------------
const applicationsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/applications',
  component: ApplicationsListPage,
})

const applicationBuilderRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/applications/$appId',
  component: ApplicationBuilderPage,
})

// ---------------------------------------------------------------------------
// Knowledge Bases (RAG)
// ---------------------------------------------------------------------------
const knowledgeBasesRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/knowledge-bases',
  component: KnowledgeBasesPage,
})

const knowledgeBaseDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/knowledge-bases/$kbId',
  component: KnowledgeBaseDetailPage,
})

// ---------------------------------------------------------------------------
// Team (client-wide users + per-app roles)
// ---------------------------------------------------------------------------
const teamRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/team',
  component: TeamPage,
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

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const routeTree = rootRoute.addChildren([
  loginRoute,
  acceptInviteRoute,
  portalRoute,
  shellRoute.addChildren([
    dashboardRoute,
    workflowsRoute,
    workflowNewRoute,
    workflowDetailRoute,
    executionsRoute,
    executionDetailRoute,
    formsRoute,
    formNewRoute,
    formDetailRoute,
    formRecordsRoute,
    applicationsRoute,
    applicationBuilderRoute,
    knowledgeBasesRoute,
    knowledgeBaseDetailRoute,
    teamRoute,
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
