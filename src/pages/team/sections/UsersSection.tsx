import { useState } from 'react'
import { UserPlus, Users, Trash2, Mail, RotateCw, XCircle } from 'lucide-react'
import { useTeamUsers, useRevokeUserAccess } from '@/features/users/hooks'
import { useInvitations, useResendInvitation, useRevokeInvitation } from '@/features/invitations/hooks'
import { usePermission } from '@/features/auth/permissions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { InviteDialog } from '../components/InviteDialog'
import type { TeamUser } from '@/features/users/types'
import type { Invitation } from '@/features/invitations/types'

export function UsersSection() {
  const { data: users, isLoading: usersLoading } = useTeamUsers()
  const { data: invitations, isLoading: invitationsLoading } = useInvitations()
  const revokeAccessMutation = useRevokeUserAccess()
  const canWrite = usePermission('users:write')

  const [inviteOpen, setInviteOpen] = useState(false)

  const pendingInvitations = (invitations ?? []).filter((inv) => inv.status === 'pending')

  if (usersLoading || invitationsLoading) {
    return <div className="flex h-64 items-center justify-center"><Spinner /></div>
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Team members</h2>
          <p className="mt-1 text-sm text-gray-500">{users?.length ?? 0} people with access</p>
        </div>
        {canWrite && (
          <Button onClick={() => setInviteOpen(true)}><UserPlus size={16} />Invite</Button>
        )}
      </div>

      {!users?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <Users size={32} className="mb-3 text-gray-300" />
          <p className="mb-4 text-gray-500">No one has access yet.</p>
          {canWrite && (
            <Button variant="outline" onClick={() => setInviteOpen(true)}><UserPlus size={16} />Invite your first team member</Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              canWrite={canWrite}
              onRevoke={() => revokeAccessMutation.mutate(user.id)}
            />
          ))}
        </div>
      )}

      {pendingInvitations.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Pending invitations ({pendingInvitations.length})
          </h3>
          <div className="space-y-2">
            {pendingInvitations.map((inv) => (
              <PendingInvitationRow key={inv.id} invitation={inv} canWrite={canWrite} />
            ))}
          </div>
        </div>
      )}

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  )
}

function UserCard({ user, canWrite, onRevoke }: { user: TeamUser; canWrite: boolean; onRevoke: () => void }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate">{user.first_name} {user.last_name}</CardTitle>
            <CardDescription className="mt-1 truncate text-xs">{user.email}</CardDescription>
          </div>
          {canWrite && (
            <Button
              variant="ghost" size="icon" onClick={onRevoke}
              title="Revoke access" className="text-red-500 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {user.memberships.map((m) => (
            <span key={m.app_id} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
              {m.app_name}: {m.role_name}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function PendingInvitationRow({ invitation, canWrite }: { invitation: Invitation; canWrite: boolean }) {
  const resendMutation = useResendInvitation()
  const revokeMutation = useRevokeInvitation()

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <Mail size={14} className="shrink-0 text-gray-400" />
        <span className="truncate text-sm text-gray-700">{invitation.email}</span>
        <span className="shrink-0 text-xs text-gray-400">{invitation.grants.length} app{invitation.grants.length === 1 ? '' : 's'}</span>
      </div>
      {canWrite && (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost" size="icon" title="Resend invitation"
            disabled={resendMutation.isPending} onClick={() => resendMutation.mutate(invitation.id)}
          >
            <RotateCw size={14} />
          </Button>
          <Button
            variant="ghost" size="icon" title="Revoke invitation" className="text-red-500 hover:bg-red-50 hover:text-red-700"
            disabled={revokeMutation.isPending} onClick={() => revokeMutation.mutate(invitation.id)}
          >
            <XCircle size={14} />
          </Button>
        </div>
      )}
    </div>
  )
}
