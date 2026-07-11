import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { MENU_TYPE_REGISTRY } from '@/features/menus/menu-registry'
import { RuntimeLink } from './RuntimeLink'
import { cn } from '@/lib/utils'
import type { MenuTreeNode } from '@/features/menus/types'

interface RuntimeSidebarProps {
  appName: string
  navTree: MenuTreeNode[]
  clientId: string
  appId: string
  activeMenuId: string
  onNavigate?: () => void
}

export function RuntimeSidebar({ appName, navTree, clientId, appId, activeMenuId, onNavigate }: RuntimeSidebarProps) {
  return (
    <aside className="flex h-screen w-60 flex-col border-r" style={{ borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}>
      <div className="flex h-14 items-center border-b px-4" style={{ borderColor: 'hsl(var(--border))' }}>
        <span className="truncate text-sm font-semibold" style={{ color: 'hsl(var(--card-foreground))' }}>{appName}</span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {navTree.map((node) => (
          <NavItem key={node.id} node={node} clientId={clientId} appId={appId} activeMenuId={activeMenuId} onNavigate={onNavigate} depth={0} />
        ))}
        {navTree.length === 0 && (
          <p className="px-2 py-4 text-center text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Nothing to show yet.</p>
        )}
      </nav>
    </aside>
  )
}

function NavItem({ node, clientId, appId, activeMenuId, onNavigate, depth }: {
  node: MenuTreeNode
  clientId: string
  appId: string
  activeMenuId: string
  onNavigate?: () => void
  depth: number
}) {
  const entry = MENU_TYPE_REGISTRY[node.menu_type]
  const Icon = entry.icon
  const hasChildren = node.children.length > 0
  const collapsedDefault = node.menu_type === 'parent' && (node.config as { collapsed_by_default?: boolean }).collapsed_by_default
  const [open, setOpen] = useState(!collapsedDefault)
  const isActive = node.id === activeMenuId

  return (
    <div>
      <div className="flex items-center" style={{ paddingLeft: depth * 12 }}>
        {hasChildren && (
          <button onClick={() => setOpen((o) => !o)} className="shrink-0 p-1 opacity-60 hover:opacity-100" aria-label="Toggle section">
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        )}
        <RuntimeLink
          to={`/${clientId}/${appId}/${node.slug}`}
          onClick={onNavigate}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors',
            !hasChildren && 'ml-5',
          )}
          style={isActive ? { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' } : { color: 'hsl(var(--card-foreground))' }}
        >
          <Icon size={14} className="shrink-0" />
          <span className="truncate">{node.name}</span>
        </RuntimeLink>
      </div>
      {hasChildren && open && (
        <div>
          {node.children.map((child) => (
            <NavItem key={child.id} node={child} clientId={clientId} appId={appId} activeMenuId={activeMenuId} onNavigate={onNavigate} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
