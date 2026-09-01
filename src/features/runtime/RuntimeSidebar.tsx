import { useState } from 'react'
import { ChevronDown, HelpCircle } from 'lucide-react'
import { getMenuType } from '@/features/menus/menu-registry'
import { MenuIcon } from '@/features/menus/MenuIcon'
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
  // MenuIcon (below) resolves the author's chosen icon — a catalog glyph or
  // an uploaded image — and falls back to this type icon for an unset icon,
  // an unknown name, or an upload it can't load.
  //
  // Accessor, not a direct index: an unregistered menu_type must still render
  // its nav row (an icon is decoration — see MenuIcon), so the type icon simply
  // falls back to a neutral glyph rather than throwing. See FR-D1-008.
  const entry = getMenuType(node.menu_type)
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
          <MenuIcon icon={node.icon} fallback={entry?.icon ?? HelpCircle} size={14} />
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
