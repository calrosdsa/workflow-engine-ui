import { useEffect, useState } from 'react'
import { Plus, Shield, Trash2, Lock } from 'lucide-react'
import { useApps } from '@/features/applications/hooks'
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole } from '@/features/roles/hooks'
import { usePermissionsCatalog } from '@/features/permissions/hooks'
import { usePermission } from '@/features/auth/permissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { Role } from '@/features/roles/types'
import type { PermissionDef } from '@/features/permissions/types'

export function RolesSection() {
  const { data: apps, isLoading: appsLoading } = useApps()
  const canWrite = usePermission('roles:write')
  const [selectedAppId, setSelectedAppId] = useState('')
  const [editing, setEditing] = useState<Role | 'new' | null>(null)

  useEffect(() => {
    if (!selectedAppId && apps && apps.length > 0) setSelectedAppId(apps[0].id)
  }, [apps, selectedAppId])

  const { data: roles, isLoading: rolesLoading } = useRoles(selectedAppId)
  const deleteMutation = useDeleteRole(selectedAppId)

  if (appsLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  if (!apps?.length) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <Shield size={32} className="mb-3 text-gray-300" />
          <p className="text-gray-500">No applications yet — roles are created per app.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Roles</h2>
            <p className="mt-1 text-sm text-gray-500">Roles are scoped to a single application.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Application</label>
          <select
            value={selectedAppId}
            onChange={(e) => setSelectedAppId(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700"
          >
            {apps.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}
          </select>
          {canWrite && (
            <Button onClick={() => setEditing('new')}><Plus size={16} />New role</Button>
          )}
        </div>
      </div>

      {rolesLoading ? (
        <div className="flex h-32 items-center justify-center"><Spinner /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(roles ?? []).map((role) => (
            <div key={role.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-gray-800">
                    {role.name}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">{role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'}</p>
                </div>
                {canWrite && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(role)}><Shield size={14} /></Button>
                    <Button
                      variant="ghost" size="icon" className="text-red-500 hover:bg-red-50 hover:text-red-700"
                      onClick={() => deleteMutation.mutate(role.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {role.permissions.slice(0, 4).map((p) => (
                  <span key={p} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">{p}</span>
                ))}
                {role.permissions.length > 4 && (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-400">+{role.permissions.length - 4} more</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <RoleEditorDialog
          appId={selectedAppId}
          role={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function RoleEditorDialog({ appId, role, onClose }: { appId: string; role: Role | null; onClose: () => void }) {
  const { data: catalog } = usePermissionsCatalog()
  const createMutation = useCreateRole(appId)
  const updateMutation = useUpdateRole(role?.id ?? '', appId)

  const [name, setName] = useState(role?.name ?? '')
  const [permissions, setPermissions] = useState<string[]>(role?.permissions ?? [])
  const [error, setError] = useState<string | null>(null)

  const isPending = createMutation.isPending || updateMutation.isPending

  const togglePermission = (key: string) => {
    setPermissions((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]))
  }

  const grouped = groupByResource(catalog ?? [])

  const handleSave = async () => {
    setError(null)
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    try {
      if (role) {
        await updateMutation.mutateAsync({ app_id: appId, name, permissions })
      } else {
        await createMutation.mutateAsync({ app_id: appId, name, permissions })
      }
      onClose()
    } catch {
      setError('Could not save role — a role with this name may already exist for this app.')
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>{role ? 'Edit role' : 'New role'}</DialogTitle>
          <DialogDescription>Choose which permissions this role grants within this application.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Manager" />
          </div>

          <div className="space-y-3">
            {Object.entries(grouped).map(([resource, defs]) => (
              <div key={resource}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{resource}</p>
                <div className="space-y-1.5">
                  {defs.map((p) => (
                    <label key={p.key} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={permissions.includes(p.key)}
                        onChange={() => togglePermission(p.key)}
                        className="rounded border-gray-300"
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t p-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? <Spinner /> : <Lock size={14} />}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function groupByResource(defs: PermissionDef[]): Record<string, PermissionDef[]> {
  const out: Record<string, PermissionDef[]> = {}
  for (const def of defs) {
    ;(out[def.resource] ??= []).push(def)
  }
  return out
}
