import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import { useApps } from '@/features/applications/hooks'
import { useRoles } from '@/features/roles/hooks'
import { useCreateInvitation } from '@/features/invitations/hooks'
import {
  useRevokeUserAppAccess,
  useGrantSuperAdmin,
  useRevokeSuperAdmin,
  useUpdateUserAppRole,
  useUpdateUserProfile,
} from '@/features/users/hooks'
import type { AppSummary } from '@/features/applications/types'
import type { InvitationGrant } from '@/features/invitations/types'
import type { TeamUser } from '@/features/users/types'

interface UserFormDrawerProps {
  open: boolean
  onClose: () => void
  /** 'invite' (default) collects an email for a brand-new person. 'manage-access'
   *  edits an EXISTING team member's access instead — email is fixed, their
   *  current app+role grants are shown with a remove action, and checking new
   *  apps grants them additional access without re-sending an invite (the
   *  backend's existing-user immediate-grant path in POST /invitations
   *  already covers this, see handleSubmit). */
  mode?: 'invite' | 'manage-access'
  existingUser?: TeamUser
}

/** Drawer for granting a team member access — the "User Details" panel from
 *  the reference design. Every newly selected app must have a role chosen
 *  before submit; the backend (POST /invitations) decides on its own
 *  whether this becomes a pending invitation email or an immediate grant
 *  (existingUser case in api/invitations/handler.go), so this form only
 *  ever calls useCreateInvitation regardless of which happens. */
