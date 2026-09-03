// FR-D2-014: Saved Views for Search menus. Mirrors the backend's
// SavedViewRow (internal/menus/store/saved_views.go) and savedViewResponse
// (api/menus/saved_views.go) exactly.
import type { FilterGroup, SortRule } from '@/features/workflows/types'

// Re-exported from features/forms/types.ts, the canonical definition (shared
// with FilterBuilder's own system-field merge) — kept as a re-export here
// since ColumnsPicker/CardLayout/SortRuleList in this feature already import
// it from './types'. "Created by (Account)" was investigated and
// deliberately NOT added — no created-by column exists on any record; only a
// separate audit-log table (internal/audit) tracks the actor per action, not
// currently exposed through the search endpoint records use. Flagged as
// separate, larger follow-up work, not bundled into this pass.
export { SYSTEM_FIELDS } from '@/features/forms/types'

export type SavedViewVisibility = 'private' | 'public' | 'role'
export type ViewLayout = 'list' | 'card' | 'calendar' | 'kanban'

export interface CalendarLayoutConfig {
  dateField: string
}

export interface KanbanLayoutConfig {
  groupField: string
  /** Which of the group field's enum values render as columns, AND in what
   *  order — one ordered list does both jobs (an omitted value is hidden; a
   *  present value's position in this array is its column position), the
   *  same way SavedViewConfig.columns already expresses both List's visible
   *  columns and their order in a single array. Omitted or empty means "all
   *  of them, in the field's own natural enum_values order" — the same
   *  "empty means everything" convention columns already uses, so an
   *  existing saved Kanban view (created before this existed) keeps showing
   *  every status with no migration needed. A value here that's no longer a
   *  real enum_values entry (the option was renamed/removed since) is simply
   *  dropped rather than rendering a broken column — see KanbanLayout's own
   *  resolution logic. */
  visibleColumns?: string[]
}

// Card has no layout_config of its own — it renders the view's own visible
// columns (ColumnsPicker) as body rows under the record's resolved title,
// so nothing Card-specific needs to be picked or stored separately.
export interface SavedViewConfig {
  filter: FilterGroup
  sort: SortRule[]
  columns: string[]
  layout: ViewLayout
  layout_config?: CalendarLayoutConfig | KanbanLayoutConfig
}

export interface SavedView {
  id: string
  menu_id: string
  name: string
  owner_user_id: string
  visibility: SavedViewVisibility
  visible_role_ids: string[]
  is_default: boolean
  config: SavedViewConfig
  /** Whether the CURRENT caller may rename/update/delete this view —
   *  computed server-side (their own private views, or any public/role view
   *  once they hold forms:{form_id}:view — the "broader per-form
   *  permission" decision, FR-D2-014 Document Control v0.2). */
  can_manage: boolean
  created_at: string
  updated_at: string
}

export type SavedViewPayload = {
  name: string
  visibility: SavedViewVisibility
  visible_role_ids?: string[]
  is_default: boolean
  config: SavedViewConfig
}

// §3's priority order: a private view the caller owns > a role-scoped view
// visible to them > a public view > (fallback, handled by the caller, not
// this function) the menu's own static default_filter/default_sort.
export function resolveDefaultView(views: SavedView[]): SavedView | undefined {
  return (
    views.find((v) => v.visibility === 'private' && v.is_default) ??
    views.find((v) => v.visibility === 'role' && v.is_default) ??
    views.find((v) => v.visibility === 'public' && v.is_default)
  )
}
