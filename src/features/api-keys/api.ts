import { api } from '@/lib/api'
import type { ApiKeySummary, CreateApiKeyPayload, CreateApiKeyResponse } from './types'

export const apiKeysApi = {
  list: () => api.get('application/api-keys').json<ApiKeySummary[]>(),
  create: (p: CreateApiKeyPayload) =>
    api.post('application/api-keys', { json: p }).json<CreateApiKeyResponse>(),
  revoke: (id: string) => api.delete(`application/api-keys/${id}`),
}
