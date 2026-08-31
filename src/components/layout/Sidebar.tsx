import { Link } from '@tanstack/react-router'
import { LayoutGrid, Users2, Cpu, Store } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { isSuperAdmin } from '@/features/auth/access'

// Global chrome only — Workflows/Forms/Executions moved into the app-scoped
// design shell (ApplicationDesignShell) since they only make sense inside a
// specific app now. Knowledge Bases moved the same way under FR-C9-002 (a KB
// always belongs to exactly one owning app now, so its screens live under
// /applications/$appId/knowledge-bases, not here). What's left here is
// genuinely global: Home (the app list), Model Providers (client-wide
// credentials/models — see the Model Providers screen's own FR), and
// Team/User Management (client-wide, Super-Admin-only — see
// features/auth/access.ts's isSuperAdmin and teamRoute's beforeLoad).
const navItems = [
  { to: '/',                label: 'Home',            icon: LayoutGrid },
]

const globalNavItems = [
  { to: '/model-providers', label: 'Model Providers', icon: Cpu },
  // Marketplace is genuinely global like the two above — it lists apps
  // published by OTHER clients, so it can't live inside any one app's
  // design shell. Ungated here (no permission check): browsing is
  // harmless, and the page itself only shows listings the backend already
  // decided this account may see.
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
    <aside className="flex h-screen w-60 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <div className="flex h-14 items-center border-b border-[hsl(var(--border))] px-4">
        <span className="text-sm font-semibold tracking-wide uppercase text-[hsl(var(--muted-foreground))]">
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
              'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
              '[&.active]:bg-[hsl(var(--muted))] [&.active]:text-[hsl(var(--foreground))]',
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}

        <div className="my-2 border-t border-[hsl(var(--border))] pt-2">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Global</p>
          {globalNavItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
                '[&.active]:bg-[hsl(var(--primary))] [&.active]:text-[hsl(var(--primary-foreground))]',
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
                'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
                '[&.active]:bg-[hsl(var(--primary))] [&.active]:text-[hsl(var(--primary-foreground))]',
              )}
            >
              <Users2 size={16} />
              Team
            </Link>
          )}
        </div>
      </nav>
      <div className="border-t border-[hsl(var(--border))] p-3">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">v0.1.0</p>
      </div>
    </aside>
  )
}