export function UserFormDrawer({ open, onClose, mode = 'invite', existingUser }: UserFormDrawerProps) {
  const { data: apps } = useApps()
  const createMutation = useCreateInvitation()
  const revokeAppAccessMutation = useRevokeUserAppAccess()
  const grantSuperAdminMutation = useGrantSuperAdmin()
  const revokeSuperAdminMutation = useRevokeSuperAdmin()
  const updateAppRoleMutation = useUpdateUserAppRole()
  const updateProfileMutation = useUpdateUserProfile()

  const existingAppIds = new Set((existingUser?.memberships ?? []).map((m) => m.app_id))

  const [firstName, setFirstName] = useState(existingUser?.first_name ?? '')
  const [lastName, setLastName] = useState(existingUser?.last_name ?? '')
  const [email, setEmail] = useState('')
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([])
  const [roleByApp, setRoleByApp] = useState<Record<string, string>>({})
  const [roleEditByApp, setRoleEditByApp] = useState<Record<string, string>>({})
  const [grantingSuperAdmin, setGrantingSuperAdmin] = useState(existingUser?.is_super_admin ?? false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const isManageAccess = mode === 'manage-access' && !!existingUser
  const superAdminChanged = isManageAccess && grantingSuperAdmin !== (existingUser?.is_super_admin ?? false)
  const nameChanged = isManageAccess
    && (firstName.trim() !== (existingUser?.first_name ?? '') || lastName.trim() !== (existingUser?.last_name ?? ''))

  const reset = () => {
    setFirstName(existingUser?.first_name ?? '')
    setLastName(existingUser?.last_name ?? '')
    setEmail('')
    setSelectedAppIds([])
    setRoleByApp({})
    setRoleEditByApp({})
    setGrantingSuperAdmin(existingUser?.is_super_admin ?? false)
    setError(null)
    setResult(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  // "Selectable" apps for the checkbox tree — in manage-access mode, apps
  // the user already has a grant for are shown separately (existing grants
  // list below) rather than re-offered here, so this list is only the apps
  // they could newly be granted.
  const selectableApps = (apps ?? []).filter((a) => !isManageAccess || !existingAppIds.has(a.id))

  const toggleApp = (appId: string, checked: boolean) => {
    setSelectedAppIds((prev) => (checked ? [...prev, appId] : prev.filter((id) => id !== appId)))
  }

  const toggleAllApps = (checked: boolean) => {
    setSelectedAppIds(checked ? selectableApps.map((a) => a.id) : [])
  }

  const allSelected = !!selectableApps.length && selectedAppIds.length === selectableApps.length
  const someSelected = selectedAppIds.length > 0 && !allSelected

  const handleSubmit = async () => {
    setError(null)

    if (isManageAccess && existingUser) {
      // Manage-access mode commits every pending change together: name
      // edits, the Super Admin toggle, any in-place role reassignments on
      // existing memberships, and any newly selected app+role grants — Save
      // should mean "apply everything shown in this drawer," not just one.
      if (nameChanged && (!firstName.trim() || !lastName.trim())) {
        setError('First and last name are required.')
        return
      }
      if (!grantingSuperAdmin) {
        const missingRole = selectedAppIds.find((id) => !roleByApp[id])
        if (missingRole) {
          setError('Choose a role for every selected app.')
          return
        }
      }
      try {
        if (nameChanged) {
          await updateProfileMutation.mutateAsync({ userId: existingUser.id, firstName: firstName.trim(), lastName: lastName.trim() })
        }
        if (superAdminChanged) {
          if (grantingSuperAdmin) await grantSuperAdminMutation.mutateAsync(existingUser.id)
          else await revokeSuperAdminMutation.mutateAsync(existingUser.id)
        }
        const roleEdits = Object.entries(roleEditByApp).filter(
          ([appId, roleId]) => roleId && roleId !== existingUser.memberships.find((m) => m.app_id === appId)?.role_id,
        )
        for (const [appId, roleId] of roleEdits) {
          await updateAppRoleMutation.mutateAsync({ userId: existingUser.id, appId, roleId })
        }
        if (!grantingSuperAdmin && selectedAppIds.length > 0) {
          const grants: InvitationGrant[] = selectedAppIds.map((appId) => ({ app_id: appId, role_id: roleByApp[appId] }))
          await createMutation.mutateAsync({ email: existingUser.email, grants })
        }
        setResult('Access updated.')
      } catch {
        setError('Could not update access.')
      }
      return
    }

    if (!email.trim()) {
      setError('Email is required.')
      return
    }
    if (selectedAppIds.length === 0) {
      setError('Select at least one app.')
      return
    }
    const missingRole = selectedAppIds.find((id) => !roleByApp[id])
    if (missingRole) {
      setError('Choose a role for every selected app.')
      return
    }
    const grants: InvitationGrant[] = selectedAppIds.map((appId) => ({ app_id: appId, role_id: roleByApp[appId] }))
    try {
      const res = await createMutation.mutateAsync({ email, grants })
      setResult(res.immediate ? 'Access granted — they can log in now.' : `Invitation sent to ${email}.`)
    } catch {
      setError('Could not send invitation.')
    }
  }

  const handleRemoveGrant = (appId: string) => {
    if (!existingUser) return
    revokeAppAccessMutation.mutate({ userId: existingUser.id, appId })
  }

  const isSaving =
    createMutation.isPending ||
    grantSuperAdminMutation.isPending ||
    revokeSuperAdminMutation.isPending ||
    updateAppRoleMutation.isPending ||
    updateProfileMutation.isPending

  return (
    <Drawer open={open} onOpenChange={(o) => !o && handleClose()}>
      <DrawerContent size="lg">
        <DrawerHeader>
          <DrawerTitle>{isManageAccess ? 'Edit User' : 'User Details'}</DrawerTitle>
          <DrawerDescription>
            {isManageAccess
              ? `Update ${existingUser?.email}'s role and access.`
              : 'Grant access to one or more applications, each with its own role.'}
          </DrawerDescription>
        </DrawerHeader>

        {result ? (
          <div className="flex-1 space-y-4 p-6">
            <p className="text-sm text-emerald-700">{result}</p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
            {!isManageAccess && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Email address *</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter user's email address." />
              </div>
            )}

            {isManageAccess && existingUser && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">First name</label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Last name</label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
                </div>
              </div>
            )}

            {isManageAccess && existingUser && (
              <div>
                <p className="mb-2 text-xs font-medium text-gray-600">Current access</p>
                {existingUser.memberships.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    {existingUser.is_super_admin ? 'Super Admin grants access to every app.' : 'No app access yet.'}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {existingUser.memberships.map((m) => (
                      <div key={m.app_id} className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-sm">
                        <span className="text-gray-800">{m.app_name}</span>
                        <div className="flex items-center gap-1">
                          <select
                            value={roleEditByApp[m.app_id] ?? m.role_id}
                            onChange={(e) => setRoleEditByApp((prev) => ({ ...prev, [m.app_id]: e.target.value }))}
                            disabled={grantingSuperAdmin}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
                          >
                            <RoleOptions appId={m.app_id} />
                          </select>
                          <Button
                            variant="ghost" size="icon" title="Remove access to this app"
                            className="text-red-500 hover:bg-red-50 hover:text-red-700"
                            disabled={revokeAppAccessMutation.isPending}
                            onClick={() => handleRemoveGrant(m.app_id)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isManageAccess && (
              <div>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-800">
                  <Checkbox checked={grantingSuperAdmin} onCheckedChange={(c) => setGrantingSuperAdmin(c === true)} />
                  Is a Super Admin?
                </label>
                <p className="mt-1 pl-6 text-xs text-gray-500">
                  Grant full administrative access, enabling management of users, roles, app creation, and marketplace templates.
                </p>
              </div>
            )}

            {!grantingSuperAdmin && (
              <div>
                <p className="mb-2 text-xs font-medium text-gray-600">
                  {isManageAccess ? 'Add access to another app' : 'Select App and Role'}
                </p>
                {selectableApps.length === 0 ? (
                  <p className="text-xs text-gray-400">Already has access to every app.</p>
                ) : (
                  <>
                    <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-800">
                      <Checkbox
                        checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                        onCheckedChange={(c) => toggleAllApps(c === true)}
                      />
                      Select All Apps
                    </label>
                    <div className="space-y-1 border-l border-gray-200 pl-3">
                      {selectableApps.map((app) => (
                        <AppRoleRow
                          key={app.id}
                          app={app}
                          checked={selectedAppIds.includes(app.id)}
                          roleId={roleByApp[app.id] ?? ''}
                          onToggle={(checked) => toggleApp(app.id, checked)}
                          onRoleChange={(roleId) => setRoleByApp((prev) => ({ ...prev, [app.id]: roleId }))}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}

        <DrawerFooter>
          {result ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                className="bg-emerald-500 text-white hover:bg-emerald-600"
                onClick={handleSubmit}
                disabled={isSaving}
              >
                {isSaving && <Spinner className="h-4 w-4" />}
                {isManageAccess ? 'Save' : 'Send Invitation'}
              </Button>
            </>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function AppRoleRow({ app, checked, roleId, onToggle, onRoleChange }: {
  app: AppSummary
  checked: boolean
  roleId: string
  onToggle: (checked: boolean) => void
  onRoleChange: (roleId: string) => void
}) {
  const { data: roles } = useRoles(app.id)

  return (
    <div className="py-1">
      <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
        <Checkbox checked={checked} onCheckedChange={(c) => onToggle(c === true)} />
        {app.name}
      </label>
      {checked && (
        <select
          value={roleId}
          onChange={(e) => onRoleChange(e.target.value)}
          className="mt-1.5 w-full max-w-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700"
        >
          <option value="">Select role…</option>
          {(roles ?? []).map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
        </select>
      )}
    </div>
  )
}

/** Bare <option> list for reassigning an EXISTING membership's role inline
 *  (used inside a <select> the parent already renders) — a separate
 *  component so useRoles(appId) is only called for apps that actually have
 *  an existing grant row, not for every selectable app up front. */
function RoleOptions({ appId }: { appId: string }) {
  const { data: roles } = useRoles(appId)
  return (
    <>
      {(roles ?? []).map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
    </>
  )
}
