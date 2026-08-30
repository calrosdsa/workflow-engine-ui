import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { HTTPError } from 'ky'
import {
  ArrowLeft, Upload, FileText, Trash2, Send, Loader2, Settings, Share2,
  RotateCw, Copy, Check, ChevronDown, ChevronUp,
} from 'lucide-react'
import {
  useKnowledgeBase, useKnowledgeDocuments, useInsertText, useUploadFile,
  useDeleteDocument, useRetryDocument, useQueryKnowledgeBase, useUpdateKnowledgeBase, useProviders,
  useDocumentGraph, useSharing, useSharingUsage, useSetSharing,
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
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'
import type { DocumentStatus, KnowledgeBase, KnowledgeDocument, KnowledgeQueryMode, StageState, StageStatus, KnowledgeBaseVisibility, AppUsage } from '@/features/knowledge/types'

// Token classes only — no raw hex/Tailwind-color literals, per
// workflow-engine-ui/design.md. --muted/--warning/--success/--destructive
// are the same 4 status roles this codebase's Badge component already
// uses; these local badges predate Badge's own variant set and now share
// its token vocabulary instead of inventing a fifth ad hoc one.
const STATUS_STYLE: Record<DocumentStatus, string> = {
  pending: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]',
  processing: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30',
  processed: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/30',
  failed: 'bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))] border-[hsl(var(--destructive))]/30',
  unknown: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]',
}

const STAGE_STYLE: Record<StageState, string> = {
  pending: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]',
  running: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30',
  completed: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/30',
  failed: 'bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))] border-[hsl(var(--destructive))]/30',
  unknown: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]',
}

// SSE (useDocumentPipelineEvents) is now the primary update mechanism —
// this poll is a slow safety net for a dropped/blocked SSE connection, not
// the main path, so the interval is much longer than before.
const POLL_INTERVAL_MS = 15000

