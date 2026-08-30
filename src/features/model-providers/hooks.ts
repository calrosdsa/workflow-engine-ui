import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { providersApi } from './api'
import type { CreateInstancePayload, VerifyPayload, SetDefaultModelPayload } from './types'

export const providerKeys = {
  instances: () => ['provider-instances'] as const,
  models:    (instanceId: string) => ['provider-instances', instanceId, 'models'] as const,
  allModels: () => ['provider-models'] as const,
  catalog:   () => ['provider-catalog'] as const,
  defaults:  () => ['provider-defaults'] as const,
}

export function useProviderInstances() {
  return useQuery({ queryKey: providerKeys.instances(), queryFn: providersApi.listInstances })
}

export function useCreateInstance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: CreateInstancePayload) => providersApi.createInstance(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: providerKeys.instances() })
      qc.invalidateQueries({ queryKey: providerKeys.allModels() })
    },
  })
}

export function useDeleteInstance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => providersApi.deleteInstance(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: providerKeys.instances() })
      qc.invalidateQueries({ queryKey: providerKeys.allModels() })
    },
  })
}

// Not a useQuery — Verify only ever runs on-demand, right before saving a
// new Instance, never passively.
export function useVerifyProvider() {
  return useMutation({ mutationFn: (p: VerifyPayload) => providersApi.verify(p) })
}

export function useInstanceModels(instanceId: string, enabled = true) {
  return useQuery({
    queryKey: providerKeys.models(instanceId),
    queryFn: () => providersApi.listModels(instanceId),
    enabled: !!instanceId && enabled,
  })
}

export function useAllProviderModels() {
  return useQuery({ queryKey: providerKeys.allModels(), queryFn: providersApi.listAllModels })
}

export function useSetModelEnabled(instanceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ modelId, enabled }: { modelId: string; enabled: boolean }) =>
      providersApi.setModelEnabled(instanceId, modelId, enabled),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: providerKeys.models(instanceId) })
      qc.invalidateQueries({ queryKey: providerKeys.allModels() })
    },
  })
}

// The vendor/model catalog is static server-side config, not per-tenant
// data — cache it for the whole session rather than refetching per mount,
// matching features/knowledge/hooks.ts's useProviders precedent.
export function useProviderCatalog() {
  return useQuery({ queryKey: providerKeys.catalog(), queryFn: providersApi.catalog, staleTime: Infinity })
}

export function useDefaultModels() {
  return useQuery({ queryKey: providerKeys.defaults(), queryFn: providersApi.getDefaults })
}

export function useSetDefaultModel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: SetDefaultModelPayload) => providersApi.setDefault(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: providerKeys.defaults() }),
  })
}
