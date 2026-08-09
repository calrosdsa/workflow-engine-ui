import { api } from '@/lib/api'
import type {
  Application, UpdateApplicationSettingsPayload, UpdateApplicationThemePayload,
  ThemeConfig, PublishResult, AppVersion, AppSummary, CreateAppPayload,
} from './types'
import type { MobileNavConfig } from '@/features/menus/mobile-nav-types'

export const applicationsApi = {
  get:           () => api.get('application').json<Application>(),
  updateSettings: (p: UpdateApplicationSettingsPayload) => api.put('application', { json: p }).json<Application>(),
  getTheme:      () => api.get('application/theme').json<{ theme: Partial<ThemeConfig> }>(),
  updateTheme:   (p: UpdateApplicationThemePayload) => api.put('application/theme', { json: p }).json<{ theme: Partial<ThemeConfig> }>(),
  getMobileNav:    () => api.get('application/mobile-nav').json<{ mobile_nav: unknown }>(),
  updateMobileNav: (mobileNav: MobileNavConfig) => api.put('application/mobile-nav', { json: { mobile_nav: mobileNav } }).json<{ mobile_nav: unknown }>(),
  publish:       () => api.post('application/publish').json<PublishResult>(),
  listVersions:  () => api.get('application/versions').json<AppVersion[]>(),
  listApps:      () => api.get('apps').json<AppSummary[]>(),
  // Super Admin only — see the backend's RequireSuperAdmin gate on POST /apps.
  createApp:     (p: CreateAppPayload) => api.post('apps', { json: p }).json<AppSummary>(),
}
