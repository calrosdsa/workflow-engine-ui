import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { knowledgeApi } from './api'
import type { CreateKnowledgeBasePayload, UpdateKnowledgeBasePayload, QueryKnowledgeBasePayload, KnowledgeBaseVisibility } from './types'

export const knowledgeKeys = {
  providers: ['knowledge-bases', 'providers'] as const,
  all:       ['knowledge-bases'] as const,
  detail:    (id: string) => ['knowledge-bases', id] as const,
  documents: (id: string) => ['knowledge-bases', id, 'documents'] as const,
  graph:     (id: string, docId: string) => ['knowledge-bases', id, 'documents', docId, 'graph'] as const,
  sharing:   (id: string) => ['knowledge-bases', id, 'sharing'] as const,
}

// The provider/model catalog is static server-side config, not per-tenant
// data — cache it for the whole session rather than refetching per mount.
export function useProviders() {
  return useQuery({ queryKey: knowledgeKeys.providers, queryFn: knowledgeApi.providers, staleTime: Infinity })
}

export function useKnowledgeBases() {
  return useQuery({ queryKey: knowledgeKeys.all, queryFn: knowledgeApi.list })
}

export function useKnowledgeBase(id: string) {
  return useQuery({ queryKey: knowledgeKeys.detail(id), queryFn: () => knowledgeApi.get(id), enabled: !!id })
}

export function useKnowledgeDocuments(id: string, opts?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: knowledgeKeys.documents(id),
    queryFn: () => knowledgeApi.listDocuments(id),
    enabled: !!id,
    refetchInterval: opts?.refetchInterval,
  })
}

export function useCreateKnowledgeBase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: CreateKnowledgeBasePayload) => knowledgeApi.create(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: knowledgeKeys.all }),
  })
}

export function useUpdateKnowledgeBase(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: UpdateKnowledgeBasePayload) => knowledgeApi.update(id, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: knowledgeKeys.all })
      qc.invalidateQueries({ queryKey: knowledgeKeys.detail(id) })
    },
  })
}

export function useDeleteKnowledgeBase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => knowledgeApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: knowledgeKeys.all }),
  })
}

export function useInsertText(kbId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ content, filePath }: { content: string; filePath?: string }) =>
      knowledgeApi.insertText(kbId, content, filePath),
    onSuccess: () => qc.invalidateQueries({ queryKey: knowledgeKeys.documents(kbId) }),
  })
}

export function useUploadFile(kbId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => knowledgeApi.uploadFile(kbId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: knowledgeKeys.documents(kbId) }),
  })
}

export function useDeleteDocument(kbId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (docId: string) => knowledgeApi.deleteDocument(kbId, docId),
    onSuccess: () => qc.invalidateQueries({ queryKey: knowledgeKeys.documents(kbId) }),
  })
}

// Reprocesses a FAILED or already-PROCESSED document from its already-stored
// content — the backend rejects retrying anything still PENDING/PROCESSING,
// so the mutation only needs to invalidate the documents list (the retried
// doc's status flips back to pending/processing and the existing poller
// picks it up).
export function useRetryDocument(kbId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (docId: string) => knowledgeApi.retryDocument(kbId, docId),
    onSuccess: () => qc.invalidateQueries({ queryKey: knowledgeKeys.documents(kbId) }),
  })
}

export function useQueryKnowledgeBase(kbId: string) {
  return useMutation({
    mutationFn: (p: QueryKnowledgeBasePayload) => knowledgeApi.query(kbId, p),
  })
}

// Lazy — only fetched once a document row is expanded (enabled gates on
// that), since most documents in a list are never inspected in this much
// detail. Works for any already-processed document, including ones
// ingested before this endpoint existed (see rag-engine's DocumentGraph).
export function useDocumentGraph(kbId: string, docId: string, enabled: boolean) {
  return useQuery({
    queryKey: knowledgeKeys.graph(kbId, docId),
    queryFn: () => knowledgeApi.getDocumentGraph(kbId, docId),
    enabled: enabled && !!kbId && !!docId,
  })
}

// FR-C9-002: Sharing Settings. useSharing 404s (via the query's own error
// state) for a KB this app doesn't own — the Sharing Settings section
// itself only renders when that's not the case (see
// KnowledgeBaseDetailPage's own ownership check), so a real 404 here is
// unexpected rather than a normal "not the owner" path.
export function useSharing(kbId: string) {
  return useQuery({ queryKey: knowledgeKeys.sharing(kbId), queryFn: () => knowledgeApi.getSharing(kbId), enabled: !!kbId })
}

// Not a useQuery — SHARE-06's usage check only ever runs on-demand, right
// before a narrowing sharing change, never passively on page load (a KB
// with a large client could make this an expensive background fetch for no
// reason on every detail-page visit).
export function useSharingUsage(kbId: string) {
  return useMutation({ mutationFn: () => knowledgeApi.getSharingUsage(kbId) })
}

export function useSetSharing(kbId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (visibility: KnowledgeBaseVisibility) => knowledgeApi.setSharing(kbId, visibility),
    onSuccess: () => qc.invalidateQueries({ queryKey: knowledgeKeys.sharing(kbId) }),
  })
}
