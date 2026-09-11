import { api } from '@/lib/api'
import type {
  CredentialSummary, UpsertCredentialPayload, CredentialTypeInfo,
  AppVariable, UpsertVariablePayload,
} from './types'

// Names are free-text (unlike the UUIDs most other resources key by), so
// they're encoded before interpolation into the path.
const encodeName = (name: string) => encodeURIComponent(name)

export const appSettingsApi = {
  listCredentials: () => api.get('application/credentials').json<CredentialSummary[]>(),
  upsertCredential: (name: string, p: UpsertCredentialPayload) =>
    api.put(`application/credentials/${encodeName(name)}`, { json: p }).json<{ name: string; type: string }>(),
  deleteCredential: (name: string) => api.delete(`application/credentials/${encodeName(name)}`),
  listCredentialTypes: () => api.get('meta/credential-types').json<{ types: CredentialTypeInfo[] }>(),

  listVariables: () => api.get('application/variables').json<AppVariable[]>(),
  upsertVariable: (name: string, p: UpsertVariablePayload) =>
    api.put(`application/variables/${encodeName(name)}`, { json: p }).json<{ name: string; value: unknown }>(),
  deleteVariable: (name: string) => api.delete(`application/variables/${encodeName(name)}`),
}
