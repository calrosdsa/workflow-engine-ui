import { useState } from 'react'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { Menu as MenuIcon, X } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { ClientSwitcher } from './ClientSwitcher'
import { useAuthStore } from '@/stores/auth'
import { ProfileMenu } from '@/features/runtime/ProfileMenu'
import { useTranslation } from '@/features/i18n/I18nProvider'

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const session = useAuthStore((s) => s.session)
  const navigate = useNavigate()
  const t = useTranslation()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isAppDesignShell = pathname.startsWith('/applications/')

  if (isAppDesignShell) {
    return <Outlet />
  }

  return (
    // The w-60 sidebar had no responsive collapse or mobile toggle at all —
    // unlike RuntimeSidebar's sibling hidden md:block + slide-over pattern
    // (RuntimeAppShell.tsx), used everywhere in the runtime bundle. Mirrors
    // that exact pattern here: fixed on desktop, a dismissible overlay
    // triggered by a mobile-only header below `md`.
    <div className="flex h-screen overflow-hidden bg-[hsl(var(--background))]">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
            {/* Backdrop click-to-close is a supplementary pointer gesture,
               not the keyboard path — same convention as a Radix/Headless
               UI dialog overlay. The real keyboard equivalent (Escape) isn't
               wired for this mobile slide-over yet; today a keyboard user
               closes it via the same toggle button that opened it. Making
               this full-viewport div a fake button/tabIndex stop would
               insert a giant, purposeless tab stop ahead of the sidebar's
               real nav links, which is worse than leaving it out of the
               tab order entirely. */}
            {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
          <div
            className="absolute inset-0 bg-black/40 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative animate-in slide-in-from-left duration-200 ease-out motion-reduce:animate-none">
            <Sidebar onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMobileNavOpen((o) => !o)}
              aria-label={mobileNavOpen ? t('common.close_navigation') : t('common.open_navigation')}
              aria-expanded={mobileNavOpen}
              className="-ml-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] md:hidden"
            >
              {mobileNavOpen ? <X size={18} /> : <MenuIcon size={18} />}
            </button>
            <ClientSwitcher />
          </div>
          {session && (
            <ProfileMenu session={session} onOpenAccountSecurity={() => navigate({ to: '/account/security' })} />
          )}
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
