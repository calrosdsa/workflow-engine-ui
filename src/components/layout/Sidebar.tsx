import { Link } from '@tanstack/react-router'
import { LayoutGrid, Users2, BookOpen, Store } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { isSuperAdmin } from '@/features/auth/access'

// Global chrome only — Workflows/Forms/Executions moved into the app-scoped
// design shell (ApplicationDesignShell) since they only make sense inside a
// specific app now. What's left here is genuinely global: Home (the app
// list), Knowledge Bases (client-wide, see B in the restructure plan), and
// Team/User Management (client-wide, Super-Admin-only — see
// features/auth/access.ts's isSuperAdmin and teamRoute's beforeLoad).
const navItems = [
  { to: '/',                label: 'Home',            icon: LayoutGrid },
]

const globalNavItems = [
  { to: '/knowledge-bases', label: 'Knowledge Bases', icon: BookOpen },
  // Marketplace is genuinely global like the entries above — it lists apps
  // published by OTHER clients, so it can't live inside any one app's
  // design shell. Ungated here (no permission check): browsing is
  // harmless, and the page only shows listings the backend already decided
  // this account may see.
  { to: '/marketplace',     label: 'Marketplace',     icon: Store },
]

interface SidebarProps {
  /** Called after any nav Link is clicked — matches RuntimeSidebar's own
   *  convention, so the mobile slide-over version of this sidebar
   *  (AppShell.tsx) can close itself on navigation instead of staying open
   *  over the newly-navigated page. Undefined on desktop, where there's no
   *  overlay to close. */
  onNavigate?: () => void
}

export function Sidebar({ onNavigate }: SidebarProps = {}) {
  const session = useAuthStore((s) => s.session)
  const canSeeTeam = isSuperAdmin(session)

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-gray-900 text-white">
      <div className="flex h-14 items-center border-b border-gray-700 px-4">
        <span className="text-sm font-semibold tracking-wide uppercase text-gray-300">
          Workflow Engine
        </span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              'text-gray-300 hover:bg-gray-800 hover:text-white',
              '[&.active]:bg-blue-600 [&.active]:text-white',
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}

        <div className="my-2 border-t border-gray-700 pt-2">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Global</p>
          {globalNavItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'text-gray-300 hover:bg-gray-800 hover:text-white',
                '[&.active]:bg-blue-600 [&.active]:text-white',
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
          {canSeeTeam && (
            <Link
              to="/team"
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'text-gray-300 hover:bg-gray-800 hover:text-white',
                '[&.active]:bg-blue-600 [&.active]:text-white',
              )}
            >
              <Users2 size={16} />
              Team
            </Link>
          )}
        </div>
      </nav>
      <div className="border-t border-gray-700 p-3">
        <p className="text-xs text-gray-500">v0.1.0</p>
      </div>
    </aside>
  )
}
