import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { HTTPError } from 'ky'
import {
  ArrowLeft, Upload, FileText, FileSpreadsheet, FileImage, File as FileIcon,
  Trash2, Send, Loader2, Settings, Share2, Play, Copy, Check, Search, Plus, X,
} from 'lucide-react'
import {
  useKnowledgeBase, useKnowledgeDocuments, useInsertText, useUploadFile,
  useDeleteDocument, useRetryDocument, useQueryKnowledgeBase, useUpdateKnowledgeBase, useProviders,
  useDocumentGraph, useSharing, useSharingUsage, useSetSharing,
} from '@/features/knowledge/hooks'
import { useDocumentPipelineEvents } from '@/features/knowledge/useDocumentEvents'
import { CredentialSelect } from '@/features/app-settings/CredentialSelect'
import { ModelPicker } from '@/features/model-providers/ModelPicker'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { ModelSelect } from '@/features/knowledge/ModelSelect'
import { usePermission } from '@/features/auth/permissions'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { Pagination } from '@/components/ui/pagination'
import { cn } from '@/lib/utils'
import type { DocumentStatus, KnowledgeBase, KnowledgeDocument, KnowledgeQueryMode, StageState, StageStatus, KnowledgeBaseVisibility, AppUsage } from '@/features/knowledge/types'

const STAGE_STYLE: Record<StageState, string> = {
  pending: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]',
  running: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30',
  completed: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/30',
  failed: 'bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))] border-[hsl(var(--destructive))]/30',
  unknown: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]',
}

const STATUS_BADGE_VARIANT: Record<DocumentStatus, 'secondary' | 'warning' | 'success' | 'destructive'> = {
  pending: 'secondary',
  processing: 'warning',
  processed: 'success',
  failed: 'destructive',
  unknown: 'secondary',
}

// SSE (useDocumentPipelineEvents) is now the primary update mechanism —
// this poll is a slow safety net for a dropped/blocked SSE connection, not
// the main path, so the interval is much longer than before.
const POLL_INTERVAL_MS = 15000

const docLabel = (doc: KnowledgeDocument) => doc.file_path || doc.content_summary || doc.doc_id

const FILE_ICON_BY_EXT: Record<string, { Icon: typeof FileText; className: string }> = {
  pdf: { Icon: FileText, className: 'text-[hsl(var(--destructive))]' },
  doc: { Icon: FileText, className: 'text-[hsl(var(--primary))]' },
  docx: { Icon: FileText, className: 'text-[hsl(var(--primary))]' },
  xls: { Icon: FileSpreadsheet, className: 'text-[hsl(var(--success))]' },
  xlsx: { Icon: FileSpreadsheet, className: 'text-[hsl(var(--success))]' },
  csv: { Icon: FileSpreadsheet, className: 'text-[hsl(var(--success))]' },
  png: { Icon: FileImage, className: 'text-[hsl(var(--warning))]' },
  jpg: { Icon: FileImage, className: 'text-[hsl(var(--warning))]' },
  jpeg: { Icon: FileImage, className: 'text-[hsl(var(--warning))]' },
  gif: { Icon: FileImage, className: 'text-[hsl(var(--warning))]' },
  webp: { Icon: FileImage, className: 'text-[hsl(var(--warning))]' },
  svg: { Icon: FileImage, className: 'text-[hsl(var(--warning))]' },
}

function fileIconFor(label: string) {
  const ext = label.split('.').pop()?.toLowerCase() ?? ''
  return FILE_ICON_BY_EXT[ext] ?? { Icon: FileIcon, className: 'text-[hsl(var(--muted-foreground))]' }
}

function formatUploadDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

type SectionId = 'files' | 'retrieval' | 'configuration'

const SECTIONS: { id: SectionId; label: string; icon: typeof FileText }[] = [
  { id: 'files', label: 'Files', icon: FileText },
  { id: 'retrieval', label: 'Retrieval testing', icon: Search },
  { id: 'configuration', label: 'Configuration', icon: Settings },
]

