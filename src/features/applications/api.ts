import { api } from '@/lib/api'
import type {
  Application, UpdateApplicationSettingsPayload, UpdateApplicationThemePayload,
  ThemeConfig, PublishResult, PublishPayload, AppVersion, AppVersionDetail, VersionDiff,
  SaveVersionPayload, SaveVersionResult, RollbackResult, AppSnapshot, ImportResult,
  AppSummary, CreateAppPayload,
} from './types'
import type { MobileNavConfig } from '@/features/menus/mobile-nav-types'

export const applicationsApi = {
  get:           () => api.get('application').json<Application>(),
  updateSettings: (p: UpdateApplicationSettingsPayload) => api.put('application', { json: p }).json<Application>(),
  getTheme:      () => api.get('application/theme').json<{ theme: Partial<ThemeConfig> }>(),
  updateTheme:   (p: UpdateApplicationThemePayload) => api.put('application/theme', { json: p }).json<{ theme: Partial<ThemeConfig> }>(),
  getMobileNav:    () => api.get('application/mobile-nav').json<{ mobile_nav: unknown }>(),
  updateMobileNav: (mobileNav: MobileNavConfig) => api.put('application/mobile-nav', { json: { mobile_nav: mobileNav } }).json<{ mobile_nav: unknown }>(),
  publish:       (p?: PublishPayload) => api.post('application/publish', { json: p ?? {} }).json<PublishResult>(),
  listVersions:  () => api.get('application/versions').json<AppVersion[]>(),
  getVersion:    (versionNumber: number) => api.get(`application/versions/${versionNumber}`).json<AppVersionDetail>(),
  diffVersions:  (toVersion: number, against?: number) =>
    api.get(`application/versions/${toVersion}/diff`, { searchParams: against != null ? { against } : {} }).json<VersionDiff>(),
  saveVersion:   (p: SaveVersionPayload) => api.post('application/versions', { json: p }).json<SaveVersionResult>(),
  rollback:      (versionNumber: number) => api.post(`application/versions/${versionNumber}/rollback`).json<RollbackResult>(),
  exportApp:     () => api.post('application/export').json<AppSnapshot>(),
  importApp:     (snapshot: AppSnapshot) => api.post('application/import', { json: { snapshot } }).json<ImportResult>(),
  listApps:      () => api.get('apps').json<AppSummary[]>(),
  // Super Admin only — see the backend's RequireSuperAdmin gate on POST /apps.
  createApp:     (p: CreateAppPayload) => api.post('apps', { json: p }).json<AppSummary>(),
}
