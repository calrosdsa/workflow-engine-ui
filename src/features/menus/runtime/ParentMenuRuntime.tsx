import { FolderTree, Search as SearchIcon, PlusSquare, LayoutTemplate, LayoutDashboard, Code2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { buildMenuTree } from '../tree'
import type { Menu, MenuType } from '../types'

interface ParentMenuRuntimeProps {
  menu: Menu
  clientId: string
  appId: string
  /** The full menu list for this app (from the published snapshot) — needed
   *  to resolve this Parent menu's immediate children. Passed down by
   *  RuntimeAppShell (Phase 6), not fetched here, since the shell already
   *  holds the one snapshot the whole runtime session hangs off of. */
  menus?: Menu[]
  onNavigate?: (slug: string) => void
}

// Mirrors MENU_TYPE_REGISTRY[type].icon, which is the source of truth for a
// menu type's icon everywhere else (see menu-icons.ts). Duplicated rather than
// imported because menu-registry.ts imports THIS module as the `parent` type's
// runtimeRenderer — reading the registry from here would close that loop.
//
// The exhaustive Record<MenuType, …> is what keeps the copy honest: adding a
// menu type fails this file to compile until its icon is listed, which is
// exactly how the missing `html` entry surfaced. Keep each icon identical to
// the registry's own, or a type's icon changes depending on where it's drawn.
const TYPE_ICONS: Record<MenuType, LucideIcon> = {
  search: SearchIcon,
  add: PlusSquare,
  parent: FolderTree,
  custom: LayoutTemplate,
  dashboard: LayoutDashboard,
  html: Code2,
}

// A Parent menu has no content of its own — landing directly on its URL
// (rather than a child) shows a "choose a section" grid instead of a dead
// page, so linking/bookmarking a Parent menu directly still has a purpose.
export function ParentMenuRuntime({ menu, menus = [], onNavigate }: ParentMenuRuntimeProps) {
  const tree = buildMenuTree(menus)
  const node = findNode(tree, menu.id)
  const children = node?.children ?? []

  if (children.length === 0) {
    return <div className="p-6 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>"{menu.name}" has no sections yet.</div>
  }

  return (
    <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
      {children.map((child) => {
        const Icon = TYPE_ICONS[child.menu_type]
        return (
          <button
            key={child.id}
            onClick={() => onNavigate?.(child.slug)}
            className="flex items-center gap-3 rounded-lg border p-4 text-left shadow-sm transition-shadow hover:shadow-md"
            style={{ borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>
              <Icon size={18} />
            </div>
            <span className="min-w-0 truncate text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>{child.name}</span>
          </button>
        )
      })}
    </div>
  )
}

function findNode<T extends { id: string; children: T[] }>(nodes: T[], id: string): T | undefined {
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findNode(n.children, id)
    if (found) return found
  }
  return undefined
}
