import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { knowledgeKeys } from './hooks'
import type { DocumentPipelineEvent, KnowledgeDocument, ListDocumentsResponse } from './types'

const SSE_EVENT_TYPES = [
  'snapshot', 'doc_started', 'stage_started', 'stage_completed',
  'stage_failed', 'doc_completed', 'doc_failed',
]

/** Subscribes to GET /api/knowledge-bases/{kbId}/documents/stream and merges
 *  every event's full document snapshot into the documents-list query cache
 *  — the same cache useKnowledgeDocuments reads, so DocumentRow re-renders
 *  with live stage/entity data with no added polling latency. Native
 *  EventSource can't set the X-Client-ID/X-App-ID headers the shared `api`
 *  client normally injects (see lib/api.ts), so those go as query params
 *  instead — RequireTenant on the backend falls back to reading them from
 *  the query string when the headers are absent (internal/middleware/tenant.go).
 *  Pass docId to scope the stream to one document; omit it for the whole KB. */
export function useDocumentPipelineEvents(kbId: string, docId?: string) {
  const qc = useQueryClient()
  const activeMembership = useAuthStore((s) => s.activeMembership)

  useEffect(() => {
    if (!kbId || !activeMembership) return

    const url = new URL(`/api/knowledge-bases/${kbId}/documents/stream`, window.location.origin)
    url.searchParams.set('client_id', activeMembership.client_id)
    if (activeMembership.app_id) url.searchParams.set('app_id', activeMembership.app_id)
    if (docId) url.searchParams.set('doc_id', docId)

    const es = new EventSource(url.toString())

    const handle = (raw: MessageEvent<string>) => {
      const ev: DocumentPipelineEvent = JSON.parse(raw.data)
      const doc = ev.document
      if (!doc) return

      qc.setQueryData<ListDocumentsResponse>(knowledgeKeys.documents(kbId), (old) => {
        if (!old) return old
        const idx = old.documents.findIndex((d) => d.doc_id === doc.doc_id)
        if (idx === -1) {
          return { ...old, documents: [doc, ...old.documents], total: old.total + 1 }
        }
        const documents = old.documents.slice()
        documents[idx] = doc as KnowledgeDocument
        return { ...old, documents }
      })
    }

    for (const type of SSE_EVENT_TYPES) es.addEventListener(type, handle)
    // EventSource retries the connection automatically on drop/network
    // error; nothing to do here beyond letting it — a reconnect's first
    // event is always a fresh snapshot (see rag-engine's
    // StreamDocumentEvents), so no manual resync logic is needed.
    es.onerror = () => {}

    return () => es.close()
  }, [kbId, docId, activeMembership, qc])
}
