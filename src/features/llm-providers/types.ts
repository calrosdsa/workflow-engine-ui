// Mirrors internal/provider.Kind (Go).
export type ProviderKind = 'llm' | 'embedding' | 'both'

// Mirrors knowledge/types.ts's Provider — the same openai/gemini catalog,
// reused rather than duplicated (a saved Provider always names one of these).
export type ProviderType = 'openai' | 'gemini'

// A saved {provider type, credential, model} combination, client-wide
// (shared across every app under the client). Never includes the API key —
// only ResolveCredential (server-side) ever decrypts it, same convention as
// app-settings' CredentialSummary.
export interface LLMProvider {
  id: string
  name: string
  kind: ProviderKind
  provider_type: ProviderType
  model: string
  embedding_dim?: number
  created_at: string
  updated_at: string
}

export interface CreateLLMProviderPayload {
  name: string
  kind: ProviderKind
  provider_type: ProviderType
  api_key: string
  model: string
  embedding_dim?: number
}

export interface UpdateLLMProviderPayload {
  name?: string
  api_key?: string
  model?: string
}
