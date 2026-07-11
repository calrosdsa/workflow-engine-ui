import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from './api'

export const userKeys = { all: ['users'] as const }

export function useTeamUsers() {
  return useQuery({ queryKey: userKeys.all, queryFn: usersApi.list })
}

export function useRevokeUserAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => usersApi.revokeAccess(userId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: userKeys.all }),
  })
}
