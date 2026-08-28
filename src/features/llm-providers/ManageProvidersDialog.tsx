// Client-wide "Manage Providers" CRUD — reachable from the Knowledge Bases
// page (Providers only make sense in that context, so this doesn't get its
// own top-level nav entry — see the App Builder nav restructure plan's C3).
// Mirrors app-settings/GlobalSettingsSection.tsx's CredentialsSubsection
// list+dialog shape.
import { useEffect, useState } from 'react'
import { Plus, Sparkles, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ModelSelect } from '@/features/knowledge/ModelSelect'
import { useProviders as useProviderCatalog } from '@/features/knowledge/hooks'
import { usePermission } from '@/features/auth/permissions'
import { useLLMProviders, useCreateLLMProvider, useDeleteLLMProvider } from './hooks'
import type { LLMProvider, ProviderKind, ProviderType } from './types'
import type { Provider as CatalogProviderType } from '@/features/knowledge/types'

const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = { openai: 'OpenAI', gemini: 'Gemini', voyage: 'Voyage' }
const KIND_LABELS: Record<ProviderKind, string> = { llm: 'LLM', embedding: 'Embedding', both: 'LLM + Embedding' }

export function ManageProvidersDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: providers, isLoading } = useLLMProviders()
  const deleteMutation = useDeleteLLMProvider()
  const canWrite = usePermission('knowledge:write')
  const [creating, setCreating] = useState(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>Providers</DialogTitle>
          <DialogDescription>
            Saved LLM/Embedding provider credentials, shared across every application under this client. Knowledge
            bases reference a Provider instead of a raw API key.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6 py-4">
          {canWrite && (
            <Button size="sm" onClick={() => setCreating(true)} className="gap-1.5 self-start">
              <Plus size={14} />Add provider
            </Button>
          )}

          {isLoading ? (
            <div className="flex h-24 items-center justify-center"><Spinner /></div>
          ) : !providers?.length ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              No providers yet.
            </div>
          ) : (
            <div className="space-y-2">
              {providers.map((p) => (
                <ProviderRow
                  key={p.id}
                  provider={p}
                  canWrite={canWrite}
                  onDelete={() => deleteMutation.mutate(p.id)}
                  deleting={deleteMutation.isPending && deleteMutation.variables === p.id}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 pb-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>

      {creating && <CreateProviderDialog onClose={() => setCreating(false)} />}
    </Dialog>
  )
}

function ProviderRow({ provider, canWrite, onDelete, deleting }: {
  provider: LLMProvider
  canWrite: boolean
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-500">
        <Sparkles size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{provider.name}</p>
        <p className="truncate text-xs text-slate-400">
          {PROVIDER_TYPE_LABELS[provider.provider_type]} · {KIND_LABELS[provider.kind]} · {provider.model}
        </p>
      </div>
      {canWrite && (
        <Button
          variant="ghost" size="icon" disabled={deleting}
          className="shrink-0 text-slate-300 hover:bg-red-50 hover:text-red-500"
          onClick={onDelete}
        >
          {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </Button>
      )}
    </div>
  )
}

function CreateProviderDialog({ onClose }: { onClose: () => void }) {
  const { data: catalog, isLoading: catalogLoading } = useProviderCatalog()
  const createMutation = useCreateLLMProvider()

  const [name, setName] = useState('')
  const [kind, setKind] = useState<Exclude<ProviderKind, 'both'>>('llm')
  const [providerType, setProviderType] = useState<CatalogProviderType>('openai')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')

  const selectedCatalog = catalog?.find((c) => c.provider === providerType)
  // A saved Provider carries exactly one model id — LLM and embedding
  // catalogs never overlap (see providerModels in the Go catalog), so
  // "used for" is LLM-only or embedding-only, never "both": a provider that
  // needs to serve both purposes is two Provider rows, one of each kind,
  // sharing the same underlying API key credential if desired. This also
  // means every model this form ever submits is guaranteed to be a real
  // catalog entry for whichever half it's for, so the backend's
  // resolveEmbeddingModel never rejects it for lacking an embedding_dim.
  const modelOptions = kind === 'embedding'
    ? (selectedCatalog?.embedding_models.map((m) => m.model) ?? [])
    : (selectedCatalog?.llm_models ?? [])
  const selectedEmbedding = selectedCatalog?.embedding_models.find((m) => m.model === model)

  // Provider types with an empty catalog half for the current `kind` (e.g.
  // Voyage has no llm_models — it's embedding-only) are hidden from the
  // Provider dropdown rather than left selectable with a dead-end empty
  // Model dropdown. Computed from the live catalog, not a hardcoded
  // provider-type list, so this stays correct if the backend catalog changes.
  const availableProviderTypes = (catalog ?? []).filter((c) =>
    kind === 'embedding' ? c.embedding_models.length > 0 : c.llm_models.length > 0,
  )

  // If the current provider type has no models for the newly-selected kind
  // (switching "Used for" away from what providerType supports), fall back
  // to the first provider type that does — mirrors the model-default effect
  // below, and prevents providerType from pointing at a hidden option.
  useEffect(() => {
    if (!catalog) return
    if (availableProviderTypes.some((c) => c.provider === providerType)) return
    const fallback = availableProviderTypes[0]?.provider
    if (fallback) setProviderType(fallback)
  }, [catalog, kind, providerType, availableProviderTypes])

  // Default the model to the catalog's first offered option whenever the
  // catalog arrives or the provider/kind selection changes — <select>'s
  // native "shows the first option" rendering is a DOM-only default, not a
  // React state update, so without this `model` stays '' and canSave never
  // turns true even though the dropdown visually shows a selection.
  useEffect(() => {
    if (!selectedCatalog) return
    if (model && modelOptions.includes(model)) return
    setModel(modelOptions[0] ?? '')
  }, [selectedCatalog, modelOptions])

  const canSave = name.trim() !== '' && apiKey.trim() !== '' && model.trim() !== ''

  const handleSave = async () => {
    await createMutation.mutateAsync({
      name: name.trim(),
      kind,
      provider_type: providerType,
      api_key: apiKey.trim(),
      model,
      embedding_dim: kind === 'embedding' ? selectedEmbedding?.dim : undefined,
    })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add provider</DialogTitle>
          <DialogDescription>
            Shared across every application under this client. The API key is encrypted and never shown again after
            saving.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Production OpenAI" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Used for</label>
            <select
              value={kind}
              onChange={(e) => { setKind(e.target.value as Exclude<ProviderKind, 'both'>); setModel('') }}
              className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700"
            >
              <option value="llm">LLM</option>
              <option value="embedding">Embedding</option>
            </select>
            <p className="mt-1 text-[11px] text-gray-400">
              A provider serves one purpose — create a second one (reusing the same API key if you like) if a
              knowledge base needs different LLM and embedding models.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Provider</label>
            <select
              value={providerType}
              onChange={(e) => { setProviderType(e.target.value as CatalogProviderType); setModel('') }}
              className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700"
            >
              {availableProviderTypes.map((c) => (
                <option key={c.provider} value={c.provider}>{PROVIDER_TYPE_LABELS[c.provider]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">API key</label>
            <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="font-mono text-xs" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Model</label>
            <ModelSelect
              key={`${providerType}-${kind}`}
              value={model}
              onChange={setModel}
              options={modelOptions}
              disabled={catalogLoading}
            />
          </div>

          {createMutation.isError && (
            <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle size={13} />Failed to save provider</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave || createMutation.isPending} className="gap-1.5">
            {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
