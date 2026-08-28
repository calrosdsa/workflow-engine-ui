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

export interface CreateApiKeyPayload {
  name: string
}

/** Create-response shape only — the ONE response that carries the full
 *  secret. Every other read (List) returns ApiKeySummary, never this. */
export interface CreateApiKeyResponse extends ApiKeySummary {
  secret: string
}
