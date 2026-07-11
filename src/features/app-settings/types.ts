// Mirrors internal/appsettings.CredentialType (Go) — 'basic' | 'bearer' | 'api_key'.
export type CredentialType = 'basic' | 'bearer' | 'api_key'

/** List-view shape — deliberately excludes the decrypted value (the API
 *  never returns it; see api/appsettings/handler.go's ListCredentials). */
export interface CredentialSummary {
  name: string
  type: CredentialType
  created_at: string
  updated_at: string
}

export interface BasicCredentialValue {
  username: string
  password: string
}

export interface BearerCredentialValue {
  token: string
}

export interface ApiKeyCredentialValue {
  key: string
  location: 'header' | 'query'
  param_name: string
}

export type CredentialValue = BasicCredentialValue | BearerCredentialValue | ApiKeyCredentialValue

export interface UpsertCredentialPayload {
  type: CredentialType
  value: CredentialValue
}

/** Non-secret, app-scoped named value addressable from workflow expressions
 *  as AppSettings["name"]. */
export interface AppVariable {
  name: string
  value: unknown
  created_at: string
  updated_at: string
}

export interface UpsertVariablePayload {
  value: unknown
}
