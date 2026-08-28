import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiKeysApi } from './api'
import type { CreateApiKeyPayload } from './types'

export const apiKeysKeys = {
  list: () => ['api-keys'] as const,
}

export function useApiKeys(opts?: { enabled?: boolean }) {
  return useQuery({ queryKey: apiKeysKeys.list(), queryFn: apiKeysApi.list, enabled: opts?.enabled ?? true })
}

export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateApiKeyPayload) => apiKeysApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: apiKeysKeys.list() }),
  })
}

export function useRevokeApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiKeysApi.revoke(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: apiKeysKeys.list() }),
  })
}