export function KnowledgeBaseDetailPage() {
  const { appId, kbId } = useParams({ from: '/shell/applications/$appId/knowledge-bases/$kbId' })
  const { data: kb, isLoading: kbLoading } = useKnowledgeBase(kbId)
  const canWrite = usePermission('knowledge:write')
  const [section, setSection] = useState<SectionId>('files')

  useDocumentPipelineEvents(kbId)
  const [pollInterval, setPollInterval] = useState<number | false>(POLL_INTERVAL_MS)
  const { data: docsResp, isLoading: docsLoading } = useKnowledgeDocuments(kbId, { refetchInterval: pollInterval })
  const docs = docsResp?.documents ?? []
  const hasInFlight = docs.some((d) => d.status === 'pending' || d.status === 'processing')
  if (hasInFlight && pollInterval === false) setPollInterval(POLL_INTERVAL_MS)
  if (!hasInFlight && pollInterval !== false && docs.length > 0) setPollInterval(false)

  if (kbLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>
  if (!kb) return <div className="p-6 text-sm text-[hsl(var(--muted-foreground))]">Knowledge base not found.</div>

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-4">
        <Link to="/applications/$appId/knowledge-bases" params={{ appId }} className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
          <ArrowLeft size={12} /> Knowledge Bases
        </Link>
        <h1 className="mt-1 text-xl font-bold text-[hsl(var(--foreground))]">{kb.name}</h1>
        {kb.description && <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">{kb.description}</p>}
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="shrink-0 overflow-x-auto overflow-y-hidden border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 md:w-52 md:overflow-x-hidden md:overflow-y-auto md:border-b-0 md:border-r">
          <nav className="flex gap-1 md:block md:space-y-0.5">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={cn(
                  'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-2 text-left text-sm font-medium transition-colors md:w-full',
                  section === id
                    ? 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                    : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
                )}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 overflow-y-auto">
          {section === 'files' && (
            <FilesSection appId={appId} kbId={kbId} docs={docs} docsLoading={docsLoading} canWrite={canWrite} hasInFlight={hasInFlight} />
          )}
          {section === 'retrieval' && (
            <div className="p-6">
              <QueryPlayground kbId={kbId} />
            </div>
          )}
          {section === 'configuration' && (
            <ConfigurationSection kb={kb} kbId={kbId} canWrite={canWrite} />
          )}
        </div>
      </div>
    </div>
  )
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

interface FilesSectionProps {
  appId: string
  kbId: string
  docs: KnowledgeDocument[]
  docsLoading: boolean
  canWrite: boolean
  hasInFlight: boolean
}

function FilesSection({ appId, kbId, docs, docsLoading, canWrite, hasInFlight }: FilesSectionProps) {
  const deleteMutation = useDeleteDocument(kbId)
  const retryMutation = useRetryDocument(kbId)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | DocumentStatus>('all')
  const [sortField, setSortField] = useState<'name' | 'created_at'>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [addOpen, setAddOpen] = useState(false)
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null)
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<KnowledgeDocument | null>(null)

  const filtered = useMemo(() => {
    let list = docs
    if (statusFilter !== 'all') list = list.filter((d) => d.status === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((d) => docLabel(d).toLowerCase().includes(q))
    return list
  }, [docs, statusFilter, search])

  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      const cmp = sortField === 'name'
        ? docLabel(a).localeCompare(docLabel(b))
        : (a.created_at ?? '').localeCompare(b.created_at ?? '')
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [filtered, sortField, sortDir])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const pagedDocs = sorted.slice((page - 1) * pageSize, page * pageSize)
  const expandedDoc = docs.find((d) => d.doc_id === expandedDocId) ?? null

  const handleSortChange = (field: string) => {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field as 'name' | 'created_at')
      setSortDir('asc')
    }
  }

  const columns: DataTableColumn[] = [
    {
      key: 'name', label: 'Name', sortable: true,
      render: (row) => {
        const doc = row as unknown as KnowledgeDocument
        const label = docLabel(doc)
        const { Icon, className } = fileIconFor(label)
        const hasGraph = doc.status === 'processed' && ((doc.entities_count ?? 0) > 0 || (doc.relations_count ?? 0) > 0)
        return (
          <div className="flex min-w-0 items-center gap-2">
            <Icon size={16} className={cn('shrink-0', className)} />
            <div className="min-w-0">
              <Link
                to="/applications/$appId/knowledge-bases/$kbId/documents/$docId"
                params={{ appId, kbId, docId: doc.doc_id }}
                className="block truncate text-sm font-medium text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] hover:underline"
              >
                {label}
              </Link>
              {(doc.error_msg || hasGraph) && (
                <div className="flex items-center gap-2">
                  {doc.error_msg && (
                    <button
                      type="button"
                      onClick={() => setExpandedDocId(doc.doc_id)}
                      className="text-[11px] text-[hsl(var(--destructive))] hover:underline"
                    >
                      Error — view details
                    </button>
                  )}
                  {hasGraph && (
                    <button
                      type="button"
                      onClick={() => setExpandedDocId(doc.doc_id)}
                      className="text-[11px] text-[hsl(var(--muted-foreground))] hover:underline"
                    >
                      {doc.entities_count ?? 0} entities · {doc.relations_count ?? 0} relations
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      },
    },
    {
      key: 'created_at', label: 'Upload date', sortable: true,
      render: (row) => (
        <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
          {formatUploadDate((row as unknown as KnowledgeDocument).created_at)}
        </span>
      ),
    },
    {
      key: 'chunks_count', label: 'Chunks',
      render: (row) => (
        <span className="tabular-nums text-sm text-[hsl(var(--foreground))]">
          {(row as unknown as KnowledgeDocument).chunks_count ?? 0}
        </span>
      ),
    },
    {
      // Every document goes through the same fixed ingestion pipeline today —
      // there's no per-document parser choice to select, so this is an
      // accurate static label, not a stubbed-out control.
      key: 'parse', label: 'Parse',
      render: () => <span className="text-xs text-[hsl(var(--muted-foreground))]">General</span>,
    },
    {
      key: 'status', label: 'Status',
      render: (row) => {
        const doc = row as unknown as KnowledgeDocument
        return <Badge variant={STATUS_BADGE_VARIANT[doc.status]}>{doc.status}</Badge>
      },
    },
    {
      key: 'actions', label: '', align: 'right',
      render: (row) => {
        const doc = row as unknown as KnowledgeDocument
        // Reprocessing is only meaningful once a document has left the
        // pending/processing pipeline — either it failed and needs a retry,
        // or it finished and the caller wants to re-run it from scratch.
        const canRun = doc.status === 'failed' || doc.status === 'processed'
        const isRunning = retryMutation.isPending && retryMutation.variables === doc.doc_id
        return (
          <div className="flex justify-end gap-1">
            {canWrite && canRun && (
              <Button
                size="sm" variant="ghost"
                onClick={() => retryMutation.mutate(doc.doc_id)}
                disabled={isRunning}
                title={doc.status === 'failed' ? 'Retry — reprocess from the stored content' : 'Re-run — reprocess this file again'}
                className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                {isRunning ? <Spinner className="h-3.5 w-3.5" /> : <Play size={13} />}
              </Button>
            )}
            <CopyDocIdButton docId={doc.doc_id} />
            {canWrite && (
              <Button
                size="sm" variant="ghost"
                onClick={() => setConfirmDeleteDoc(doc)}
                title="Delete document"
                className="shrink-0 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))]"
              >
                <Trash2 size={13} />
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-col gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Files</h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {hasInFlight
              ? 'Please wait for your files to finish parsing before starting an AI-powered chat.'
              : `${docs.length} file${docs.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search files…"
              className="pl-8"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as 'all' | DocumentStatus); setPage(1) }}
            className="w-36"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="processed">Processed</option>
            <option value="failed">Failed</option>
          </Select>
          {canWrite && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus size={14} /> Add file
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <DataTable
          columns={columns}
          rows={pagedDocs as unknown as Record<string, unknown>[]}
          getRowId={(row) => (row as unknown as KnowledgeDocument).doc_id}
          sortField={sortField}
          sortDir={sortDir}
          onSortChange={handleSortChange}
          loading={docsLoading && docs.length === 0}
          emptyMessage={docs.length === 0 ? 'No files yet — add one to get started.' : 'No files match your search.'}
        />
        {expandedDoc && (
          <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="truncate text-xs font-medium text-[hsl(var(--foreground))]">{docLabel(expandedDoc)}</p>
              <Button variant="ghost" size="icon" onClick={() => setExpandedDocId(null)} className="h-6 w-6 shrink-0">
                <X size={13} />
              </Button>
            </div>
            {expandedDoc.error_msg && (
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-[hsl(var(--destructive))]/10 p-2.5 text-[11px] text-[hsl(var(--destructive))]">
                {expandedDoc.error_msg}
              </pre>
            )}
            {expandedDoc.stages && expandedDoc.stages.length > 0 && (
              <div className="mt-2">
                <Label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Pipeline stages</Label>
                <StageBadges stages={expandedDoc.stages} />
              </div>
            )}
            {expandedDoc.status === 'processed' && ((expandedDoc.entities_count ?? 0) > 0 || (expandedDoc.relations_count ?? 0) > 0) && (
              <div className="mt-2">
                <DocumentGraphPanel kbId={kbId} docId={expandedDoc.doc_id} />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-[hsl(var(--border))] px-4 py-2">
        <p className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">Total {sorted.length}</p>
        <div className="flex items-center gap-3">
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
          <Select
            value={String(pageSize)}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
            className="h-7 w-28 text-xs"
          >
            {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n} / Page</option>)}
          </Select>
        </div>
      </div>

      <AddDocumentDialog kbId={kbId} open={addOpen} onOpenChange={setAddOpen} />

      <ConfirmDialog
        open={!!confirmDeleteDoc}
        onOpenChange={(o) => { if (!o) setConfirmDeleteDoc(null) }}
        title="Delete this document?"
        description={confirmDeleteDoc ? `"${docLabel(confirmDeleteDoc)}" and every chunk indexed from it will be permanently deleted — this can't be undone.` : undefined}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (confirmDeleteDoc) deleteMutation.mutate(confirmDeleteDoc.doc_id)
          setConfirmDeleteDoc(null)
        }}
      />
    </div>
  )
}

function CopyDocIdButton({ docId }: { docId: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard.writeText(docId)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <Button
      size="sm" variant="ghost"
      onClick={copy}
      title="Copy document ID"
      className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
    >
      {copied ? <Check size={13} className="text-[hsl(var(--success))]" /> : <Copy size={13} />}
    </Button>
  )
}

function AddDocumentDialog({ kbId, open, onOpenChange }: { kbId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [textContent, setTextContent] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const insertMutation = useInsertText(kbId)
  const uploadMutation = useUploadFile(kbId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a file</DialogTitle>
          <DialogDescription>Upload a file or paste text to index into this knowledge base.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div>
            <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Upload a file</Label>
            <Button
              variant="outline"
              className="w-full justify-center"
              disabled={uploadMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadMutation.isPending ? <Spinner className="h-4 w-4" /> : <Upload size={14} />}
              Choose file
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

          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            <div className="h-px flex-1 bg-[hsl(var(--border))]" /> or <div className="h-px flex-1 bg-[hsl(var(--border))]" />
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Paste text</Label>
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              rows={4}
              placeholder="Paste text to index…"
              className="w-full resize-y rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20"
            />
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                disabled={!textContent.trim() || insertMutation.isPending}
                onClick={() => insertMutation.mutate({ content: textContent }, { onSuccess: () => setTextContent('') })}
              >
                {insertMutation.isPending ? <Spinner className="h-4 w-4" /> : <FileText size={14} />}
                Insert text
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Renders whatever stages the backend reports, in the order they arrive —
// no hardcoded stage list, so a future stage type (e.g. PII detection)
// shows up automatically with no frontend change.
function StageBadges({ stages }: { stages?: StageStatus[] }) {
  if (!stages?.length) return null
  return (
    <div className="flex flex-wrap gap-1">
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
    return <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]"><Spinner className="h-3 w-3" /> Loading…</div>
  }
  if (!data || (data.entities.length === 0 && data.relations.length === 0)) {
    return null
  }

  return (
    <div className="space-y-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2.5">
      {data.entities.length > 0 && (
        <div>
          <Label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] tabular-nums">
            Entities ({data.entities.length})
          </Label>
          <div className="flex flex-wrap gap-1">
            {data.entities.map((e) => (
              <span
                key={e.name}
                title={e.description}
                className="rounded-full border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/10 px-2 py-0.5 text-[11px] text-[hsl(var(--primary))]"
              >
                {e.name}
                {e.type && <span className="ml-1 opacity-70">· {e.type}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
      {data.relations.length > 0 && (
        <div>
          <Label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] tabular-nums">
            Relations ({data.relations.length})
          </Label>
          <div className="space-y-1">
            {data.relations.map((r) => (
              <div key={`${r.source}-${r.target}`} className="text-[11px] text-[hsl(var(--muted-foreground))]">
                <span className="font-medium text-[hsl(var(--foreground))]">{r.source}</span>
                {' → '}
                <span className="font-medium text-[hsl(var(--foreground))]">{r.target}</span>
                {r.keywords && <span className="ml-1 text-[hsl(var(--muted-foreground))]">({r.keywords})</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const VISIBILITY_OPTIONS: { value: KnowledgeBaseVisibility; label: string; description: string }[] = [
  { value: 'full_access', label: 'No Restrictions', description: 'Every other app can view, use, create, edit, and delete this data.' },
  { value: 'read_only', label: 'Read Only Access', description: 'Every other app can view and use this data, but not modify it.' },
  { value: 'private', label: "Won't Share", description: 'Not shared with anyone outside this app.' },
]

// FR-C9-002: a section on the Configuration tab (not a dialog) — sharing is
// meant to be revisited any time, not a one-time creation choice, so it
// lives inline alongside Model Settings rather than behind a button+modal.
function SharingSettingsSection({ kbId, canWrite }: { kbId: string; canWrite: boolean }) {
  const { data: sharing, isLoading } = useSharing(kbId)
  const usageMutation = useSharingUsage(kbId)
  const setSharingMutation = useSetSharing(kbId)
  const [pendingUsage, setPendingUsage] = useState<{ target: KnowledgeBaseVisibility; apps: AppUsage[] } | null>(null)

  if (isLoading || !sharing) {
    return (
      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <div className="flex h-16 items-center justify-center"><Spinner className="h-4 w-4" /></div>
      </div>
    )
  }

  const rank: Record<KnowledgeBaseVisibility, number> = { private: 0, read_only: 1, full_access: 2 }

  const applyVisibility = (visibility: KnowledgeBaseVisibility) => {
    setSharingMutation.mutate(visibility, {
      onError: (e) => {
        // 409 in_use is the normal outcome of a real (rare) race: the usage
        // check (requestChange) ran clean, but another app started
        // referencing this KB before this save landed. Every other failure
        // is a genuine error.
        if (e instanceof HTTPError && e.response.status === 409) {
          toast.error('This knowledge base is now in use elsewhere — refresh and try again.')
          return
        }
        toast.error('Could not update sharing settings.')
      },
    })
  }

  const requestChange = (visibility: KnowledgeBaseVisibility) => {
    if (visibility === sharing.visibility) return
    // Only a NARROWING change needs a usage check (FR-C9-002 SHARE-06) —
    // widening access never removes anything another app already has.
    if (rank[visibility] >= rank[sharing.visibility]) {
      applyVisibility(visibility)
      return
    }
    usageMutation.mutate(undefined, {
      onSuccess: (usage) => {
        // Defensive against a null `apps` — the backend guarantees [] on
        // every response, but this component shouldn't trust that alone.
        const apps = usage.apps ?? []
        if (apps.length === 0) {
          applyVisibility(visibility)
        } else {
          setPendingUsage({ target: visibility, apps })
        }
      },
      onError: () => {
        toast.error('Could not verify usage across every app — try again.')
      },
    })
  }

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Share2 size={14} className="text-[hsl(var(--muted-foreground))]" />
        <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Sharing Settings</h2>
      </div>
      <RadioGroup
        value={sharing.visibility}
        onValueChange={(v) => requestChange(v as KnowledgeBaseVisibility)}
        className="flex flex-col gap-2"
      >
        {VISIBILITY_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              'flex cursor-pointer items-start gap-2 rounded-lg border border-[hsl(var(--border))] p-3',
              !canWrite && 'cursor-not-allowed opacity-60',
            )}
          >
            <RadioGroupItem value={opt.value} disabled={!canWrite || usageMutation.isPending || setSharingMutation.isPending} className="mt-0.5" />
            <span className="text-sm">
              <span className="block font-medium text-[hsl(var(--foreground))]">{opt.label}</span>
              <span className="block text-[11px] text-[hsl(var(--muted-foreground))]">{opt.description}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
      {(usageMutation.isPending || setSharingMutation.isPending) && (
        <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]"><Spinner className="h-3 w-3" /> Updating…</div>
      )}

      <ConfirmDialog
        open={!!pendingUsage}
        onOpenChange={(open) => { if (!open) setPendingUsage(null) }}
        title="This knowledge base is in use elsewhere"
        description={pendingUsage ? describeUsage(pendingUsage.apps) : undefined}
        confirmLabel="Change anyway"
        destructive
        loading={setSharingMutation.isPending}
        onConfirm={() => {
          if (pendingUsage) applyVisibility(pendingUsage.target)
          setPendingUsage(null)
        }}
      />
    </div>
  )
}

function describeUsage(apps: AppUsage[]): string {
  const parts = apps.map((a) => {
    const refs: string[] = []
    if (a.workflows.length) refs.push(`${a.workflows.length} workflow${a.workflows.length === 1 ? '' : 's'} (${a.workflows.join(', ')})`)
    if (a.agents.length) refs.push(`${a.agents.length} agent${a.agents.length === 1 ? '' : 's'} (${a.agents.join(', ')})`)
    return `${a.app_name} — ${refs.join(' and ')}`
  })
  return `Changing this could break access for: ${parts.join('; ')}. This can't be undone automatically — continue?`
}

const PROVIDER_LABELS: Record<string, string> = { openai: 'OpenAI', gemini: 'Gemini', voyage: 'Voyage' }

function ConfigurationSection({ kb, kbId, canWrite }: { kb: KnowledgeBase; kbId: string; canWrite: boolean }) {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="max-w-2xl space-y-6 p-6">
      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Model Settings</h2>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              {PROVIDER_LABELS[kb.provider] ?? kb.provider} · {kb.llm_model} · {kb.embedding_model} ({kb.embedding_dim}d)
            </p>
          </div>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)} className="shrink-0">
              <Settings size={14} />
              Edit
            </Button>
          )}
        </div>
      </div>

      <EditModelSettingsDialog kb={kb} open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* FR-C9-002: only the owning app sees/edits sharing — a KB reached
         via another app's sharing grant has no Sharing Settings here. */}
      {kb.owned_by_app && <SharingSettingsSection kbId={kbId} canWrite={canWrite} />}
    </div>
  )
}

// The embedding model and its dimension are fixed at creation because they
// name the existing vector space. A user may still select another configured
// Provider Instance that exposes that exact pair, which rotates the API key
// without requiring re-ingestion.
function EditModelSettingsDialog({ kb, open, onOpenChange }: { kb: KnowledgeBase; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslation()
  const { data: providers } = useProviders()
  const updateMutation = useUpdateKnowledgeBase(kb.id)
  const [credentialName, setCredentialName] = useState(kb.credential_name)
  const [llmModel, setLlmModel] = useState(kb.llm_model)
  const [embeddingModelID, setEmbeddingModelID] = useState<string | undefined>()

  // Re-sync from the current KB whenever the dialog is (re-)opened, so a
  // previous edit that was cancelled doesn't leak into the next open.
  useEffect(() => {
    if (open) {
      setCredentialName(kb.credential_name)
      setLlmModel(kb.llm_model)
      setEmbeddingModelID(undefined)
    }
  }, [open, kb.credential_name, kb.llm_model])

  const selectedProvider = providers?.find((p) => p.provider === kb.provider)
  const canSubmit = credentialName.trim() !== '' && llmModel.trim() !== ''
    && (credentialName !== kb.credential_name || llmModel !== kb.llm_model || embeddingModelID !== undefined)

  const submit = () => {
    const payload: { credential_name?: string; llm_model?: string; embedding_model_id?: string } = {}
    if (credentialName !== kb.credential_name) payload.credential_name = credentialName
    if (llmModel !== kb.llm_model) payload.llm_model = llmModel
    if (embeddingModelID) payload.embedding_model_id = embeddingModelID
    updateMutation.mutate(payload, {
      onSuccess: () => {
        if (embeddingModelID) toast.success(t('knowledge.settings.embedding_instance_updated'))
        onOpenChange(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>Model Settings</DialogTitle>
          <DialogDescription>
            {t('knowledge.settings.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div>
            <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Provider</Label>
            <div className="flex h-9 items-center rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2.5 text-sm text-[hsl(var(--muted-foreground))]">
              {PROVIDER_LABELS[kb.provider] ?? kb.provider}
            </div>
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('knowledge.settings.llm_credential')}</Label>
            <CredentialSelect
              value={credentialName || undefined}
              onChange={(name) => setCredentialName(name ?? '')}
              typeFilter={['bearer', 'api_key']}
              accentClassName="text-[hsl(var(--primary))]"
            />
            <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
              A Bearer token or API key credential holding the {PROVIDER_LABELS[kb.provider] ?? kb.provider} API key.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">LLM Model</Label>
              <ModelSelect
                value={llmModel}
                onChange={setLlmModel}
                options={selectedProvider?.llm_models ?? [kb.llm_model]}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Embedding Model</Label>
              <div className="flex h-9 items-center rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2.5 text-sm text-[hsl(var(--muted-foreground))]">
                {kb.embedding_model} ({kb.embedding_dim}d)
              </div>
            </div>
          </div>
          <div>
            <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('knowledge.settings.embedding_instance')}</Label>
            <ModelPicker
              value={embeddingModelID}
              onChange={setEmbeddingModelID}
              capability="embedding"
              isOptionAllowed={(model) => model.model === kb.embedding_model && model.embedding_dim === kb.embedding_dim}
              emptyLabel={t('knowledge.settings.embedding_instance_empty', { model: kb.embedding_model, dim: kb.embedding_dim })}
            />
            <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
              {t('knowledge.settings.embedding_instance_hint', { model: kb.embedding_model, dim: kb.embedding_dim })}
            </p>
          </div>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
            {t('knowledge.settings.embedding_model_fixed')}
          </p>

          {updateMutation.isError && (
            <p className="text-xs text-[hsl(var(--destructive))]">Failed to update model settings. Check the credential and try again.</p>
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
  const [enableRerank, setEnableRerank] = useState(false)
  const queryMutation = useQueryKnowledgeBase(kbId)

  const run = () => {
    if (!query.trim()) return
    queryMutation.mutate({ query, mode, include_answer: true, enable_rerank: enableRerank })
  }

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 space-y-3">
      <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Retrieval testing</h2>
      <div className="flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors',
              mode === m
                ? 'border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--muted-foreground))]/40',
            )}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Rerank Results</Label>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Reorders retrieved chunks by relevance before answering</p>
        </div>
        <Switch checked={enableRerank} onCheckedChange={setEnableRerank} />
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
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3">
          <Label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Answer</Label>
          <p className="whitespace-pre-wrap text-sm text-[hsl(var(--foreground))]">{queryMutation.data.answer || '(no context found)'}</p>
          {queryMutation.data.references.length > 0 && (
            <div className="mt-3 border-t border-[hsl(var(--border))] pt-2">
              <Label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Sources</Label>
              <ul className="space-y-1">
                {queryMutation.data.references.map((ref) => (
                  <li key={ref.reference_id} className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                    <FileText size={11} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
                    <span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">[{ref.reference_id}]</span>
                    <span className="truncate">{ref.file_path}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {queryMutation.isError && (
        <p className="text-xs text-[hsl(var(--destructive))]">Query failed — check the knowledge base's model configuration.</p>
      )}
    </div>
  )
}
