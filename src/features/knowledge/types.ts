// Mirrors api/knowledgebases/providers.go's Provider enum — the only two
// supported for now. Each provider's base_url is fixed server-side; the
// frontend only ever selects a provider + a model from its catalog.
export type Provider = 'openai' | 'gemini'

export interface EmbeddingModelOption {
  model: string
  dim: number
}

export interface ProviderCatalogEntry {
  provider: Provider
  llm_models: string[]
  embedding_models: EmbeddingModelOption[]
}

// List's response shape — omits the rag-engine-derived fields (llm_model,
// embedding_model, embedding_dim) that Get/Create/Update include, since
// listing avoids a per-row gRPC round-trip. See api/knowledgebases's
// kbListItem.
export interface KnowledgeBaseSummary {
  id: string
  name: string
  description: string
  provider: Provider
  credential_name: string
  created_at: string
  updated_at: string
}

// Get/Create/Update's response shape — never includes the API key itself,
// only the named credential reference (credential_name) it resolves to
// server-side. See api/knowledgebases's kbResponse.
export interface KnowledgeBase extends KnowledgeBaseSummary {
  llm_model: string
  embedding_model: string
  embedding_dim: number
}

// credential_name must reference a saved "bearer" credential (holding
// {"token": "<api key>"}) — resolved server-side, never sent as a raw key.
export interface CreateKnowledgeBasePayload {
  name: string
  description: string
  provider: Provider
  credential_name: string
  llm_model: string
  embedding_model: string
}

// Provider and embedding settings can't be changed after creation — rag-
// engine rejects an embedding dimension change outright, and swapping
// providers would silently break the KB's existing embedding space. Create
// a new knowledge base instead.
export interface UpdateKnowledgeBasePayload {
  name?: string
  description?: string
  credential_name?: string
  llm_model?: string
}

export type DocumentStatus = 'pending' | 'processing' | 'processed' | 'failed' | 'unknown'

export interface KnowledgeDocument {
  doc_id: string
  status: DocumentStatus
  content_summary?: string
  content_length?: number
  chunks_count?: number
  error_msg?: string
  file_path?: string
  created_at?: string
  updated_at?: string
  track_id?: string
}

export interface ListDocumentsResponse {
  documents: KnowledgeDocument[]
  total: number
}

export type KnowledgeQueryMode = 'naive' | 'local' | 'global' | 'hybrid' | 'mix' | 'bypass'

export interface QueryKnowledgeBasePayload {
  query: string
  mode: KnowledgeQueryMode
  include_answer: boolean
  response_type?: string
  user_prompt?: string
}

export interface QueryKnowledgeBaseResponse {
  answer: string
  context: string
}
