import { Link } from '@tanstack/react-router'
import { Workflow, Play, FileText, LayoutDashboard, LayoutGrid, Users2, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePermission } from '@/features/auth/permissions'

// requiresDesign: gates design tools (Workflow/Form builders, Applications'
// Menu Config + App Settings) behind application:design — matches the
// user's explicit design-tool list. Dashboard, Executions (monitoring/
// triggering, not building), and Team (its own independent users:write/
// roles:write gates, deliberately NOT tied to application:design — see
// features/auth/access.ts) stay ungated here.
const navItems = [
  { to: '/',             label: 'Dashboard',    icon: LayoutDashboard, requiresDesign: false },
  { to: '/workflows',    label: 'Workflows',    icon: Workflow,        requiresDesign: true },
  { to: '/executions',   label: 'Executions',   icon: Play,            requiresDesign: false },
  { to: '/forms',        label: 'Forms',        icon: FileText,        requiresDesign: true },
  { to: '/knowledge-bases', label: 'Knowledge Bases', icon: BookOpen,  requiresDesign: true },
  { to: '/applications', label: 'Applications', icon: LayoutGrid,      requiresDesign: true },
  { to: '/team',         label: 'Team',         icon: Users2,          requiresDesign: false },
]

export function Sidebar() {
  const canDesign = usePermission('application:design')

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-gray-900 text-white">
      <div className="flex h-14 items-center border-b border-gray-700 px-4">
        <span className="text-sm font-semibold tracking-wide uppercase text-gray-300">
          Workflow Engine
        </span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems
          .filter(({ requiresDesign }) => !requiresDesign || canDesign)
          .map(({ to, label, icon: Icon }) => (
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
      </nav>
      <div className="border-t border-gray-700 p-3">
        <p className="text-xs text-gray-500">v0.1.0</p>
      </div>
    </aside>
  )
}
