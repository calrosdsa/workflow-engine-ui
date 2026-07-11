import { createContext, useContext } from 'react'
import {
  createRouter,
  createRootRoute,
  createRoute,
  notFound,
  Outlet,
} from '@tanstack/react-router'
import { z } from 'zod'
import { authApi } from '@/features/auth/api'
import { useAuthStore } from '@/stores/auth'
import { runtimeApi } from '@/features/runtime/api'
import { RuntimeAppShell } from '@/features/runtime/RuntimeAppShell'
import { RuntimeRecordPage } from '@/features/runtime/RuntimeRecordPage'
import { RuntimeLoginPage } from '@/features/runtime/RuntimeLoginPage'
import { NotFoundPage } from '@/features/runtime/NotFoundPage'
import type { AppSnapshot } from '@/features/runtime/types'
import type { SearchMenuConfig } from '@/features/menus/types'

// A SEPARATE route tree from the builder's router.tsx — not addChildren'd
// onto its rootRoute. The runtime is publicly reachable by end users of a
// published app; joining the builder's authenticated router tree would ship
// the entire admin bundle (form-builder canvas, dnd-kit, CodeMirror,
// workflow builder, ~500KB+ gzipped) to anonymous visitors and mixes a
// public surface into an admin-tool's routing. See runtime-main.tsx /
// vite.config.ts for the second Vite entry (runtime.html) this tree is
// mounted under.
//
// NOTE: this file deliberately does NOT declare module '@tanstack/react-
// router' { interface Register { router: ... } } — router.tsx (the
// builder's tree) already does, and TS interface-declaration merging
// requires identical types across a single compiled program (both files
// live under the same src/ tree and share one tsconfig). A second,
// conflicting Register.router declaration would be a real type error.
//
// A consequence: the STANDALONE useLoaderData()/useParams() hooks (imported
// from '@tanstack/react-router' with no `from`) are typed generically
// against the GLOBAL registered router (defaulting to RegisteredRouter), so
// calling those on a route that isn't part of that global tree resolves to
// `never`. Each ROUTE OBJECT's own bound methods do NOT have this problem,
// though: route.useLoaderData<TId>()/route.useParams<TId>() are
// parameterized by that route's own TId, not RegisteredRouter — confirmed
// by reading @tanstack/react-router's route.d.ts (UseLoaderDataRoute<TId>/
// UseParamsRoute<TId>). So every runtime component below uses
// `someRoute.useParams()` / `runtimeAppRoute.useLoaderData()` (bound to the
// specific route object created in this file), never the standalone hooks.
//
// The loader's snapshot data specifically still needs RuntimeSnapshotContext
// on top of runtimeAppRoute.useLoaderData() — not because of a typing issue,
// but so DESCENDANT routes (runtimeMenuRoute, runtimeIndexRoute) can read
// the PARENT route's already-loaded data without a redundant second fetch;
// TanStack Router doesn't provide a "read an ancestor route's loader data"
// hook, only "read THIS route's own loader data".
const RuntimeSnapshotContext = createContext<AppSnapshot | null>(null)

function useRuntimeSnapshotContext(): AppSnapshot {
  const ctx = useContext(RuntimeSnapshotContext)
  if (!ctx) throw new Error('useRuntimeSnapshotContext must be used within the runtime app route')
  return ctx
}

const runtimeRootRoute = createRootRoute({ component: () => <Outlet /> })

// Per the selective-gating decision: this route's beforeLoad calls
// authApi.me() the SAME way the builder's shellRoute does, to populate
// useAuthStore for any menu that needs permission checks — but, unlike
// shellRoute, does NOT redirect-if-no-session. An anonymous visitor can
// browse public menus (no required_permission); RuntimeAppShell's
// PermissionDeniedPage is the gate for menus that need an account.
//
// The published snapshot is loaded ONCE here (not per-menu-route) since
// it's the single fetch the whole runtime session hangs off of — child
// routes read it via RuntimeSnapshotContext, never re-fetching.
const runtimeAppRoute = createRoute({
  getParentRoute: () => runtimeRootRoute,
  path: '/$clientId/$appId',
  beforeLoad: async () => {
    try {
      const me = await authApi.me()
      useAuthStore.getState().setSession(me)
    } catch {
      // No session — proceed anonymously.
    }
  },
  loader: async ({ params }) => {
    try {
      return await runtimeApi.getPublishedSnapshot(params.clientId, params.appId)
    } catch {
      // 404 (never published) or any other failure — treat uniformly as
      // "there's nothing here" rather than leaking a raw error state.
      throw notFound()
    }
  },
  component: RuntimeAppRouteComponent,
})

