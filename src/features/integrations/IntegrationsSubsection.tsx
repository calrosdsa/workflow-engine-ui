// Mirrors GlobalSettingsSection.tsx's CredentialsSubsection shape exactly —
// same list/row/create-dialog structure, same credentials:read/write
// gating (see api/handler.go's route registration comment for why
// Embedded Integrations reuse that pair rather than a dedicated one).
import { useState } from 'react'
import { Plus, Globe, Trash2, Loader2, AlertCircle, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { usePermission } from '@/features/auth/permissions'
import { useIntegrations, useCreateIntegration, useUpdateIntegration, useDeleteIntegration } from './hooks'
import type { EmbeddedIntegration, IntegrationAuthMode, UpsertIntegrationPayload } from './types'

export function IntegrationsSubsection() {
  const { data: integrations, isLoading } = useIntegrations()
  const deleteMutation = useDeleteIntegration()
  const canWrite = usePermission('credentials:write')
  const [editing, setEditing] = useState<'new' | EmbeddedIntegration | null>(null)

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Embedded integrations</h2>
          <p className="text-sm text-gray-500">
            External web apps a dashboard's Embed widget can iframe in, optionally passing through the current
            user's identity instead of requiring a separate login.
          </p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setEditing('new')} className="shrink-0 gap-1.5">
            <Plus size={14} />Add integration
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-24 items-center justify-center"><Spinner /></div>
      ) : !integrations?.length ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
          No integrations yet.
        </div>
      ) : (
        <div className="space-y-2">
          {integrations.map((i) => (
            <IntegrationRow
              key={i.id}
              integration={i}
              canWrite={canWrite}
              onEdit={() => setEditing(i)}
              onDelete={() => deleteMutation.mutate(i.id)}
              deleting={deleteMutation.isPending && deleteMutation.variables === i.id}
            />
          ))}
        </div>
      )}

      {editing && <IntegrationFormDialog integration={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </section>
  )
}

const AUTH_MODE_LABELS: Record<IntegrationAuthMode, string> = {
  none: 'No SSO',
  signed_launch: 'Signed launch (SSO)',
  oidc: 'OIDC silent sign-in',
}

