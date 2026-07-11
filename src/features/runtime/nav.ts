import { hasPermission } from '@/features/auth/permissions'
import { buildMenuTree, findAncestors } from '@/features/menus/tree'
import type { Menu, MenuTreeNode } from '@/features/menus/types'
import type { MenuSnapshotItem } from './types'

/** The published snapshot's menu items are structurally identical to the
 *  builder's Menu (same fields, snapshot just omits created_at/updated_at/
 *  app_id) — reused wherever runtime code needs to hand a MenuSnapshotItem
 *  to something typed against Menu (buildMenuTree/findAncestors, or a
 *  MenuTypeRegistry runtimeRenderer). The empty placeholders are safe
 *  because nothing in the runtime path reads app_id/created_at/updated_at
 *  off an individual menu — the app-level snapshot already carries app
 *  identity via AppSnapshot.app. */
export function toMenu(item: MenuSnapshotItem): Menu {
  return { ...item, app_id: '', created_at: '', updated_at: '' }
}

/** Builds the runtime nav tree from a published snapshot's flat menu list,
 *  filtering out any node (and its whole subtree) whose required_permission
 *  the caller's permissions don't satisfy — the "hide" half of role-based
 *  menu visibility. Reuses buildMenuTree from features/menus/tree.ts,
 *  written once and imported by both the builder's tree view and this. */
export function buildRuntimeNavTree(menus: MenuSnapshotItem[], permissions: string[]): MenuTreeNode[] {
  const tree = buildMenuTree(menus.map(toMenu))
  return filterByPermission(tree, permissions)
}

function filterByPermission(nodes: MenuTreeNode[], permissions: string[]): MenuTreeNode[] {
  const out: MenuTreeNode[] = []
  for (const node of nodes) {
    if (node.required_permission && !hasPermission(permissions, node.required_permission)) continue
    out.push({ ...node, children: filterByPermission(node.children, permissions) })
  }
  return out
}

/** Ancestor chain (root-first) for breadcrumbs, from the full unfiltered
 *  menu list (a permission-gated ancestor still needs to appear in its own
 *  breadcrumb trail if the current, visible menu is one of its descendants
 *  — filtering ancestors would produce a broken/incomplete trail). */
export function runtimeAncestors(menus: MenuSnapshotItem[], menuId: string) {
  return findAncestors(menus.map(toMenu), menuId)
}
