import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from './api'

export const userKeys = { all: ['users'] as const }

export function useTeamUsers() {
  return useQuery({ queryKey: userKeys.all, queryFn: usersApi.list })
}

// FR-D2-016 — resolves a batch of user ids to display name/email (e.g.
// comment authors), lower-privilege than useTeamUsers()/GET /users. Sorted +
// deduped before use as a query key so an equivalent-but-differently-ordered
// ids array (a re-render with the same authors in a new Set iteration order)
// doesn't trigger a spurious refetch.
export function useUsersBasic(ids: string[]) {
  const key = [...new Set(ids)].sort()
  return useQuery({
    queryKey: ['users', 'basic', key],
    queryFn: () => usersApi.getBasic(key),
    enabled: key.length > 0,
  })
}

export function useUpdateUserProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, firstName, lastName }: { userId: string; firstName: string; lastName: string }) =>
      usersApi.updateProfile(userId, firstName, lastName),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  })
}

export function useRevokeUserAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => usersApi.revokeAccess(userId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: userKeys.all }),
  })
}

export function useRevokeUserAppAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, appId }: { userId: string; appId: string }) => usersApi.revokeAppAccess(userId, appId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: userKeys.all }),
  })
}

export function useUpdateUserAppRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, appId, roleId }: { userId: string; appId: string; roleId: string }) =>
      usersApi.updateAppRole(userId, appId, roleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  })
}

export function useGrantSuperAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => usersApi.grantSuperAdmin(userId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: userKeys.all }),
  })
}

export function useRevokeSuperAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => usersApi.revokeSuperAdmin(userId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: userKeys.all }),
  })
}
