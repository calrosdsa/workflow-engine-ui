import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Bot, Loader2 } from 'lucide-react'
import { useAgents, useCreateAgent, useUpdateAgent, useDeleteAgent } from '@/features/agents/hooks'
import { ModelPicker } from '@/features/model-providers/ModelPicker'
import { usePermission } from '@/features/auth/permissions'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AgentEditorDrawer } from './AgentEditorDrawer'
import type { Agent } from '@/features/agents/types'

// appId is accepted for prop-shape parity with every other App Design
// section (MenusSection, MobileLayoutSection, etc.) even though it isn't
// read directly here — app scope is resolved server-side from the
// X-Client-ID/X-App-ID request headers every API call already sends (see
// api/agents' own package doc), not from a URL path segment or a prop
// threaded into the query.
interface AgentsSectionProps {
  appId: string
}

export function AgentsSection(_props: AgentsSectionProps) {
  const { data: agents, isLoading } = useAgents()
  const deleteMutation = useDeleteAgent()
  const canWrite = usePermission('assistant:write')
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Agent | null>(null)
  const [editing, setEditing] = useState<Agent | null>(null)

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  const ordered = agents ?? []

  const confirmDelete = () => {
    if (!pendingDelete) return
    const name = pendingDelete.name
    deleteMutation.mutate(pendingDelete.id, {
      onSuccess: () => {
        toast.success(`"${name}" deleted`)
        setPendingDelete(null)
      },
      onError: (e) => {
        // A 409 here means the agent is still referenced as a Sub-Agent by
        // another Agent (FR-C8-001 v0.2's resolved block-delete policy) —
        // the backend's error message already names which one(s), so it's
        // surfaced verbatim rather than a generic failure toast.
        toast.error('Could not delete agent', {
          description: e instanceof Error ? e.message : undefined,
        })
      },
    })
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Agents</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{ordered.length} agents for this app</p>
        </div>
        {canWrite && (
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus size={16} />New Agent</Button>
        )}
      </div>

      {!ordered.length ? (
        <EmptyState canWrite={canWrite} onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="divide-y divide-[hsl(var(--border))] rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          {ordered.map((agent) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              canWrite={canWrite}
              onEdit={() => setEditing(agent)}
              onDelete={() => setPendingDelete(agent)}
            />
          ))}
        </div>
      )}

      <CreateAgentDialog open={createOpen} onOpenChange={setCreateOpen} />

      {editing && <AgentEditorDrawer agent={editing} canWrite={canWrite} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => { if (!open) setPendingDelete(null) }}
        title="Delete this agent?"
        description={pendingDelete ? `"${pendingDelete.name}" will be permanently deleted — this can't be undone.` : undefined}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function AgentRow({ agent, canWrite, onEdit, onDelete }: { agent: Agent; canWrite: boolean; onEdit: () => void; onDelete: () => void }) {
  const updateMutation = useUpdateAgent(agent.id)

  const toggleEnabled = (enabled: boolean) => {
    updateMutation.mutate(
      { name: agent.name, description: agent.description, instructions: agent.instructions, model_id: agent.model_id, enabled, session_ttl_days: agent.session_ttl_days },
      {
        onError: (e) => {
          toast.error('Could not update agent', { description: e instanceof Error ? e.message : undefined })
        },
      },
    )
  }

  return (
    <div className="group flex items-center gap-3 px-4 py-3">
      <Bot size={16} className="shrink-0 text-[hsl(var(--primary))]" />
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <div className="truncate font-medium text-[hsl(var(--foreground))]">{agent.name}</div>
        <p className="mt-0.5 truncate text-xs text-[hsl(var(--muted-foreground))]">
          {agent.description || 'No description'} · Updated {new Date(agent.updated_at).toLocaleDateString()}
        </p>
      </button>
      <div className="flex shrink-0 items-center gap-2">
        <Switch
          checked={agent.enabled}
          onCheckedChange={toggleEnabled}
          disabled={!canWrite || updateMutation.isPending}
          aria-label={agent.enabled ? `Disable ${agent.name}` : `Enable ${agent.name}`}
        />
        {canWrite && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            aria-label={`Delete ${agent.name}`}
            title={`Delete ${agent.name}`}
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
      <p className="mb-4 text-[hsl(var(--muted-foreground))]">No agents yet</p>
      {canWrite && (
        <Button variant="outline" onClick={onCreate} className="gap-1.5"><Plus size={16} />Create your first agent</Button>
      )}
    </div>
  )
}

function CreateAgentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState('')
  const [modelId, setModelId] = useState<string | undefined>(undefined)
  const createMutation = useCreateAgent()

  const canSubmit = name.trim().length > 0 && !!modelId

  const submit = () => {
    if (!canSubmit || !modelId) return
    createMutation.mutate(
      { name: name.trim(), model_id: modelId },
      {
        onSuccess: () => {
          toast.success(`"${name.trim()}" created`)
          setName('')
          setModelId(undefined)
          onOpenChange(false)
        },
        onError: (e) => {
          toast.error('Could not create agent', { description: e instanceof Error ? e.message : undefined })
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Agent</DialogTitle>
          <DialogDescription>
            Configure tools, skills, and instructions after creation — this only sets the name and its model provider. New agents start disabled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Support Triage Agent" autoFocus />
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Model</Label>
            <ModelPicker
              value={modelId}
              onChange={setModelId}
              capability="llm"
              isOptionAllowed={(model) => model.provider_type === 'openai' || model.provider_type === 'gemini'}
              accentClassName="text-[hsl(var(--primary))]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>Cancel</Button>
          <Button size="sm" className="gap-1.5" disabled={!canSubmit || createMutation.isPending} onClick={submit}>
            {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