function RuntimeAppRouteComponent() {
  // Inferred locally from THIS route's own `loader` return type above —
  // correct without needing the global Register.
  const snapshot = runtimeAppRoute.useLoaderData()
  return (
    <RuntimeSnapshotContext.Provider value={snapshot}>
      <Outlet />
    </RuntimeSnapshotContext.Provider>
  )
}

const runtimeLoginRoute = createRoute({
  getParentRoute: () => runtimeAppRoute,
  path: '/login',
  validateSearch: z.object({ returnTo: z.string().optional() }),
  component: RuntimeLoginPage,
})

function RuntimeIndexRedirect() {
  const snapshot = useRuntimeSnapshotContext()
  const { clientId, appId } = runtimeAppRoute.useParams()
  const defaultSlug = (snapshot.app.settings.default_menu_slug as string | undefined)
    ?? [...snapshot.menus].sort((a, b) => a.sort_order - b.sort_order)[0]?.slug

  if (!defaultSlug) {
    return <NotFoundPage message="This application has no menus configured yet." />
  }

  // Client-side redirect (not throw redirect() in a loader) — the target
  // slug depends on data the parent route already loaded (settings /
  // first-menu fallback), so redirecting from inside the loader would need
  // a second fetch; doing it here reuses the already-loaded snapshot.
  if (typeof window !== 'undefined') {
    window.location.replace(`/${clientId}/${appId}/${defaultSlug}`)
  }
  return null
}

// Landing on /$clientId/$appId with no menuSlug — redirects to the app's
// configured default_menu_slug (General Settings' "Default menu slug"), or
// the first menu in sort_order if none is set.
const runtimeIndexRoute = createRoute({
  getParentRoute: () => runtimeAppRoute,
  path: '/',
  component: RuntimeIndexRedirect,
})

function RuntimeMenuRoute() {
  const snapshot = useRuntimeSnapshotContext()
  const { clientId, appId } = runtimeAppRoute.useParams()
  const { menuSlug } = runtimeMenuRoute.useParams()

  const currentMenu = snapshot.menus.find((m) => m.slug === menuSlug)
  if (!currentMenu) {
    return <NotFoundPage />
  }

  return <RuntimeAppShell snapshot={snapshot} clientId={clientId} appId={appId} currentMenu={currentMenu} />
}

// /login is declared BEFORE /$menuSlug (more-specific-before-less-specific,
// matching router.tsx's own ordering convention) so a literal "login" path
// segment never gets swallowed as a menu slug.
const runtimeMenuRoute = createRoute({
  getParentRoute: () => runtimeAppRoute,
  path: '/$menuSlug',
  component: RuntimeMenuRoute,
})

// "Expand to full page" from a Search menu's record-detail drawer — reuses
// the same snapshot/menu resolution as the drawer, rendering RecordDetailPanel
// full-page instead of in a Drawer. A thin sibling to RuntimeAppShell (rather
// than a mode flag on it) so RuntimeAppShell's existing menu-driven contract
// (always render the current menu's registered runtimeRenderer) stays
// untouched.
function RuntimeRecordRoute() {
  const snapshot = useRuntimeSnapshotContext()
  const { clientId, appId } = runtimeAppRoute.useParams()
  const { menuSlug, recordId } = runtimeRecordRoute.useParams()

  const currentMenu = snapshot.menus.find((m) => m.slug === menuSlug)
  if (!currentMenu || currentMenu.menu_type !== 'search') {
    return <NotFoundPage />
  }
  const formId = (currentMenu.config as SearchMenuConfig).form_id

  return (
    <RuntimeRecordPage
      snapshot={snapshot}
      clientId={clientId}
      appId={appId}
      currentMenu={currentMenu}
      formId={formId}
      recordId={recordId}
    />
  )
}

const runtimeRecordRoute = createRoute({
  getParentRoute: () => runtimeMenuRoute,
  path: '/$recordId',
  component: RuntimeRecordRoute,
})

const runtimeCatchAllRoute = createRoute({
  getParentRoute: () => runtimeRootRoute,
  path: '$',
  component: () => <NotFoundPage />,
})

const runtimeRouteTree = runtimeRootRoute.addChildren([
  runtimeAppRoute.addChildren([
    runtimeLoginRoute,
    runtimeIndexRoute,
    runtimeMenuRoute.addChildren([runtimeRecordRoute]),
  ]),
  runtimeCatchAllRoute,
])

export const runtimeRouter = createRouter({ routeTree: runtimeRouteTree })
