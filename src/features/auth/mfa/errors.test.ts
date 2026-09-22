import { describe, expect, it } from 'vitest'
import { HTTPError } from 'ky'
import { mfaFailure } from './errors'

// The same shape ky throws: a real HTTPError over a real Response.
function httpError(status: number): HTTPError {
  return new HTTPError(new Response('{}', { status }), new Request('http://t/api/auth/mfa/verify'), {} as never)
}

describe('mfaFailure', () => {
  // One row per status the engine's internal/auth/mfa/errors.go can send.
  it.each([
    [400, 'invalid_code'],
    [429, 'too_many_attempts'],
    [409, 'conflict'],
    [500, 'server'],
    [503, 'server'],
  ] as const)('maps %i to %s', (status, want) => {
    expect(mfaFailure(httpError(status))).toBe(want)
  })

  it('treats a failure with no HTTP response as a network problem, not a wrong code', () => {
    expect(mfaFailure(new TypeError('Failed to fetch'))).toBe('network')
    expect(mfaFailure(undefined)).toBe('network')
  })

  it('never reports a server fault as the user having typed the wrong code', () => {
    // The original bug, from the other side: every failure read as a wrong code.
    expect(mfaFailure(httpError(500))).not.toBe('invalid_code')
    expect(mfaFailure(httpError(429))).not.toBe('invalid_code')
  })
})
