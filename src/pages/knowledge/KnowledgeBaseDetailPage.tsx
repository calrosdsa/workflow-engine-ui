import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from '@tanstack/react-router'
import {
  ArrowLeft, Upload, FileText, Trash2, Send, Loader2, Settings,
  RotateCw, Copy, Check, ChevronDown, ChevronUp,
} from 'lucide-react'
import {
  useKnowledgeBase, useKnowledgeDocuments, useInsertText, useUploadFile,
  useDeleteDocument, useRetryDocument, useQueryKnowledgeBase, useUpdateKnowledgeBase, useProviders,
  useDocumentGraph,
} from '@/features/knowledge/hooks'
import { useDocumentPipelineEvents } from '@/features/knowledge/useDocumentEvents'
import { CredentialSelect } from '@/features/app-settings/CredentialSelect'
import { ModelSelect } from '@/features/knowledge/ModelSelect'
import { usePermission } from '@/features/auth/permissions'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { DocumentStatus, KnowledgeBase, KnowledgeDocument, KnowledgeQueryMode, StageState, StageStatus } from '@/features/knowledge/types'

const STATUS_STYLE: Record<DocumentStatus, string> = {
  pending: 'bg-gray-50 text-gray-600 border-gray-200',
  processing: 'bg-amber-50 text-amber-700 border-amber-200',
  processed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  unknown: 'bg-gray-50 text-gray-600 border-gray-200',
}

const STAGE_STYLE: Record<StageState, string> = {
  pending: 'bg-gray-50 text-gray-500 border-gray-200',
  running: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  unknown: 'bg-gray-50 text-gray-500 border-gray-200',
}

// SSE (useDocumentPipelineEvents) is now the primary update mechanism —
// this poll is a slow safety net for a dropped/blocked SSE connection, not
// the main path, so the interval is much longer than before.
const POLL_INTERVAL_MS = 15000

export function KnowledgeBaseDetailPage() {
  const { kbId } = useParams({ from: '/shell/knowledge-bases/$kbId' })
  const { data: kb, isLoading: kbLoading } = useKnowledgeBase(kbId)
  const canWrite = usePermission('knowledge:write')

  useDocumentPipelineEvents(kbId)
  const [pollInterval, setPollInterval] = useState<number | false>(POLL_INTERVAL_MS)
  const { data: docsResp, isLoading: docsLoading } = useKnowledgeDocuments(kbId, { refetchInterval: pollInterval })
  const insertMutation = useInsertText(kbId)
  const uploadMutation = useUploadFile(kbId)
  const deleteMutation = useDeleteDocument(kbId)
  const retryMutation = useRetryDocument(kbId)

  const docs = docsResp?.documents ?? []
  const hasInFlight = docs.some((d) => d.status === 'pending' || d.status === 'processing')
  if (hasInFlight && pollInterval === false) setPollInterval(POLL_INTERVAL_MS)
  if (!hasInFlight && pollInterval !== false && docs.length > 0) setPollInterval(false)

  const [textContent, setTextContent] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  if (kbLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>
  if (!kb) return <div className="p-6 text-sm text-gray-500">Knowledge base not found.</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/knowledge-bases" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
            <ArrowLeft size={12} /> Knowledge Bases
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{kb.name}</h1>
          {kb.description && <p className="text-sm text-gray-500 mt-1">{kb.description}</p>}
          <p className="mt-1 text-xs text-gray-400">{kb.llm_model} · {kb.embedding_model} ({kb.embedding_dim}d)</p>
        </div>
        {canWrite && (
          <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings size={14} />
            Model Settings
          </Button>
        )}
      </div>

      <EditModelSettingsDialog kb={kb} open={settingsOpen} onOpenChange={setSettingsOpen} />

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
              <DocumentRow
                key={doc.doc_id}
                kbId={kbId}
                doc={doc}
                canWrite={canWrite}
                onDelete={() => deleteMutation.mutate(doc.doc_id)}
                onRetry={() => retryMutation.mutate(doc.doc_id)}
                isRetrying={retryMutation.isPending && retryMutation.variables === doc.doc_id}
              />
            ))}
          </div>
        )}
      </div>

      <QueryPlayground kbId={kbId} />
    </div>
  )
}

