// Compact action toolbar for the record detail view — replaces the old
// bottom footer bar of Edit/Delete/account-action Buttons. No separate
// "Edit" action here: per-field inline editing (InlineFieldEditor) replaced
// the whole-form Edit button entirely, so this toolbar only needs to hold
// the record-level destructive/account actions, collapsed into a single
// "..." overflow menu (Jira-style — a compact icon trigger, not a
// button-per-action bar) rather than duplicated per-status Buttons.
//
// Rendered inline in each host's own title row (RecordsTable.tsx's
// DrawerHeader, RuntimeRecordPage/RuntimeFormRecordPage's <h1> row) rather
// than inside RecordDetailPanel itself — sitting at the same height as the
// record title, matching the reference Jira-style layout, instead of
// occupying its own separate bordered row below the title.
import { useEffect, useState } from 'react'
import { MoreHorizontal, Trash2, RotateCw, XCircle, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EnableAccountDialog } from './EnableAccountDialog'
import { PermissionGate } from '@/features/auth/PermissionGate'
import { usePermission } from '@/features/auth/permissions'
import { useDeleteRecord } from '@/features/forms/hooks'
import {
  useRecordAccountStatus, useResendRecordInvite, useRemoveRecordAccess, useEnableRecordAccess,
} from './record-detail-hooks'
import { useCurrentViewer, isTabVisible } from './detail-tabs/useTabVisible'
import { useExpressionRuntimeState, schemaToVariableDecls } from './expression-context'
import { getCustomAction } from './custom-actions/registry'
import './custom-actions'
import type { CreateUserSettings, FormSchema } from '@/features/form-builder/schema'
import type { FormRecord } from '@/features/forms/types'

interface RecordDetailToolbarProps {
  formId: string
  recordId: string
  record: FormRecord | undefined
  createUserSettings: CreateUserSettings | undefined
  /** FR-D2-017's customActions live on FormSettings, and a custom action's
   *  visibility/renderIf gates and update_field's own field-eligibility
   *  check all need the form's real schema — absent (every form that has
   *  never opened the "Custom Actions" panel) resolves to an empty action
   *  list, zero behavior change from today. */
  schema?: FormSchema
  /** Called after a successful delete so the caller can close the drawer /
   *  navigate back to the list — this toolbar has no navigation context. */
  onDeleted?: () => void
}

