import { useAuthStore } from '@/stores/auth'
import type { AddMenuConfig, Menu, MenuType, SearchMenuConfig } from '@/features/menus/types'
import type { MenuSnapshotItem } from '@/features/runtime/types'

// Mirrors internal/auth.HasPermission in the Go backend: exact match, a
// resource wildcard ("workflows:*"), a per-action wildcard on three-part
// keys ("forms:*:view" grants "forms:<any id>:view" — how a read-only role
// sees every form's records without holding the write-matching "forms:*"),
// or the full wildcard ("*"). This is UI polish only — the server
// independently re-checks every request via RequirePermission, so this never
// needs to be the actual security boundary.
export function hasPermission(permissions: string[], need: string): boolean {
  const [resource, , action] = need.split(':')
  const actionWildcard = action === undefined ? undefined : `${resource}:*:${action}`
  return permissions.some(
    (p) => p === '*' || p === need || p === `${resource}:*` || (actionWildcard !== undefined && p === actionWildcard),
  )
}

export function usePermission(need: string): boolean {
  return useAuthStore((s) => {
    const perms = s.session?.memberships?.find(
      (m) => m.client_id === s.activeMembership?.client_id && m.app_id === s.activeMembership?.app_id,
    )?.permissions
    return hasPermission(perms ?? [], need)
  })
}

// Menu types whose runtime content is sourced from a form record (Search
// lists/filters records, Add creates one) — the only two the per-form
// permission rule below applies to, mapped to which action on that form it
// requires. Parent/Custom menus have no underlying data resource to gate.
const RESOURCE_ACTION_BY_MENU_TYPE: Partial<Record<MenuType, 'view' | 'create'>> = {
  search: 'view',
  add: 'create',
}

/** Viewer-facing subset of a menu shared by both the builder's Menu and the
 *  published runtime's MenuSnapshotItem — accepts either so the same check
 *  runs in the builder preview and at runtime. Includes `config` so
 *  canViewMenu can read a Search/Add menu's own form_id — both Menu and
 *  MenuSnapshotItem already carry it, so widening this Pick needs no call-site
 *  changes. */
export type ViewableMenu = Pick<
  Menu | MenuSnapshotItem,
  'menu_type' | 'required_permission' | 'permission_mode' | 'required_role_ids' | 'config'
>

/** The single source of truth for "can this member see this menu," covering
 *  every independent gate the menu editor's Permission section can set —
 *  all must pass:
 *   - required_permission: gates any menu type on a specific permission key.
 *   - permission_mode 'role': visible only to members whose current role is
 *     in required_role_ids ('all' skips this gate entirely). A member
 *     holding the global "*" permission (client-wide Super Admin) always
 *     satisfies this gate regardless of required_role_ids, the same way
 *     hasPermission already treats "*" as matching any required_permission
 *     below — otherwise Super Admin's roleId is always the builtin
 *     super_admin role's own ID (see ResolveMembership in the Go backend),
 *     which can never appear in an app-scoped menu's required_role_ids, so
 *     role-gated menus would stay invisible even to Super Admin.
 *   - Search/Add menus additionally require the per-form permission for
 *     that menu's own form (view for Search, create for Add) — independent
 *     of permission_mode, since a menu can be visible to a role but still
 *     point at a form that role isn't granted access to. A menu restricted
 *     to a specific role still requires the viewer's role to hold this
 *     per-form permission; the two gates compose, neither bypasses the other.
 *
 *  Reused by nav.ts (builds the filtered nav tree) and RuntimeAppShell.tsx/
 *  RuntimeRecordPage.tsx (gates the currently-loaded menu so deep-linking to
 *  a hidden menu 403s instead of silently rendering). */
export function canViewMenu(menu: ViewableMenu, roleId: string | undefined, permissions: string[]): boolean {
  if (menu.required_permission && !hasPermission(permissions, menu.required_permission)) return false
  if (
    menu.permission_mode === 'role' &&
    !hasPermission(permissions, '*') &&
    !(roleId && menu.required_role_ids.includes(roleId))
  )
    return false

  const action = RESOURCE_ACTION_BY_MENU_TYPE[menu.menu_type]
  if (action) {
    const formId = (menu.config as SearchMenuConfig | AddMenuConfig).form_id
    if (!formId || !hasPermission(permissions, `forms:${formId}:${action}`)) return false
  }
  return true
}
