import { useState } from 'react'
import { toast } from 'sonner'
import { GitBranch, ArrowUpRight, Lock, Unlink, Loader2, AlertCircle, Rocket, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  useEnvironmentLinkStatus, useCreateProduction, useLinkExisting, usePromotePreview, usePromote, useUnlinkEnvironment,
} from '@/features/environment/hooks'
import { useApps } from '@/features/applications/hooks'
import { usePermission } from '@/features/auth/permissions'
import { extractApiError } from '@/lib/api'

const RESOURCE_LABELS: Record<string, string> = {
  forms: 'Forms', workflows: 'Workflows', menus: 'Menus', roles: 'Roles',
  agents: 'Agents', credentials: 'Credentials', variables: 'Variables',
}

export function EnvironmentLinkSection() {
  const { data: status, isLoading } = useEnvironmentLinkStatus()
  const canWrite = usePermission('environment:write')

  const [createOpen, setCreateOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [promoteOpen, setPromoteOpen] = useState(false)
  const [unlinkOpen, setUnlinkOpen] = useState(false)

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>
  if (!status) return null

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Environment Link</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          A direct link between a Sandbox app and a Production app. Promote pushes Sandbox's current state into
          Production, overwriting it completely — no merging, no local Production edits to worry about, since a
          linked Production is locked from direct changes the moment it's linked.
        </p>
      </div>

      {!status.linked && <UnlinkedState canWrite={canWrite} onCreate={() => setCreateOpen(true)} onLink={() => setLinkOpen(true)} />}
      {status.linked && status.role === 'sandbox' && (
        <SandboxState
          otherAppId={status.other_app_id}
          linkedAt={status.linked_at}
          canWrite={canWrite}
          onPromote={() => setPromoteOpen(true)}
          onUnlink={() => setUnlinkOpen(true)}
        />
      )}
      {status.linked && status.role === 'production' && (
        <ProductionState otherAppId={status.other_app_id} linkedAt={status.linked_at} canWrite={canWrite} onUnlink={() => setUnlinkOpen(true)} />
      )}

      <CreateProductionDialog open={createOpen} onOpenChange={setCreateOpen} />
      <LinkExistingDialog open={linkOpen} onOpenChange={setLinkOpen} />
      <PromoteDialog open={promoteOpen} onOpenChange={setPromoteOpen} />
      <UnlinkDialog open={unlinkOpen} onOpenChange={setUnlinkOpen} role={status.role} />
    </div>
  )
}

function UnlinkedState({ canWrite, onCreate, onLink }: { canWrite: boolean; onCreate: () => void; onLink: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[hsl(var(--border))] p-12 text-center">
      <GitBranch size={24} className="mb-3 text-[hsl(var(--muted-foreground))]" />
      <p className="mb-1 text-sm font-medium text-[hsl(var(--foreground))]">This app isn't linked to an environment</p>
      <p className="mb-5 max-w-sm text-[12px] text-[hsl(var(--muted-foreground))]">
        Link this app as a Sandbox to a Production app, so you can test and customize changes here before pushing
        them live.
      </p>
      {canWrite && (
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={onCreate}>
            <Rocket size={13} /> Create Production from this app
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onLink}>
            <Link2 size={13} /> Link to an existing app
          </Button>
        </div>
      )}
    </div>
  )
}

function SandboxState({
  otherAppId, linkedAt, canWrite, onPromote, onUnlink,
}: {
  otherAppId?: string
  linkedAt?: string
  canWrite: boolean
  onPromote: () => void
  onUnlink: () => void
}) {
  const { data: apps } = useApps()
  const productionName = apps?.find((a) => a.id === otherAppId)?.name ?? otherAppId

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
            <GitBranch size={16} />
          </div>
          <div>
            <p className="font-medium text-[hsl(var(--foreground))]">This app is a Sandbox</p>
            <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
              Linked to <span className="font-medium text-[hsl(var(--foreground))]">{productionName}</span> as Production
              {linkedAt && ` · linked ${new Date(linkedAt).toLocaleDateString()}`}
            </p>
          </div>
        </div>
      </div>
      {canWrite && (
        <div className="mt-4 flex items-center gap-2 border-t border-[hsl(var(--border))] pt-4">
          <Button size="sm" className="gap-1.5" onClick={onPromote}>
            <ArrowUpRight size={13} /> Promote to Production
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-[hsl(var(--destructive))]" onClick={onUnlink}>
            <Unlink size={13} /> Unlink
          </Button>
        </div>
      )}
    </div>
  )
}

