import { Link } from '@tanstack/react-router'
import { LayoutGrid, Users2, BookOpen } from 'lucide-react'
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
]

export function Sidebar() {
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
