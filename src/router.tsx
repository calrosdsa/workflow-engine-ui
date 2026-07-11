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
import { FormRendererHarness } from '@/pages/dev/FormRendererHarness'
import { PageBuilderHarness } from '@/pages/dev/PageBuilderHarness'
import { LoginPage } from '@/features/auth/LoginPage'
import { AcceptInvitePage } from '@/features/auth/AcceptInvitePage'
import { authApi } from '@/features/auth/api'
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
    try {
      const me = await authApi.me()
      useAuthStore.getState().setSession(me)
    } catch {
      throw redirect({ to: '/login' })
    }
  },
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
