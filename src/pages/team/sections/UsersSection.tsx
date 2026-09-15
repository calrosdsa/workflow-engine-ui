import { useMemo, useState } from 'react'
import { Trash2, RotateCw, XCircle, Pencil } from 'lucide-react'
import { useTeamUsers, useRevokeUserAccess } from '@/features/users/hooks'
import { useInvitations, useResendInvitation, useRevokeInvitation } from '@/features/invitations/hooks'
import { useApps } from '@/features/applications/hooks'
import { usePermission } from '@/features/auth/permissions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { Pagination } from '@/components/ui/pagination'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { TeamListLayout } from '../components/TeamListLayout'
import { UserFormDrawer } from '../components/UserFormDrawer'
import type { TeamUser } from '@/features/users/types'
import type { Invitation } from '@/features/invitations/types'
import { useTranslation } from '@/features/i18n/I18nProvider'

const PAGE_SIZE = 10

type Row =
  | { kind: 'user'; id: string; name: string; email: string; status: 'Active'; user: TeamUser }
  | { kind: 'invitation'; id: string; name: string; email: string; status: 'Pending'; invitation: Invitation }

export function UsersSection() {
  const t = useTranslation()
  const { data: users, isLoading: usersLoading } = useTeamUsers()
  const { data: invitations, isLoading: invitationsLoading } = useInvitations()
  const { data: apps } = useApps()
  const revokeAccessMutation = useRevokeUserAccess()
  const resendMutation = useResendInvitation()
  const revokeInviteMutation = useRevokeInvitation()
  const canWrite = usePermission('users:write')

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [manageAccessTarget, setManageAccessTarget] = useState<TeamUser | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<Row | null>(null)

  const pendingInvitations = (invitations ?? []).filter((inv) => inv.status === 'pending')

  const rows = useMemo<Row[]>(() => {
    const userRows: Row[] = (users ?? [])
      .filter((u) => !selectedAppId || u.memberships.some((m) => m.app_id === selectedAppId))
      .map((u) => ({
        kind: 'user', id: u.id, status: 'Active',
        name: `${u.first_name} ${u.last_name}`.trim() || u.email, email: u.email, user: u,
      }))
    const invitationRows: Row[] = pendingInvitations
      .filter((inv) => !selectedAppId || inv.grants.some((g) => g.app_id === selectedAppId))
      .map((inv) => ({ kind: 'invitation', id: inv.id, status: 'Pending', name: inv.email, email: inv.email, invitation: inv }))
    const all = [...userRows, ...invitationRows]
    const q = search.trim().toLowerCase()
    return q ? all.filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)) : all
  }, [users, pendingInvitations, selectedAppId, search])

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleSelectApp = (appId: string | null) => {
    setSelectedAppId(appId)
    setPage(1)
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleConfirmRevoke = () => {
    if (!revokeTarget) return
    if (revokeTarget.kind === 'user') revokeAccessMutation.mutate(revokeTarget.user.id)
    else revokeInviteMutation.mutate(revokeTarget.invitation.id)
    setRevokeTarget(null)
  }

  const columns: DataTableColumn[] = [
    { key: 'name', label: t('common.name') },
    { key: 'email', label: t('auth.email') },
    {
      key: 'status', label: t('common.status'),
      render: (row) => (
        <Badge variant={row.status === 'Active' ? 'success' : 'warning'}>{row.status === 'Active' ? t('team.active') : t('common.pending')}</Badge>
      ),
    },
    {
      key: 'actions', label: '', align: 'right',
      render: (row) => {
        const r = row as unknown as Row
        if (!canWrite) return null
        if (r.kind === 'invitation') {
          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost" size="icon" title={t('team.resend_invitation')}
                disabled={resendMutation.isPending} onClick={() => resendMutation.mutate(r.invitation.id)}
              >
                <RotateCw size={14} />
              </Button>
              <Button
                variant="ghost" size="icon" title={t('team.revoke_invitation')} className="text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))]"
                onClick={() => setRevokeTarget(r)}
              >
                <XCircle size={14} />
              </Button>
            </div>
          )
        }
        return (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost" size="icon" title={t('team.edit_user')}
              onClick={() => setManageAccessTarget(r.user)}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost" size="icon" title={t('team.revoke_access')} className="text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))]"
              onClick={() => setRevokeTarget(r)}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        )
      },
    },
  ]

  if (usersLoading || invitationsLoading) {
    return <div className="flex h-64 items-center justify-center"><Spinner /></div>
  }

  return (
    <TeamListLayout
      apps={apps ?? []}
      selectedAppId={selectedAppId}
      onSelectApp={handleSelectApp}
      search={search}
      onSearchChange={handleSearchChange}
      searchPlaceholder={t('team.search_users')}
      primaryAction={canWrite ? { label: t('team.add_user'), onClick: () => setFormOpen(true) } : undefined}
    >
      <DataTable
        columns={columns}
        rows={pagedRows as unknown as Record<string, unknown>[]}
        getRowId={(row) => (row as unknown as Row).id}
        emptyMessage={t('team.no_access')}
      />
      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />

      <UserFormDrawer open={formOpen} onClose={() => setFormOpen(false)} />

      {manageAccessTarget && (
        <UserFormDrawer
          open
          mode="manage-access"
          existingUser={manageAccessTarget}
          onClose={() => setManageAccessTarget(null)}
        />
      )}

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(o) => !o && setRevokeTarget(null)}
        title={revokeTarget?.kind === 'invitation' ? t('team.revoke_invitation_title') : t('team.revoke_access_title')}
        description={
          revokeTarget?.kind === 'invitation'
            ? t('team.revoke_invitation_description', { email: revokeTarget.email })
            : t('team.revoke_access_description', { email: revokeTarget?.email ?? '' })
        }
        confirmLabel={t('team.revoke')}
        destructive
        loading={revokeAccessMutation.isPending || revokeInviteMutation.isPending}
        onConfirm={handleConfirmRevoke}
      />
    </TeamListLayout>
  )
}
