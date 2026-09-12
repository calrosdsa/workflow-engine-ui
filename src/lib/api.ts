import ky, { HTTPError } from 'ky'
import type { VariableDecl, HttpRequestConfig } from '@/features/workflows/types'
import { useAuthStore } from '@/stores/auth'

// All requests go to /api which Vite proxies to localhost:8080. The Vite
// proxy makes this same-origin from the browser's perspective in dev, so the
// Limen session cookie is sent automatically with ky's default 'same-origin'
// credentials — no explicit `credentials: 'include'` needed here. (If UI and
// API end up cross-origin in production, this needs `credentials: 'include'`
// plus CORS configured to allow the UI's origin with credentials.)
export const api = ky.create({
  prefix: '/api',
  headers: { 'Content-Type': 'application/json' },
  hooks: {
    // ky v2's beforeRequest/afterResponse hooks receive a single state
    // object ({ request, options, response, retryCount }), not positional
    // (request, options, response) args — verified against the installed
    // ky@2.0.2 type definitions after a runtime TypeError surfaced from the
    // old 3-positional-arg signature (response was always undefined).
    beforeRequest: [
      ({ request }) => {
        const active = useAuthStore.getState().activeMembership
        if (active) {
          request.headers.set('X-Client-ID', active.client_id)
          if (active.app_id) request.headers.set('X-App-ID', active.app_id)
        }
      },
    ],
    afterResponse: [
      ({ response }) => {
        // A 401 here means either "no session" or "session valid but no
        // membership matches the requested client/app" (RequireTenant
        // returns 401 for both — see internal/middleware/tenant.go). Only
        // treat this as a real logout if we THOUGHT we had tenant context
        // to send; a user with zero memberships will always 401 on
        // resource endpoints (nothing to scope to) without their session
        // having expired, so force-redirecting them would bounce a
        // successful login straight back to /login.
        if (response.status === 401 && useAuthStore.getState().activeMembership) {
          useAuthStore.getState().clear()
          if (!window.location.pathname.startsWith('/login')) {
            window.location.href = '/login'
          }
        }
      },
    ],
  },
})

/** Extracts the human-readable message from a failed `api.*` call — every
 *  handler in this backend responds to an error with respond.Error's
 *  `{"error": "..."}` JSON shape (api/respond/respond.go). ky pre-parses the
 *  response body into HTTPError.data and consumes the stream doing so — its
 *  own docs are explicit that `err.response.json()`/`.clone()` no longer
 *  work at that point, so `data` (not the response) is the only way to read
 *  it here. Falls back to the raw error's message for a non-HTTP failure
 *  (network down, aborted) or a body that wasn't this JSON shape. */
export function extractApiError(err: unknown): string {
  if (err instanceof HTTPError) {
    const data = err.data as { error?: string } | undefined
    if (data?.error) return data.error
  }
  return err instanceof Error ? err.message : String(err)
}

// ---------------------------------------------------------------------------
// Expression validation / preview
// ---------------------------------------------------------------------------

export interface ExpressionPreview {
  value: unknown
  type: string
}

export interface ExpressionValidateResult {
  valid: boolean
  error?: string
  stage?: 'compile' | 'evaluate'
  preview?: ExpressionPreview
}

export interface ExpressionValidateRequest {
  expression: string
  variables: VariableDecl[]
  evaluate?: boolean
  sample_values?: Record<string, unknown>
}

/** Validates (and optionally previews) an Expr expression against the real
 *  backend engine. Never throws on an invalid expression — the result carries
 *  `valid: false` with a message. Only throws on network/server failure. */
export async function validateExpression(
  req: ExpressionValidateRequest,
  signal?: AbortSignal,
): Promise<ExpressionValidateResult> {
  return api
    .post('expressions/validate', {
      json: { evaluate: true, ...req },
      signal,
    })
    .json<ExpressionValidateResult>()
}

