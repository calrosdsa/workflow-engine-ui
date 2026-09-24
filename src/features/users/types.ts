export interface UserMembership {
  app_id: string
  app_name: string
  role_id: string
  role_name: string
}

export interface TeamUser {
  id: string
  email: string
  first_name: string
  last_name: string
  status: string
  is_super_admin: boolean
  /** Whether the member has two-step verification on. Absent from engines that
   *  predate reporting it -- treat that as "unknown", not "off". */
  mfa_enabled?: boolean
  memberships: UserMembership[]
}

// FR-D2-016 — the narrow shape GET /users/basic returns. Deliberately
// smaller than TeamUser (no memberships/status/is_super_admin) — this is a
// lower-privilege lookup any tenant-scoped caller may use, not the
// Super-Admin-only GET /users surface TeamUser backs.
export interface BasicUser {
  id: string
  first_name?: string
  last_name?: string
  email: string
}
