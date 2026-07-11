import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi } from './api'
import { useAuthStore } from '@/stores/auth'

export function useMe() {
  return useQuery({ queryKey: ['auth', 'me'], queryFn: authApi.me, retry: false })
}

export function useLogin() {
  const qc = useQueryClient()
  const setSession = useAuthStore((s) => s.setSession)
  return useMutation({
    mutationFn: ({ credential, password }: { credential: string; password: string }) =>
      authApi.login(credential, password),
    onSuccess: async () => {
      const me = await authApi.me()
      setSession(me)
      qc.setQueryData(['auth', 'me'], me)
    },
  })
}

export function useSignup() {
  const qc = useQueryClient()
  const setSession = useAuthStore((s) => s.setSession)
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.signup(email, password),
    onSuccess: async () => {
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
