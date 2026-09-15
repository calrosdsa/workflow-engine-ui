// Mini-form for re-enabling a record's previously-removed account access —
// lets the user edit the email and pick a role before re-provisioning (see
// useEnableRecordAccess / POST .../account/enable-access). Modeled on
// ConfirmDialog's Dialog wrapper, but needs its own body since it collects
// two fields rather than a single confirm/cancel.
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RoleSelect } from '@/features/form-builder/config/RoleSelect'
import { useTranslation } from '@/features/i18n/I18nProvider'

interface EnableAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-fills the email input — typically the record's own email field value. */
  defaultEmail?: string
  loading?: boolean
  onConfirm: (data: { email: string; role_id: string }) => void | Promise<void>
  container?: HTMLElement | null
}

export function EnableAccountDialog({ open, onOpenChange, defaultEmail, loading, onConfirm, container }: EnableAccountDialogProps) {
  const t = useTranslation()
  const [email, setEmail] = useState(defaultEmail ?? '')
  const [roleId, setRoleId] = useState<string | undefined>(undefined)

  // Re-seed the email each time the dialog opens (a different record may
  // have been selected since it last closed).
  useEffect(() => {
    if (open) setEmail(defaultEmail ?? '')
  }, [open, defaultEmail])

  const canSubmit = email.trim() !== '' && !!roleId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent container={container} className="w-full max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('enable_account_dialog.title')}</DialogTitle>
          <DialogDescription>{t('enable_account_dialog.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-6 py-4">
          <div>
            <Label className="mb-1 block text-xs font-medium text-gray-600">{t('enable_account_dialog.email_label')}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
          </div>
          <div>
            <Label className="mb-1 block text-xs font-medium text-gray-600">{t('enable_account_dialog.role_label')}</Label>
            <RoleSelect value={roleId} onChange={setRoleId} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>{t('common.cancel')}</Button>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={!canSubmit || loading}
            onClick={() => onConfirm({ email: email.trim(), role_id: roleId! })}
          >
            {loading && <Loader2 size={13} className="animate-spin" />}
            {t('enable_account_dialog.enable_button')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
