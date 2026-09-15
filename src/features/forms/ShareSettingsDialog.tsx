import { useState } from 'react'
import { toast } from 'sonner'
import { HTTPError } from 'ky'
import { Share2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { useSharing, useSharingUsage, useSetSharing } from './hooks'
import type { FormVisibility, FormAppUsage } from './types'

interface ShareSettingsDialogProps {
  formId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Local to this one component — see LinkSharedFormDialog's grantLabels(t)
// for the same t()-taking-factory shape applied to a sibling dialog.
function visibilityOptions(t: ReturnType<typeof useTranslation>): { value: FormVisibility; label: string; description: string }[] {
  return [
    { value: 'full_access', label: t('forms.share_settings_dialog.option_full_access'), description: t('forms.share_settings_dialog.option_full_access_hint') },
    { value: 'read_only', label: t('forms.share_settings_dialog.option_read_only'), description: t('forms.share_settings_dialog.option_read_only_hint') },
    { value: 'private', label: t('forms.share_settings_dialog.option_private'), description: t('forms.share_settings_dialog.option_private_hint') },
  ]
}

const RANK: Record<FormVisibility, number> = { private: 0, read_only: 1, full_access: 2 }

/** "Share Settings" — FR-C1-013's live, revocable 3-state cross-app grant,
 *  replacing the old "Share This Form In Other Apps" one-time clone. A
 *  dialog (not a page section, unlike Knowledge Bases' equivalent) per the
 *  requester's own direction — this is a row-menu action, not something
 *  that needed its own permanent home on a page that doesn't otherwise
 *  exist for a form. */
export function ShareSettingsDialog({ formId, open, onOpenChange }: ShareSettingsDialogProps) {
  const t = useTranslation()
  const { data: sharing, isLoading } = useSharing(formId, open)
  const usageMutation = useSharingUsage(formId)
  const setSharingMutation = useSetSharing(formId)
  const [pendingUsage, setPendingUsage] = useState<{ target: FormVisibility; apps: FormAppUsage[] } | null>(null)

  const applyVisibility = (visibility: FormVisibility) => {
    setSharingMutation.mutate(visibility, {
      onError: (e) => {
        // 409 in_use is the normal outcome of a real (rare) race: the usage
        // check ran clean, but another app started referencing this form
        // before this save landed. Every other failure is a genuine error.
        if (e instanceof HTTPError && e.response.status === 409) {
          toast.error(t('forms.share_settings_dialog.in_use_toast'))
          return
        }
        toast.error(t('forms.share_settings_dialog.update_failed_toast'))
      },
    })
  }

  const requestChange = (visibility: FormVisibility) => {
    if (!sharing || visibility === sharing.visibility) return
    // Only a NARROWING change needs a usage check — widening access never
    // removes anything another app already has.
    if (RANK[visibility] >= RANK[sharing.visibility]) {
      applyVisibility(visibility)
      return
    }
    usageMutation.mutate(undefined, {
      onSuccess: (usage) => {
        const apps = usage.apps ?? []
        if (apps.length === 0) {
          applyVisibility(visibility)
        } else {
          setPendingUsage({ target: visibility, apps })
        }
      },
      onError: () => {
        toast.error(t('forms.share_settings_dialog.verify_failed_toast'))
      },
    })
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPendingUsage(null)
      usageMutation.reset()
      setSharingMutation.reset()
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Share2 size={16} /> {t('forms.share_settings_dialog.title')}</DialogTitle>
          <DialogDescription>
            {t('forms.share_settings_dialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4">
          {isLoading || !sharing ? (
            <div className="flex h-24 items-center justify-center"><Spinner /></div>
          ) : (
            <RadioGroup
              value={sharing.visibility}
              onValueChange={(v) => requestChange(v as FormVisibility)}
              className="flex flex-col gap-2"
            >
              {visibilityOptions(t).map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-[hsl(var(--border))] p-3"
                >
                  <RadioGroupItem
                    value={opt.value}
                    disabled={usageMutation.isPending || setSharingMutation.isPending}
                    className="mt-0.5"
                  />
                  <span className="text-sm">
                    <span className="block font-medium text-[hsl(var(--foreground))]">{opt.label}</span>
                    <span className="block text-[11px] text-[hsl(var(--muted-foreground))]">{opt.description}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          )}
          {(usageMutation.isPending || setSharingMutation.isPending) && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
              <Spinner className="h-3 w-3" /> {t('forms.share_settings_dialog.updating')}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button size="sm" variant="outline" onClick={() => handleOpenChange(false)}>{t('common.close')}</Button>
        </DialogFooter>
      </DialogContent>

      <ConfirmDialog
        open={!!pendingUsage}
        onOpenChange={(o) => { if (!o) setPendingUsage(null) }}
        title={t('forms.share_settings_dialog.in_use_title')}
        description={pendingUsage ? describeUsage(pendingUsage.apps, t) : undefined}
        confirmLabel={t('forms.share_settings_dialog.change_anyway')}
        destructive
        loading={setSharingMutation.isPending}
        onConfirm={() => {
          if (pendingUsage) applyVisibility(pendingUsage.target)
          setPendingUsage(null)
        }}
      />
    </Dialog>
  )
}

function describeUsage(apps: FormAppUsage[], t: ReturnType<typeof useTranslation>): string {
  const parts = apps.map((a) =>
    t(a.workflows.length === 1 ? 'forms.share_settings_dialog.usage_line_one' : 'forms.share_settings_dialog.usage_line_many', {
      app: a.app_name, count: a.workflows.length, list: a.workflows.join(', '),
    }),
  )
  return t('forms.share_settings_dialog.usage_prefix', { apps: parts.join('; ') })
}
