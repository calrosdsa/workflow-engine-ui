export interface InvitationGrant {
  app_id: string
  role_id: string
}

export interface Invitation {
  id: string
  client_id: string
  email: string
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  grants: InvitationGrant[]
  invited_by: string
  expires_at: string
  accepted_at?: string
  resent_at?: string
  created_at: string
}

export interface CreateInvitationPayload {
  email: string
  grants: InvitationGrant[]
}

export interface CreateInvitationResult {
  immediate: boolean
  user_id?: string
  invitation_id?: string
}

export interface AcceptInvitationPayload {
  token: string
  password: string
  first_name: string
  last_name: string
}

export interface AcceptInvitationResult {
  email: string
  message: string
}
