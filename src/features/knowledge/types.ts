// Mirrors api/knowledgebases/providers.go's Provider enum. Each provider's
// base_url is fixed server-side; the frontend only ever selects a provider +
// a model from its catalog. Voyage is embedding-only — its catalog entry's
// llm_models is empty, so UI that offers a "Used for: LLM" choice should
// filter Voyage out rather than show a dead-end empty model dropdown.
export type Provider = 'openai' | 'gemini' | 'voyage'

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
  // FR-C9-002: whether the CALLER's own app owns this KB — the Sharing
  // Settings section only renders when true; a false value means this KB
  // was reached via a sharing grant from another app.
  owned_by_app: boolean
}

// credential_name must reference a saved "bearer" credential (holding
// {"token": "<api key>"}) — resolved server-side, never sent as a raw key.
// llm_model accepts any non-empty model id, not just the catalog's list —
// the backend forwards it to the provider as-is (see providers.go's
// resolveLLMModel doc comment). embedding_dim is required only when
// embedding_model isn't one of useProviders()'s catalog entries; ignored by
// the backend otherwise.
export interface CreateKnowledgeBasePayload {
  name: string
  description: string
  // llm_provider_id/embedding_provider_id reference a saved
  // features/llm-providers LLMProvider — the preferred way to supply model
  // config, resolved server-side into provider/credential/model. The legacy
  // provider/credential_name/*_model fields still exist on the wire (backend
  // accepts either), but the create form only ever sends provider IDs now.
  llm_provider_id: string
  embedding_provider_id: string
}

// FR-C9-002: a KB always belongs to exactly one owning app (set implicitly
// at creation from the active app — there is no create-time sharing
// choice). Visibility is the separate, editable grant controlling what
// every OTHER app under the client may do with it, changed from the
// Sharing Settings section on the detail page (see sharing.ts).
export type KnowledgeBaseVisibility = 'private' | 'read_only' | 'full_access'

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

export type StageState = 'pending' | 'running' | 'completed' | 'failed' | 'unknown'

// StageStatus is generic over whatever stage names the backend reports —
// new stage types (e.g. a future PII-detection stage) show up automatically
// without a frontend change, since nothing here hardcodes a stage list.
export interface StageStatus {
  stage: string
  state: StageState
  duration_ms?: number
  items_produced?: number
  error_msg?: string
  started_at?: string
  completed_at?: string
}

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
  stages?: StageStatus[]
  entities_count?: number
  relations_count?: number
}

export interface GraphEntity {
  name: string
  type: string
  description: string
}

export interface GraphRelation {
  source: string
  target: string
  description: string
  keywords: string
}

export interface DocumentGraphResponse {
  entities: GraphEntity[]
  relations: GraphRelation[]
}

// The wire shape of one SSE frame from GET .../documents/stream — see
// workflow-engine's api/knowledgebases/sse.go sseDocumentEvent.
export interface DocumentPipelineEvent {
  kb_id: string
  doc_id: string
  event_type: string
  stage?: string
  duration_ms?: number
  items_produced?: number
  error_msg?: string
  at: string
  document: KnowledgeDocument
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
  enable_rerank?: boolean
}

export interface QueryResponseChunk {
  content: string
  file_path: string
  reference_id: number
}

export interface QueryResponseReference {
  reference_id: number
  file_path: string
}

export interface QueryKnowledgeBaseResponse {
  answer: string
  context: string
  chunks: QueryResponseChunk[]
  references: QueryResponseReference[]
}

// FR-C9-002 sharing endpoints — see api/knowledgebases/sharing.go.
export interface SharingResponse {
  visibility: KnowledgeBaseVisibility
}

export interface AppUsage {
  app_id: string
  app_name: string
  workflows: string[]
  agents: string[]
}

export interface SharingUsageResponse {
  apps: AppUsage[]
}

// The 409 body PATCH .../sharing returns when a narrowing change would
// remove another app's access and the caller hasn't confirmed yet.
export interface SharingInUseError {
  error: 'in_use'
  apps: AppUsage[]
}
