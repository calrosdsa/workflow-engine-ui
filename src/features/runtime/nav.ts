import { canViewMenu } from '@/features/auth/permissions'
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
 *  filtering out any node (and its whole subtree) that canViewMenu rejects —
 *  the "hide" half of role-based menu visibility — and separately dropping
 *  any node flagged hidden_from_nav (e.g. an Add menu auto-paired with a
 *  Search menu, meant to be reached only via that Search menu's "Create"
 *  button, never as its own nav entry). hidden_from_nav is intentionally
 *  NOT folded into canViewMenu: canViewMenu also gates direct/deep-linked
 *  access to a menu (see RuntimeAppShell.tsx), and a hidden-from-nav menu
 *  must still be directly navigable by slug — only its nav *entry* is
 *  suppressed, unlike a permission/role failure which blocks access
 *  entirely. Reuses buildMenuTree from features/menus/tree.ts, written once
 *  and imported by both the builder's tree view and this. */
export function buildRuntimeNavTree(menus: MenuSnapshotItem[], roleId: string | undefined, permissions: string[]): MenuTreeNode[] {
  const tree = buildMenuTree(menus.map(toMenu))
  return filterNavTree(tree, roleId, permissions)
}

function filterNavTree(nodes: MenuTreeNode[], roleId: string | undefined, permissions: string[]): MenuTreeNode[] {
  const out: MenuTreeNode[] = []
  for (const node of nodes) {
    if (node.hidden_from_nav) continue
    if (!canViewMenu(node, roleId, permissions)) continue
    out.push({ ...node, children: filterNavTree(node.children, roleId, permissions) })
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
