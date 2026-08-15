// Mirrors internal/integrations.AuthMode (Go). "none" is a plain embed with
// no SSO attempt; "signed_launch" mints a short-lived token the embed
// widget hands to the iframe via a URL fragment (see docs/dashboard-system-plan.md
// section 8.2). RS256/JWKS-based delivery is designed for on the backend
// (SigningAlg field) but not implemented yet — every integration today uses
// "HS256" if AuthMode is signed_launch. "oidc" (FR-D3-008) silently
// authenticates the current end user against an external IdP via a hidden
// prompt=none iframe, rather than asserting the platform's own session
// identity the way signed_launch does — see useOidcHandshake.ts.
export type IntegrationAuthMode = 'none' | 'signed_launch' | 'oidc'

export interface IntegrationClaimsConfig {
  email: boolean
  name: boolean
  roles: boolean
}

// A registered embeddable external app, client-wide or scoped to one app
// (app_id undefined = client-wide, mirroring how AllowedRoleIds-style
// nullable-app-scoping works elsewhere in this codebase). Never includes
// the shared secret — only has_shared_secret, same "never returned in
// plaintext" convention as CredentialSummary/LLMProvider. The oidc_* fields
// are populated only when auth_mode === 'oidc'; oidc_has_client_secret
// mirrors has_shared_secret's own "presence, never the value" stance.
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
  oidc_issuer_url?: string
  oidc_client_id?: string
  oidc_has_client_secret?: boolean
  oidc_scopes?: string[]
  created_at: string
  updated_at: string
}

// shared_secret/oidc_client_secret are omitted (not sent) on update to mean
// "leave the existing secret alone" — the same blank-field convention
// CredentialFormDialog's backend counterpart already uses. Sending an empty
// string is treated the same as omitting it (see the Go handler's
// integrationRequest doc comment).
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
  oidc_issuer_url?: string
  oidc_client_id?: string
  oidc_client_secret?: string
  oidc_scopes?: string[]
}

export interface SSOTokenResponse {
  token: string
  expires_in: number
}

// GET /integrations/{id}/runtime-info's response — the menus:read-gated,
// non-admin subset of EmbeddedIntegration an ordinary runtime session (any
// signed-in end user viewing a published app, not just a builder/admin) can
// fetch to drive an embed's client-side SSO handshake. Deliberately NOT a
// Pick<EmbeddedIntegration, ...> alias -- keeping it a separate type makes
// it a compile error to accidentally pass a full EmbeddedIntegration where
// this narrower shape was the point, and keeps this file the one place that
// needs updating if the backend's runtimeInfoResponse ever changes shape.
export interface IntegrationRuntimeInfo {
  auth_mode: IntegrationAuthMode
  allowed_origins: string[]
}

// The minimal shape useSsoHandshake/useOidcHandshake actually destructure —
// `id` + IntegrationRuntimeInfo's two fields. A full EmbeddedIntegration
// satisfies this structurally (no cast needed at call sites that already
// have one, e.g. the config-time picker), and so does an
// IntegrationRuntimeInfo + the id the caller already knows from
// config.integrationId (the runtime Renderer.tsx path, which never fetches
// a full EmbeddedIntegration at all). Keeping the handshake hooks' param
// type this narrow, rather than the full EmbeddedIntegration, is what makes
// it possible for a menus:read-only runtime session to use them at all.
export type IntegrationHandshakeInfo = Pick<EmbeddedIntegration, 'id' | 'auth_mode' | 'allowed_origins'>

// StartOIDCFlowResponse is what POST /integrations/{id}/oidc/start returns —
// the IdP's /authorize URL (with prompt=none already attached) for the
// frontend to load in a hidden iframe. See useOidcHandshake.ts.
export interface StartOIDCFlowResponse {
  authorize_url: string
}
