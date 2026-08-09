import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { integrationsApi } from './api'
import type { UpsertIntegrationPayload } from './types'

export const integrationKeys = {
  list: () => ['integrations'] as const,
}

export function useIntegrations() {
  return useQuery({ queryKey: integrationKeys.list(), queryFn: integrationsApi.list })
}

export function useCreateIntegration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: UpsertIntegrationPayload) => integrationsApi.create(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: integrationKeys.list() }),
  })
}

export function useUpdateIntegration(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: UpsertIntegrationPayload) => integrationsApi.update(id, p),
    onSuccess: () => qc.invalidateQueries({ queryKey: integrationKeys.list() }),
  })
}

export function useDeleteIntegration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => integrationsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: integrationKeys.list() }),
  })
}

// Not cached via useQuery — minting is a one-shot action (used right before
// setting an iframe's src), not data to keep around and refetch.
export function useMintSSOToken() {
  return useMutation({ mutationFn: (id: string) => integrationsApi.mintSSOToken(id) })
}
