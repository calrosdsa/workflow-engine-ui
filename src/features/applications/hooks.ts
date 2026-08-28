import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { applicationsApi } from './api'
import { authApi } from '@/features/auth/api'
import { useAuthStore } from '@/stores/auth'
import { parseMobileNavConfig } from '@/features/menus/mobile-nav-types'
import type { MobileNavConfig } from '@/features/menus/mobile-nav-types'
import type {
  Application, UpdateApplicationSettingsPayload, UpdateApplicationThemePayload, CreateAppPayload,
  SaveVersionPayload, AppSnapshot, PublishPayload,
} from './types'

export const applicationKeys = {
  detail:    () => ['application'] as const,
  theme:     () => ['application', 'theme'] as const,
  mobileNav: () => ['application', 'mobile-nav'] as const,
  versions:  () => ['application', 'versions'] as const,
  versionDetail: (n: number) => ['application', 'versions', n] as const,
  versionDiff:   (to: number, against?: number) => ['application', 'versions', to, 'diff', against ?? 'latest'] as const,
  apps:      () => ['apps'] as const,
}

export function useApplication() {
  return useQuery({ queryKey: applicationKeys.detail(), queryFn: applicationsApi.get })
}

export function useUpdateApplicationSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: UpdateApplicationSettingsPayload) => applicationsApi.updateSettings(p),
    // Optimistically reflect the rename immediately, same pattern as useUpdateForm.
    onMutate: async (p: UpdateApplicationSettingsPayload) => {
      await qc.cancelQueries({ queryKey: applicationKeys.detail() })
      const prev = qc.getQueryData<Application>(applicationKeys.detail())
      if (prev) {
        qc.setQueryData<Application>(applicationKeys.detail(), { ...prev, name: p.name, settings: p.settings })
      }
      return { prev }
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(applicationKeys.detail(), ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: applicationKeys.detail() }),
  })
}

export function useApplicationTheme() {
  return useQuery({ queryKey: applicationKeys.theme(), queryFn: applicationsApi.getTheme })
}

export function useUpdateApplicationTheme() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: UpdateApplicationThemePayload) => applicationsApi.updateTheme(p),
    onSuccess: (res) => {
      qc.setQueryData(applicationKeys.theme(), res)
      qc.invalidateQueries({ queryKey: applicationKeys.detail() })
    },
  })
}

export function useApplicationMobileNav() {
  return useQuery({
    queryKey: applicationKeys.mobileNav(),
    queryFn: async () => parseMobileNavConfig((await applicationsApi.getMobileNav()).mobile_nav),
  })
}

export function useUpdateApplicationMobileNav() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (config: MobileNavConfig) => applicationsApi.updateMobileNav(config),
    onSuccess: (res) => {
      qc.setQueryData(applicationKeys.mobileNav(), parseMobileNavConfig(res.mobile_nav))
      qc.invalidateQueries({ queryKey: applicationKeys.detail() })
    },
  })
}

export function usePublishApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p?: PublishPayload) => applicationsApi.publish(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: applicationKeys.detail() })
      qc.invalidateQueries({ queryKey: applicationKeys.versions() })
    },
  })
}

export function useApplicationVersions() {
  return useQuery({ queryKey: applicationKeys.versions(), queryFn: applicationsApi.listVersions })
}

export function useApplicationVersionDetail(versionNumber: number | null) {
  return useQuery({
    queryKey: applicationKeys.versionDetail(versionNumber ?? -1),
    queryFn: () => applicationsApi.getVersion(versionNumber as number),
    enabled: versionNumber != null,
  })
}

/** against=null defaults to a diff against the app's own current latest
 *  version (the backend does this when the query param is omitted) — used
 *  by both the version-history detail view and the rollback confirmation
 *  flow's "this will change..." preview. */
export function useVersionDiff(toVersion: number | null, against?: number) {
  return useQuery({
    queryKey: applicationKeys.versionDiff(toVersion ?? -1, against),
    queryFn: () => applicationsApi.diffVersions(toVersion as number, against),
    enabled: toVersion != null,
  })
}

/** "Save Version" — a deliberate, git-commit-style checkpoint. Never
 *  touches apps.published_version, so the Publish badge/live-version query
 *  is deliberately NOT invalidated here — only the version-history list
 *  changes. */
export function useSaveVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: SaveVersionPayload) => applicationsApi.saveVersion(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: applicationKeys.versions() }),
  })
}

/** Rollback restores live design-time state to match a target version, then
 *  records the rollback itself as a NEW version. Its blast radius spans
 *  every resource type this app builder has (forms, workflows, menus,
 *  roles, agents, credentials, variables) — rather than trying to
 *  enumerate every affected query key, invalidate everything so nothing
 *  is left showing stale pre-rollback data. */
export function useRollback() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (versionNumber: number) => applicationsApi.rollback(versionNumber),
    onSuccess: () => qc.invalidateQueries(),
  })
}

export function useExportApp() {
  return useMutation({ mutationFn: () => applicationsApi.exportApp() })
}

/** Import is additive (existing content in this app is left untouched),
 *  but still touches nearly every resource type, same broad-invalidation
 *  reasoning as useRollback. */
export function useImportApp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (snapshot: AppSnapshot) => applicationsApi.importApp(snapshot),
    onSuccess: () => qc.invalidateQueries(),
  })
}

/** Every app under the tenant's client — used by cross-app views like the
 *  Team page's Roles tab app selector, which has no single "current app"
 *  the way every other application hook does. */
export function useApps() {
  return useQuery({ queryKey: applicationKeys.apps(), queryFn: applicationsApi.listApps })
}

/** Super Admin only — see the backend's RequireSuperAdmin gate on POST /apps.
 *  Home's app-card grid reads session.memberships (a Super Admin's
 *  memberships are synthetically expanded to one row per app on every
 *  /auth/me call — see api/auth/me.go), not the useApps() query above, so a
 *  successful create refetches /auth/me and pushes the result into
 *  useAuthStore directly rather than just invalidating a query key — the
 *  same refresh setSession's own callers (useLogin/useSignup) already do. */
export function useCreateApp() {
  const qc = useQueryClient()
  const setSession = useAuthStore((s) => s.setSession)
  return useMutation({
    mutationFn: (p: CreateAppPayload) => applicationsApi.createApp(p),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: applicationKeys.apps() })
      const me = await authApi.me()
      setSession(me)
      qc.setQueryData(['auth', 'me'], me)
    },
  })
}
