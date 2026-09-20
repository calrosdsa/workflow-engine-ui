import { describe, it, expect } from 'vitest'
import { HTTPError } from 'ky'
import { api, appendRequestId, extractApiError, requestIdOf } from './api'

// 32 hex chars, the shape the engine emits (an OTel trace id).
const ID = '0123456789abcdef0123456789abcdef'

interface FakeOptions {
  /** X-Request-Id header value; null omits the header entirely. */
  id?: string | null
  /** The pre-parsed body ky would have put on HTTPError.data. */
  data?: unknown
}

// Builds the same shape ky throws: a real HTTPError over a real Response, with
// `data` set by hand because that population step lives inside ky's fetch loop.
function httpError(status: number, { id = ID, data }: FakeOptions = {}): HTTPError {
  const headers = new Headers()
  if (id !== null) headers.set('X-Request-Id', id)
  const err = new HTTPError(
    new Response('{}', { status, headers }),
    new Request('http://t/api/x'),
    {} as never,
  )
  err.data = data
  return err
}

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1

describe('requestIdOf', () => {
  it('returns a valid X-Request-Id', () => {
    expect(requestIdOf(httpError(500))).toBe(ID)
  })

  it('does not gate on status: that is the callers job', () => {
    expect(requestIdOf(httpError(400))).toBe(ID)
  })

  it('accepts UUID-style ids and the 8 and 64 char bounds', () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000'
    expect(requestIdOf(httpError(500, { id: uuid }))).toBe(uuid)
    expect(requestIdOf(httpError(500, { id: 'a'.repeat(8) }))).toBe('a'.repeat(8))
    expect(requestIdOf(httpError(500, { id: 'a'.repeat(64) }))).toBe('a'.repeat(64))
  })

  it('is undefined when the header is absent', () => {
    // A 502/504 answered by Caddy/Traefik never reached the engine.
    expect(requestIdOf(httpError(502, { id: null }))).toBeUndefined()
  })

  it.each([
    ['contains a space', 'abc def123456'],
    ['contains markup', '<img src=x onerror=1>'],
    ['is 200 chars long', 'a'.repeat(200)],
    ['is one char over the limit', 'a'.repeat(65)],
    ['is too short', 'a'.repeat(7)],
    ['is empty', ''],
    ['contains an underscore', 'abcdef_123456'],
  ])('rejects a header value that %s', (_label, id) => {
    expect(requestIdOf(httpError(500, { id }))).toBeUndefined()
  })

  it('is undefined for anything that is not an HTTPError', () => {
    expect(requestIdOf(new Error('boom'))).toBeUndefined()
    expect(requestIdOf('boom')).toBeUndefined()
    expect(requestIdOf(null)).toBeUndefined()
    expect(requestIdOf(undefined)).toBeUndefined()
    // Duck-typed lookalike: only a real ky HTTPError is trusted.
    expect(requestIdOf({ response: { headers: new Headers({ 'X-Request-Id': ID }) } })).toBeUndefined()
  })
})

