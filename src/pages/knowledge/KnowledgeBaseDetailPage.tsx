import { useRef, useState } from 'react'
import { useParams, Link } from '@tanstack/react-router'
import { ArrowLeft, Upload, FileText, Trash2, Send, Loader2 } from 'lucide-react'
import {
  useKnowledgeBase, useKnowledgeDocuments, useInsertText, useUploadFile,
  useDeleteDocument, useQueryKnowledgeBase,
} from '@/features/knowledge/hooks'
import { usePermission } from '@/features/auth/permissions'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { DocumentStatus, KnowledgeQueryMode } from '@/features/knowledge/types'

const STATUS_STYLE: Record<DocumentStatus, string> = {
  pending: 'bg-gray-50 text-gray-600 border-gray-200',
  processing: 'bg-amber-50 text-amber-700 border-amber-200',
  processed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  unknown: 'bg-gray-50 text-gray-600 border-gray-200',
}

// Poll while any document is still in flight — otherwise a single fetch is
// enough (no point re-polling a KB whose documents are all terminal).
const POLL_INTERVAL_MS = 3000

export function KnowledgeBaseDetailPage() {
  const { kbId } = useParams({ from: '/shell/knowledge-bases/$kbId' })
  const { data: kb, isLoading: kbLoading } = useKnowledgeBase(kbId)
  const canWrite = usePermission('knowledge:write')

  const [pollInterval, setPollInterval] = useState<number | false>(POLL_INTERVAL_MS)
  const { data: docsResp, isLoading: docsLoading } = useKnowledgeDocuments(kbId, { refetchInterval: pollInterval })
  const insertMutation = useInsertText(kbId)
  const uploadMutation = useUploadFile(kbId)
  const deleteMutation = useDeleteDocument(kbId)

  const docs = docsResp?.documents ?? []
  const hasInFlight = docs.some((d) => d.status === 'pending' || d.status === 'processing')
  if (hasInFlight && pollInterval === false) setPollInterval(POLL_INTERVAL_MS)
  if (!hasInFlight && pollInterval !== false && docs.length > 0) setPollInterval(false)

  const [textContent, setTextContent] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (kbLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>
  if (!kb) return <div className="p-6 text-sm text-gray-500">Knowledge base not found.</div>

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link to="/knowledge-bases" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
          <ArrowLeft size={12} /> Knowledge Bases
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">{kb.name}</h1>
        {kb.description && <p className="text-sm text-gray-500 mt-1">{kb.description}</p>}
        <p className="mt-1 text-xs text-gray-400">{kb.llm_model} · {kb.embedding_model} ({kb.embedding_dim}d)</p>
      </div>

      {canWrite && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Add a document</h2>
          <div className="flex gap-2">
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              rows={3}
              placeholder="Paste text to index…"
              className="flex-1 resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                disabled={!textContent.trim() || insertMutation.isPending}
                onClick={() => insertMutation.mutate({ content: textContent }, { onSuccess: () => setTextContent('') })}
              >
                {insertMutation.isPending ? <Spinner className="h-4 w-4" /> : <FileText size={14} />}
                Insert Text
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={uploadMutation.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadMutation.isPending ? <Spinner className="h-4 w-4" /> : <Upload size={14} />}
                Upload File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadMutation.mutate(file)
                  e.target.value = ''
                }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
          <h2 className="text-sm font-semibold text-gray-700">Documents ({docs.length})</h2>
          {docsLoading && <Spinner className="h-3.5 w-3.5" />}
        </div>
        {docs.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">No documents yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {docs.map((doc) => (
              <div key={doc.doc_id} className="flex items-center gap-3 px-4 py-3">
                <FileText size={14} className="shrink-0 text-gray-300" />
                <div className="min-w-0 flex-1">
                  <span className="truncate text-sm text-gray-800">{doc.file_path || doc.content_summary || doc.doc_id}</span>
                  {doc.error_msg && <p className="mt-0.5 truncate text-xs text-red-500">{doc.error_msg}</p>}
                  {!doc.error_msg && doc.chunks_count ? (
                    <p className="mt-0.5 text-xs text-gray-400">{doc.chunks_count} chunks</p>
                  ) : null}
                </div>
                <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium', STATUS_STYLE[doc.status])}>
                  {doc.status}
                </span>
                {canWrite && (
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => deleteMutation.mutate(doc.doc_id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 size={13} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <QueryPlayground kbId={kbId} />
    </div>
  )
}

const MODES: KnowledgeQueryMode[] = ['mix', 'hybrid', 'local', 'global', 'naive', 'bypass']

function QueryPlayground({ kbId }: { kbId: string }) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<KnowledgeQueryMode>('mix')
  const queryMutation = useQueryKnowledgeBase(kbId)

  const run = () => {
    if (!query.trim()) return
    queryMutation.mutate({ query, mode, include_answer: true })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700">Query playground</h2>
      <div className="flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors',
              mode === m ? 'border-teal-400 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-500 hover:border-gray-300',
            )}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') run() }}
          placeholder="Ask a question about this knowledge base…"
          className="flex-1"
        />
        <Button size="sm" disabled={!query.trim() || queryMutation.isPending} onClick={run}>
          {queryMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Ask
        </Button>
      </div>
      {queryMutation.data && (
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <Label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">Answer</Label>
          <p className="whitespace-pre-wrap text-sm text-gray-800">{queryMutation.data.answer || '(no context found)'}</p>
        </div>
      )}
      {queryMutation.isError && (
        <p className="text-xs text-red-500">Query failed — check the knowledge base's model configuration.</p>
      )}
    </div>
  )
}
