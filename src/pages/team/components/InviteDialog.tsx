import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useApps } from '@/features/applications/hooks'
import { useRoles } from '@/features/roles/hooks'
import { useCreateInvitation } from '@/features/invitations/hooks'
import type { InvitationGrant } from '@/features/invitations/types'

interface GrantDraft {
  key: number
  app_id: string
  role_id: string
}

let nextKey = 0

export function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: apps } = useApps()
  const createMutation = useCreateInvitation()

  const [email, setEmail] = useState('')
  const [grants, setGrants] = useState<GrantDraft[]>([{ key: nextKey++, app_id: apps?.[0]?.id ?? '', role_id: '' }])
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const addRow = () => setGrants((prev) => [...prev, { key: nextKey++, app_id: apps?.[0]?.id ?? '', role_id: '' }])
  const removeRow = (key: number) => setGrants((prev) => prev.filter((g) => g.key !== key))
  const updateRow = (key: number, patch: Partial<GrantDraft>) =>
    setGrants((prev) => prev.map((g) => (g.key === key ? { ...g, ...patch } : g)))

  const reset = () => {
    setEmail('')
    setGrants([{ key: nextKey++, app_id: apps?.[0]?.id ?? '', role_id: '' }])
    setError(null)
    setResult(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    setError(null)
    if (!email.trim()) {
      setError('Email is required.')
      return
    }
    const validGrants: InvitationGrant[] = grants
      .filter((g) => g.app_id && g.role_id)
      .map((g) => ({ app_id: g.app_id, role_id: g.role_id }))
    if (validGrants.length === 0) {
      setError('Choose at least one app and role.')
      return
    }
    try {
      const res = await createMutation.mutateAsync({ email, grants: validGrants })
      setResult(res.immediate ? 'Access granted — they can log in now.' : `Invitation sent to ${email}.`)
    } catch {
      setError('Could not send invitation.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription>Grant access to one or more applications, each with its own role.</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 p-4">
            <p className="text-sm text-emerald-700">{result}</p>
            <div className="flex justify-end">
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4 p-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@example.com" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Access</label>
                <div className="space-y-2">
                  {grants.map((g) => (
                    <GrantRow
                      key={g.key}
                      grant={g}
                      apps={apps ?? []}
                      onChange={(patch) => updateRow(g.key, patch)}
                      onRemove={grants.length > 1 ? () => removeRow(g.key) : undefined}
                    />
                  ))}
                </div>
                <Button variant="outline" size="sm" className="mt-2" onClick={addRow}>
                  <Plus size={14} />Add another app
                </Button>
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t p-4">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                {createMutation.isPending && <Spinner />}
                Send invitation
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function GrantRow({ grant, apps, onChange, onRemove }: {
  grant: GrantDraft
  apps: { id: string; name: string }[]
  onChange: (patch: Partial<GrantDraft>) => void
  onRemove?: () => void
}) {
  const { data: roles } = useRoles(grant.app_id)

  return (
    <div className="flex items-center gap-2">
      <select
        value={grant.app_id}
        onChange={(e) => onChange({ app_id: e.target.value, role_id: '' })}
        className="w-1/2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700"
      >
        <option value="">Select app…</option>
        {apps.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}
      </select>
      <select
        value={grant.role_id}
        onChange={(e) => onChange({ role_id: e.target.value })}
        disabled={!grant.app_id}
        className="w-1/2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 disabled:opacity-50"
      >
        <option value="">Select role…</option>
        {(roles ?? []).map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
      </select>
      {onRemove && (
        <Button variant="ghost" size="icon" onClick={onRemove} className="shrink-0 text-red-500 hover:bg-red-50 hover:text-red-700">
          <Trash2 size={14} />
        </Button>
      )}
    </div>
  )
}
