import { api } from '@/lib/api'
import type { ContentObject } from './types'

// Owner scoping for every /content call — mirrors internal/content.Owner
// (Go). client_id/app_id are injected server-side from the authenticated
// request context (see api/content/handler.go's parseOwner) — never sent
// from here — so only owner_kind/owner_resource_id are this client's job.
export interface ContentOwner {
  ownerKind: 'form_record' | 'kb_document' | 'app_asset'
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
    // Same Content-Type-deletion requirement as features/knowledge/api.ts's
    // uploadFile — the shared `api` instance defaults to application/json,
    // which ky merges into every request rather than replacing, so it must
    // be deleted here or the browser never gets to set its own multipart
    // boundary.
    return api.post('content', {
      body: form,
      hooks: { beforeRequest: [(request) => { request.headers.delete('Content-Type') }] },
    }).json<ContentObject>()
  },

  list: (owner: ContentOwner) =>
    api.get('content', {
      searchParams: { owner_kind: owner.ownerKind, owner_resource_id: owner.ownerResourceId },
    }).json<ContentObject[]>(),

  // downloadUrl is a plain path, not a fetch call — used directly as an
  // <img src>/<a href>, so the browser's own session cookie carries auth
  // the same way any other same-origin image request would.
  downloadUrl: (id: string) => `/api/content/${id}`,

  presignedUrl: (id: string, ttlSeconds?: number) =>
    api.get(`content/${id}/url`, {
      searchParams: ttlSeconds ? { ttl_seconds: ttlSeconds } : undefined,
    }).json<{ url: string }>(),

  delete: (id: string) => api.delete(`content/${id}`),
}
