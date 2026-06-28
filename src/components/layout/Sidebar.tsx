import { Link } from '@tanstack/react-router'
import { Workflow, Play, FileText, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/',            label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/workflows',   label: 'Workflows',  icon: Workflow },
  { to: '/executions',  label: 'Executions', icon: Play },
  { to: '/forms',       label: 'Forms',      icon: FileText },
]

export function Sidebar() {
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
      </nav>
      <div className="border-t border-gray-700 p-3">
        <p className="text-xs text-gray-500">v0.1.0</p>
      </div>
    </aside>
  )
}
