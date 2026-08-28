import { useState } from 'react'
import { toast } from 'sonner'
import { History, Save, RotateCcw, Loader2, AlertCircle, ChevronRight, Rocket, GitCommitHorizontal, Undo2, Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  useApplicationVersions, useApplicationVersionDetail, useVersionDiff,
  useSaveVersion, useRollback, useExportApp, useImportApp,
} from '@/features/applications/hooks'
import { usePermission } from '@/features/auth/permissions'
import type { AppVersion, ResourceDiff, VersionKind } from '@/features/applications/types'

const KIND_META: Record<VersionKind, { label: string; icon: typeof Rocket; className: string }> = {
  publish:    { label: 'Published',  icon: Rocket,               className: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]' },
  checkpoint: { label: 'Checkpoint', icon: GitCommitHorizontal,  className: 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]' },
  rollback:   { label: 'Rollback',   icon: Undo2,                className: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]' },
}

const RESOURCE_LABELS: Record<string, string> = {
  forms: 'Forms', workflows: 'Workflows', menus: 'Menus', roles: 'Roles',
  agents: 'Agents', credentials: 'Credentials', variables: 'Variables',
}

/** The git-tag-style display label for a version — see AppVersion's own
 *  doc comment. Every user-facing "vN" in this file should go through this,
 *  not raw version_number, which stays purely an internal route/lookup key
 *  (rollback target, diff-against, detail fetch). */
function versionLabel(v: { major_version: number; minor_version: number }): string {
  return `v${v.major_version}.${v.minor_version}`
}

export function VersionHistorySection({ publishedVersion }: { publishedVersion: number | null }) {
  const { data: versions, isLoading } = useApplicationVersions()
  const canWrite = usePermission('application:write')
  const canPublish = usePermission('application:publish')

  const [saveOpen, setSaveOpen] = useState(false)
  const [detailVersion, setDetailVersion] = useState<number | null>(null)
  const [rollbackTarget, setRollbackTarget] = useState<AppVersion | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const exportMutation = useExportApp()

  const handleExport = async () => {
    try {
      const snapshot = await exportMutation.mutateAsync()
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${snapshot.app.slug || 'app'}-export.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    } catch (e) {
      toast.error('Export failed', { description: e instanceof Error ? e.message : undefined })
    }
  }

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  const ordered = versions ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Version History</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Every checkpoint, publish, and rollback for this app — a linear timeline. Rolling back never deletes
            history; it creates a new version whose content matches the one you picked. Only the most recent 20
            versions are kept — older ones are pruned automatically as new ones are saved.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport} disabled={exportMutation.isPending}>
            {exportMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Export
          </Button>
          {canWrite && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setImportOpen(true)}>
              <Upload size={13} />
              Import
            </Button>
          )}
          {canWrite && (
            <Button size="sm" className="gap-1.5" onClick={() => setSaveOpen(true)}>
              <Save size={13} />
              Save Version
            </Button>
          )}
        </div>
      </div>

      {!ordered.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[hsl(var(--border))] p-12 text-center">
          <History size={24} className="mb-3 text-[hsl(var(--muted-foreground))]" />
          <p className="mb-1 text-sm font-medium text-[hsl(var(--foreground))]">No versions yet</p>
          <p className="text-[12px] text-[hsl(var(--muted-foreground))]">Save your first checkpoint, or publish, to start this app's history.</p>
        </div>
      ) : (
        <div className="divide-y divide-[hsl(var(--border))] rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          {ordered.map((v) => (
            <VersionRow
              key={v.id}
              version={v}
              isLive={publishedVersion != null && v.version_number === publishedVersion}
              canRollback={canPublish}
              rolledBackFromLabel={(() => {
                if (v.rolled_back_from_version == null) return null
                const source = ordered.find((o) => o.version_number === v.rolled_back_from_version)
                // The source version may have aged out of the 20-entry
                // retention window (see the backend's pruneOldVersions) —
                // fall back to the raw internal number rather than
                // fabricating a major.minor label with no real backing.
                return source ? versionLabel(source) : `#${v.rolled_back_from_version}`
              })()}
              onOpenDetail={() => setDetailVersion(v.version_number)}
              onRollback={() => setRollbackTarget(v)}
            />
          ))}
        </div>
      )}

      <SaveVersionDialog open={saveOpen} onOpenChange={setSaveOpen} />
      <VersionDetailDialog versionNumber={detailVersion} onOpenChange={(open) => { if (!open) setDetailVersion(null) }} />
      <RollbackDialog target={rollbackTarget} onOpenChange={(open) => { if (!open) setRollbackTarget(null) }} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}

