import { api } from '@/lib/api'
import type { EmbeddedIntegration, UpsertIntegrationPayload, SSOTokenResponse } from './types'

export const integrationsApi = {
  list:   () => api.get('integrations').json<EmbeddedIntegration[]>(),
  get:    (id: string) => api.get(`integrations/${id}`).json<EmbeddedIntegration>(),
  create: (p: UpsertIntegrationPayload) => api.post('integrations', { json: p }).json<EmbeddedIntegration>(),
  update: (id: string, p: UpsertIntegrationPayload) => api.put(`integrations/${id}`, { json: p }).json<EmbeddedIntegration>(),
  delete: async (id: string): Promise<void> => {
    await api.delete(`integrations/${id}`)
  },
  mintSSOToken: (id: string) => api.post(`integrations/${id}/sso-token`).json<SSOTokenResponse>(),
}
