import { useState } from 'react'
import { Plus, Webhook, Trash2, Loader2, AlertCircle, Copy, Check, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from './hooks'
import { usePermission } from '@/features/auth/permissions'
import type { ApiKeySummary, CreateApiKeyResponse } from './types'

export function ApiKeysSubsection() {
  // apikeys:read is a dedicated permission, deliberately NOT implied by
  // credentials:read (see internal/auth/permissions.go's comment on why) —
  // a user who can reach this page via credentials:read is not guaranteed
  // to hold apikeys:read too. Hide the section entirely rather than render
  // it and let GET /application/api-keys 403 silently into a misleading
  // "No API keys yet" empty state.
  const canRead = usePermission('apikeys:read')
  const canWrite = usePermission('apikeys:write')
  const { data: keys, isLoading } = useApiKeys({ enabled: canRead })
  const revokeMutation = useRevokeApiKey()
  const [creating, setCreating] = useState(false)
  const [justCreated, setJustCreated] = useState<CreateApiKeyResponse | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<ApiKeySummary | null>(null)

  if (!canRead) return null

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">API keys</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Long-lived credentials for a third party to call this app's API directly — no login required. Each key
            grants access to every form's records plus the Knowledge Base/RAG endpoints. Revoking is immediate and
            permanent.
          </p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setCreating(true)} className="shrink-0 gap-1.5">
            <Plus size={14} />Generate key
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-24 items-center justify-center"><Spinner /></div>
      ) : !keys?.length ? (
        <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
          No API keys yet.
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <ApiKeyRow
              key={k.id}
              apiKey={k}
              canWrite={canWrite}
              onRevoke={() => setRevokeTarget(k)}
            />
          ))}
        </div>
      )}

      {creating && (
        <CreateApiKeyDialog
          onClose={() => setCreating(false)}
          onCreated={(created) => { setCreating(false); setJustCreated(created) }}
        />
      )}
      {justCreated && (
        <SecretRevealDialog secret={justCreated} onClose={() => setJustCreated(null)} />
      )}
      {revokeTarget && (
        <RevokeConfirmDialog
          apiKey={revokeTarget}
          pending={revokeMutation.isPending}
          onConfirm={async () => { await revokeMutation.mutateAsync(revokeTarget.id); setRevokeTarget(null) }}
          onCancel={() => setRevokeTarget(null)}
        />
      )}
    </section>
  )
}

function ApiKeyRow({ apiKey, canWrite, onRevoke }: {
  apiKey: ApiKeySummary
  canWrite: boolean
  onRevoke: () => void
}) {
  const revoked = !!apiKey.revoked_at
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 ${revoked ? 'border-[hsl(var(--border))]/50 bg-[hsl(var(--muted))]/40' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'}`}>
      <Webhook size={16} className={`shrink-0 ${revoked ? 'text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--success))]'}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`truncate text-sm font-medium ${revoked ? 'text-[hsl(var(--muted-foreground))] line-through' : 'text-[hsl(var(--foreground))]'}`}>{apiKey.name}</p>
          {revoked && (
            <span className="shrink-0 rounded-full bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              Revoked
            </span>
          )}
        </div>
        <p className="truncate font-mono text-xs text-[hsl(var(--muted-foreground))]">
          {apiKey.key_prefix}··· · All forms + Knowledge Base/RAG
          {apiKey.last_used_at && !revoked ? ` · Last used ${formatRelative(apiKey.last_used_at)}` : ''}
          {!apiKey.last_used_at && !revoked ? ' · Never used' : ''}
        </p>
      </div>
      {canWrite && !revoked && (
        <Button
          variant="ghost" size="icon"
          className="shrink-0 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))]"
          onClick={onRevoke}
        >
          <Trash2 size={14} />
        </Button>
      )}
    </div>
  )
}

function CreateApiKeyDialog({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (created: CreateApiKeyResponse) => void
}) {
  const createMutation = useCreateApiKey()
  const [name, setName] = useState('')

  const handleCreate = async () => {
    const created = await createMutation.mutateAsync({ name: name.trim() })
    onCreated(created)
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate API key</DialogTitle>
          <DialogDescription>
            Grants the holder access to every form's records and the Knowledge Base/RAG endpoints for this app. The
            secret is shown once, immediately after creation — save it somewhere safe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp integration"
              className="text-sm"
              autoFocus
            />
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">A label to help you tell keys apart later — not shown to whoever holds the key.</p>
          </div>

          {createMutation.isError && (
            <p className="flex items-center gap-1 text-xs text-[hsl(var(--destructive))]"><AlertCircle size={13} />Failed to generate key</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || createMutation.isPending} className="gap-1.5">
            {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Generate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Shown exactly once, immediately after creation — the backend never
// returns the secret again after this response (FR-F-007 SEC-05). Closing
// this dialog is the point of no return, so onClose has no "are you sure"
// — the warning text itself carries that weight instead.
function SecretRevealDialog({ secret, onClose }: { secret: CreateApiKeyResponse; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(secret.secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-[hsl(var(--warning))]" />
            Save this key now
          </DialogTitle>
          <DialogDescription>
            This is the only time <span className="font-medium text-[hsl(var(--foreground))]">{secret.name}</span>'s secret is shown. Once you
            close this dialog, it cannot be retrieved again — only revoked and replaced with a new key.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6 py-4">
          <div className="flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-2.5">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-[hsl(var(--foreground))]">{secret.secret}</code>
            <Button variant="outline" size="sm" onClick={copy} className="shrink-0 gap-1.5">
              {copied ? <Check size={13} className="text-[hsl(var(--success))]" /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={onClose}>I've saved it</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RevokeConfirmDialog({ apiKey, pending, onConfirm, onCancel }: {
  apiKey: ApiKeySummary
  pending: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Revoke "{apiKey.name}"?</DialogTitle>
          <DialogDescription>
            This is immediate and permanent — any third party still using this key will start getting rejected
            requests right away. There is no way to un-revoke; a replacement requires generating a new key.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2 px-6 pb-4 pt-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending} className="gap-1.5">
            {pending && <Loader2 size={14} className="animate-spin" />}
            Revoke
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const diffMs = Date.now() - then
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay}d ago`
}
