// Mirrors internal/provider.VendorType (Go) — which LLM/embedding vendor a
// Provider Instance uses.
export type ProviderType = 'openai' | 'gemini' | 'voyage' | 'anthropic' | 'deepseek'

export type Capability = 'llm' | 'embedding'

// A saved credentialed connection to one vendor, client-wide (shared across
// every app under the client). Never includes the API key — only
// ResolveCredential (server-side) ever decrypts it. Exposes one
// ProviderModel per catalog model of its ProviderType (see ProviderModel
// below) — an Instance itself carries no model; that's the whole point of
// the Instance/Model split over the old one-row-per-model shape.
export interface ProviderInstance {
  id: string
  name: string
  provider_type: ProviderType
  created_at: string
  updated_at: string
}

// One model exposed by a ProviderInstance, independently enabled/disabled.
export interface ProviderModel {
  id: string
  instance_id: string
  model: string
  capability: Capability
  embedding_dim?: number
  enabled: boolean
}

// ListAllModels' response shape — a ProviderModel plus enough of its parent
// Instance's identity to render "{instance name} · {model}" in a picker
// without a second round-trip per row.
export interface ProviderModelWithInstance extends ProviderModel {
  instance_name: string
  provider_type: ProviderType
}

export interface CreateInstancePayload {
  name: string
  provider_type: ProviderType
  api_key: string
}

export interface VerifyPayload {
  provider_type: ProviderType
  api_key: string
}

export interface VerifyResult {
  ok: boolean
  error?: string
}

export interface EmbeddingModelOption {
  model: string
  dim: number
}

// One vendor's full model catalog — GET /providers/catalog, the canonical
// source (GET /knowledge-bases/providers returns the same shape for the
// older KB-creation-dialog caller).
export interface ProviderCatalogEntry {
  provider: ProviderType
  llm_models: string[]
  embedding_models: EmbeddingModelOption[]
}

export interface DefaultModels {
  llm_model_id: string | null
  embedding_model_id: string | null
}

export interface SetDefaultModelPayload {
  capability: Capability
  model_id: string
}
