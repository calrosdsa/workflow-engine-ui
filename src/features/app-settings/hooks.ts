import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { appSettingsApi } from './api'
import type { UpsertCredentialPayload, UpsertVariablePayload } from './types'

export const appSettingsKeys = {
  credentials:     () => ['app-settings', 'credentials'] as const,
  credentialTypes: () => ['app-settings', 'credential-types'] as const,
  variables:       () => ['app-settings', 'variables'] as const,
}

export function useCredentials() {
  return useQuery({ queryKey: appSettingsKeys.credentials(), queryFn: appSettingsApi.listCredentials })
}

/** The merged built-in + package-declared credential-type registry — what a
 *  creation form needs to know which types exist and what fields each one
 *  has. Effectively static for a given deployment (changes only when a
 *  package is enabled/disabled/updated), so a longer staleTime than the
 *  default avoids refetching it on every Application Settings visit. */
export function useCredentialTypes() {
  return useQuery({
    queryKey: appSettingsKeys.credentialTypes(),
    queryFn: appSettingsApi.listCredentialTypes,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpsertCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, payload }: { name: string; payload: UpsertCredentialPayload }) =>
      appSettingsApi.upsertCredential(name, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: appSettingsKeys.credentials() }),
  })
}

export function useDeleteCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => appSettingsApi.deleteCredential(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: appSettingsKeys.credentials() }),
  })
}

export function useVariables() {
  return useQuery({ queryKey: appSettingsKeys.variables(), queryFn: appSettingsApi.listVariables })
}

export function useUpsertVariable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, payload }: { name: string; payload: UpsertVariablePayload }) =>
      appSettingsApi.upsertVariable(name, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: appSettingsKeys.variables() }),
  })
}

export function useDeleteVariable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => appSettingsApi.deleteVariable(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: appSettingsKeys.variables() }),
  })
}
