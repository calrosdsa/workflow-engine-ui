export interface Role {
  id: string
  client_id: string
  app_id: string
  name: string
  permissions: string[]
  /** Per-form field mask ({"<form_id>": ["field1", ...]}) — fields this
   *  role's holders never see on any record read (view-only enforcement, no
   *  write-side restriction). No editor UI yet; round-tripped so a role
   *  fetched and re-saved through the existing editor doesn't silently drop
   *  a mask set some other way (e.g. directly via the API). */
  hidden_fields?: Record<string, string[]>
  is_builtin: boolean
  created_at: string
}

export interface CreateRolePayload {
  app_id: string
  name: string
  permissions: string[]
  hidden_fields?: Record<string, string[]>
}

export type UpdateRolePayload = CreateRolePayload
