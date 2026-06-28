export type FieldType =
  | 'string' | 'text' | 'integer' | 'decimal' | 'boolean'
  | 'date' | 'time' | 'datetime' | 'email' | 'phone'
  | 'json' | 'file' | 'enum' | 'reference'

export interface FieldDef {
  name: string
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
  created_at: string
  updated_at: string
  migration_warnings?: string[]
}

export type CreateFormPayload = Omit<FormDefinition, 'id' | 'created_at' | 'updated_at' | 'migration_warnings'>
export type UpdateFormPayload = CreateFormPayload

export type FormRecord = Record<string, unknown>
