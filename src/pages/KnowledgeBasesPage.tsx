import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Plus, Trash2, ExternalLink, BookOpen } from 'lucide-react'
import { useKnowledgeBases, useCreateKnowledgeBase, useDeleteKnowledgeBase, useProviders } from '@/features/knowledge/hooks'
import { CredentialSelect } from '@/features/app-settings/CredentialSelect'
import { usePermission } from '@/features/auth/permissions'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { CreateKnowledgeBasePayload, KnowledgeBaseSummary, Provider } from '@/features/knowledge/types'

export function KnowledgeBasesPage() {
  const { data: kbs, isLoading } = useKnowledgeBases()
  const deleteMutation = useDeleteKnowledgeBase()
  const canWrite = usePermission('knowledge:write')
  const [createOpen, setCreateOpen] = useState(false)

  if (isLoading) return <PageLoader />

  const ordered = kbs ?? []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Bases</h1>
          <p className="text-sm text-gray-500 mt-1">{ordered.length} knowledge bases</p>
        </div>
        {canWrite && (
          <Button onClick={() => setCreateOpen(true)}><Plus size={16} />New Knowledge Base</Button>
        )}
      </div>

      {!ordered.length ? (
        <EmptyState canWrite={canWrite} onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
          {ordered.map((kb) => (
            <KnowledgeBaseRow
              key={kb.id}
              kb={kb}
              canWrite={canWrite}
              onDelete={() => deleteMutation.mutate(kb.id)}
            />
          ))}
        </div>
      )}

      <CreateKnowledgeBaseDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}

const PROVIDER_LABELS: Record<Provider, string> = { openai: 'OpenAI', gemini: 'Gemini' }

function KnowledgeBaseRow({ kb, canWrite, onDelete }: { kb: KnowledgeBaseSummary; canWrite: boolean; onDelete: () => void }) {
  return (
    <div className="group flex items-center gap-3 px-4 py-3">
      <BookOpen size={16} className="shrink-0 text-teal-500" />
      <div className="min-w-0 flex-1">
        <span className="truncate font-medium text-gray-900">{kb.name}</span>
        <p className="mt-0.5 truncate text-xs text-gray-400">
          {PROVIDER_LABELS[kb.provider]} · {kb.credential_name} · Updated {new Date(kb.updated_at).toLocaleDateString()}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Link to="/knowledge-bases/$kbId" params={{ kbId: kb.id }}>
          <Button variant="ghost" size="icon"><ExternalLink size={14} /></Button>
        </Link>
        {canWrite && (
          <Button size="sm" variant="outline" onClick={onDelete} className="text-red-600 hover:text-red-700 hover:bg-red-50">
            <Trash2 size={14} />
          </Button>
        )}
      </div>
    </div>
  )
}

function EmptyState({ canWrite, onCreate }: { canWrite: boolean; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
      <p className="text-gray-500 mb-4">No knowledge bases yet</p>
      {canWrite && (
        <Button variant="outline" onClick={onCreate}><Plus size={16} />Create your first knowledge base</Button>
      )}
    </div>
  )
}

function PageLoader() {
  return <div className="flex h-64 items-center justify-center"><Spinner /></div>
}

const EMPTY_PAYLOAD: CreateKnowledgeBasePayload = {
  name: '', description: '', provider: 'openai', credential_name: '', llm_model: '', embedding_model: '',
}

function CreateKnowledgeBaseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: providers, isLoading: providersLoading } = useProviders()
  const [form, setForm] = useState<CreateKnowledgeBasePayload>(EMPTY_PAYLOAD)
  const createMutation = useCreateKnowledgeBase()

  const selectedProvider = providers?.find((p) => p.provider === form.provider)

  // Default the model pickers to the provider's first offered model whenever
  // the provider changes (including on first load, once the catalog arrives).
  useEffect(() => {
    if (!selectedProvider) return
    setForm((f) => ({
      ...f,
      llm_model: f.llm_model || selectedProvider.llm_models[0] || '',
      embedding_model: f.embedding_model || selectedProvider.embedding_models[0]?.model || '',
    }))
  }, [selectedProvider])

  const canSubmit = form.name.trim() !== '' && form.credential_name.trim() !== ''
    && form.llm_model.trim() !== '' && form.embedding_model.trim() !== ''

  const submit = () => {
    createMutation.mutate(form, {
      onSuccess: () => {
        onOpenChange(false)
        setForm(EMPTY_PAYLOAD)
      },
    })
  }

  const selectedEmbedding = selectedProvider?.embedding_models.find((m) => m.model === form.embedding_model)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>New Knowledge Base</DialogTitle>
          <DialogDescription>
            Pick a provider and a saved credential — the API key is resolved server-side and never leaves the backend.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div>
            <Label className="mb-1 block text-xs font-medium text-gray-600">Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Support Docs" />
          </div>
          <div>
            <Label className="mb-1 block text-xs font-medium text-gray-600">Description (optional)</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Product support articles and FAQs" />
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-gray-600">Provider</Label>
            <div className="flex gap-1.5">
              {(['openai', 'gemini'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm({ ...form, provider: p, credential_name: '', llm_model: '', embedding_model: '' })}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    form.provider === p ? 'border-teal-400 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-500 hover:border-gray-300',
                  )}
                >
                  {PROVIDER_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-gray-600">Credential</Label>
            <CredentialSelect
              value={form.credential_name || undefined}
              onChange={(name) => setForm({ ...form, credential_name: name ?? '' })}
              typeFilter="bearer"
              accentClassName="text-teal-600"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              A Bearer token credential holding the {PROVIDER_LABELS[form.provider]} API key. Manage saved credentials in Application Settings.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs font-medium text-gray-600">LLM Model</Label>
              <select
                value={form.llm_model}
                onChange={(e) => setForm({ ...form, llm_model: e.target.value })}
                disabled={providersLoading || !selectedProvider}
                className="h-9 w-full rounded-md border border-gray-200 bg-white px-2.5 text-sm text-gray-700 disabled:opacity-50"
              >
                {(selectedProvider?.llm_models ?? []).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-gray-600">Embedding Model</Label>
              <select
                value={form.embedding_model}
                onChange={(e) => setForm({ ...form, embedding_model: e.target.value })}
                disabled={providersLoading || !selectedProvider}
                className="h-9 w-full rounded-md border border-gray-200 bg-white px-2.5 text-sm text-gray-700 disabled:opacity-50"
              >
                {(selectedProvider?.embedding_models ?? []).map((m) => (
                  <option key={m.model} value={m.model}>{m.model} ({m.dim}d)</option>
                ))}
              </select>
            </div>
          </div>
          {selectedEmbedding && (
            <p className="text-[11px] text-gray-400">
              The embedding dimension ({selectedEmbedding.dim}d) is fixed once created — changing embedding models later requires a new knowledge base.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>Cancel</Button>
          <Button size="sm" disabled={!canSubmit || createMutation.isPending} onClick={submit}>
            {createMutation.isPending ? <Spinner className="h-4 w-4" /> : <Plus size={14} />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