// ---------------------------------------------------------------------------
// HTTP request test-execute (Workflow Builder's http_request node —
// "send request" preview and the auto-map feature that proposes a
// ResponseSchema from the real response). Mirrors api/httprequesttest's
// testRequestRequest/testRequestResponse wire shapes exactly.
// ---------------------------------------------------------------------------

export interface HttpRequestTestRequest {
  configuration: HttpRequestConfig
  variables?: VariableDecl[]
  sample_values?: Record<string, unknown>
}

export interface HttpRequestTestResult {
  status_code: number
  status: string
  headers: Record<string, string>
  headers_all: Record<string, string[]>
  body: unknown
  body_text: string
  is_json: boolean
  duration_ms: number
  ok: boolean
  /** A soft/business-logic failure (bad config, an unresolvable expression,
   *  or a transport failure like DNS/timeout) — every other field is
   *  zero-valued when set. Distinct from a non-2xx HTTP response, which is
   *  a SUCCESSFUL test (ok: false, a real status_code/body). */
  error?: string
}

/** Fires a real outbound HTTP call built from an http_request node's config
 *  — gated server-side behind workflows:write (unlike validateExpression's
 *  unauthenticated endpoint), since this makes real network I/O and can
 *  resolve a saved credential into the outgoing request. Never throws on a
 *  bad config/unreachable target — the result carries `error` with a
 *  message. Only throws on a genuine failure to reach this backend itself. */
export async function testHttpRequest(
  req: HttpRequestTestRequest,
  signal?: AbortSignal,
): Promise<HttpRequestTestResult> {
  return api
    .post('http-request/test', { json: req, signal })
    .json<HttpRequestTestResult>()
}

// ---------------------------------------------------------------------------
// Node preview (Workflow Builder's set_variable/condition nodes — the only
// node types whose real activity is I/O-free enough to run outside Temporal
// for a design-time preview). Mirrors api/nodetest's request/response wire
// shapes exactly; response fields match activities.NodeOutput's own JSON
// tags directly, no separate DTO on the Go side.
// ---------------------------------------------------------------------------

export interface TestNodeRequest {
  node_type: 'set_variable' | 'condition'
  configuration: unknown
  variables?: VariableDecl[]
  variable_values?: Record<string, unknown>
  node_outputs?: Record<string, Record<string, unknown>>
  trigger_record?: Record<string, unknown>
}

export interface TestNodeResult {
  updated_variables?: Record<string, unknown>
  node_output?: Record<string, unknown>
  branch_taken?: string
  /** A soft/business-logic failure (bad config, an expression referencing an
   *  ancestor with no captured output) — carried here rather than thrown. */
  error?: string
}

/** Runs a set_variable/condition node's REAL evaluation logic — the same
 *  activity function a live workflow run would call, just outside Temporal
 *  — against caller-supplied variables/upstream outputs. Never throws on a
 *  bad config/expression; the result carries `error` with a message. Only
 *  throws on a genuine failure to reach this backend itself. */
export async function testWorkflowNode(
  req: TestNodeRequest,
  signal?: AbortSignal,
): Promise<TestNodeResult> {
  return api
    .post('nodes/test', { json: req, signal })
    .json<TestNodeResult>()
}

// ---------------------------------------------------------------------------
// Embed-check (Custom menu type, embed mode)
// ---------------------------------------------------------------------------

export interface EmbedCheckResult {
  can_embed: boolean
  reason?: string
}

/** Checks whether a URL's response headers (X-Frame-Options / CSP
 *  frame-ancestors) allow it to be embedded in an iframe. There is no
 *  reliable client-side signal for this (a blocked iframe still fires the
 *  DOM `load` event in Chromium), so this is a deterministic, header-based
 *  server check — see api/embedcheck/handler.go. Never throws on an
 *  unreachable/malformed URL — the result carries `can_embed: false` with a
 *  reason. Only throws on a genuine network/server failure reaching our own
 *  backend. */
export async function checkEmbeddable(url: string, signal?: AbortSignal): Promise<EmbedCheckResult> {
  return api.post('embed-check', { json: { url }, signal }).json<EmbedCheckResult>()
}
