import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invitationsApi } from './api'
import type { CreateInvitationPayload, AcceptInvitationPayload } from './types'

export const invitationKeys = { all: ['invitations'] as const }

export function useInvitations() {
  return useQuery({ queryKey: invitationKeys.all, queryFn: invitationsApi.list })
}

export function useCreateInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: CreateInvitationPayload) => invitationsApi.create(p),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: invitationKeys.all })
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useResendInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invitationsApi.resend(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: invitationKeys.all }),
  })
}

export function useRevokeInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invitationsApi.revoke(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: invitationKeys.all }),
  })
}

/** Runs pre-login (no session, no query cache worth invalidating) — see
 *  invitationsApi.accept's comment on why this is safe to call through the
 *  same shared api instance. */
export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (p: AcceptInvitationPayload) => invitationsApi.accept(p),
  })
}
