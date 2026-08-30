import { api } from '@/lib/api'
import type {
  ProviderInstance, ProviderModel, ProviderModelWithInstance, CreateInstancePayload, VerifyPayload, VerifyResult,
  ProviderCatalogEntry, DefaultModels, SetDefaultModelPayload,
} from './types'

export const providersApi = {
  listInstances:   () => api.get('providers').json<ProviderInstance[]>(),
  createInstance:  (p: CreateInstancePayload) => api.post('providers', { json: p }).json<ProviderInstance>(),
  updateInstance:  (id: string, p: { name?: string; api_key?: string }) => api.put(`providers/${id}`, { json: p }).json<ProviderInstance>(),
  deleteInstance:  (id: string) => api.delete(`providers/${id}`),
  verify:          (p: VerifyPayload) => api.post('providers/verify', { json: p }).json<VerifyResult>(),
  listModels:      (instanceId: string) => api.get(`providers/${instanceId}/models`).json<ProviderModel[]>(),
  listAllModels:   () => api.get('providers/models').json<ProviderModelWithInstance[]>(),
  setModelEnabled: (instanceId: string, modelId: string, enabled: boolean) =>
    api.patch(`providers/${instanceId}/models/${modelId}`, { json: { enabled } }).json<ProviderModel>(),
  catalog:         () => api.get('providers/catalog').json<ProviderCatalogEntry[]>(),
  getDefaults:     () => api.get('providers/defaults').json<DefaultModels>(),
  setDefault:      (p: SetDefaultModelPayload) => api.put('providers/defaults', { json: p }).json<DefaultModels>(),
}
