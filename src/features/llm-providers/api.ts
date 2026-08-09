import { api } from '@/lib/api'
import type { LLMProvider, CreateLLMProviderPayload, UpdateLLMProviderPayload } from './types'

export const llmProvidersApi = {
  list:   () => api.get('providers').json<LLMProvider[]>(),
  get:    (id: string) => api.get(`providers/${id}`).json<LLMProvider>(),
  create: (p: CreateLLMProviderPayload) => api.post('providers', { json: p }).json<LLMProvider>(),
  update: (id: string, p: UpdateLLMProviderPayload) => api.put(`providers/${id}`, { json: p }).json<LLMProvider>(),
  delete: (id: string) => api.delete(`providers/${id}`),
}
