import { useState } from 'react'
import { Plus, KeyRound, Braces, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  useCredentials, useUpsertCredential, useDeleteCredential,
  useVariables, useUpsertVariable, useDeleteVariable,
} from '@/features/app-settings/hooks'
import { usePermission } from '@/features/auth/permissions'
import { IntegrationsSubsection } from '@/features/integrations/IntegrationsSubsection'
import { ApiKeysSubsection } from '@/features/api-keys/ApiKeysSubsection'
import type { CredentialSummary, CredentialType, AppVariable } from '@/features/app-settings/types'

export function GlobalSettingsSection() {
  return (
    <div className="mx-auto max-w-2xl space-y-10 p-6">
      <CredentialsSubsection />
      <div className="h-px bg-[hsl(var(--border))]" />
      <VariablesSubsection />
      <div className="h-px bg-[hsl(var(--border))]" />
      <ApiKeysSubsection />
      <div className="h-px bg-[hsl(var(--border))]" />
      <IntegrationsSubsection />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

function CredentialsSubsection() {
  const { data: credentials, isLoading } = useCredentials()
  const deleteMutation = useDeleteCredential()
  const canWrite = usePermission('credentials:write')
  const [editing, setEditing] = useState<'new' | null>(null)

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Credentials</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Saved authentication credentials the HTTP Request node can reference by name. Values are encrypted
            and never shown again after saving.
          </p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setEditing('new')} className="shrink-0 gap-1.5">
            <Plus size={14} />Add credential
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-24 items-center justify-center"><Spinner /></div>
      ) : !credentials?.length ? (
        <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
          No credentials yet.
        </div>
      ) : (
        <div className="space-y-2">
          {credentials.map((c) => (
            <CredentialRow
              key={c.name}
              credential={c}
              canWrite={canWrite}
              onDelete={() => deleteMutation.mutate(c.name)}
              deleting={deleteMutation.isPending && deleteMutation.variables === c.name}
            />
          ))}
        </div>
      )}

      {editing === 'new' && <CredentialFormDialog onClose={() => setEditing(null)} />}
    </section>
  )
}

function CredentialRow({ credential, canWrite, onDelete, deleting }: {
  credential: CredentialSummary
  canWrite: boolean
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
      <KeyRound size={16} className="shrink-0 text-[hsl(var(--primary))]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">{credential.name}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{CREDENTIAL_TYPE_LABELS[credential.type]}</p>
      </div>
      {canWrite && (
        <Button
          variant="ghost" size="icon" disabled={deleting}
          className="shrink-0 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))]"
          onClick={onDelete}
        >
          {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </Button>
      )}
    </div>
  )
}

const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  basic: 'Basic auth',
  bearer: 'Bearer token',
  api_key: 'API key',
}

