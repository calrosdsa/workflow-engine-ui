export interface Role {
  id: string
  client_id: string
  app_id: string
  name: string
  permissions: string[]
  /** Per-form field mask ({"<form_id>": ["field1", ...]}) — fields this
   *  role's holders never see on any record read (view-only enforcement, no
   *  write-side restriction). Editable via RoleFormDrawer's "Hide fields
   *  from this role" section (FR-C7-003).
   *
   *  Older, role-level mechanism — still fully supported, never removed
   *  (backend COMPATIBILITY.md Rule 2). A field's own hide_rules (Advanced
   *  Settings, "hidden_in_ui" action) is the newer per-field alternative:
   *  finer-grained (per field/audience/condition) and, unlike this setting,
   *  never bypassed for a Super Admin. Prefer hide_rules for new masking. */
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