describe('extractApiError', () => {
  it('appends the request id to a 5xx body message', () => {
    const err = httpError(500, { data: { error: 'internal error' } })
    expect(extractApiError(err)).toBe(`internal error (${ID})`)
  })

  it('applies from the 500 boundary upward', () => {
    expect(extractApiError(httpError(499, { data: { error: 'boom' } }))).toBe('boom')
    expect(extractApiError(httpError(500, { data: { error: 'boom' } }))).toBe(`boom (${ID})`)
    expect(extractApiError(httpError(503, { data: { error: 'boom' } }))).toBe(`boom (${ID})`)
  })

  it.each([400, 401, 403, 404, 409, 422])('leaves a %i untouched', (status) => {
    expect(extractApiError(httpError(status, { data: { error: 'boom' } }))).toBe('boom')
  })

  it('leaves a 5xx untouched when the header is absent', () => {
    expect(extractApiError(httpError(502, { id: null, data: { error: 'boom' } }))).toBe('boom')
  })

  it('leaves a 5xx untouched when the header is malformed', () => {
    for (const id of ['abc def123456', '<b>bold</b>id', 'a'.repeat(200)]) {
      expect(extractApiError(httpError(500, { id, data: { error: 'boom' } }))).toBe('boom')
    }
  })

  it('still falls back to the error message without a body message', () => {
    const err = httpError(500)
    expect(extractApiError(err)).toBe(err.message)
  })

  it('does not double the id when the hook already stamped the fallback message', () => {
    // No data.error, so extractApiError returns err.message, which
    // appendRequestId has already suffixed. Appending again would print the
    // id twice. A hand-built error that never ran the hook cannot catch this.
    const err = httpError(500)
    appendRequestId({ error: err })
    expect(count(extractApiError(err), ID)).toBe(1)
  })

  it('passes non-HTTP errors through unchanged', () => {
    expect(extractApiError(new Error('network down'))).toBe('network down')
    expect(extractApiError('plain string')).toBe('plain string')
  })
})

describe('appendRequestId (ky beforeError hook)', () => {
  it('appends the id to a 5xx message exactly once and returns the same error', () => {
    const err = httpError(500)
    const before = err.message
    const out = appendRequestId({ error: err })
    expect(out).toBe(err)
    expect(err.message).toBe(`${before} (${ID})`)
    expect(count(err.message, ID)).toBe(1)
  })

  it('leaves the message alone for a 4xx', () => {
    const err = httpError(404)
    const before = err.message
    appendRequestId({ error: err })
    expect(err.message).toBe(before)
  })

  it('leaves the message alone when the header is absent or malformed', () => {
    for (const id of [null, 'abc def123456', '<b>', 'a'.repeat(200)]) {
      const err = httpError(500, { id })
      const before = err.message
      appendRequestId({ error: err })
      expect(err.message).toBe(before)
    }
  })

  it('returns a non-HTTPError untouched', () => {
    const err = new TypeError('Failed to fetch')
    const out = appendRequestId({ error: err })
    expect(out).toBe(err)
    expect(out.message).toBe('Failed to fetch')
  })
})

describe('api instance end to end', () => {
  // retry: 0 so ky does not re-issue the GET on a 5xx and the fake sees one call.
  const call = (res: Response) =>
    api
      .extend({ prefix: 'http://t/api', retry: 0, fetch: async () => res })
      .get('x')
      .then(
        () => {
          throw new Error('expected the request to reject')
        },
        (e: unknown) => e as Error,
      )

  const failure = (status: number, body: string, headers: Record<string, string> = {}) =>
    new Response(body, {
      status,
      headers: { 'Content-Type': 'application/json', 'X-Request-Id': ID, ...headers },
    })

  it('stamps the id on the message and on extractApiError for a 500 with a body', async () => {
    const e = await call(failure(500, '{"error":"internal error"}'))
    expect(e.message.endsWith(` (${ID})`)).toBe(true)
    expect(count(e.message, ID)).toBe(1)
    expect(extractApiError(e)).toBe(`internal error (${ID})`)
  })

  it('shows the id once when the 5xx has no parseable body', async () => {
    const e = await call(failure(500, ''))
    // The empty body is what sends extractApiError down its err.message
    // fallback, the path where a second append would double the id.
    expect((e as HTTPError).data).toBeUndefined()
    expect(count(e.message, ID)).toBe(1)
    expect(count(extractApiError(e), ID)).toBe(1)
  })

  it('adds nothing for a 4xx', async () => {
    const e = await call(failure(409, '{"error":"already exists"}'))
    expect(e.message).not.toContain(ID)
    expect(extractApiError(e)).toBe('already exists')
  })

  it('adds nothing when the edge answered without the header', async () => {
    const res = new Response('bad gateway', { status: 502, headers: { 'Content-Type': 'text/plain' } })
    const e = await call(res)
    expect(e.message).not.toMatch(/\)$/)
    expect(extractApiError(e)).toBe(e.message)
  })
})
