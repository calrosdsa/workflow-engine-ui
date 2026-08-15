import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { integrationsApi } from './api'
import type { UpsertIntegrationPayload } from './types'

export const integrationKeys = {
  list: () => ['integrations'] as const,
  runtimeInfo: (id: string) => ['integrations', id, 'runtime-info'] as const,
}

export function useIntegrations() {
  return useQuery({ queryKey: integrationKeys.list(), queryFn: integrationsApi.list })
}

// Runtime-session-safe counterpart to useIntegrations — fetches only
// auth_mode + allowed_origins for ONE integration via the menus:read-gated
// runtime-info endpoint, rather than the credentials:read-gated full list a
// typical end-user viewing a published app won't have permission for. Use
// this (not useIntegrations) from any component that renders in the actual
// runtime (not the design-time builder) and needs an integration's
// handshake-relevant fields — see Renderer.tsx (Dashboard embed widget) and
// CustomMenuRuntime.tsx (Custom menu embed mode) for the two call sites.
export function useIntegrationRuntimeInfo(id: string | undefined) {
  return useQuery({
    queryKey: integrationKeys.runtimeInfo(id ?? ''),
    queryFn: () => integrationsApi.getRuntimeInfo(id!),
    enabled: !!id,
  })
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
