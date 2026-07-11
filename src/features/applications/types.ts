import type { ThemeConfig } from '@/features/theme/types'
export type { ThemeConfig } from '@/features/theme/types'

export interface ApplicationSettings {
  description?: string
  default_menu_slug?: string
  [k: string]: unknown
}

export interface Application {
  id: string
  client_id: string
  name: string
  slug: string
  settings: ApplicationSettings
  theme: Partial<ThemeConfig>
  published_version: number | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface UpdateApplicationSettingsPayload {
  name: string
  settings: ApplicationSettings
}

export interface UpdateApplicationThemePayload {
  theme: Partial<ThemeConfig>
}

export interface PublishResult {
  version_number: number
  published_at: string
}

export interface ValidationIssue {
  level: 'error' | 'warning'
  path: string
  message: string
}

export interface PublishValidationError {
  issues: ValidationIssue[]
}

export interface AppVersion {
  id: string
  app_id: string
  version_number: number
  published_by: string
  created_at: string
}

/** Thin listing shape for cross-app views (e.g. the Team page's Roles tab
 *  app selector) that have no single "current app" to read full Application
 *  settings for the way every other /application route does. */
export interface AppSummary {
  id: string
  name: string
  slug: string
}