function ProductionState({
  otherAppId, linkedAt, canWrite, onUnlink,
}: {
  otherAppId?: string
  linkedAt?: string
  canWrite: boolean
  onUnlink: () => void
}) {
  const { data: apps } = useApps()
  const sandboxName = apps?.find((a) => a.id === otherAppId)?.name ?? otherAppId

  return (
    <div className="rounded-lg border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/5 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]">
          <Lock size={16} />
        </div>
        <div>
          <p className="font-medium text-[hsl(var(--foreground))]">This app is a locked Production</p>
          <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
            Linked to <span className="font-medium text-[hsl(var(--foreground))]">{sandboxName}</span> as Sandbox
            {linkedAt && ` · linked ${new Date(linkedAt).toLocaleDateString()}`}. Design-time edits are disabled here
            — make changes in the Sandbox and Promote them across. Publish and Rollback still work normally.
          </p>
        </div>
      </div>
      {canWrite && (
        <div className="mt-4 flex items-center gap-2 border-t border-[hsl(var(--warning))]/20 pt-4">
          <Button variant="ghost" size="sm" className="gap-1.5 text-[hsl(var(--destructive))]" onClick={onUnlink}>
            <Unlink size={13} /> Unlink
          </Button>
        </div>
      )}
    </div>
  )
}

function CreateProductionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const createMutation = useCreateProduction()

  const handleClose = (o: boolean) => {
    if (!o) { setName(''); setSlug('') }
    onOpenChange(o)
  }

  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync({ name, slug })
      toast.success(`Created "${name}" as Production, linked to this app as Sandbox`)
      handleClose(false)
    } catch (e) {
      toast.error('Could not create Production', { description: extractApiError(e) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>Create Production from this Sandbox</DialogTitle>
          <DialogDescription>
            Creates a brand-new, empty app and links it as Production. This app becomes its Sandbox. Nothing is
            copied over yet — use Promote afterward to push this app's state across.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 py-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="CRM (Production)" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Slug</label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="crm-production" className="font-mono" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => handleClose(false)} disabled={createMutation.isPending}>Cancel</Button>
          <Button size="sm" className="gap-1.5" onClick={handleCreate} disabled={!name || !slug || createMutation.isPending}>
            {createMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}
            Create Production
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LinkExistingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: apps } = useApps()
  const [targetId, setTargetId] = useState('')
  const linkMutation = useLinkExisting()

  const handleClose = (o: boolean) => {
    if (!o) setTargetId('')
    onOpenChange(o)
  }

  const handleLink = async () => {
    try {
      await linkMutation.mutateAsync({ production_app_id: targetId })
      toast.success('Linked as Production')
      handleClose(false)
    } catch (e) {
      toast.error('Could not link', { description: extractApiError(e) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>Link to an existing app as Production</DialogTitle>
          <DialogDescription>
            Links an already-existing app under your client as Production, with this app becoming its Sandbox.
            Nothing is copied over yet — use Promote afterward to push this app's state across.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 py-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Production app</label>
            <Select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">Select an app…</option>
              {apps?.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => handleClose(false)} disabled={linkMutation.isPending}>Cancel</Button>
          <Button size="sm" className="gap-1.5" onClick={handleLink} disabled={!targetId || linkMutation.isPending}>
            {linkMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
            Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PromoteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: preview, isLoading: previewLoading } = usePromotePreview(open)
  const promoteMutation = usePromote()
  const [confirmText, setConfirmText] = useState('')

  const handleClose = (o: boolean) => {
    if (!o) setConfirmText('')
    onOpenChange(o)
  }

  const handlePromote = async () => {
    try {
      const result = await promoteMutation.mutateAsync()
      toast.success(`Promoted to Production (v${result.major_version}.${result.minor_version})`)
      if (result.warnings && result.warnings.length > 0) {
        toast.warning(`${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'} after promotion`, {
          description: result.warnings.map((w) => w.message).join('; '),
        })
      }
      handleClose(false)
    } catch (e) {
      toast.error('Promote failed', { description: extractApiError(e) })
    }
  }

  const entries = preview ? Object.entries(preview.diff).filter(([, d]) => d.added.length || d.removed.length || d.changed.length) : []
  const canConfirm = confirmText.trim().toUpperCase() === 'PROMOTE'

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>Promote to Production?</DialogTitle>
          <DialogDescription>
            This overwrites Production's forms, workflows, menus, roles, agents, and settings to match this
            Sandbox's current state exactly — a wide, whole-app change. Credential VALUES carry over (same
            encryption boundary, same client), so Production doesn't need credentials re-entered. This does NOT
            publish Production — its live runtime stays as-is until it's published separately. Recorded as a new
            version, so if something's wrong afterward, Production can be rolled back from its own Version History.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[40vh] overflow-y-auto border-y border-[hsl(var(--border))] px-6 py-3">
          {previewLoading ? (
            <div className="flex h-16 items-center justify-center"><Spinner /></div>
          ) : entries.length === 0 ? (
            <p className="flex items-center gap-1.5 text-[12px] text-[hsl(var(--muted-foreground))]">
              <AlertCircle size={13} />
              Production already matches this Sandbox — promoting won't change anything.
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-[hsl(var(--warning))]">
                <AlertCircle size={13} /> This will change Production:
              </p>
              <ul className="space-y-1 text-[12px]">
                {entries.map(([resource, d]) => (
                  <li key={resource} className="text-[hsl(var(--foreground))]">
                    <span className="font-medium">{RESOURCE_LABELS[resource] ?? resource}:</span>{' '}
                    {d.added.length > 0 && <span className="text-[hsl(var(--success))]">+{d.added.length}</span>}
                    {d.added.length > 0 && (d.removed.length > 0 || d.changed.length > 0) && ' '}
                    {d.removed.length > 0 && <span className="text-[hsl(var(--destructive))]">-{d.removed.length}</span>}
                    {d.removed.length > 0 && d.changed.length > 0 && ' '}
                    {d.changed.length > 0 && <span className="text-[hsl(var(--warning))]">{d.changed.length} changed</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="px-6 py-3">
          <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
            Type PROMOTE to confirm
          </label>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="PROMOTE" className="font-mono" />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => handleClose(false)} disabled={promoteMutation.isPending}>Cancel</Button>
          <Button
            variant="destructive" size="sm" className="gap-1.5"
            onClick={handlePromote}
            disabled={!canConfirm || promoteMutation.isPending}
          >
            {promoteMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <ArrowUpRight size={13} />}
            Promote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UnlinkDialog({ open, onOpenChange, role }: { open: boolean; onOpenChange: (open: boolean) => void; role?: 'sandbox' | 'production' }) {
  const unlinkMutation = useUnlinkEnvironment()

  const handleUnlink = async () => {
    try {
      await unlinkMutation.mutateAsync()
      toast.success('Unlinked')
      onOpenChange(false)
    } catch (e) {
      toast.error('Could not unlink', { description: extractApiError(e) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-sm">
        <DialogHeader>
          <DialogTitle>Unlink this environment?</DialogTitle>
          <DialogDescription>
            {role === 'production'
              ? "This lifts Production's lock immediately — direct edits become possible again here. Past promotion history stays visible in this app's Version History either way."
              : 'This removes the link between this Sandbox and its Production app. Both apps keep their current content — nothing is deleted.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={unlinkMutation.isPending}>Cancel</Button>
          <Button variant="destructive" size="sm" className="gap-1.5" onClick={handleUnlink} disabled={unlinkMutation.isPending}>
            {unlinkMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Unlink size={13} />}
            Unlink
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