interface DocumentRowProps {
  kbId: string
  doc: KnowledgeDocument
  canWrite: boolean
  onDelete: () => void
  onRetry: () => void
  isRetrying: boolean
}

function DocumentRow({ kbId, doc, canWrite, onDelete, onRetry, isRetrying }: DocumentRowProps) {
  const [errorExpanded, setErrorExpanded] = useState(false)
  const [graphExpanded, setGraphExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyDocID = () => {
    void navigator.clipboard.writeText(doc.doc_id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const hasGraph = doc.status === 'processed' && ((doc.entities_count ?? 0) > 0 || (doc.relations_count ?? 0) > 0)

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <FileText size={14} className="shrink-0 text-gray-300" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-gray-800">{doc.file_path || doc.content_summary || doc.doc_id}</div>
          {doc.error_msg && (
            <button
              type="button"
              onClick={() => setErrorExpanded((v) => !v)}
              className="mt-0.5 flex max-w-full items-center gap-1 text-left text-xs text-red-500 hover:text-red-600"
            >
              <span className="truncate">{doc.error_msg}</span>
              {errorExpanded ? <ChevronUp size={12} className="shrink-0" /> : <ChevronDown size={12} className="shrink-0" />}
            </button>
          )}
          {!doc.error_msg && doc.chunks_count ? (
            <p className="mt-0.5 text-xs text-gray-400">{doc.chunks_count} chunks</p>
          ) : null}
          <StageBadges stages={doc.stages} />
        </div>
        <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium', STATUS_STYLE[doc.status])}>
          {doc.status}
        </span>
        {hasGraph && (
          <Button
            size="sm" variant="ghost"
            onClick={() => setGraphExpanded((v) => !v)}
            title="Entities and relationships extracted from this document"
            className="shrink-0 text-gray-500 hover:text-gray-700"
          >
            {doc.entities_count ?? 0}&nbsp;entities · {doc.relations_count ?? 0}&nbsp;relations
            {graphExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </Button>
        )}
        <Button
          size="sm" variant="ghost"
          onClick={copyDocID}
          title="Copy document ID"
          className="shrink-0 text-gray-400 hover:text-gray-600"
        >
          {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
        </Button>
        {canWrite && doc.status === 'failed' && (
          <Button
            size="sm" variant="ghost"
            onClick={onRetry}
            disabled={isRetrying}
            title="Retry — reprocess from the stored content"
            className="shrink-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
          >
            {isRetrying ? <Spinner className="h-3.5 w-3.5" /> : <RotateCw size={13} />}
          </Button>
        )}
        {canWrite && (
          <Button
            size="sm" variant="ghost"
            onClick={onDelete}
            title="Delete document"
            className="shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 size={13} />
          </Button>
        )}
      </div>
      {errorExpanded && doc.error_msg && (
        <pre className="mt-2 ml-6 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-red-50 p-2.5 text-[11px] text-red-700">
          {doc.error_msg}
        </pre>
      )}
      {graphExpanded && hasGraph && <DocumentGraphPanel kbId={kbId} docId={doc.doc_id} />}
    </div>
  )
}

// Renders whatever stages the backend reports, in the order they arrive —
// no hardcoded stage list, so a future stage type (e.g. PII detection)
// shows up automatically with no frontend change.
function StageBadges({ stages }: { stages?: StageStatus[] }) {
  if (!stages?.length) return null
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {stages.map((s) => (
        <span
          key={s.stage}
          title={s.error_msg || (s.duration_ms ? `${s.duration_ms}ms` : undefined)}
          className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium capitalize', STAGE_STYLE[s.state])}
        >
          {s.stage}
        </span>
      ))}
    </div>
  )
}

function DocumentGraphPanel({ kbId, docId }: { kbId: string; docId: string }) {
  const { data, isLoading } = useDocumentGraph(kbId, docId, true)

  if (isLoading) {
    return <div className="mt-2 ml-6 flex items-center gap-2 text-xs text-gray-400"><Spinner className="h-3 w-3" /> Loading…</div>
  }
  if (!data || (data.entities.length === 0 && data.relations.length === 0)) {
    return null
  }

  return (
    <div className="mt-2 ml-6 space-y-2 rounded-md border border-gray-100 bg-gray-50 p-2.5">
      {data.entities.length > 0 && (
        <div>
          <Label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Entities ({data.entities.length})
          </Label>
          <div className="flex flex-wrap gap-1">
            {data.entities.map((e) => (
              <span
                key={e.name}
                title={e.description}
                className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] text-teal-700"
              >
                {e.name}
                {e.type && <span className="ml-1 text-teal-500">· {e.type}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
      {data.relations.length > 0 && (
        <div>
          <Label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Relations ({data.relations.length})
          </Label>
          <div className="space-y-1">
            {data.relations.map((r) => (
              <div key={`${r.source}-${r.target}`} className="text-[11px] text-gray-600">
                <span className="font-medium text-gray-800">{r.source}</span>
                {' → '}
                <span className="font-medium text-gray-800">{r.target}</span>
                {r.keywords && <span className="ml-1 text-gray-400">({r.keywords})</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const PROVIDER_LABELS: Record<string, string> = { openai: 'OpenAI', gemini: 'Gemini' }

// Provider and embedding model are fixed at creation (see
// UpdateKnowledgeBasePayload's doc comment — embedding dimension is baked
// into the vector indexes, and swapping providers would break the existing
// embedding space). This dialog only lets the credential and LLM model
// rotate; the embedding model is shown for reference only.
function EditModelSettingsDialog({ kb, open, onOpenChange }: { kb: KnowledgeBase; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: providers } = useProviders()
  const updateMutation = useUpdateKnowledgeBase(kb.id)
  const [credentialName, setCredentialName] = useState(kb.credential_name)
  const [llmModel, setLlmModel] = useState(kb.llm_model)

  // Re-sync from the current KB whenever the dialog is (re-)opened, so a
  // previous edit that was cancelled doesn't leak into the next open.
  useEffect(() => {
    if (open) {
      setCredentialName(kb.credential_name)
      setLlmModel(kb.llm_model)
    }
  }, [open, kb.credential_name, kb.llm_model])

  const selectedProvider = providers?.find((p) => p.provider === kb.provider)
  const canSubmit = credentialName.trim() !== '' && llmModel.trim() !== ''
    && (credentialName !== kb.credential_name || llmModel !== kb.llm_model)

  const submit = () => {
    const payload: { credential_name?: string; llm_model?: string } = {}
    if (credentialName !== kb.credential_name) payload.credential_name = credentialName
    if (llmModel !== kb.llm_model) payload.llm_model = llmModel
    updateMutation.mutate(payload, { onSuccess: () => onOpenChange(false) })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>Model Settings</DialogTitle>
          <DialogDescription>
            Rotate the credential or switch LLM models. Provider and embedding model are fixed once a knowledge base is created.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div>
            <Label className="mb-1 block text-xs font-medium text-gray-600">Provider</Label>
            <div className="flex h-9 items-center rounded-md border border-gray-100 bg-gray-50 px-2.5 text-sm text-gray-500">
              {PROVIDER_LABELS[kb.provider] ?? kb.provider}
            </div>
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-gray-600">Credential</Label>
            <CredentialSelect
              value={credentialName || undefined}
              onChange={(name) => setCredentialName(name ?? '')}
              typeFilter={['bearer', 'api_key']}
              accentClassName="text-teal-600"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              A Bearer token or API key credential holding the {PROVIDER_LABELS[kb.provider] ?? kb.provider} API key.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs font-medium text-gray-600">LLM Model</Label>
              <ModelSelect
                value={llmModel}
                onChange={setLlmModel}
                options={selectedProvider?.llm_models ?? [kb.llm_model]}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-gray-600">Embedding Model</Label>
              <div className="flex h-9 items-center rounded-md border border-gray-100 bg-gray-50 px-2.5 text-sm text-gray-500">
                {kb.embedding_model} ({kb.embedding_dim}d)
              </div>
            </div>
          </div>
          <p className="text-[11px] text-gray-400">
            To use a different embedding model, create a new knowledge base — existing embeddings can't be migrated in place.
          </p>

          {updateMutation.isError && (
            <p className="text-xs text-red-500">Failed to update model settings. Check the credential and try again.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={updateMutation.isPending}>Cancel</Button>
          <Button size="sm" disabled={!canSubmit || updateMutation.isPending} onClick={submit}>
            {updateMutation.isPending ? <Spinner className="h-4 w-4" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
