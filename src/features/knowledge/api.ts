import { api } from '@/lib/api'
import type {
  KnowledgeBase, KnowledgeBaseSummary, ProviderCatalogEntry,
  CreateKnowledgeBasePayload, UpdateKnowledgeBasePayload,
  KnowledgeDocument, ListDocumentsResponse, QueryKnowledgeBasePayload, QueryKnowledgeBaseResponse,
  DocumentGraphResponse,
} from './types'

export const knowledgeApi = {
  providers: () => api.get('knowledge-bases/providers').json<ProviderCatalogEntry[]>(),

  list:   () => api.get('knowledge-bases').json<KnowledgeBaseSummary[]>(),
  get:    (id: string) => api.get(`knowledge-bases/${id}`).json<KnowledgeBase>(),
  create: (p: CreateKnowledgeBasePayload) => api.post('knowledge-bases', { json: p }).json<KnowledgeBase>(),
  update: (id: string, p: UpdateKnowledgeBasePayload) =>
    api.patch(`knowledge-bases/${id}`, { json: p }).json<KnowledgeBase>(),
  delete: (id: string) => api.delete(`knowledge-bases/${id}`),

  listDocuments: (kbId: string) =>
    api.get(`knowledge-bases/${kbId}/documents`).json<ListDocumentsResponse>(),
  getDocument: (kbId: string, docId: string) =>
    api.get(`knowledge-bases/${kbId}/documents/${docId}`).json<KnowledgeDocument>(),
  insertText: (kbId: string, content: string, filePath?: string) =>
    api.post(`knowledge-bases/${kbId}/documents`, { json: { content, file_path: filePath ?? '' } })
      .json<{ doc_id: string; status: string; duplicate: boolean }>(),
  uploadFile: (kbId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    // The shared `api` instance defaults Content-Type to application/json
    // (see lib/api.ts), which ky merges into every request's headers rather
    // than replacing — so it must be deleted here, not just omitted, or the
    // browser never gets to set the multipart/form-data boundary itself.
    return api.post(`knowledge-bases/${kbId}/documents/upload`, {
      body: form,
      hooks: { beforeRequest: [(request) => { request.headers.delete('Content-Type') }] },
    }).json<{ doc_id: string; status: string; duplicate: boolean }>()
  },
  deleteDocument: (kbId: string, docId: string) => api.delete(`knowledge-bases/${kbId}/documents/${docId}`),
  retryDocument: (kbId: string, docId: string) =>
    api.post(`knowledge-bases/${kbId}/documents/${docId}/retry`)
      .json<{ doc_id: string; status: string; duplicate: boolean }>(),
  getDocumentGraph: (kbId: string, docId: string) =>
    api.get(`knowledge-bases/${kbId}/documents/${docId}/graph`).json<DocumentGraphResponse>(),

  query: (kbId: string, p: QueryKnowledgeBasePayload) =>
    api.post(`knowledge-bases/${kbId}/query`, { json: p }).json<QueryKnowledgeBaseResponse>(),
}
