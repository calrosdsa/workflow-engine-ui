import type { Me } from './types'
import { hasPermission } from './permissions'

/** True if ANY of the user's memberships qualifies them for the App Builder
 *  shell — either they can design (application:design, on any app) or they
 *  can administer the team (users:write / roles:write, on any app). The
 *  latter two are included so a pure team-admin with zero design
 *  permissions isn't misrouted into the Runtime Portal and locked out of
 *  /team, which has its own independent users:write/roles:write gates
 *  unchanged by this check.
 *
 *  This only answers the router-level "which shell do they land in"
 *  question. Which specific apps show design tools once inside the builder
 *  is gated per-app by the same application:design permission checked
 *  against activeMembership (existing usePermission/PermissionGate
 *  machinery, unchanged) — a user might be a designer on one app and not
 *  another, and still lands in the builder either way. */
export function qualifiesForBuilder(me: Me | null): boolean {
  if (!me) return false
  return me.memberships.some(
    (m) =>
      hasPermission(m.permissions, 'application:design') ||
      hasPermission(m.permissions, 'users:write') ||
      hasPermission(m.permissions, 'roles:write'),
  )
}
