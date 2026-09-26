import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isRedirect } from '@tanstack/react-router'
import { HTTPError } from 'ky'
import { authApi } from './api'
import { requireSession } from './requireSession'
import { useAuthStore } from '@/stores/auth'
import type { Me } from './types'

// The same shape ky throws for a non-2xx answer (see lib/api.test.ts).
function httpError(status: number): HTTPError {
  return new HTTPError(new Response('{}', { status }), new Request('http://t/api/auth/me'), {} as never)
}

const me: Me = { user_id: 'user-1', email: 'someone@example.test', memberships: [] }

describe('requireSession', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useAuthStore.getState().clear()
  })

  it('returns the session and stores it', async () => {
    vi.spyOn(authApi, 'me').mockResolvedValue(me)
    await expect(requireSession()).resolves.toEqual(me)
    expect(useAuthStore.getState().session).toEqual(me)
  })

  it('sends a caller with no session (401) to /login', async () => {
    vi.spyOn(authApi, 'me').mockRejectedValue(httpError(401))
    const thrown = await requireSession().catch((e: unknown) => e)
    expect(isRedirect(thrown)).toBe(true)
    expect(isRedirect(thrown) && thrown.options.to).toBe('/login')
  })

  // A server or proxy failure says nothing about the session. Sending the
  // user to /login for one signed them out whenever the API blinked.
  it.each([500, 502, 503])('rethrows a %i instead of sending the user to /login', async (status) => {
    const failure = httpError(status)
    vi.spyOn(authApi, 'me').mockRejectedValue(failure)
    const thrown = await requireSession().catch((e: unknown) => e)
    expect(isRedirect(thrown)).toBe(false)
    expect(thrown).toBe(failure)
    expect(useAuthStore.getState().session).toBeNull()
  })

  it('rethrows a dropped connection instead of sending the user to /login', async () => {
    const failure = new TypeError('Failed to fetch')
    vi.spyOn(authApi, 'me').mockRejectedValue(failure)
    const thrown = await requireSession().catch((e: unknown) => e)
    expect(isRedirect(thrown)).toBe(false)
    expect(thrown).toBe(failure)
  })
})
