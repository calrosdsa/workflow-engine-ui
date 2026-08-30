import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Plus, Trash2, ExternalLink, BookOpen, Sparkles } from 'lucide-react'
import { useKnowledgeBases, useCreateKnowledgeBase, useDeleteKnowledgeBase } from '@/features/knowledge/hooks'
import { ProviderSelect } from '@/features/llm-providers/ProviderSelect'
import { ManageProvidersDialog } from '@/features/llm-providers/ManageProvidersDialog'
import { usePermission } from '@/features/auth/permissions'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CreateKnowledgeBasePayload, KnowledgeBaseSummary, Provider } from '@/features/knowledge/types'

export function KnowledgeBasesPage() {
  const { appId } = useParams({ strict: false }) as { appId?: string }
  const { data: kbs, isLoading } = useKnowledgeBases()
  const deleteMutation = useDeleteKnowledgeBase()
  const canWrite = usePermission('knowledge:write')
  const [createOpen, setCreateOpen] = useState(false)
  const [providersOpen, setProvidersOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<KnowledgeBaseSummary | null>(null)

  if (isLoading) return <PageLoader />

  const ordered = kbs ?? []

  const confirmDelete = () => {
    if (!pendingDelete) return
    const name = pendingDelete.name
    deleteMutation.mutate(pendingDelete.id, {
      onSuccess: () => {
        toast.success(`"${name}" deleted`)
        setPendingDelete(null)
      },
      onError: (e) => {
        toast.error('Could not delete knowledge base', {
          description: e instanceof Error ? e.message : undefined,
        })
      },
    })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Knowledge Bases</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{ordered.length} knowledge base{ordered.length === 1 ? '' : 's'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setProvidersOpen(true)} className="gap-1.5">
            <Sparkles size={16} />Providers
          </Button>
          {canWrite && (
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus size={16} />New Knowledge Base</Button>
          )}
        </div>
      </div>
      <ManageProvidersDialog open={providersOpen} onOpenChange={setProvidersOpen} />

      {!ordered.length ? (
        <EmptyState canWrite={canWrite} onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="divide-y divide-[hsl(var(--border))] rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          {ordered.map((kb) => (
            <KnowledgeBaseRow
              key={kb.id}
              kb={kb}
              appId={appId ?? ''}
              canWrite={canWrite}
              onDelete={() => setPendingDelete(kb)}
            />
          ))}
        </div>
      )}

      <CreateKnowledgeBaseDialog open={createOpen} onOpenChange={setCreateOpen} />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => { if (!open) setPendingDelete(null) }}
        title="Delete this knowledge base?"
        description={pendingDelete ? `"${pendingDelete.name}" and every document in it will be permanently deleted — this can't be undone, and it may be in use by other applications.` : undefined}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

const PROVIDER_LABELS: Record<Provider, string> = { openai: 'OpenAI', gemini: 'Gemini', voyage: 'Voyage' }

function KnowledgeBaseRow({ kb, appId, canWrite, onDelete }: { kb: KnowledgeBaseSummary; appId: string; canWrite: boolean; onDelete: () => void }) {
  return (
    <div className="group flex items-center gap-3 px-4 py-3">
      <BookOpen size={16} className="shrink-0 text-[hsl(var(--primary))]" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-[hsl(var(--foreground))]">{kb.name}</div>
        <p className="mt-0.5 truncate text-xs text-[hsl(var(--muted-foreground))]">
          {PROVIDER_LABELS[kb.provider]} · {kb.credential_name} · Updated {new Date(kb.updated_at).toLocaleDateString()}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Link to="/applications/$appId/knowledge-bases/$kbId" params={{ appId, kbId: kb.id }}>
          <Button variant="ghost" size="icon" aria-label={`Open ${kb.name}`} title={`Open ${kb.name}`}>
            <ExternalLink size={14} />
          </Button>
        </Link>
        {canWrite && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            aria-label={`Delete ${kb.name}`}
            title={`Delete ${kb.name}`}
            className="text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))]"
          >
            <Trash2 size={14} />
          </Button>
        )}
      </div>
    </div>
  )
}

function EmptyState({ canWrite, onCreate }: { canWrite: boolean; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[hsl(var(--border))] p-12 text-center">
      <p className="mb-4 text-[hsl(var(--muted-foreground))]">No knowledge bases yet</p>
      {canWrite && (
        <Button variant="outline" onClick={onCreate} className="gap-1.5"><Plus size={16} />Create your first knowledge base</Button>
      )}
    </div>
  )
}

function PageLoader() {
  return <div className="flex h-64 items-center justify-center"><Spinner /></div>
}

const EMPTY_PAYLOAD: CreateKnowledgeBasePayload = {
  name: '', description: '', llm_provider_id: '', embedding_provider_id: '',
}

function CreateKnowledgeBaseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [form, setForm] = useState<CreateKnowledgeBasePayload>(EMPTY_PAYLOAD)
  const createMutation = useCreateKnowledgeBase()

  const canSubmit = form.name.trim() !== '' && form.llm_provider_id !== '' && form.embedding_provider_id !== ''

  const submit = () => {
    createMutation.mutate(form, {
      onSuccess: () => {
        toast.success(`"${form.name}" created`)
        onOpenChange(false)
        setForm(EMPTY_PAYLOAD)
      },
      onError: (e) => {
        toast.error('Could not create knowledge base', {
          description: e instanceof Error ? e.message : undefined,
        })
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>New Knowledge Base</DialogTitle>
          <DialogDescription>
            Pick a saved LLM provider and embedding provider — the API key is resolved server-side and never leaves
            the backend. This knowledge base belongs to the app you're currently working in; you can share it with
            other apps afterward from its Sharing Settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div>
            <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Support Docs" />
          </div>
          <div>
            <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Description (optional)</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Product support articles and FAQs" />
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">LLM Provider</Label>
            <ProviderSelect
              value={form.llm_provider_id || undefined}
              onChange={(id) => setForm({ ...form, llm_provider_id: id ?? '' })}
              kind="llm"
            />
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Embedding Provider</Label>
            <ProviderSelect
              value={form.embedding_provider_id || undefined}
              onChange={(id) => setForm({ ...form, embedding_provider_id: id ?? '' })}
              kind="embedding"
            />
            <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
              Fixed once created — changing the embedding provider later requires a new knowledge base.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>Cancel</Button>
          <Button size="sm" className="gap-1.5" disabled={!canSubmit || createMutation.isPending} onClick={submit}>
            {createMutation.isPending ? <Spinner className="h-4 w-4" /> : <Plus size={14} />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
