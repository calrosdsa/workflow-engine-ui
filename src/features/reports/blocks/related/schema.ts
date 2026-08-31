import type { ColumnConfig } from '../table/schema'

// Mirrors internal/reports.RelatedBlockConfig (Go, block_related.go)
// exactly — snake_case field names matching the wire schema (FR-J1-002 §1).
// Scoped to v1 to the GENERATED Line Items relationship only (child_form_id
// must be a form with is_line_items=true and parent_form_id === this
// config's own parent_form_id) — an adopted-form or plain-reference
// relationship is a natural extension of this same block type later, not
// exposed by this config shape yet.
export interface RelatedBlockConfig {
  parent_form_id: string
  child_form_id: string
  columns?: ColumnConfig[]
  limit?: number
}

export function emptyRelatedBlockConfig(): RelatedBlockConfig {
  return { parent_form_id: '', child_form_id: '' }
}

/** Defensive parse — never throws, heals a malformed/stale blob. */
export function parseRelatedBlockConfig(raw: unknown): RelatedBlockConfig {
  const empty = emptyRelatedBlockConfig()
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>
  return {
    parent_form_id: typeof r.parent_form_id === 'string' ? r.parent_form_id : empty.parent_form_id,
    child_form_id: typeof r.child_form_id === 'string' ? r.child_form_id : empty.child_form_id,
    columns: Array.isArray(r.columns) ? (r.columns as ColumnConfig[]) : empty.columns,
    limit: typeof r.limit === 'number' ? r.limit : undefined,
  }
}
