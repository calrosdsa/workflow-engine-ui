import { redirect } from '@tanstack/react-router'
import { authApi } from './api'
import { useAuthStore } from '@/stores/auth'
import type { Me } from './types'

/** Shared `beforeLoad` session check for every route that requires a valid
 *  Limen session (the builder shell and the Runtime Portal) — factored out
 *  so the two routes' auth checks can't drift apart. The Limen session
 *  lives in an HttpOnly cookie (unreadable from JS by design), so the only
 *  source of truth for "is there a valid session" is the server; this hits
 *  it, stores the result, and redirects to /login on failure. Returns the
 *  fetched Me so callers can make routing decisions off it without a
 *  second round-trip. */
export async function requireSession(): Promise<Me> {
  try {
    const me = await authApi.me()
    useAuthStore.getState().setSession(me)
    return me
  } catch {
    throw redirect({ to: '/login' })
  }
}
