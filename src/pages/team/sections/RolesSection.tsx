import { useEffect, useMemo, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useApps } from '@/features/applications/hooks'
import { useRoles, useDeleteRole } from '@/features/roles/hooks'
import { usePermission } from '@/features/auth/permissions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { Pagination } from '@/components/ui/pagination'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { TeamListLayout } from '../components/TeamListLayout'
import { RoleFormDrawer } from '../components/RoleFormDrawer'
import type { Role } from '@/features/roles/types'

const PAGE_SIZE = 10

export function RolesSection() {
  const { data: apps, isLoading: appsLoading } = useApps()
  const canWrite = usePermission('roles:write')
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Role | 'new' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null)

  useEffect(() => {
    if (!selectedAppId && apps && apps.length > 0) setSelectedAppId(apps[0].id)
  }, [apps, selectedAppId])

  const { data: roles, isLoading: rolesLoading } = useRoles(selectedAppId ?? '')
  const deleteMutation = useDeleteRole(selectedAppId ?? '')

  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = roles ?? []
    return q ? list.filter((r) => r.name.toLowerCase().includes(q)) : list
  }, [roles, search])

  const pageCount = Math.max(1, Math.ceil(filteredRoles.length / PAGE_SIZE))
  const pagedRoles = filteredRoles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleSelectApp = (appId: string | null) => {
    setSelectedAppId(appId ?? apps?.[0]?.id ?? null)
    setPage(1)
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id)
    setDeleteTarget(null)
  }

  const columns: DataTableColumn[] = [
    { key: 'name', label: 'Role Name' },
    {
      key: 'status', label: 'Status',
      render: () => <Badge variant="success">Active</Badge>,
    },
    {
      key: 'actions', label: '', align: 'right',
      render: (row) => {
        const role = row as unknown as Role
        if (!canWrite) return null
        return (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" title="Edit role" onClick={() => setEditing(role)}>
              <Pencil size={14} />
            </Button>
            {!role.is_builtin && (
              <Button
                variant="ghost" size="icon" title="Delete role" className="text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))]"
                onClick={() => setDeleteTarget(role)}
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  if (appsLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  if (!apps?.length) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[hsl(var(--border))] p-12 text-center">
          <p className="text-[hsl(var(--muted-foreground))]">No applications yet — roles are created per app.</p>
        </div>
      </div>
    )
  }

  return (
    <TeamListLayout
      apps={apps}
      selectedAppId={selectedAppId}
      onSelectApp={handleSelectApp}
      search={search}
      onSearchChange={handleSearchChange}
      searchPlaceholder="Search Roles..."
      primaryAction={canWrite ? { label: '+ Add Role', onClick: () => setEditing('new') } : undefined}
    >
      {rolesLoading ? (
        <div className="flex h-32 items-center justify-center"><Spinner /></div>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={pagedRoles as unknown as Record<string, unknown>[]}
            getRowId={(row) => (row as unknown as Role).id}
            emptyMessage="No roles yet for this application."
          />
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
        </>
      )}

      <p className="border-t border-[hsl(var(--border))] px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">
        Platform roles (Super Admin, Owner, Editor, Viewer) aren't scoped to one app and don't
        appear in this list — grant Super Admin from a user's "Manage Access" panel on the Users tab.
      </p>

      {editing && selectedAppId && (
        <RoleFormDrawer
          appId={selectedAppId}
          role={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete role?"
        description={`"${deleteTarget?.name}" will be removed. Users currently assigned this role will lose the permissions it grants.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </TeamListLayout>
  )
}
