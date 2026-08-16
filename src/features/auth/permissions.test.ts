import { describe, it, expect } from 'vitest'
import { hasPermission, canViewMenu, type ViewableMenu } from './permissions'

// This fixture table is intentionally duplicated in
// workflow-engine/internal/auth/rbac_parity_test.go — keep both in sync.
// They assert the two independent HasPermission implementations (the Go
// one, the real security boundary, and this one, explicitly documented as
// UI polish only) agree on every case, including the Super Admin "*"
// wildcard and application:design-shaped keys.
const parityCases: { name: string; perms: string[]; need: string; want: boolean }[] = [
  { name: 'exact match', perms: ['workflows:read'], need: 'workflows:read', want: true },
  { name: 'no match', perms: ['workflows:read'], need: 'workflows:write', want: false },
  { name: 'empty perms', perms: [], need: 'workflows:read', want: false },
  { name: 'resource wildcard matches', perms: ['workflows:*'], need: 'workflows:write', want: true },
  { name: 'resource wildcard does not cross resources', perms: ['workflows:*'], need: 'forms:read', want: false },
  { name: 'global wildcard matches anything', perms: ['*'], need: 'forms:write', want: true },
  { name: 'global wildcard matches application:design', perms: ['*'], need: 'application:design', want: true },
  { name: 'application wildcard matches application:design', perms: ['application:*'], need: 'application:design', want: true },
  { name: 'application wildcard does not match forms', perms: ['application:*'], need: 'forms:write', want: false },
  { name: 'exact application:design', perms: ['application:design'], need: 'application:design', want: true },
  { name: 'per-form key exact match', perms: ['forms:abc-123:view'], need: 'forms:abc-123:view', want: true },
  { name: 'per-form key does not match a different form', perms: ['forms:abc-123:view'], need: 'forms:other-form:view', want: false },
  { name: 'forms wildcard matches per-form key', perms: ['forms:*'], need: 'forms:abc-123:view', want: true },
  { name: 'unrelated resource does not match', perms: ['users:write'], need: 'roles:write', want: false },
]

describe('hasPermission parity with Go HasPermission', () => {
  for (const { name, perms, need, want } of parityCases) {
    it(name, () => {
      expect(hasPermission(perms, need)).toBe(want)
    })
  }
})

describe('canViewMenu role-gating', () => {
  const roleGatedMenu: ViewableMenu = {
    menu_type: 'parent',
    required_permission: undefined,
    permission_mode: 'role',
    required_role_ids: ['admin-role-id'],
    config: {},
  }

  it('is visible to a member whose role is in required_role_ids', () => {
    expect(canViewMenu(roleGatedMenu, 'admin-role-id', [])).toBe(true)
  })

  it('is hidden from a member whose role is not in required_role_ids', () => {
    expect(canViewMenu(roleGatedMenu, 'standard-role-id', [])).toBe(false)
  })

  it('is hidden when roleId is undefined', () => {
    expect(canViewMenu(roleGatedMenu, undefined, [])).toBe(false)
  })

  // Regression for the bug where a client-wide Super Admin (permissions
  // ["*"]) could not see any role-gated menu: their roleId always resolves
  // to the builtin super_admin role's own ID (see ResolveMembership in the
  // Go backend), which can never appear in an app-scoped menu's
  // required_role_ids -- so the identity check alone always failed them,
  // even though "*" already bypasses every required_permission check.
  it('is visible to a holder of the global "*" permission regardless of role identity', () => {
    expect(canViewMenu(roleGatedMenu, 'super-admin-builtin-role-id', ['*'])).toBe(true)
  })

  it('"*" does not bypass required_permission', () => {
    const permissionGatedMenu: ViewableMenu = {
      ...roleGatedMenu,
      permission_mode: 'all',
      required_permission: 'users:write',
    }
    expect(canViewMenu(permissionGatedMenu, undefined, ['*'])).toBe(true)
    expect(canViewMenu(permissionGatedMenu, undefined, ['workflows:read'])).toBe(false)
  })

  it("permission_mode 'all' skips the role gate entirely", () => {
    const openMenu: ViewableMenu = { ...roleGatedMenu, permission_mode: 'all' }
    expect(canViewMenu(openMenu, undefined, [])).toBe(true)
  })
})
