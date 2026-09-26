import { redirect } from '@tanstack/react-router'
import { HTTPError } from 'ky'
import { authApi } from './api'
import { useAuthStore } from '@/stores/auth'
import type { Me } from './types'

/** Shared `beforeLoad` session check for every route that requires a valid
 *  Limen session (the builder shell and the Runtime Portal) — factored out
 *  so the two routes' auth checks can't drift apart. The Limen session
 *  lives in an HttpOnly cookie (unreadable from JS by design), so the only
 *  source of truth for "is there a valid session" is the server; this hits
 *  it, stores the result, and redirects to /login when the server says there
 *  is no session (a 401). Returns the fetched Me so callers can make routing
 *  decisions off it without a second round-trip. */
export async function requireSession(): Promise<Me> {
  try {
    const me = await authApi.me()
    useAuthStore.getState().setSession(me)
    return me
  } catch (err) {
    // Only a 401 means there is no session. A 500 (the server couldn't read
    // the session), a 502 from the proxy during a rollout or a dropped
    // connection says nothing about it, and answering those with /login
    // signed people out over a blip. Rethrown, the error lands on the
    // route's error page, and a reload recovers once the server does.
    if (err instanceof HTTPError && err.response.status === 401) {
      throw redirect({ to: '/login' })
    }
    throw err
  }
}