function VersionRow({
  version, isLive, canRollback, rolledBackFromLabel, onOpenDetail, onRollback,
}: {
  version: AppVersion
  isLive: boolean
  canRollback: boolean
  rolledBackFromLabel: string | null
  onOpenDetail: () => void
  onRollback: () => void
}) {
  const meta = KIND_META[version.kind]
  const Icon = meta.icon
  return (
    <div className="group flex items-center gap-3 px-4 py-3">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${meta.className}`}>
        <Icon size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-[hsl(var(--foreground))]">{versionLabel(version)}</span>
          <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
          {isLive && <Badge className="bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]">Live</Badge>}
          {version.kind === 'rollback' && rolledBackFromLabel != null && (
            <span className="text-[11px] text-[hsl(var(--muted-foreground))]">from {rolledBackFromLabel}</span>
          )}
          {version.label && <span className="truncate text-[13px] text-[hsl(var(--foreground))]">{version.label}</span>}
        </div>
        <p className="mt-0.5 truncate text-xs text-[hsl(var(--muted-foreground))]">
          {new Date(version.created_at).toLocaleString()}
          {version.description ? ` · ${version.description}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" size="sm" onClick={onOpenDetail} className="gap-1 text-xs">
          Details <ChevronRight size={13} />
        </Button>
        {canRollback && (
          <Button variant="ghost" size="sm" onClick={onRollback} className="gap-1 text-xs">
            <RotateCcw size={13} /> Rollback
          </Button>
        )}
      </div>
    </div>
  )
}

function SaveVersionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const saveMutation = useSaveVersion()

  const handleSave = async () => {
    try {
      const result = await saveMutation.mutateAsync({ label: label || undefined, description: description || undefined })
      if (result.issues && result.issues.length > 0) {
        toast.warning(`Checkpoint ${versionLabel(result)} saved with ${result.issues.length} issue${result.issues.length === 1 ? '' : 's'}`, {
          description: result.issues.map((i) => i.message).join('; '),
        })
      } else {
        toast.success(`Checkpoint ${versionLabel(result)} saved`)
      }
      onOpenChange(false)
      setLabel('')
      setDescription('')
    } catch (e) {
      toast.error('Could not save version', { description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>Save Version</DialogTitle>
          <DialogDescription>
            A deliberate checkpoint of the app's current state — forms, workflows, menus, roles, agents, and settings,
            all together. This does not publish or change what's live.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 py-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Label (optional)</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Before Q3 pricing changes" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What changed, or why this checkpoint matters…"
              className="flex w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] shadow-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saveMutation.isPending}>Cancel</Button>
          <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save Version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function VersionDetailDialog({ versionNumber, onOpenChange }: { versionNumber: number | null; onOpenChange: (open: boolean) => void }) {
  const { data: detail, isLoading } = useApplicationVersionDetail(versionNumber)
  const { data: diff } = useVersionDiff(versionNumber, undefined)

  return (
    <Dialog open={versionNumber != null} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>Version {detail ? versionLabel(detail) : ''}</DialogTitle>
          {detail && (
            <DialogDescription>
              {KIND_META[detail.kind].label} · {new Date(detail.created_at).toLocaleString()}
              {detail.label ? ` · ${detail.label}` : ''}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="max-h-[50vh] overflow-y-auto px-6 py-2">
          {isLoading ? (
            <div className="flex h-24 items-center justify-center"><Spinner /></div>
          ) : detail ? (
            <div className="space-y-4">
              {detail.description && (
                <p className="text-sm text-[hsl(var(--foreground))]">{detail.description}</p>
              )}
              {isOldSnapshotShape(detail.snapshot.snapshot_schema_version) && (
                <p className="flex items-center gap-1.5 text-[12px] text-[hsl(var(--warning))]">
                  <AlertCircle size={13} className="shrink-0" />
                  This version predates whole-app snapshots — it only captured Menus/Theme, not Forms/Workflows/Roles/
                  Agents/Credentials/Variables, and can't be rolled back to.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <SnapshotCount label="Forms" count={detail.snapshot.forms?.length ?? null} />
                <SnapshotCount label="Workflows" count={detail.snapshot.workflows?.length ?? null} />
                <SnapshotCount label="Menus" count={detail.snapshot.menus?.length ?? null} />
                <SnapshotCount label="Roles" count={detail.snapshot.roles?.length ?? null} />
                <SnapshotCount label="Agents" count={detail.snapshot.agents?.length ?? null} />
                <SnapshotCount label="Credentials" count={detail.snapshot.credentials?.length ?? null} />
              </div>
              {diff && <DiffSummary diff={diff.resources} />}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// CURRENT_SNAPSHOT_SCHEMA_VERSION mirrors the backend's
// appbuilder.CurrentSnapshotSchemaVersion (internal/appbuilder/versions.go)
// — a version older than this predates whole-app snapshots (Forms/
// Workflows/Roles/Agents/Credentials/Variables are all null on the wire,
// not empty arrays) and can't be rolled back to; see Restorer.RollbackTo's
// own ErrOldSnapshotSchema check on the backend for the authoritative
// enforcement — this is only the read-only detail view's own defensive
// null-handling plus a matching notice, not a second source of truth.
const CURRENT_SNAPSHOT_SCHEMA_VERSION = 2

function isOldSnapshotShape(version: number): boolean {
  return version < CURRENT_SNAPSHOT_SCHEMA_VERSION
}

function SnapshotCount({ label, count }: { label: string; count: number | null }) {
  return (
    <div className="rounded-md border border-[hsl(var(--border))] px-2.5 py-1.5">
      <span className="font-medium text-[hsl(var(--foreground))]">{count ?? '—'}</span>{' '}
      <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
    </div>
  )
}

function DiffSummary({ diff }: { diff: Record<string, ResourceDiff> }) {
  const entries = Object.entries(diff).filter(([, d]) => d.added.length || d.removed.length || d.changed.length)
  if (entries.length === 0) {
    return <p className="text-[12px] text-[hsl(var(--muted-foreground))]">No changes from the previous version.</p>
  }
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Changed since previous version</p>
      <ul className="space-y-1 text-[12px]">
        {entries.map(([resource, d]) => (
          <li key={resource} className="text-[hsl(var(--foreground))]">
            <span className="font-medium">{RESOURCE_LABELS[resource] ?? resource}:</span>{' '}
            {d.added.length > 0 && <span className="text-[hsl(var(--success))]">+{d.added.length} added</span>}
            {d.added.length > 0 && (d.removed.length > 0 || d.changed.length > 0) && ', '}
            {d.removed.length > 0 && <span className="text-[hsl(var(--destructive))]">-{d.removed.length} removed</span>}
            {d.removed.length > 0 && d.changed.length > 0 && ', '}
            {d.changed.length > 0 && <span className="text-[hsl(var(--warning))]">{d.changed.length} changed</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function RollbackDialog({ target, onOpenChange }: { target: AppVersion | null; onOpenChange: (open: boolean) => void }) {
  const { data: diff, isLoading: diffLoading } = useVersionDiff(target?.version_number ?? null)
  const rollbackMutation = useRollback()
  const [confirmText, setConfirmText] = useState('')

  const handleClose = (open: boolean) => {
    if (!open) setConfirmText('')
    onOpenChange(open)
  }

  const handleRollback = async () => {
    if (!target) return
    try {
      const result = await rollbackMutation.mutateAsync(target.version_number)
      toast.success(`Rolled back to ${versionLabel(target)} (recorded as ${versionLabel(result)})`)
      if (result.warnings && result.warnings.length > 0) {
        toast.warning(`${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'} after rollback`, {
          description: result.warnings.map((w) => w.message).join('; '),
        })
      }
      handleClose(false)
    } catch (e) {
      toast.error('Rollback failed', { description: e instanceof Error ? e.message : undefined })
    }
  }

  const entries = diff ? Object.entries(diff.resources).filter(([, d]) => d.added.length || d.removed.length || d.changed.length) : []
  const canConfirm = confirmText.trim().toUpperCase() === 'ROLLBACK'

  return (
    <Dialog open={target != null} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>Rollback to {target ? versionLabel(target) : ''}?</DialogTitle>
          <DialogDescription>
            This restores every form, workflow, menu, role, agent, and setting to match {target ? versionLabel(target) : ''} — a
            wide, whole-app change. It does NOT touch what's currently live; the running app stays as-is until you
            publish again. This creates a NEW version, so nothing is destroyed — you can always roll forward again.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[40vh] overflow-y-auto border-y border-[hsl(var(--border))] px-6 py-3">
          {diffLoading ? (
            <div className="flex h-16 items-center justify-center"><Spinner /></div>
          ) : entries.length === 0 ? (
            <p className="flex items-center gap-1.5 text-[12px] text-[hsl(var(--muted-foreground))]">
              <AlertCircle size={13} />
              This version matches the app's current state — rolling back won't change anything.
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-[hsl(var(--warning))]">
                <AlertCircle size={13} /> This will change:
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
            Type ROLLBACK to confirm
          </label>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="ROLLBACK" className="font-mono" />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => handleClose(false)} disabled={rollbackMutation.isPending}>Cancel</Button>
          <Button
            variant="destructive" size="sm" className="gap-1.5"
            onClick={handleRollback}
            disabled={!canConfirm || rollbackMutation.isPending}
          >
            {rollbackMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
            Rollback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const importMutation = useImportApp()

  const handleFileChange = (f: File | null) => {
    setFile(f)
    setParseError(null)
  }

  const handleImport = async () => {
    if (!file) return
    setParseError(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const result = await importMutation.mutateAsync(parsed)
      toast.success(`Imported as ${versionLabel(result)}`)
      if (result.warnings && result.warnings.length > 0) {
        toast.warning(`${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'} after import`, {
          description: result.warnings.map((w) => w.message).join('; '),
        })
      }
      onOpenChange(false)
      setFile(null)
    } catch (e) {
      if (e instanceof SyntaxError) setParseError('This file is not valid JSON.')
      else toast.error('Import failed', { description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>Import App</DialogTitle>
          <DialogDescription>
            Restores an exported app's design — forms, workflows, menus, roles, agents, and settings — into this app.
            Every id is remapped fresh, so nothing here is overwritten; this is additive, not a replace. No
            records/runtime data are copied — imported forms start empty. Credential values are never included in an
            export, so any credentials the source app used will need to be added here from Settings afterward.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-6 py-2">
          <input
            type="file"
            accept="application/json"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-[hsl(var(--foreground))] file:mr-3 file:rounded-md file:border-0 file:bg-[hsl(var(--primary))]/10 file:px-3 file:py-1.5 file:text-[hsl(var(--primary))] file:text-xs file:font-medium"
          />
          {parseError && (
            <p className="flex items-center gap-1.5 text-xs text-[hsl(var(--destructive))]">
              <AlertCircle size={13} />{parseError}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={importMutation.isPending}>Cancel</Button>
          <Button size="sm" className="gap-1.5" onClick={handleImport} disabled={!file || importMutation.isPending}>
            {importMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
