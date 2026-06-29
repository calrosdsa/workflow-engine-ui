import ky from 'ky'
import type { VariableDecl } from '@/features/workflows/types'

// All requests go to /api which Vite proxies to localhost:8080.
export const api = ky.create({
  prefix: '/api',
  headers: { 'Content-Type': 'application/json' },
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
