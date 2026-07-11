// FilterGroup/SortRule/CompareOp/FilterCondition are re-exported (not
// duplicated) from features/workflows/types.ts — FilterBuilder.tsx is
// directly reusable for the Search Menu's default-filter editor since its
// props are generic ({group, fields, variables, onChange}), nothing
// workflow-specific. Note these UI-rich types carry a UI-only `id` field
// (list-rendering key) that must be stripped before saving to the backend
// and re-attached after loading — see stripIds/ensureIds below, mirroring
// the identical pattern already used in features/workflows/builder/store.ts
// and NodeConfigPanel.tsx for the same reason (backend graph.FilterGroup has
// no id field).
export type { FilterGroup, SortRule, CompareOp, FilterCondition } from '@/features/workflows/types'
import type { FilterGroup, SortRule } from '@/features/workflows/types'
import type { PageSchema } from '@/features/page-builder/schema'

export type MenuType = 'search' | 'add' | 'parent' | 'custom'

export interface SearchMenuConfig {
  form_id: string
  columns: string[]
  default_filter?: FilterGroup
  default_sort?: SortRule[]
  page_size: number
}

export interface AddMenuConfig {
  form_id: string
  success_behavior: 'message' | 'redirect'
  success_message?: string
  redirect_menu_slug?: string
  navigate_after_save: boolean
}

export interface ParentMenuConfig {
  collapsed_by_default?: boolean
}

/** Drives a Custom Menu — either a structured, presentational page (built
 *  via features/page-builder) or a single embedded external webpage. `mode`
 *  selects which of schema/embedUrl is active; the other is left populated
 *  (not cleared) when switching modes in the builder, so toggling back and
 *  forth doesn't lose work. */
export interface CustomMenuConfig {
  mode: 'page' | 'embed'
  schema?: PageSchema
  embedUrl?: string
}

export type MenuConfig = SearchMenuConfig | AddMenuConfig | ParentMenuConfig | CustomMenuConfig

export interface Menu {
  id: string
  app_id: string
  parent_id: string | null
  menu_type: MenuType
  slug: string
  name: string
  icon?: string
  sort_order: number
  config: MenuConfig
  required_permission?: string
  created_at: string
  updated_at: string
}

export type CreateMenuPayload = Omit<Menu, 'id' | 'created_at' | 'updated_at' | 'app_id'>
export type UpdateMenuPayload = CreateMenuPayload

/** A Menu with its children resolved (built client-side from the flat list). */
export interface MenuTreeNode extends Menu {
  children: MenuTreeNode[]
}

export interface ReorderMenusPayload {
  ordered_ids: string[]
}