function IntegrationRow({ integration, canWrite, onEdit, onDelete, deleting }: {
  integration: EmbeddedIntegration
  canWrite: boolean
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-500">
        <Globe size={14} />
      </div>
      <button type="button" onClick={onEdit} disabled={!canWrite} className="min-w-0 flex-1 text-left disabled:cursor-default">
        <p className="truncate text-sm font-medium text-slate-800">{integration.name}</p>
        <p className="truncate text-xs text-slate-400">
          {integration.base_url} · {AUTH_MODE_LABELS[integration.auth_mode]}
          {integration.auth_mode === 'signed_launch' && !integration.has_shared_secret && (
            <span className="ml-1 text-amber-600">· no secret configured</span>
          )}
          {integration.auth_mode === 'oidc' && (!integration.oidc_issuer_url || !integration.oidc_client_id) && (
            <span className="ml-1 text-amber-600">· incomplete OIDC configuration</span>
          )}
        </p>
      </button>
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

function IntegrationFormDialog({ integration, onClose }: { integration?: EmbeddedIntegration; onClose: () => void }) {
  const isEdit = !!integration
  const createMutation = useCreateIntegration()
  const updateMutation = useUpdateIntegration(integration?.id ?? '')

  const [name, setName] = useState(integration?.name ?? '')
  const [baseUrl, setBaseUrl] = useState(integration?.base_url ?? '')
  const [allowedOriginsText, setAllowedOriginsText] = useState((integration?.allowed_origins ?? []).join('\n'))
  const [authMode, setAuthMode] = useState<IntegrationAuthMode>(integration?.auth_mode ?? 'none')
  const [sharedSecret, setSharedSecret] = useState('')
  const [claimEmail, setClaimEmail] = useState(integration?.claims.email ?? true)
  const [claimName, setClaimName] = useState(integration?.claims.name ?? true)
  const [claimRoles, setClaimRoles] = useState(integration?.claims.roles ?? false)
  const [tokenTTL, setTokenTTL] = useState(integration?.token_ttl_secs ?? 300)
  const [oidcIssuerUrl, setOidcIssuerUrl] = useState(integration?.oidc_issuer_url ?? '')
  const [oidcClientId, setOidcClientId] = useState(integration?.oidc_client_id ?? '')
  const [oidcClientSecret, setOidcClientSecret] = useState('')
  const [oidcScopesText, setOidcScopesText] = useState((integration?.oidc_scopes ?? ['openid']).join(' '))

  const allowedOrigins = allowedOriginsText.split('\n').map((s) => s.trim()).filter(Boolean)
  const oidcScopes = oidcScopesText.split(/\s+/).map((s) => s.trim()).filter(Boolean)
  const mutation = isEdit ? updateMutation : createMutation

  const canSave = name.trim() !== '' && baseUrl.trim() !== '' && allowedOrigins.length > 0 &&
    (authMode === 'none' || isEdit || sharedSecret.trim() !== '' || authMode === 'oidc') &&
    (authMode !== 'oidc' || (oidcIssuerUrl.trim() !== '' && oidcClientId.trim() !== ''))

  const handleSave = async () => {
    const payload: UpsertIntegrationPayload = {
      name: name.trim(),
      base_url: baseUrl.trim(),
      allowed_origins: allowedOrigins,
      auth_mode: authMode,
      signing_alg: 'HS256',
      claims: { email: claimEmail, name: claimName, roles: claimRoles },
      token_ttl_secs: tokenTTL,
      // Omit shared_secret entirely when blank — on edit that means "leave
      // the existing secret alone" (see UpsertIntegrationPayload's doc
      // comment); on create, an omitted secret is only valid when
      // auth_mode is 'none' (canSave already enforces this).
      ...(sharedSecret.trim() ? { shared_secret: sharedSecret.trim() } : {}),
      ...(authMode === 'oidc' ? {
        oidc_issuer_url: oidcIssuerUrl.trim(),
        oidc_client_id: oidcClientId.trim(),
        oidc_scopes: oidcScopes.length > 0 ? oidcScopes : ['openid'],
        // Same "omit when blank means leave alone" convention as
        // shared_secret above.
        ...(oidcClientSecret.trim() ? { oidc_client_secret: oidcClientSecret.trim() } : {}),
      } : {}),
    }
    await mutation.mutateAsync(payload)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit integration' : 'Add integration'}</DialogTitle>
          <DialogDescription>
            Registered here so the dashboard's Embed widget can offer it by name. The shared secret (if any) is
            encrypted and never shown again after saving.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-6 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Support Portal" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Base URL</label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://partner.example.com" className="font-mono text-xs" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Allowed origins</label>
            <textarea
              value={allowedOriginsText}
              onChange={(e) => setAllowedOriginsText(e.target.value)}
              placeholder="https://partner.example.com"
              rows={2}
              className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-700"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              One exact origin per line. The Embed SDK handshake only responds to messages from these origins.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Authentication</label>
            <select
              value={authMode}
              onChange={(e) => setAuthMode(e.target.value as IntegrationAuthMode)}
              className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700"
            >
              <option value="none">No SSO — plain embed</option>
              <option value="signed_launch">Signed launch — pass through the current user's identity</option>
              <option value="oidc">OIDC — silently sign in via an external identity provider</option>
            </select>
          </div>

          {authMode === 'oidc' && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Issuer URL</label>
                <Input
                  value={oidcIssuerUrl}
                  onChange={(e) => setOidcIssuerUrl(e.target.value)}
                  placeholder="https://accounts.example.com"
                  className="font-mono text-xs"
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  The endpoints are discovered automatically from {'"issuer"'}/.well-known/openid-configuration.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Client ID</label>
                <Input value={oidcClientId} onChange={(e) => setOidcClientId(e.target.value)} className="font-mono text-xs" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Client secret {isEdit && '(leave blank to keep the current one)'}
                </label>
                <Input
                  type="password"
                  value={oidcClientSecret}
                  onChange={(e) => setOidcClientSecret(e.target.value)}
                  placeholder={isEdit && integration?.oidc_has_client_secret ? '••••••••' : 'optional for a public client'}
                  className="font-mono text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Scopes</label>
                <Input
                  value={oidcScopesText}
                  onChange={(e) => setOidcScopesText(e.target.value)}
                  placeholder="openid email profile"
                  className="font-mono text-xs"
                />
                <p className="mt-1 text-[11px] text-gray-400">Space-separated. {'"openid"'} is always required.</p>
              </div>
            </>
          )}

          {authMode === 'signed_launch' && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Shared secret {isEdit && '(leave blank to keep the current one)'}
                </label>
                <Input
                  type="password"
                  value={sharedSecret}
                  onChange={(e) => setSharedSecret(e.target.value)}
                  placeholder={isEdit && integration?.has_shared_secret ? '••••••••' : ''}
                  className="font-mono text-xs"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">Claims to include</label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-[12px] text-slate-700">
                    <Checkbox checked={claimEmail} onCheckedChange={(c) => setClaimEmail(c === true)} />Email
                  </label>
                  <label className="flex items-center gap-2 text-[12px] text-slate-700">
                    <Checkbox checked={claimName} onCheckedChange={(c) => setClaimName(c === true)} />Name
                  </label>
                  <label className="flex items-center gap-2 text-[12px] text-slate-700">
                    <Checkbox checked={claimRoles} onCheckedChange={(c) => setClaimRoles(c === true)} />Role
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Token lifetime (seconds)</label>
                <Input
                  type="number" min={5} max={3600}
                  value={tokenTTL}
                  onChange={(e) => setTokenTTL(Number(e.target.value) || 300)}
                  className="w-32"
                />
              </div>
            </>
          )}

          {mutation.isError && (
            <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle size={13} />Failed to save integration</p>
          )}

          {authMode === 'signed_launch' && (
            <p className="flex items-start gap-1.5 rounded-md bg-slate-50 p-2 text-[11px] text-slate-500">
              <ShieldCheck size={13} className="mt-px shrink-0 text-slate-400" />
              The token is short-lived and audience-scoped to this integration. It never carries more than the
              claims checked above.
            </p>
          )}

          {authMode === 'oidc' && (
            <p className="flex items-start gap-1.5 rounded-md bg-slate-50 p-2 text-[11px] text-slate-500">
              <ShieldCheck size={13} className="mt-px shrink-0 text-slate-400" />
              A hidden, invisible sign-in attempt runs when the widget loads. If the end user doesn't already have
              an active session with this identity provider, the embed loads without SSO rather than showing an
              interactive login prompt.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 pb-4 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave || mutation.isPending} className="gap-1.5">
            {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
