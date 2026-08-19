// Resolves a stored role ID (form.create_user_role_field's value — the
// Account section's Role field, form-builder/factory.ts's createAccountSection)
// to its real role name for read-only display. Editing already resolves this
// correctly (FieldRenderer.tsx's RoleFieldInput, backed by the identical
// useRoles hook) — this is the read-only counterpart, for List columns and
// Card layout, which had no such resolution and showed the raw UUID.
import { useRoles } from '@/features/roles/hooks'
import { useAuthStore } from '@/stores/auth'

interface RoleValueLabelProps {
  roleId: unknown
}

export function RoleValueLabel({ roleId }: RoleValueLabelProps) {
  const appId = useAuthStore((s) => s.activeMembership?.app_id) ?? ''
  const { data: roles, isLoading } = useRoles(appId)

  if (typeof roleId !== 'string' || !roleId) return <>—</>
  if (isLoading) return <span style={{ color: 'hsl(var(--muted-foreground))' }}>…</span>

  const role = roles?.find((r) => r.id === roleId)
  return <>{role?.name ?? roleId}</>
}
