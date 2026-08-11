import { api } from '@/lib/api'
import type { EmbeddedIntegration, UpsertIntegrationPayload, SSOTokenResponse, StartOIDCFlowResponse } from './types'

export const integrationsApi = {
  list:   () => api.get('integrations').json<EmbeddedIntegration[]>(),
  get:    (id: string) => api.get(`integrations/${id}`).json<EmbeddedIntegration>(),
  create: (p: UpsertIntegrationPayload) => api.post('integrations', { json: p }).json<EmbeddedIntegration>(),
  update: (id: string, p: UpsertIntegrationPayload) => api.put(`integrations/${id}`, { json: p }).json<EmbeddedIntegration>(),
  delete: async (id: string): Promise<void> => {
    await api.delete(`integrations/${id}`)
  },
  mintSSOToken: (id: string) => api.post(`integrations/${id}/sso-token`).json<SSOTokenResponse>(),
  // Begins an OIDC silent-auth attempt — returns the IdP's /authorize URL
  // (prompt=none already attached) for useOidcHandshake to load in a hidden
  // iframe. Not cacheable data (same reasoning as mintSSOToken), so this is
  // consumed via a plain async call, not a useQuery hook.
  startOidcFlow: (id: string) => api.post(`integrations/${id}/oidc/start`).json<StartOIDCFlowResponse>(),
}
