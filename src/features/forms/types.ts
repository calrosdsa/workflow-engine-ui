export type FieldType =
  | 'string' | 'text' | 'integer' | 'decimal' | 'boolean'
  | 'date' | 'time' | 'datetime' | 'email' | 'phone'
  | 'json' | 'file' | 'enum' | 'reference'
  // System-managed column on a Line Items child form linking a row back to
  // its parent record (UUID, cascade-deletes with the parent). Never used
  // directly by the form builder's field palette.
  | 'parent_link'
  // Read-only, virtual field on a PARENT form that resolves at read time to
  // the row count of one of the parent's own Line Items children. Never gets
  // a physical column — reference_table holds the target child form's id.
  | 'line_item_count'
  // Virtual field on a PARENT form marking that one of its Line Items grids
  // targets an ADOPTED form (an ordinary, independently-visible form with
  // its own workflows/permissions/standalone page, not a hidden generated
  // child) — never gets a physical column. reference_table holds the
  // adopted form's id; adopted_reference_field names the field on that form
  // pointing back at this parent. Never used directly by the field palette.
  | 'line_item_adopted'

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
  /** Which aggregate a 'line_item_count' field computes over reference_table's
   *  rows. Undefined/'count' is the original count-only behavior. */
  aggregate_fn?: 'count' | 'sum' | 'avg' | 'min' | 'max'
  /** Name (not physical column) of the numeric field on reference_table to
   *  aggregate. Required whenever aggregate_fn is anything but 'count'. */
  aggregate_field?: string
  /** Name of an ordinary TypeReference field on reference_table pointing
   *  back at this parent. Required when type === 'line_item_adopted'; also
   *  reused on a 'line_item_count' field when its target is an adopted form
   *  rather than a generated child (see the backend's doc comment on this
   *  same wire key for why one field carries both meanings). */
  adopted_reference_field?: string
  description?: string
  /** Marks this field as (one of, possibly several) fields used to build a
   *  human-readable title for a record of this form, shown wherever the
   *  runtime would otherwise display the record's raw id. When several
   *  fields set this, the runtime concatenates their formatted values in
   *  field order. Falls back to the legacy name/label/id heuristic when no
   *  field on the form sets this. See features/forms/runtime/record-title.ts. */
  is_record_title?: boolean
  /** Marks this field as included in the form's combined full-text search
   *  column ("tsv", generated server-side from all searchable fields).
   *  Only meaningful for text-like types (string/text/email/phone). */
  searchable?: boolean
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
  /** Backend-readable mirror of schema.settings.createUser — explicit typed
   *  fields (not parsed out of the opaque `layout` blob) so record creation
   *  can provision a real user account. Derived from schema.settings.createUser
   *  by form-builder/serialize.ts's toPayload; the builder's own source of
   *  truth stays schema.settings.createUser, hydrated from `layout` as usual. */
  create_user_on_submit?: boolean
  create_user_name_field?: string
  create_user_email_field?: string
  create_user_role_field?: string
  /** Parent-configured row-count bounds for a Line Items child form (only
   *  meaningful when is_line_items is true), enforced server-side alongside
   *  each row's own validation. Mirrors the owning 'line_items' element's
   *  lineItemConfig.minRows/maxRows — set by form-builder/lineItemsSync.ts
   *  on every child-form save. 0/absent means "no bound" for either. */
  line_items_min_rows?: number
  line_items_max_rows?: number
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
