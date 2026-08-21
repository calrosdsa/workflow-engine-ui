import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from './api'

export const userKeys = { all: ['users'] as const }

export function useTeamUsers() {
  return useQuery({ queryKey: userKeys.all, queryFn: usersApi.list })
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
