import { useAuthStore } from '@/stores/auth'

// Mirrors internal/auth.HasPermission in the Go backend: exact match, a
// resource wildcard ("workflows:*"), or the full wildcard ("*"). This is UI
// polish only — the server independently re-checks every request via
// RequirePermission, so this never needs to be the actual security boundary.
export function hasPermission(permissions: string[], need: string): boolean {
  const [resource] = need.split(':')
  return permissions.some((p) => p === '*' || p === need || p === `${resource}:*`)
}

export function usePermission(need: string): boolean {
  return useAuthStore((s) => {
    const perms = s.session?.memberships?.find(
      (m) => m.client_id === s.activeMembership?.client_id && m.app_id === s.activeMembership?.app_id,
    )?.permissions
    return hasPermission(perms ?? [], need)
  })
}
