import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { llmProvidersApi } from './api'
import type { CreateLLMProviderPayload, UpdateLLMProviderPayload } from './types'

export const llmProviderKeys = {
  list: () => ['llm-providers'] as const,
}

export function useLLMProviders() {
  return useQuery({ queryKey: llmProviderKeys.list(), queryFn: llmProvidersApi.list })
}

export function useCreateLLMProvider() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: CreateLLMProviderPayload) => llmProvidersApi.create(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: llmProviderKeys.list() }),
  })
}

export function useUpdateLLMProvider(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: UpdateLLMProviderPayload) => llmProvidersApi.update(id, p),
    onSuccess: () => qc.invalidateQueries({ queryKey: llmProviderKeys.list() }),
  })
}

export function useDeleteLLMProvider() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => llmProvidersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: llmProviderKeys.list() }),
  })
}
