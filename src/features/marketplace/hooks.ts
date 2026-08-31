import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HTTPError } from 'ky'
import { marketplaceApi, type BrowseParams } from './api'
import { applicationKeys } from '@/features/applications/hooks'
import { authApi } from '@/features/auth/api'
import { useAuthStore } from '@/stores/auth'
import type { ListingPayload, CreateGrantPayload, InstallPayload } from './types'

export const marketplaceKeys = {
  listing: () => ['application', 'marketplace', 'listing'] as const,
  grants: () => ['application', 'marketplace', 'listing', 'grants'] as const,
  browse: (p: BrowseParams) => ['marketplace', 'browse', p.search ?? '', p.category ?? ''] as const,
  publicListing: (id: string) => ['marketplace', 'listings', id] as const,
}

/** This app's own listing. A 404 is the ordinary "never published" state,
 *  not an error — it's mapped to null so callers render an empty
 *  publish-this-app panel instead of an error state. Any other failure
 *  still throws. */
export function useListing() {
  return useQuery({
    queryKey: marketplaceKeys.listing(),
    queryFn: async () => {
      try {
        return await marketplaceApi.getListing()
      } catch (e) {
        if (e instanceof HTTPError && e.response.status === 404) return null
        throw e
      }
    },
  })
}

export function useGrants(enabled: boolean) {
  return useQuery({
    queryKey: marketplaceKeys.grants(),
    queryFn: marketplaceApi.listGrants,
    enabled,
  })
}

/** Publishing writes a real checkpoint version of the source app (the
 *  listing pins it), so the app's own version list is invalidated too — not
 *  just the listing. */
export function usePublishListing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: ListingPayload) => marketplaceApi.publish(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: marketplaceKeys.listing() })
      qc.invalidateQueries({ queryKey: applicationKeys.versions() })
    },
  })
}

export function useUpdateListing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: ListingPayload) => marketplaceApi.updateListing(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: marketplaceKeys.listing() }),
  })
}

/** Re-pinning also writes a fresh checkpoint — same invalidation reasoning
 *  as usePublishListing. */
export function useResnapshotListing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: marketplaceApi.resnapshot,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: marketplaceKeys.listing() })
      qc.invalidateQueries({ queryKey: applicationKeys.versions() })
    },
  })
}

export function useSubmitListing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: marketplaceApi.submit,
    onSuccess: () => qc.invalidateQueries({ queryKey: marketplaceKeys.listing() }),
  })
}

export function useUnpublishListing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: marketplaceApi.unpublish,
    onSuccess: () => qc.invalidateQueries({ queryKey: marketplaceKeys.listing() }),
  })
}

export function useCreateGrant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: CreateGrantPayload) => marketplaceApi.createGrant(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: marketplaceKeys.grants() }),
  })
}

export function useRevokeGrant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (grantId: string) => marketplaceApi.revokeGrant(grantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: marketplaceKeys.grants() }),
  })
}

export function useBrowseMarketplace(params: BrowseParams) {
  return useQuery({
    queryKey: marketplaceKeys.browse(params),
    queryFn: () => marketplaceApi.browse(params),
  })
}

export function usePublicListing(id: string | null) {
  return useQuery({
    queryKey: marketplaceKeys.publicListing(id ?? ''),
    queryFn: () => marketplaceApi.getPublicListing(id as string),
    enabled: id != null,
  })
}

/** Install creates a brand-new app in the caller's own client. Home's app
 *  grid reads session.memberships (not a query), so a successful install
 *  refetches /auth/me and pushes it into the auth store — the same refresh
 *  useCreateApp already performs for the identical reason. */
export function useInstallListing() {
  const qc = useQueryClient()
  const setSession = useAuthStore((s) => s.setSession)
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: InstallPayload }) =>
      marketplaceApi.install(id, payload),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: applicationKeys.apps() })
      qc.invalidateQueries({ queryKey: ['marketplace'] })
      const me = await authApi.me()
      setSession(me)
      qc.setQueryData(['auth', 'me'], me)
    },
  })
}
