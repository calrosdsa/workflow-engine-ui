import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rolesApi } from './api'
import type { CreateRolePayload, UpdateRolePayload } from './types'

export const roleKeys = {
  all:   (appId: string) => ['roles', appId] as const,
  detail: (id: string, appId: string) => ['roles', appId, id] as const,
}

/** Unlike every other resource hook in this app, this takes an explicit
 *  appId rather than reading the active membership's app_id — roles are
 *  scoped per-app, but the Team page's Roles tab is a cross-app view with
 *  its own app selector (see src/pages/team/sections/RolesSection.tsx). */
export function useRoles(appId: string) {
  return useQuery({ queryKey: roleKeys.all(appId), queryFn: () => rolesApi.list(appId), enabled: !!appId })
}

export function useCreateRole(appId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: CreateRolePayload) => rolesApi.create(p),
    onSuccess:  () => qc.invalidateQueries({ queryKey: roleKeys.all(appId) }),
  })
}

export function useUpdateRole(id: string, appId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: UpdateRolePayload) => rolesApi.update(id, p),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: roleKeys.all(appId) })
      qc.invalidateQueries({ queryKey: roleKeys.detail(id, appId) })
    },
  })
}

export function useDeleteRole(appId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => rolesApi.delete(id, appId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: roleKeys.all(appId) }),
  })
}
