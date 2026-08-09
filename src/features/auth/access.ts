import type { Me } from './types'
import { hasPermission } from './permissions'

/** True if ANY membership holds the literal client-wide Super Admin grant
 *  (permissions === ["*"]) — deliberately narrower than hasPermission's
 *  wildcard matching (which also matches "resource:*" over a single
 *  resource), mirroring the backend's identically-scoped
 *  auth.HasWildcard/api/auth's me.go hasWildcard helpers. The Team menu
 *  (Users/Roles/Invitations) is Super-Admin-only, not merely gated by
 *  users:write/roles:write — see teamRoute's beforeLoad in router.tsx and
 *  the backend's RequireSuperAdmin middleware. */
export function isSuperAdmin(me: Me | null): boolean {
  if (!me) return false
  return me.memberships.some((m) => m.permissions.includes('*'))
}

/** True if ANY of the user's memberships qualifies them for the App Builder
 *  shell — either they can design (application:design, on any app) or
 *  they're a Super Admin (who needs the shell to reach the Team menu, even
 *  with zero design permissions on any single app).
 *
 *  This only answers the router-level "which shell do they land in"
 *  question. Which specific apps show design tools once inside the builder
 *  is gated per-app by the same application:design permission checked
 *  against activeMembership (existing usePermission/PermissionGate
 *  machinery, unchanged) — a user might be a designer on one app and not
 *  another, and still lands in the builder either way. */
export function qualifiesForBuilder(me: Me | null): boolean {
  if (!me) return false
  return isSuperAdmin(me) || me.memberships.some((m) => hasPermission(m.permissions, 'application:design'))
}
