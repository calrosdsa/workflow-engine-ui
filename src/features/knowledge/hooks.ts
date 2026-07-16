import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { knowledgeApi } from './api'
import type { CreateKnowledgeBasePayload, UpdateKnowledgeBasePayload, QueryKnowledgeBasePayload } from './types'

export const knowledgeKeys = {
  providers: ['knowledge-bases', 'providers'] as const,
  all:       ['knowledge-bases'] as const,
  detail:    (id: string) => ['knowledge-bases', id] as const,
  documents: (id: string) => ['knowledge-bases', id, 'documents'] as const,
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

export function useQueryKnowledgeBase(kbId: string) {
  return useMutation({
    mutationFn: (p: QueryKnowledgeBasePayload) => knowledgeApi.query(kbId, p),
  })
}