export function KnowledgeBaseDetailPage() {
  const { appId, kbId } = useParams({ from: '/shell/applications/$appId/knowledge-bases/$kbId' })
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
  if (!kb) return <div className="p-6 text-sm text-[hsl(var(--muted-foreground))]">Knowledge base not found.</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/applications/$appId/knowledge-bases" params={{ appId }} className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            <ArrowLeft size={12} /> Knowledge Bases
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-[hsl(var(--foreground))]">{kb.name}</h1>
          {kb.description && <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{kb.description}</p>}
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{kb.llm_model} · {kb.embedding_model} ({kb.embedding_dim}d)</p>
        </div>
        {canWrite && (
          <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings size={14} />
            Model Settings
          </Button>
        )}
      </div>

      <EditModelSettingsDialog kb={kb} open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* FR-C9-002: only the owning app sees/edits sharing — a KB reached
         via another app's sharing grant has no Sharing Settings here. */}
      {kb.owned_by_app && <SharingSettingsSection kbId={kbId} canWrite={canWrite} />}

      {canWrite && (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 space-y-3">
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Add a document</h2>
          <div className="flex gap-2">
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              rows={3}
              placeholder="Paste text to index…"
              className="flex-1 resize-y rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20"
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

      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-2">
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Documents ({docs.length})</h2>
          {docsLoading && <Spinner className="h-3.5 w-3.5" />}
        </div>
        {docs.length === 0 ? (
          <p className="p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">No documents yet.</p>
        ) : (
          <div className="divide-y divide-[hsl(var(--border))]">
            {docs.map((doc) => (
              <DocumentRow
                key={doc.doc_id}
                kbId={kbId}
                doc={doc}
                canWrite={canWrite}
                onDelete={() => deleteMutation.mutate(doc.doc_id)}
                isDeleting={deleteMutation.isPending && deleteMutation.variables === doc.doc_id}
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
  isDeleting: boolean
  onRetry: () => void
  isRetrying: boolean
}

function DocumentRow({ kbId, doc, canWrite, onDelete, isDeleting, onRetry, isRetrying }: DocumentRowProps) {
  const [errorExpanded, setErrorExpanded] = useState(false)
  const [graphExpanded, setGraphExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  // Document delete is exactly as irreversible as the knowledge-base-level
  // delete KnowledgeBasesPage.tsx already confirms via ConfirmDialog — per
  // design.md's Microinteractions stance, this closes that asymmetry rather
  // than firing the mutation directly on click.
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const copyDocID = () => {
    void navigator.clipboard.writeText(doc.doc_id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const hasGraph = doc.status === 'processed' && ((doc.entities_count ?? 0) > 0 || (doc.relations_count ?? 0) > 0)
  const docLabel = doc.file_path || doc.content_summary || doc.doc_id

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <FileText size={14} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-[hsl(var(--foreground))]">{docLabel}</div>
          {doc.error_msg && (
            <button
              type="button"
              onClick={() => setErrorExpanded((v) => !v)}
              className="mt-0.5 flex max-w-full items-center gap-1 text-left text-xs text-[hsl(var(--destructive))] hover:opacity-80"
            >
              <span className="truncate">{doc.error_msg}</span>
              {errorExpanded ? <ChevronUp size={12} className="shrink-0" /> : <ChevronDown size={12} className="shrink-0" />}
            </button>
          )}
          {!doc.error_msg && doc.chunks_count ? (
            <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))] tabular-nums">{doc.chunks_count} chunks</p>
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
            className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] tabular-nums"
          >
            {doc.entities_count ?? 0}&nbsp;entities · {doc.relations_count ?? 0}&nbsp;relations
            {graphExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </Button>
        )}
        <Button
          size="sm" variant="ghost"
          onClick={copyDocID}
          title="Copy document ID"
          className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          {copied ? <Check size={13} className="text-[hsl(var(--success))]" /> : <Copy size={13} />}
        </Button>
        {canWrite && doc.status === 'failed' && (
          <Button
            size="sm" variant="ghost"
            onClick={onRetry}
            disabled={isRetrying}
            title="Retry — reprocess from the stored content"
            className="shrink-0 text-[hsl(var(--warning))] hover:text-[hsl(var(--warning))] hover:bg-[hsl(var(--warning))]/10"
          >
            {isRetrying ? <Spinner className="h-3.5 w-3.5" /> : <RotateCw size={13} />}
          </Button>
        )}
        {canWrite && (
          <Button
            size="sm" variant="ghost"
            onClick={() => setConfirmingDelete(true)}
            title="Delete document"
            className="shrink-0 text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10"
          >
            <Trash2 size={13} />
          </Button>
        )}
      </div>
      {errorExpanded && doc.error_msg && (
        <pre className="mt-2 ml-6 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-[hsl(var(--destructive))]/10 p-2.5 text-[11px] text-[hsl(var(--destructive))]">
          {doc.error_msg}
        </pre>
      )}
      {graphExpanded && hasGraph && <DocumentGraphPanel kbId={kbId} docId={doc.doc_id} />}
      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete this document?"
        description={`"${docLabel}" and every chunk indexed from it will be permanently deleted — this can't be undone.`}
        confirmLabel="Delete"
        destructive
        loading={isDeleting}
        onConfirm={() => { onDelete(); setConfirmingDelete(false) }}
      />
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
    return <div className="mt-2 ml-6 flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]"><Spinner className="h-3 w-3" /> Loading…</div>
  }
  if (!data || (data.entities.length === 0 && data.relations.length === 0)) {
    return null
  }

  return (
    <div className="mt-2 ml-6 space-y-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-2.5">
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

// FR-C9-002: a section on the detail page (not a dialog) — sharing is
// meant to be revisited any time, not a one-time creation choice, so it
// lives inline alongside the other page sections rather than behind a
// button+modal like Model Settings.
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
            <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Provider</Label>
            <div className="flex h-9 items-center rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2.5 text-sm text-[hsl(var(--muted-foreground))]">
              {PROVIDER_LABELS[kb.provider] ?? kb.provider}
            </div>
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Credential</Label>
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
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
            To use a different embedding model, create a new knowledge base — existing embeddings can't be migrated in place.
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
      <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Query playground</h2>
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
