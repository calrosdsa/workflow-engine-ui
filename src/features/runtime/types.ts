import type { ThemeConfig } from '@/features/theme/types'
import type { MenuType, MenuConfig, PermissionMode } from '@/features/menus/types'

// Mirrors internal/appbuilder.AppSnapshot / MenuSnapshotItem exactly — the
// JSON the public GET /runtime/{client_id}/{app_id} endpoint returns.
export interface AppSnapshotMeta {
  id: string
  name: string
  slug: string
  settings: Record<string, unknown>
}

export interface MenuSnapshotItem {
  id: string
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
  hidden_from_nav: boolean
}

export interface AppSnapshot {
  app: AppSnapshotMeta
  menus: MenuSnapshotItem[]
  theme: Partial<ThemeConfig>
}
