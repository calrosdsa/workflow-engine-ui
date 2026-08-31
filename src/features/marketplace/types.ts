import type { RestoreWarning } from '@/features/environment/types'

/** A listing's moderation state. Orthogonal to visibility — visibility says
 *  who COULD see it, status says whether it's cleared to be seen at all.
 *  Mirrors the backend's marketplace.Status (internal/marketplace/store.go):
 *
 *    draft ──submit──> pending_review ──approve──> approved
 *      │                    └──reject──> rejected ──edit──> draft
 *      └──submit (private only, no review hop)──> approved
 */
export type ListingStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'unpublished'

export type ListingVisibility = 'private' | 'public'

/** The publisher's own view of their app's listing — the tenant-scoped
 *  routes' shape. Carries moderation fields (status, rejection_reason) that
 *  the public browse shape deliberately omits. */
export interface Listing {
  id: string
  source_app_id: string
  client_id: string
  visibility: ListingVisibility
  status: ListingStatus
  name: string
  description: string
  category: string
  /** Which immutable app version this listing is pinned to. A listing never
   *  tracks its source app automatically — re-pinning is an explicit
   *  "republish" action (see useResnapshotListing). */
  snapshot_version_id: string
  submitted_at?: string
  reviewed_at?: string
  rejection_reason?: string
  install_count: number
  created_at: string
  updated_at: string
}

export interface ListingPayload {
  name: string
  description: string
  category: string
  visibility: ListingVisibility
}

/** A private share. token is returned ONLY to the publisher (the
 *  tenant-scoped grants routes) — it's the secret they hand the recipient,
 *  and it never appears in any cross-client response. */
export interface Grant {
  id: string
  email: string
  token: string
  status: 'pending' | 'installed' | 'revoked'
  created_at: string
  expires_at?: string
  installed_at?: string
}

export interface CreateGrantPayload {
  email: string
  expires_at?: string
}

/** The outward-facing shape of a listing, as returned by the cross-client
 *  browse/detail routes. Deliberately omits source_app_id and
 *  snapshot_version_id — those are internal ids of someone else's app, and
 *  install resolves the pinned snapshot server-side rather than trusting a
 *  client-supplied version id. */
export interface PublicListing {
  id: string
  name: string
  description: string
  category: string
  visibility: ListingVisibility
  install_count: number
  published_at?: string
  updated_at: string
}

export interface PublicListingDetail extends PublicListing {
  /** Resource counts from the pinned snapshot (forms/workflows/menus/roles/
   *  agents/credentials) — enough to see what you'd be getting without
   *  exposing the publisher's actual app design. Absent if the snapshot
   *  couldn't be read, which degrades the view rather than failing it. */
  resources?: Record<string, number>
}

export interface InstallPayload {
  name: string
  slug: string
}

export interface InstallResult {
  app_id: string
  name: string
  slug: string
  /** Dangling agent provider/knowledge-base references and stripped
   *  credentials. Must be surfaced prominently rather than in a dismissible
   *  toast: an installer has no prior context on what the source app's
   *  agents were wired to. */
  warnings?: RestoreWarning[]
}
