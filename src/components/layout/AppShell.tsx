import { Outlet, useRouterState } from '@tanstack/react-router'
import { Sidebar } from './Sidebar'
import { ClientSwitcher } from './ClientSwitcher'
import { useAuthStore } from '@/stores/auth'
import { ProfileMenu } from '@/features/runtime/ProfileMenu'

// /applications/$appId/* (the app-scoped design shell) renders its own
// full-screen chrome — header with Dashboard/Workflows/Forms/App
// Design/Settings nav, its own back-to-Home arrow — so it must NOT also sit
// inside AppShell's global Sidebar/header. Those are for the global chrome
// only (Home, Knowledge Bases, Team): showing them alongside the design
// shell's own nav would let a user editing one app jump to Team or another
// app's global-scoped pages mid-edit, and duplicates the "back to Home"
// affordance ApplicationDesignShell already has. shellRoute stays the
// parent (not a route-tree split) so the design shell keeps its
// requireSession gate without duplicating it.
export function AppShell() {
  const session = useAuthStore((s) => s.session)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isAppDesignShell = pathname.startsWith('/applications/')

  if (isAppDesignShell) {
    return <Outlet />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-white px-4">
          <ClientSwitcher />
          {session && <ProfileMenu session={session} />}
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
