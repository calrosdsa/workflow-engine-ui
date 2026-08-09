import { FolderTree, Search as SearchIcon, PlusSquare, LayoutTemplate, LayoutDashboard } from 'lucide-react'
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

const TYPE_ICONS: Record<MenuType, LucideIcon> = {
  search: SearchIcon,
  add: PlusSquare,
  parent: FolderTree,
  custom: LayoutTemplate,
  dashboard: LayoutDashboard,
}

// A Parent menu has no content of its own — landing directly on its URL
// (rather than a child) shows a "choose a section" grid instead of a dead
// page, so linking/bookmarking a Parent menu directly still has a purpose.
export function ParentMenuRuntime({ menu, menus = [], onNavigate }: ParentMenuRuntimeProps) {
  const tree = buildMenuTree(menus)
  const node = findNode(tree, menu.id)
  const children = node?.children ?? []

  if (children.length === 0) {
    return <div className="p-6 text-sm text-gray-400">"{menu.name}" has no sections yet.</div>
  }

  return (
    <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
      {children.map((child) => {
        const Icon = TYPE_ICONS[child.menu_type]
        return (
          <button
            key={child.id}
            onClick={() => onNavigate?.(child.slug)}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
              <Icon size={18} />
            </div>
            <span className="min-w-0 truncate text-sm font-medium text-gray-800">{child.name}</span>
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