function CredentialFormDialog({ onClose }: { onClose: () => void }) {
  const upsertMutation = useUpsertCredential()
  const [name, setName] = useState('')
  const [type, setType] = useState<CredentialType>('bearer')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [apiKeyValue, setApiKeyValue] = useState('')
  const [apiKeyParamName, setApiKeyParamName] = useState('')
  const [apiKeyLocation, setApiKeyLocation] = useState<'header' | 'query'>('header')

  const canSave = name.trim() !== '' && (
    (type === 'basic' && username.trim() !== '' && password.trim() !== '') ||
    (type === 'bearer' && token.trim() !== '') ||
    (type === 'api_key' && apiKeyValue.trim() !== '' && apiKeyParamName.trim() !== '')
  )

  const handleSave = async () => {
    const value =
      type === 'basic' ? { username, password } :
      type === 'bearer' ? { token } :
      { key: apiKeyValue, location: apiKeyLocation, param_name: apiKeyParamName }
    await upsertMutation.mutateAsync({ name: name.trim(), payload: { type, value } })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add credential</DialogTitle>
          <DialogDescription>
            Referenced from the HTTP Request node's Auth tab by name — the value is encrypted at rest and never
            shown again.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. stripe_api" className="font-mono text-xs" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CredentialType)}
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-sm text-[hsl(var(--foreground))]"
            >
              <option value="bearer">Bearer token</option>
              <option value="basic">Basic auth</option>
              <option value="api_key">API key</option>
            </select>
          </div>

          {type === 'basic' && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Username</label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Password</label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </>
          )}

          {type === 'bearer' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Token</label>
              <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} className="font-mono text-xs" />
            </div>
          )}

          {type === 'api_key' && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Key</label>
                <Input type="password" value={apiKeyValue} onChange={(e) => setApiKeyValue(e.target.value)} className="font-mono text-xs" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Param name</label>
                <Input value={apiKeyParamName} onChange={(e) => setApiKeyParamName(e.target.value)} placeholder="e.g. X-API-Key" className="font-mono text-xs" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Send as</label>
                <select
                  value={apiKeyLocation}
                  onChange={(e) => setApiKeyLocation(e.target.value as 'header' | 'query')}
                  className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-sm text-[hsl(var(--foreground))]"
                >
                  <option value="header">Header</option>
                  <option value="query">Query param</option>
                </select>
              </div>
            </>
          )}

          {upsertMutation.isError && (
            <p className="flex items-center gap-1 text-xs text-[hsl(var(--destructive))]"><AlertCircle size={13} />Failed to save credential</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave || upsertMutation.isPending} className="gap-1.5">
            {upsertMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------

function VariablesSubsection() {
  const { data: variables, isLoading } = useVariables()
  const deleteMutation = useDeleteVariable()
  const canWrite = usePermission('credentials:write')
  const [adding, setAdding] = useState(false)

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Global variables</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Non-secret values shared across every workflow, addressable from any expression as{' '}
            <code className="rounded bg-[hsl(var(--muted))] px-1 py-0.5 text-[11px]">AppSettings["name"]</code>.
          </p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setAdding(true)} className="shrink-0 gap-1.5">
            <Plus size={14} />Add variable
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-24 items-center justify-center"><Spinner /></div>
      ) : !variables?.length && !adding ? (
        <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
          No global variables yet.
        </div>
      ) : (
        <div className="space-y-2">
          {(variables ?? []).map((v) => (
            <VariableRow
              key={v.name}
              variable={v}
              canWrite={canWrite}
              onDelete={() => deleteMutation.mutate(v.name)}
              deleting={deleteMutation.isPending && deleteMutation.variables === v.name}
            />
          ))}
          {adding && <NewVariableRow onDone={() => setAdding(false)} />}
        </div>
      )}
    </section>
  )
}

function VariableRow({ variable, canWrite, onDelete, deleting }: {
  variable: AppVariable
  canWrite: boolean
  onDelete: () => void
  deleting: boolean
}) {
  const upsertMutation = useUpsertVariable()
  const [value, setValue] = useState(stringifyValue(variable.value))

  const commit = () => {
    if (value === stringifyValue(variable.value)) return
    upsertMutation.mutate({ name: variable.name, payload: { value: parseValue(value) } })
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
      <Braces size={16} className="shrink-0 text-[hsl(var(--primary))]" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate font-mono text-xs font-medium text-[hsl(var(--foreground))]">{variable.name}</p>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          disabled={!canWrite}
          className="h-7 font-mono text-[11px]"
        />
      </div>
      {canWrite && (
        <Button
          variant="ghost" size="icon" disabled={deleting}
          className="shrink-0 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))]"
          onClick={onDelete}
        >
          {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </Button>
      )}
    </div>
  )
}

function NewVariableRow({ onDone }: { onDone: () => void }) {
  const upsertMutation = useUpsertVariable()
  const [name, setName] = useState('')
  const [value, setValue] = useState('')

  const handleSave = async () => {
    if (!name.trim()) return
    await upsertMutation.mutateAsync({ name: name.trim(), payload: { value: parseValue(value) } })
    onDone()
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/5 p-3">
      <Braces size={16} className="shrink-0 text-[hsl(var(--primary))]" />
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="name" className="w-32 shrink-0 font-mono text-xs" />
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="value" className="min-w-0 flex-1 font-mono text-xs" />
      <Button size="sm" onClick={handleSave} disabled={!name.trim() || upsertMutation.isPending} className="shrink-0 gap-1">
        {upsertMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
      </Button>
      <Button variant="ghost" size="sm" onClick={onDone} className="shrink-0 text-[hsl(var(--muted-foreground))]">Cancel</Button>
    </div>
  )
}

// A variable's value is stored/returned as arbitrary JSON (internal/appsettings
// stores it in a JSONB column), but the row editor presents it as a single
// text field for the common case (strings/numbers) — stringify for display,
// and re-parse as JSON on save so "true"/"123"/'"quoted"' round-trip through
// their real types rather than always becoming a string.
function stringifyValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function parseValue(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
