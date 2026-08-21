// Tab-level analog of PermissionGate (features/auth/PermissionGate.tsx) —
// role/user-aware rather than permission-string-aware, since PermissionGate's
// `need: string` prop has no role-aware variant (every existing call site
// passes exactly one `forms:{id}:action` string). Role check reuses
// canViewMenu's exact role-membership logic (features/auth/permissions.ts),
// including the '*'-permission Super Admin bypass; user check is a plain
// membership test against the session's own user id. Client-side only, same
// "UI polish only — the server independently re-checks" trust model
// PermissionGate already documents; a tab failing this gate never reaches
// the server at all here, but the underlying data it would have shown stays
// governed by that data's own real server-side permission checks regardless.
//
// A plain function, not a hook — RecordDetailPanel needs to evaluate this
// once per tab inside a .filter() over a variable-length, config-driven
// list, which a hook can't do (the Rules of Hooks forbid a call count that
// varies per render). useCurrentViewer reads the session ONCE at the top of
// the calling component; isTabVisible then does the actual (pure,
// hook-free) per-tab check against that already-resolved viewer.
import { useAuthStore } from '@/stores/auth'
import { hasPermission } from '@/features/auth/permissions'
import type { TabVisibilityConfig } from '@/features/form-builder/schema'

export interface CurrentViewer {
  userId: string | undefined
  roleId: string | undefined
  permissions: string[]
}

export function useCurrentViewer(): CurrentViewer {
  const session = useAuthStore((s) => s.session)
  const activeMembership = useAuthStore((s) => s.activeMembership)
  const membership = session?.memberships?.find(
    (m) => m.client_id === activeMembership?.client_id && m.app_id === activeMembership?.app_id,
  )
  return {
    userId: session?.user_id,
    roleId: membership?.role_id,
    permissions: membership?.permissions ?? [],
  }
}

export function isTabVisible(visibility: TabVisibilityConfig | undefined, viewer: CurrentViewer): boolean {
  if (!visibility || visibility.mode === 'everyone') return true

  const roleOk = viewer.roleId
    ? hasPermission(viewer.permissions, '*') || !!visibility.roleIds?.includes(viewer.roleId)
    : hasPermission(viewer.permissions, '*')
  const userOk = !!viewer.userId && !!visibility.userIds?.includes(viewer.userId)

  switch (visibility.mode) {
    case 'roles':
      return roleOk
    case 'users':
      return userOk
    case 'roles_or_users':
      return roleOk || userOk
    default:
      return true
  }
}
