export interface Role {
  id: string
  client_id: string
  app_id: string
  name: string
  permissions: string[]
  is_builtin: boolean
  created_at: string
}

export interface CreateRolePayload {
  app_id: string
  name: string
  permissions: string[]
}

export type UpdateRolePayload = CreateRolePayload
