export type FieldType =
  | 'string' | 'text' | 'integer' | 'decimal' | 'boolean'
  | 'date' | 'time' | 'datetime' | 'email' | 'phone'
  | 'json' | 'file' | 'enum' | 'reference'

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
  created_at: string
  updated_at: string
  migration_warnings?: string[]
}

export type CreateFormPayload = Omit<FormDefinition, 'id' | 'created_at' | 'updated_at' | 'migration_warnings'>
export type UpdateFormPayload = CreateFormPayload

export type FormRecord = Record<string, unknown>
