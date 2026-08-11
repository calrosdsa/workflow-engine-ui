export interface Role {
  id: string
  client_id: string
  app_id: string
  name: string
  permissions: string[]
  /** Per-form field mask ({"<form_id>": ["field1", ...]}) — fields this
   *  role's holders never see on any record read (view-only enforcement, no
   *  write-side restriction). Editable via RoleFormDrawer's "Hide fields
   *  from this role" section (FR-C7-003). */
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
