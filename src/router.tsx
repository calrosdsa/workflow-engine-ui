import {
  createRouter,
  createRootRoute,
  createRoute,
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
import TestLayout from './pages/test/Test'

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
const rootRoute = createRootRoute({ component: () => <Outlet /> })

const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'shell',
  component: AppShell,
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
  component: () => (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900">New Form</h1>
      <p className="text-gray-500 mt-2">Form builder editor coming soon.</p>
    </div>
  ),
})

const formDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/forms/$formId',
  component: FormsPage,
})

const formRecordsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/forms/$formId/records',
  component: FormRecordsPage,
})

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const routeTree = rootRoute.addChildren([
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
    testRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
