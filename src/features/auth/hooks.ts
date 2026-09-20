import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi } from './api'
import { isMfaChallenge } from './mfa/api'
import { useAuthStore } from '@/stores/auth'

export function useMe() {
  return useQuery({ queryKey: ['auth', 'me'], queryFn: authApi.me, retry: false })
}

export function useLogin() {
  const loadSession = useLoadSession()
  return useMutation({
    mutationFn: ({ credential, password }: { credential: string; password: string }) =>
      authApi.login(credential, password),
    onSuccess: async (result) => {
      // A challenge carries no session, so /auth/me would 401. The caller
      // renders the second step and loads the session once it completes.
      if (isMfaChallenge(result)) return
      await loadSession()
    },
  })
}

/** Loads /auth/me into the store and the query cache. Used after an ordinary
 *  sign-in and again after an MFA challenge completes, which is the point at
 *  which a session finally exists. */
export function useLoadSession() {
  const qc = useQueryClient()
  const setSession = useAuthStore((s) => s.setSession)
  return async () => {
    const me = await authApi.me()
    setSession(me)
    qc.setQueryData(['auth', 'me'], me)
    return me
  }
}

export function useSignup() {
  const qc = useQueryClient()
  const setSession = useAuthStore((s) => s.setSession)
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.signup(email, password),
    onSuccess: async (result) => {
      if (isMfaChallenge(result)) return
      const me = await authApi.me()
      setSession(me)
      qc.setQueryData(['auth', 'me'], me)
    },
  })
}

export function useLogout() {
  const qc = useQueryClient()
  const clear = useAuthStore((s) => s.clear)
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      clear()
      qc.setQueryData(['auth', 'me'], null)
      window.location.href = '/login'
    },
  })
}
