import ky from 'ky'
import type { VariableDecl } from '@/features/workflows/types'
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
