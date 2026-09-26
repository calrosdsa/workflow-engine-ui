import { useState } from 'react'
import { ChevronDown, HelpCircle, ArrowLeft } from 'lucide-react'
import { getMenuType } from '@/features/menus/menu-registry'
import { MenuIcon } from '@/features/menus/MenuIcon'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { RuntimeLink } from './RuntimeLink'
import { cn } from '@/lib/utils'
import type { MenuTreeNode } from '@/features/menus/types'
import type { ScopedRoot } from './nav'

interface RuntimeSidebarProps {
  appName: string
  navTree: MenuTreeNode[]
  /** Set once the app is in modules mode and a root ancestor was resolved
   *  for the current menu — renders a "back to home" header above navTree,
   *  and in that case navTree is scopedRoot's own children only, never the
   *  whole app's tree (see resolveSidebarNav in nav.ts). Absent/null for an
   *  app with no root-level module menus, which keeps today's single
   *  always-present full-tree sidebar with no header row, unconditionally. */
  scopedRoot?: ScopedRoot | null
  clientId: string
  appId: string
  activeMenuId: string
  onNavigate?: () => void
}

export function RuntimeSidebar({ appName, navTree, scopedRoot, clientId, appId, activeMenuId, onNavigate }: RuntimeSidebarProps) {
  const t = useTranslation()
  return (
    // The index of the app: it sits on the desk (--background) rather than on
    // a sheet, so the records and forms (--card) are the only raised things
    // on the page. The active entry is printed in the app's spot colour.
    <aside className="flex h-screen w-60 flex-col border-r border-[hsl(var(--ink)/0.14)] bg-[hsl(var(--background))]">
      <div className="flex h-14 shrink-0 items-center px-4">
        <span className="truncate text-[15px] font-bold tracking-[-0.01em] text-[hsl(var(--foreground))]">{appName}</span>
      </div>
      {scopedRoot && (
        // Always targets home, never scopedRoot's own landing route — the
        // literal, minimal meaning of "back to home." Clicking it a second
        // time to "come back" goes through the home grid again rather than
        // competing with this row for a second navigation target.
        <RuntimeLink
          to={`/${clientId}/${appId}`}
          onClick={onNavigate}
          aria-label={t('runtime.sidebar.back_to_home')}
          className="mx-3 mb-1 flex h-9 shrink-0 items-center gap-2 rounded-md px-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--ink))] transition-colors hover:bg-[hsl(var(--ink)/0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        >
          <ArrowLeft size={13} className="shrink-0" />
          <MenuIcon icon={scopedRoot.icon} fallback={getMenuType(scopedRoot.menu_type)?.icon ?? HelpCircle} size={13} />
          <span className="truncate">{scopedRoot.name}</span>
        </RuntimeLink>
      )}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {navTree.map((node) => (
          <NavItem key={node.id} node={node} clientId={clientId} appId={appId} activeMenuId={activeMenuId} onNavigate={onNavigate} depth={0} />
        ))}
        {navTree.length === 0 && (
          <div className="flex flex-col items-center gap-1 px-2 py-8 text-center">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('runtime.sidebar.empty')}</p>
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
  const collapsedDefault = (node.menu_type === 'parent' || node.menu_type === 'module') && (node.config as { collapsed_by_default?: boolean }).collapsed_by_default
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
            'relative flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-[13.5px] transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
            !hasChildren && 'ml-5',
            depth === 0 && hasChildren && 'font-semibold',
            isActive
              // A bar in the margin and the entry printed in the spot
              // colour: the active page reads without flooding the row.
              ? 'bg-[hsl(var(--ink)/0.08)] font-semibold text-[hsl(var(--ink))] before:absolute before:inset-y-1.5 before:-left-3 before:w-[3px] before:rounded-r-full before:bg-[hsl(var(--ink))]'
              : 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--ink)/0.05)]',
          )}
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
