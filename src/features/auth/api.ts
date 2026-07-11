import { api } from '@/lib/api'
import type { Me, User } from './types'

// Route paths verified against installed Limen v0.1.3 source, not assumed
// from docs: credential-password plugin registers /signup/credential
// ({email, password}) and /signin/credential ({credential, password} —
// "credential" is the email or username); Limen's core registers
// /signout; the oauth plugin registers /:provider/authorize.
// All relative to the /auth base path.
export const authApi = {
  login: (credential: string, password: string) =>
    api.post('auth/signin/credential', { json: { credential, password } }).json<{ user: User }>(),

  signup: (email: string, password: string) =>
    api.post('auth/signup/credential', { json: { email, password } }).json<{ user: User }>(),

  logout: () => api.post('auth/signout'),

  me: () => api.get('auth/me').json<Me>(),

  googleAuthorizeUrl: () => '/api/auth/google/authorize',
}
