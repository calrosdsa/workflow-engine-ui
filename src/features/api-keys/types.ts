// Mirrors internal/apikeys.Summary (Go) — the list-view shape, which never
// carries the secret or its hash. See docs/Requirements (FRD)/3.1-Platform-
// Foundations-and-Cross-Cutting-Concerns/FR-F-007.md.
export interface ApiKeySummary {
  id: string
  name: string
  key_prefix: string
  permissions: string[]
  created_at: string
  last_used_at?: string
  revoked_at?: string
}

export type ApiKeyKind = 'integration' | 'management'

export interface CreateApiKeyPayload {
  name: string
  /** Which fixed permission set to mint (api/apikeys.Handler.Create's
   *  `kind`) — omitted/`'integration'` for the record + Knowledge Base/RAG
   *  scope, `'management'` for the full design-time wildcard scope a
   *  headless builder (e.g. the MCP server) needs. */
  kind?: ApiKeyKind
}

/** Create-response shape only — the ONE response that carries the full
 *  secret. Every other read (List) returns ApiKeySummary, never this. */
export interface CreateApiKeyResponse extends ApiKeySummary {
  secret: string
}

// The backend never returns `kind` directly (it stores/reports only the
// resolved `permissions` snapshot) — but the two kinds are structurally
// distinguishable: only the management scope grants `application:*`
// (api/apikeys.Handler.Create's managementPermissions), which no
// integration-kind key's per-form snapshot can ever contain. Inferring from
// that one marker avoids a backend response-shape change for a value the
// frontend can already derive exactly.
export function apiKeyKind(permissions: string[]): ApiKeyKind {
  return permissions.includes('application:*') ? 'management' : 'integration'
}
