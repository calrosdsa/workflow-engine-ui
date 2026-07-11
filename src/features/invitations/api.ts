import { api } from '@/lib/api'
import type {
  Invitation, CreateInvitationPayload, CreateInvitationResult,
  AcceptInvitationPayload, AcceptInvitationResult,
} from './types'

export const invitationsApi = {
  list:   () => api.get('invitations').json<Invitation[]>(),
  create: (p: CreateInvitationPayload) => api.post('invitations', { json: p }).json<CreateInvitationResult>(),
  resend: (id: string) => api.post(`invitations/${id}/resend`).json<Invitation>(),
  revoke: (id: string) => api.delete(`invitations/${id}`),
  // Safe to call through the same shared `api` ky instance pre-login: its
  // beforeRequest hook (src/lib/api.ts) only attaches X-Client-ID/X-App-ID
  // when activeMembership is set — an unauthenticated caller has none, so
  // no tenant headers get sent, matching what this public backend route
  // (mounted outside RequireTenant) expects.
  accept: (p: AcceptInvitationPayload) => api.post('invitations/accept', { json: p }).json<AcceptInvitationResult>(),
}
