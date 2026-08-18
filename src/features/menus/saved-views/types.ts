// FR-D2-014: Saved Views for Search menus. Mirrors the backend's
// SavedViewRow (internal/menus/store/saved_views.go) and savedViewResponse
// (api/menus/saved_views.go) exactly.
import type { FilterGroup, SortRule } from '@/features/workflows/types'

export type SavedViewVisibility = 'private' | 'public' | 'role'
export type ViewLayout = 'list' | 'card' | 'calendar' | 'kanban'

export interface CardLayoutConfig {
  titleField?: string
  subtitleField?: string
  imageField?: string
  bodyFields?: string[]
}

export interface CalendarLayoutConfig {
  dateField: string
}

export interface KanbanLayoutConfig {
  groupField: string
}

export interface SavedViewConfig {
  filter: FilterGroup
  sort: SortRule[]
  columns: string[]
  layout: ViewLayout
  layout_config?: CardLayoutConfig | CalendarLayoutConfig | KanbanLayoutConfig
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
