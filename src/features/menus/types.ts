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
import type { DashboardSchema } from '@/features/dashboard/schema'

export type MenuType = 'search' | 'add' | 'parent' | 'custom' | 'dashboard'

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
 *  forth doesn't lose work. When `mode === 'embed'`, `integrationId` may
 *  reference a `signed_launch` Embedded Integration (features/integrations)
 *  — same optional SSO pass-through as the Dashboard embed widget
 *  (features/dashboard/widgets/embed/schema.ts), scoped to signed_launch
 *  only here (no oidc/postMessage handshake for this simpler surface).
 *  Unset = a plain, unauthenticated iframe, same as before this field
 *  existed. */
export interface CustomMenuConfig {
  mode: 'page' | 'embed'
  schema?: PageSchema
  embedUrl?: string
  integrationId?: string
}

/** Drives a Dashboard menu — a grid canvas of plugin-registered widget tiles
 *  (see features/dashboard/widget-registry.ts). Also the mechanism for
 *  "custom pages": a page built entirely from Content-category widgets
 *  (heading, paragraph, image, ...) is a DashboardMenuConfig with no
 *  data-bearing widgets, so custom pages and dashboards share one canvas and
 *  one persistence model rather than being two parallel features. */
export interface DashboardMenuConfig {
  schema: DashboardSchema
}

export type MenuConfig = SearchMenuConfig | AddMenuConfig | ParentMenuConfig | CustomMenuConfig | DashboardMenuConfig

/** How the "Permission" section of the menu editor gates visibility:
 *  'all' shows the menu to anyone who can view the app; 'role' restricts it
 *  to members whose current role (Membership.role_id) is in
 *  required_role_ids. Independent of required_permission, which continues to
 *  gate on a resource:action permission key. */
export type PermissionMode = 'all' | 'role'

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
  permission_mode: PermissionMode
  required_role_ids: string[]
  /** Excludes this menu from the runtime nav tree/sidebar while leaving it
   *  fully reachable by slug (deep link, or another menu's onNavigate) and
   *  fully visible/editable in the App Design builder's own menu tree. Set
   *  on an Add menu auto-paired with a Search menu at creation time — it's
   *  only ever meant to be reached via that Search menu's "Create" button,
   *  not as its own nav entry. Independent of permission_mode/
   *  required_role_ids, which gate identity, not structural nav placement. */
  hidden_from_nav: boolean
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
