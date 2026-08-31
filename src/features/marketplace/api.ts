import { api } from '@/lib/api'
import type {
  Listing, ListingPayload, Grant, CreateGrantPayload,
  PublicListing, PublicListingDetail, InstallPayload, InstallResult,
} from './types'

export interface BrowseParams {
  search?: string
  category?: string
  limit?: number
  offset?: number
}

export const marketplaceApi = {
  // --- Tenant-scoped: this app's OWN listing -------------------------------
  getListing:    () => api.get('application/marketplace/listing').json<Listing>(),
  publish:       (p: ListingPayload) => api.post('application/marketplace/listing', { json: p }).json<Listing>(),
  updateListing: (p: ListingPayload) => api.put('application/marketplace/listing', { json: p }).json<Listing>(),
  resnapshot:    () => api.post('application/marketplace/listing/resnapshot').json<Listing>(),
  submit:        () => api.post('application/marketplace/listing/submit').json<Listing>(),
  unpublish:     () => api.post('application/marketplace/listing/unpublish').json<Listing>(),

  listGrants:  () => api.get('application/marketplace/listing/grants').json<Grant[]>(),
  createGrant: (p: CreateGrantPayload) => api.post('application/marketplace/listing/grants', { json: p }).json<Grant>(),
  revokeGrant: (grantId: string) => api.delete(`application/marketplace/listing/grants/${grantId}`),

  // --- Cross-client: browsing and installing OTHER clients' listings -------
  // These run behind RequireAuthenticatedUser (session only, no tenant
  // scope) on the backend, so the X-Client-ID/X-App-ID headers ky attaches
  // are simply ignored there rather than being required.
  browse: (p: BrowseParams = {}) =>
    api.get('marketplace/listings', {
      searchParams: {
        ...(p.search ? { search: p.search } : {}),
        ...(p.category ? { category: p.category } : {}),
        ...(p.limit != null ? { limit: p.limit } : {}),
        ...(p.offset != null ? { offset: p.offset } : {}),
      },
    }).json<PublicListing[]>(),
  getPublicListing: (id: string) => api.get(`marketplace/listings/${id}`).json<PublicListingDetail>(),
  // Install DOES need tenant scope — it writes a brand-new app into the
  // caller's own client (RequireTenant + marketplace:install on the backend).
  install: (id: string, p: InstallPayload) =>
    api.post(`marketplace/listings/${id}/install`, { json: p }).json<InstallResult>(),
}
