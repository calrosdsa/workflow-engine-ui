import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
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
import { useTranslation } from '@/features/i18n/I18nProvider'
import { MfaResetSection } from './MfaResetSection'

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
  const t = useTranslation()
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
        setError(t('team.name_required'))
        return
      }
      if (!grantingSuperAdmin) {
        const missingRole = selectedAppIds.find((id) => !roleByApp[id])
        if (missingRole) {
          setError(t('team.role_required'))
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
        setResult(t('team.access_updated'))
      } catch {
        setError(t('team.access_update_failed'))
      }
      return
    }

    if (!email.trim()) {
      setError(t('team.email_required'))
      return
    }
    if (selectedAppIds.length === 0) {
      setError(t('team.select_app_required'))
      return
    }
    const missingRole = selectedAppIds.find((id) => !roleByApp[id])
    if (missingRole) {
      setError(t('team.role_required'))
      return
    }
    const grants: InvitationGrant[] = selectedAppIds.map((appId) => ({ app_id: appId, role_id: roleByApp[appId] }))
    try {
      const res = await createMutation.mutateAsync({ email, grants })
      setResult(res.immediate ? t('team.access_granted') : t('team.invitation_sent', { email }))
    } catch {
      setError(t('team.invitation_failed'))
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
          <DrawerTitle>{isManageAccess ? t('team.edit_user_title') : t('team.user_details')}</DrawerTitle>
          <DrawerDescription>
            {isManageAccess
              ? t('team.update_access_description', { email: existingUser?.email ?? '' })
              : t('team.grant_access_description')}
          </DrawerDescription>
        </DrawerHeader>

        {result ? (
          <div className="flex-1 space-y-4 p-6">
            <p className="text-sm text-[hsl(var(--success))]">{result}</p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
            {!isManageAccess && (
              <div>
                <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('team.email_address')}</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('team.email_placeholder')} />
              </div>
            )}

            {isManageAccess && existingUser && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('team.first_name')}</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t('team.first_name')} />
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('team.last_name')}</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t('team.last_name')} />
                </div>
              </div>
            )}

            {isManageAccess && existingUser && (
              <div>
                <p className="mb-2 text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('team.current_access')}</p>
                {existingUser.memberships.length === 0 ? (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {existingUser.is_super_admin ? t('team.super_admin_every_app') : t('team.no_app_access')}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {existingUser.memberships.map((m) => (
                      <div key={m.app_id} className="flex items-center justify-between gap-2 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm">
                        <span className="text-[hsl(var(--foreground))]">{m.app_name}</span>
                        <div className="flex items-center gap-1">
                          <RoleSelect
                            appId={m.app_id}
                            value={roleEditByApp[m.app_id] ?? m.role_id}
                            onChange={(roleId) => setRoleEditByApp((prev) => ({ ...prev, [m.app_id]: roleId }))}
                            disabled={grantingSuperAdmin}
                          />
                          <Button
                            variant="ghost" size="icon" title={t('team.remove_app_access')}
                            className="text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))]"
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
                <Label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))]">
                  <Checkbox checked={grantingSuperAdmin} onCheckedChange={(c) => setGrantingSuperAdmin(c === true)} />
                  {t('team.super_admin')}
                </Label>
                <p className="mt-1 pl-6 text-xs text-[hsl(var(--muted-foreground))]">
                  {t('team.super_admin_description')}
                </p>
              </div>
            )}

            {/* Not part of Save: resetting takes effect immediately, behind its own confirmation. */}
            {isManageAccess && existingUser && <MfaResetSection user={existingUser} />}

            {!grantingSuperAdmin && (
              <div>
                <p className="mb-2 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  {isManageAccess ? t('team.add_access_another_app') : t('team.select_app_role')}
                </p>
                {selectableApps.length === 0 ? (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('team.already_all_apps')}</p>
                ) : (
                  <>
                    <Label className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))]">
                      <Checkbox
                        checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                        onCheckedChange={(c) => toggleAllApps(c === true)}
                      />
                      {t('team.all_apps_select')}
                    </Label>
                    <div className="space-y-1 border-l border-[hsl(var(--border))] pl-3">
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

            {error && <p className="text-xs text-[hsl(var(--destructive))]">{error}</p>}
          </div>
        )}

        <DrawerFooter>
          {result ? (
            <Button onClick={handleClose}>{t('team.done')}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>{t('team.cancel')}</Button>
              <Button
                onClick={handleSubmit}
                disabled={isSaving}
              >
                {isSaving && <Spinner className="h-4 w-4" />}
                {isManageAccess ? t('team.save') : t('team.send_invitation')}
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
  const t = useTranslation()
  const { data: roles } = useRoles(app.id)

  return (
    <div className="py-1">
      <Label className="flex cursor-pointer items-center gap-2 text-sm font-normal text-[hsl(var(--foreground))]">
        <Checkbox checked={checked} onCheckedChange={(c) => onToggle(c === true)} />
        {app.name}
      </Label>
      {checked && (
        <SelectMenu value={roleId || '__none__'} onValueChange={(v) => onRoleChange(v === '__none__' ? '' : v)}>
          <SelectTrigger className="mt-1.5 h-8 w-full max-w-xs text-sm"><SelectValue placeholder={t('team.select_role')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__" className="text-xs">{t('team.select_role')}</SelectItem>
            {(roles ?? []).map((role) => <SelectItem key={role.id} value={role.id} className="text-xs">{role.name}</SelectItem>)}
          </SelectContent>
        </SelectMenu>
      )}
    </div>
  )
}

/** Role reassignment dropdown for an EXISTING membership row — same
 *  SelectMenu-per-appId shape as AppRoleRow's own role picker above, kept as
 *  a separate component so useRoles(appId) is only called for apps that
 *  actually have an existing grant row, not for every selectable app up
 *  front. */
function RoleSelect({ appId, value, onChange, disabled }: {
  appId: string
  value: string
  onChange: (roleId: string) => void
  disabled?: boolean
}) {
  const { data: roles } = useRoles(appId)
  return (
    <SelectMenu value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        {(roles ?? []).map((role) => <SelectItem key={role.id} value={role.id} className="text-xs">{role.name}</SelectItem>)}
      </SelectContent>
    </SelectMenu>
  )
}
