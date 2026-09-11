// Mirrors internal/appsettings.CredentialType (Go) — widened from a closed
// 'basic' | 'bearer' | 'api_key' union to a plain string once credential
// types became extensible: a package can declare its own named type (e.g.
// "whatsapp_api") via GET /meta/credential-types (see CredentialTypeInfo
// below), not just the 3 built-ins. BuiltinCredentialType keeps the closed
// shape for call sites that only ever mean one of the 3 (kept for
// documentation value — nothing currently narrows to it).
export type CredentialType = string
export type BuiltinCredentialType = 'basic' | 'bearer' | 'api_key'

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

/** A package-declared named type's value has whatever fields its
 *  CredentialTypeSpec.fields[] says — known only at runtime, from the
 *  served registry (see CredentialTypeInfo below), so it can't be typed any
 *  more precisely than a plain record the way the 3 built-ins can. */
export type CredentialValue = BasicCredentialValue | BearerCredentialValue | ApiKeyCredentialValue | Record<string, string>

export interface UpsertCredentialPayload {
  type: CredentialType
  value: CredentialValue
}

// ---------------------------------------------------------------------------
// Credential TYPES (what fields a creation form should render) — mirrors
// internal/appsettings.CredentialTypeField/CredentialTypeSpec (Go). Served
// by GET /meta/credential-types: appsettings.BuiltinCredentialTypes (basic/
// bearer/api_key) merged with every currently-loaded package's own
// credential_types — see api/meta/credentialtypes.go's own file comment for
// why this is a dedicated endpoint, not folded into node-taxonomy.
// ---------------------------------------------------------------------------

export interface CredentialTypeField {
  key: string
  label: string
  secret: boolean
  required?: boolean
  /** Constrains the field to one of a fixed set of choices (e.g. api_key's
   *  location: "header"/"query"), rendered as a select instead of a text
   *  input. Omit for a free-text field. */
  options?: string[]
}

export interface CredentialTypeInfo {
  name: string
  display_name: string
  fields: CredentialTypeField[]
  /** True for one of the 3 always-available shapes; omitted (falsy) for a
   *  type a currently-loaded package declared. */
  built_in?: boolean
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
