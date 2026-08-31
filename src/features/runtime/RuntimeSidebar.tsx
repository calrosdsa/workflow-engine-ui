import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { MENU_TYPE_REGISTRY } from '@/features/menus/menu-registry'
import { resolveMenuIcon } from '@/features/menus/menu-icons'
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
      <div className="flex h-14 shrink-0 items-center border-b px-4" style={{ borderColor: 'hsl(var(--border))' }}>
        <span className="truncate text-sm font-semibold" style={{ color: 'hsl(var(--card-foreground))' }}>{appName}</span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {navTree.map((node) => (
          <NavItem key={node.id} node={node} clientId={clientId} appId={appId} activeMenuId={activeMenuId} onNavigate={onNavigate} depth={0} />
        ))}
        {navTree.length === 0 && (
          <div className="flex flex-col items-center gap-1 px-2 py-8 text-center">
            <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Nothing to show yet.</p>
          </div>
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
  // The author's chosen icon (features/menus/menu-icons.ts) wins over the
  // menu type's own; an unset icon, or a name this build's catalog doesn't
  // carry, falls back to exactly what rendered before icons were settable.
  const Icon = resolveMenuIcon(node.icon) ?? entry.icon
  const hasChildren = node.children.length > 0
  const collapsedDefault = node.menu_type === 'parent' && (node.config as { collapsed_by_default?: boolean }).collapsed_by_default
  const [open, setOpen] = useState(!collapsedDefault)
  const isActive = node.id === activeMenuId

  return (
    <div>
      <div className="flex items-center" style={{ paddingLeft: depth * 12 }}>
        {hasChildren && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex shrink-0 items-center justify-center rounded p-1 opacity-60 transition-[opacity,background-color] hover:opacity-100 hover:bg-[hsl(var(--accent))] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] pointer-coarse:h-11 pointer-coarse:w-11"
            aria-label={open ? `Collapse ${node.name}` : `Expand ${node.name}`}
            aria-expanded={open}
          >
            <ChevronDown
              size={12}
              className="transition-transform duration-150 ease-out motion-reduce:transition-none"
              style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
            />
          </button>
        )}
        <RuntimeLink
          to={`/${clientId}/${appId}/${node.slug}`}
          onClick={onNavigate}
          aria-current={isActive ? 'page' : undefined}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
            !hasChildren && 'ml-5',
            !isActive && 'hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]',
          )}
          style={isActive ? { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' } : { color: 'hsl(var(--card-foreground))' }}
        >
          <Icon size={14} className="shrink-0" />
          <span className="truncate">{node.name}</span>
        </RuntimeLink>
      </div>
      {hasChildren && (
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
          style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            {node.children.map((child) => (
              <NavItem key={child.id} node={child} clientId={clientId} appId={appId} activeMenuId={activeMenuId} onNavigate={onNavigate} depth={depth + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
