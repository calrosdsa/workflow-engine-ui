// Mirrors internal/integrations.AuthMode (Go). "none" is a plain embed with
// no SSO attempt; "signed_launch" mints a short-lived token the embed
// widget hands to the iframe via a URL fragment (see docs/dashboard-system-plan.md
// section 8.2). RS256/JWKS-based delivery is designed for on the backend
// (SigningAlg field) but not implemented yet — every integration today uses
// "HS256" if AuthMode is signed_launch.
export type IntegrationAuthMode = 'none' | 'signed_launch'

export interface IntegrationClaimsConfig {
  email: boolean
  name: boolean
  roles: boolean
}

// A registered embeddable external app, client-wide or scoped to one app
// (app_id undefined = client-wide, mirroring how AllowedRoleIds-style
// nullable-app-scoping works elsewhere in this codebase). Never includes
// the shared secret — only has_shared_secret, same "never returned in
// plaintext" convention as CredentialSummary/LLMProvider.
export interface EmbeddedIntegration {
  id: string
  app_id?: string
  name: string
  base_url: string
  allowed_origins: string[]
  auth_mode: IntegrationAuthMode
  signing_alg: string
  has_shared_secret: boolean
  claims: IntegrationClaimsConfig
  token_ttl_secs: number
  created_at: string
  updated_at: string
}

// shared_secret is omitted (not sent) on update to mean "leave the existing
// secret alone" — the same blank-field convention CredentialFormDialog's
// backend counterpart already uses. Sending an empty string is treated the
// same as omitting it (see the Go handler's integrationRequest doc comment).
export interface UpsertIntegrationPayload {
  app_id?: string
  name: string
  base_url: string
  allowed_origins: string[]
  auth_mode: IntegrationAuthMode
  signing_alg: string
  shared_secret?: string
  claims: IntegrationClaimsConfig
  token_ttl_secs: number
}

export interface SSOTokenResponse {
  token: string
  expires_in: number
}
