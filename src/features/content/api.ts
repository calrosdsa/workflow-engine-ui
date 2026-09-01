import { api } from '@/lib/api'
import type { ContentObject } from './types'

// Owner scoping for every /content call — mirrors internal/content.Owner
// (Go). client_id/app_id are injected server-side from the authenticated
// request context (see api/content/handler.go's parseOwner) — never sent
// from here — so only owner_kind/owner_resource_id are this client's job.
export interface ContentOwner {
  ownerKind: 'form_record' | 'kb_document' | 'app_asset' | 'menu_icon'
  ownerResourceId: string
}

export const contentApi = {
  // fieldName is optional — omit it for a non-form-field upload (e.g. an
  // app_asset). When set and owner.ownerKind is 'form_record', the backend
  // looks up that field's MaxFileSizeBytes/AllowedMimeTypes rule (FR-C1-012)
  // and rejects the upload before storing anything if it's violated —
  // omitting fieldName skips that check entirely, matching pre-FR-C1-012
  // behavior.
  upload: (owner: ContentOwner, file: File, fieldName?: string) => {
    const form = new FormData()
    form.append('owner_kind', owner.ownerKind)
    form.append('owner_resource_id', owner.ownerResourceId)
    if (fieldName) form.append('field_name', fieldName)
    form.append('file', file)
    // The shared `api` instance sets Content-Type: application/json at
    // client-construction time (lib/api.ts). ky's own FormData-boundary
    // auto-handling (Ky.js: "Content-Type header should be deleted when
    // creating Request from another Request with FormData body") explicitly
    // skips itself whenever a content-type header was "user-provided" --
    // which this counts as, since it's set on the client. Deleting it via a
    // beforeRequest hook does NOT work: by the time that hook runs, `new
    // Request(input, options)` has already been constructed (Ky.js
    // constructs `this.request` before hooks run), and the browser bakes
    // the multipart boundary into the body/headers AT THAT CONSTRUCTION
    // POINT -- a header deleted afterward doesn't undo that framing.
    // Confirmed live: the beforeRequest-deletion version produced
    // net::ERR_CONNECTION_RESET on every real upload attempt (a malformed
    // request the backend's multipart parser or the dev proxy couldn't
    // make sense of), even though a raw, unmodified `fetch()` with an
    // identical FormData body succeeded immediately (201) -- isolating the
    // bug to ky's header-timing, not the proxy or backend. The correct fix
    // is ky's own documented mechanism: passing `undefined` for a header in
    // per-call options is a real deletion signal BEFORE Request
    // construction (utils/merge.js's mergeHeaders explicitly checks
    // `value === undefined`), letting ky's own FormData auto-detection set
    // the correct multipart Content-Type + boundary itself.
    return api.post('content', {
      body: form,
      headers: { 'Content-Type': undefined },
    }).json<ContentObject>()
  },

  list: (owner: ContentOwner) =>
    api.get('content', {
      searchParams: { owner_kind: owner.ownerKind, owner_resource_id: owner.ownerResourceId },
    }).json<ContentObject[]>(),

  // NOTE: there is deliberately no plain downloadUrl(id) => /api/content/{id}
  // helper here — GET /content/{id} requires X-Client-ID/X-App-ID headers
  // (RequireTenant has no cookie-only tenant resolution,
  // internal/middleware/tenant.go), which a plain <img src>/<a href> can
  // never attach (native browser resource loads don't go through ky's
  // beforeRequest hook). A prior version of this file had exactly that
  // helper with a doc comment claiming the session cookie alone was
  // sufficient — confirmed WRONG live (every real <img> load 401'd).
  // Always use presignedUrl below for anything rendered as a URL string —
  // it's self-contained (signed query params) and needs no headers.
  presignedUrl: (id: string, ttlSeconds?: number) =>
    api.get(`content/${id}/url`, {
      searchParams: ttlSeconds ? { ttl_seconds: ttlSeconds } : undefined,
    }).json<{ url: string }>(),

  delete: (id: string) => api.delete(`content/${id}`),
}
