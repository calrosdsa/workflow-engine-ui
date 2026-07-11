export type FieldType =
  | 'string' | 'text' | 'integer' | 'decimal' | 'boolean'
  | 'date' | 'time' | 'datetime' | 'email' | 'phone'
  | 'json' | 'file' | 'enum' | 'reference'
  // System-managed column on a Line Items child form linking a row back to
  // its parent record (UUID, cascade-deletes with the parent). Never used
  // directly by the form builder's field palette.
  | 'parent_link'

export interface FieldDef {
  name: string
  /** Immutable physical Postgres column name, assigned by the backend on first
   *  save. Renaming `name`/`label` never changes this, so data is preserved. */
  column?: string
  label: string
  type: FieldType
  required?: boolean
  unique?: boolean
  index?: boolean
  default?: string
  enum_values?: string[]
  reference_table?: string
  /** Name of the field on the target form (reference_table) to display/search
   *  for this reference. Optional; when absent, consumers fall back to
   *  name/label/id heuristics. Only meaningful when type === 'reference'. */
  display_field?: string
  description?: string
}

export interface FormDefinition {
  id: string
  name: string
  slug: string
  description?: string
  fields: FieldDef[]
  /** Opaque builder layout schema (sections/columns/elements). Round-trips
   *  losslessly via the backend `layout` JSONB column. */
  layout?: unknown
  /** Immutable physical table name (read-only; backend-assigned). */
  physical_table?: string
  /** Optional parent form (within the same app) — makes this a "dependent
   *  form" nested under the parent in the forms tree view. */
  parent_form_id?: string
  /** True when this form is the generated child table backing a Line Items
   *  field on its parent. Hidden from the standalone forms list/tree; its
   *  rows are only ever read/written nested on the parent record. */
  is_line_items?: boolean
  created_at: string
  updated_at: string
  migration_warnings?: string[]
}

export type CreateFormPayload = Omit<FormDefinition, 'id' | 'created_at' | 'updated_at' | 'migration_warnings'>
export type UpdateFormPayload = CreateFormPayload

export type FormRecord = Record<string, unknown>

export interface AuditFieldChange {
  old: unknown
  new: unknown
}

export interface AuditLogEntry {
  id: string
  client_id: string
  app_id?: string
  form_id: string
  record_id: string
  action: 'create' | 'update' | 'delete'
  actor_user_id?: string
  actor_workflow_execution_id?: string
  field_changes?: Record<string, AuditFieldChange>
  created_at: string
}

export interface AuditLogResponse {
  entries: AuditLogEntry[]
  total: number
  page: number
  page_size: number
}

export interface LinkedRecordGroup {
  form_id: string
  form_name: string
  field_name: string
  field_label: string
  records: FormRecord[]
  total: number
  page: number
  page_size: number
}

export interface LinkedRecordsResponse {
  groups: LinkedRecordGroup[]
}
