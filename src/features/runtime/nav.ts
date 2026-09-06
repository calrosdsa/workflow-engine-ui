import { canViewMenu } from '@/features/auth/permissions'
import { buildMenuTree, findAncestors } from '@/features/menus/tree'
import type { Menu, MenuTreeNode, MenuType } from '@/features/menus/types'
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

/** True once an app has at least one root-level (`parent_id` null) menu of
 *  menu_type 'module' — the single trigger for BOTH the home/launcher
 *  landing route (RuntimeIndexRedirect) and the sidebar's scoped-subtree
 *  mode (resolveSidebarNav below), so the two behaviors can never disagree
 *  about whether "this app is in modules mode." Structural/unfiltered by
 *  design: whether the APP is configured this way must not depend on which
 *  viewer is asking — only the per-viewer rendering decisions do. */
export function isModulesModeApp(menus: MenuSnapshotItem[]): boolean {
  return menus.some((m) => m.menu_type === 'module' && m.parent_id === null)
}

export interface ScopedRoot {
  id: string
  name: string
  icon?: string
  menu_type: MenuType
}

function findTreeNode(nodes: MenuTreeNode[], id: string): MenuTreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findTreeNode(node.children, id)
    if (found) return found
  }
  return undefined
}

/** Single source of truth for what the sidebar shows: the full filtered
 *  tree for an app with no root-level module menus (today's unconditional
 *  behavior, byte-for-byte unchanged), or — once the app has at least one —
 *  only the branch rooted at whichever top-level tile the current menu
 *  descends from (that root's own children), plus the root itself so the
 *  caller can render a "back to home" header naming it. Applies to ANY
 *  root-level tile once the app is in modules mode, not only module-typed
 *  ones — a legacy root-level menu alongside new modules gets scoped
 *  exactly the same way, so there is exactly one sidebar behavior per app,
 *  never two coexisting ones. */
export function resolveSidebarNav(
  menus: MenuSnapshotItem[],
  currentMenuId: string,
  roleId: string | undefined,
  permissions: string[],
): { navTree: MenuTreeNode[]; scopedRoot: ScopedRoot | null } {
  const fullTree = buildRuntimeNavTree(menus, roleId, permissions)
  if (!isModulesModeApp(menus)) return { navTree: fullTree, scopedRoot: null }

  // Root-first ancestor chain, excluding the current menu itself — its first
  // entry (if any) is the top-level ancestor; an empty chain means the
  // current menu IS already a root.
  const ancestors = runtimeAncestors(menus, currentMenuId)
  const rootId = ancestors[0]?.id ?? currentMenuId
  const rootNode = findTreeNode(fullTree, rootId)

  // rootNode can be absent if canViewMenu rejected the root ancestor itself
  // (filterNavTree drops a rejected node AND its whole subtree) while the
  // viewer still independently reached currentMenuId (e.g. a direct link) —
  // an existing, pre-this-feature ambiguity in the permission model, not
  // something this feature introduces. Falling back to the full tree here
  // is the same graceful-degradation stance MenuIcon/UnavailableMenu take
  // elsewhere: never worse than doing nothing, never a crash.
  if (!rootNode) return { navTree: fullTree, scopedRoot: null }

  return {
    navTree: rootNode.children,
    scopedRoot: { id: rootNode.id, name: rootNode.name, icon: rootNode.icon, menu_type: rootNode.menu_type },
  }
}