export function RecordDetailToolbar({ formId, recordId, record, createUserSettings, schema, onDeleted }: RecordDetailToolbarProps) {
  const t = useTranslation()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmingRemoveAccess, setConfirmingRemoveAccess] = useState(false)
  const [enablingAccount, setEnablingAccount] = useState(false)
  const accountEnabled = !!createUserSettings?.enabled

  const canEdit = usePermission(`forms:${formId}:edit`)
  const canDelete = usePermission(`forms:${formId}:delete`)

  const deleteRecord = useDeleteRecord(formId)
  const { data: accountStatus } = useRecordAccountStatus(formId, recordId, accountEnabled)
  const resendInvite = useResendRecordInvite(formId, recordId)
  const removeAccess = useRemoveRecordAccess(formId, recordId)
  const enableAccess = useEnableRecordAccess(formId, recordId)

  // Custom actions (FR-D2-017) — resolved the exact same way DetailTabList
  // resolves its own tab list: a static TabVisibilityConfig gate (client-
  // side, against the already-loaded session) composed with an expression
  // renderIf gate (a debounced /expressions/validate round-trip), fails
  // closed (hidden) until a real resolved `true` comes back rather than
  // flashing visible during the 250ms debounce window — identical reasoning
  // to DetailTabList's own renderIfResolved comment.
  const viewer = useCurrentViewer()
  const configuredActions = (schema?.settings?.customActions ?? []).filter((a) => isTabVisible(a.visibility, viewer))
  const variables = schema ? schemaToVariableDecls(schema) : []
  const actionRenderIfExpressions = configuredActions
    .filter((a) => a.renderIf?.mode === 'expression' && !!a.renderIf.expressionWhen)
    .map((a) => ({ key: a.id, kind: 'visibleWhen' as const, expr: a.renderIf!.expressionWhen }))
  const actionRenderIfResolved = useExpressionRuntimeState(actionRenderIfExpressions, variables, record ?? {})
  const visibleActions = configuredActions.filter((a) => {
    if (a.renderIf?.mode !== 'expression' || !a.renderIf.expressionWhen) return true
    return actionRenderIfResolved[a.id]?.visible ?? false
  })

  // Same reasoning as RecordDetailPanel's original effect (see its own doc
  // comment, unchanged): deleteRecord.mutate() alone doesn't give a
  // reliable completion signal, since formsApi.deleteRecord's underlying
  // ky response is fire-and-forget from the mutation's own perspective.
  useEffect(() => {
    if (deleteRecord.isSuccess) {
      toast.success('Record deleted')
      onDeleted?.()
      setConfirmingDelete(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteRecord.isSuccess])

  useEffect(() => {
    if (deleteRecord.isError) {
      toast.error('Delete failed', {
        description: deleteRecord.error instanceof Error ? deleteRecord.error.message : undefined,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteRecord.isError])

  const handleDelete = () => {
    if (deleteRecord.isPending) return
    deleteRecord.mutate(recordId)
  }

  const hasAccountAction = accountEnabled && canEdit && !!accountStatus?.status
  const hasCustomActions = visibleActions.length > 0
  const hasAnyAction = hasCustomActions || hasAccountAction || canDelete
  if (!hasAnyAction) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t('runtime.record_detail.more_actions')}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
        >
          <MoreHorizontal size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" container={document.getElementById('runtime-root')}>
          {hasCustomActions && record && (
            <>
              {visibleActions.map((action) => {
                const def = getCustomAction(action.type)
                if (!def) return null
                const config = def.parseConfig(action.config)
                return (
                  <def.MenuItem
                    key={action.id}
                    formId={formId}
                    recordId={recordId}
                    record={record}
                    schema={schema}
                    config={config}
                    label={action.label}
                  />
                )
              })}
            </>
          )}
          {hasCustomActions && (hasAccountAction || canDelete) && <DropdownMenuSeparator />}
          {hasAccountAction && (
            <PermissionGate need={`forms:${formId}:edit`}>
              {accountStatus?.status === 'pending' && (
                <DropdownMenuItem
                  disabled={resendInvite.isPending}
                  onClick={() => {
                    resendInvite.mutate(undefined, {
                      onSuccess: () => toast.success('Invite resent'),
                      onError: (e) => toast.error('Failed to resend invite', { description: e instanceof Error ? e.message : undefined }),
                    })
                  }}
                >
                  <RotateCw size={13} />Resend Invite
                </DropdownMenuItem>
              )}
              {accountStatus?.status === 'active' && (
                <DropdownMenuItem destructive onClick={() => setConfirmingRemoveAccess(true)}>
                  <XCircle size={13} />Remove Login Access
                </DropdownMenuItem>
              )}
              {accountStatus?.status === 'removed' && (
                <DropdownMenuItem onClick={() => setEnablingAccount(true)}>
                  <UserPlus size={13} />Enable Account
                </DropdownMenuItem>
              )}
            </PermissionGate>
          )}
          {hasAccountAction && canDelete && <DropdownMenuSeparator />}
          <PermissionGate need={`forms:${formId}:delete`}>
            <DropdownMenuItem destructive onClick={() => setConfirmingDelete(true)}>
              <Trash2 size={13} />Delete
            </DropdownMenuItem>
          </PermissionGate>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete this record?"
        description="This action can't be undone."
        confirmLabel="Delete"
        destructive
        loading={deleteRecord.isPending}
        onConfirm={handleDelete}
        container={document.getElementById('runtime-root')}
      />

      <ConfirmDialog
        open={confirmingRemoveAccess}
        onOpenChange={setConfirmingRemoveAccess}
        title="Remove login access?"
        description="This person will no longer be able to log in. You can re-enable access later."
        confirmLabel="Remove Access"
        destructive
        loading={removeAccess.isPending}
        onConfirm={async () => {
          try {
            await removeAccess.mutateAsync()
            toast.success('Login access removed')
            setConfirmingRemoveAccess(false)
          } catch (e) {
            toast.error('Failed to remove access', { description: e instanceof Error ? e.message : undefined })
          }
        }}
        container={document.getElementById('runtime-root')}
      />

      <EnableAccountDialog
        open={enablingAccount}
        onOpenChange={setEnablingAccount}
        defaultEmail={createUserSettings?.emailFieldKey ? (record?.[createUserSettings.emailFieldKey] as string | undefined) : undefined}
        loading={enableAccess.isPending}
        onConfirm={async (data) => {
          try {
            await enableAccess.mutateAsync(data)
            toast.success('Account enabled')
            setEnablingAccount(false)
          } catch (e) {
            toast.error('Failed to enable account', { description: e instanceof Error ? e.message : undefined })
          }
        }}
        container={document.getElementById('runtime-root')}
      />
    </>
  )
}
