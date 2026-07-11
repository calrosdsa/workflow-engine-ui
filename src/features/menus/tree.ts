import type { Menu, MenuTreeNode } from './types'

/** Groups a flat menu list by parent_id and sorts siblings by sort_order.
 *  Written once, imported by both the builder's tree view and the runtime's
 *  nav-tree/breadcrumb generation (features/runtime/nav.ts). */
export function buildMenuTree(menus: Menu[]): MenuTreeNode[] {
  const byParent = new Map<string | null, Menu[]>()
  for (const m of menus) {
    // Go's `omitempty` on a nil *string omits the JSON key entirely rather
    // than sending `"parent_id": null`, so a root-level menu's parent_id
    // arrives as `undefined`, not `null` — normalise both to the same Map
    // key or root-level menus silently vanish from the tree (undefined and
    // null are distinct Map keys).
    const key = m.parent_id ?? null
    const list = byParent.get(key) ?? []
    list.push(m)
    byParent.set(key, list)
  }
  for (const list of byParent.values()) list.sort((a, b) => a.sort_order - b.sort_order)

  const build = (parentId: string | null): MenuTreeNode[] =>
    (byParent.get(parentId) ?? []).map((m) => ({ ...m, children: build(m.id) }))

  return build(null)
}

/** Flattens a tree back into an ordered list (depth-first). */
export function flattenTree(tree: MenuTreeNode[]): Menu[] {
  const out: Menu[] = []
  const walk = (nodes: MenuTreeNode[]) => {
    for (const { children, ...menu } of nodes) {
      out.push(menu)
      walk(children)
    }
  }
  walk(tree)
  return out
}

/** Returns the ancestor chain (root-first) for a given menu id, excluding
 *  the menu itself — used for breadcrumb generation. */
export function findAncestors(menus: Menu[], menuId: string): Menu[] {
  const byId = new Map(menus.map((m) => [m.id, m]))
  const chain: Menu[] = []
  let current = byId.get(menuId)
  while (current?.parent_id) {
    const parent = byId.get(current.parent_id)
    if (!parent) break
    chain.unshift(parent)
    current = parent
  }
  return chain
}
