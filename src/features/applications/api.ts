import { api } from '@/lib/api'
import type {
  Application, UpdateApplicationSettingsPayload, UpdateApplicationThemePayload,
  ThemeConfig, PublishResult, AppVersion, AppSummary,
} from './types'

export const applicationsApi = {
  get:           () => api.get('application').json<Application>(),
  updateSettings: (p: UpdateApplicationSettingsPayload) => api.put('application', { json: p }).json<Application>(),
  getTheme:      () => api.get('application/theme').json<{ theme: Partial<ThemeConfig> }>(),
  updateTheme:   (p: UpdateApplicationThemePayload) => api.put('application/theme', { json: p }).json<{ theme: Partial<ThemeConfig> }>(),
  publish:       () => api.post('application/publish').json<PublishResult>(),
  listVersions:  () => api.get('application/versions').json<AppVersion[]>(),
  listApps:      () => api.get('apps').json<AppSummary[]>(),
}
