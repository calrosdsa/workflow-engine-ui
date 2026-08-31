import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { environmentApi } from './api'
import { applicationKeys } from '@/features/applications/hooks'
import type { CreateProductionPayload, LinkExistingPayload } from './types'

export const environmentKeys = {
  status:  () => ['application', 'environment-link'] as const,
  preview: () => ['application', 'environment-link', 'promote-preview'] as const,
}

export function useEnvironmentLinkStatus() {
  return useQuery({ queryKey: environmentKeys.status(), queryFn: environmentApi.status })
}

export function useCreateProduction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: CreateProductionPayload) => environmentApi.createProduction(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: environmentKeys.status() })
      // Unlike LinkExisting (which links to an app that must already be in
      // the useApps() cache), CreateProduction makes a BRAND-NEW app — the
      // Sandbox/Production status cards resolve other_app_id to a name via
      // useApps(), so that list needs invalidating too or the new
      // Production app shows as a raw UUID until something else happens to
      // refetch /apps.
      qc.invalidateQueries({ queryKey: applicationKeys.apps() })
    },
  })
}

export function useLinkExisting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: LinkExistingPayload) => environmentApi.linkExisting(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: environmentKeys.status() }),
  })
}

/** Only meaningful when the current app is a linked Sandbox — see
 *  PromotePreview's own backend doc comment for why this always builds two
 *  FRESH snapshots rather than reading stored versions. */
export function usePromotePreview(enabled: boolean) {
  return useQuery({
    queryKey: environmentKeys.preview(),
    queryFn: environmentApi.promotePreview,
    enabled,
  })
}

/** Promote's blast radius spans every design-time resource type on the
 *  Production app (forms, workflows, menus, roles, agents, credentials,
 *  variables) — same broad-invalidation reasoning as useRollback/useImportApp
 *  in features/applications/hooks.ts. Also invalidates this app's OWN
 *  version list (Sandbox's version history is untouched by Promote, but
 *  Production's isn't visible from here anyway — this just covers the
 *  Sandbox-side queries a promote could plausibly affect, e.g. link status
 *  metadata). */
export function usePromote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: environmentApi.promote,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: environmentKeys.status() })
      qc.invalidateQueries({ queryKey: environmentKeys.preview() })
      qc.invalidateQueries({ queryKey: applicationKeys.versions() })
    },
  })
}

/** Unlink's effect is broad enough (lifts Production's lock immediately) that
 *  every design-time query on THIS app could now behave differently
 *  (builder save/publish buttons re-enable if this was a locked Production)
 *  — invalidate everything, same reasoning as useRollback/useImportApp. */
export function useUnlinkEnvironment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: environmentApi.unlink,
    onSuccess: () => qc.invalidateQueries(),
  })
}
