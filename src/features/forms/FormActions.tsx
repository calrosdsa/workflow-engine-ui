import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ListTree, MoreHorizontal, Unlink } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useCopyForm, useUnlinkForm, useDeleteForm, useUnlinkSharedForm } from './hooks'
import { ShareSettingsDialog } from './ShareSettingsDialog'
import { AddDependentFormDialog } from './AddDependentFormDialog'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { getFormLinkStatus } from './form-link-status'
import type { FormDefinition } from './types'

interface FormActionsProps {
  appId: string
  form: FormDefinition
  canWrite: boolean
  compact?: boolean
}

/** The row actions shared by the tree and list presentations of the forms page. */
export function FormActions({ appId, form, canWrite, compact = false }: FormActionsProps) {
  const [shareOpen, setShareOpen] = useState(false)
  const [addDependentOpen, setAddDependentOpen] = useState(false)
  const copyMutation = useCopyForm()
  const unlinkMutation = useUnlinkForm()
  const deleteMutation = useDeleteForm()
  const unlinkSharedMutation = useUnlinkSharedForm()
  const t = useTranslation()

  if (!canWrite) return null

  // A form borrowed from another app belongs to the owner: this menu only
  // exposes actions the current app is allowed to perform on the link itself.
  const { isLinked } = getFormLinkStatus(form)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={`flex shrink-0 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] data-[state=open]:bg-[hsl(var(--muted))] ${compact ? 'h-6 w-6 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100' : 'h-7 w-7'}`}
            title={t('forms.actions.title')}
            aria-label={t('forms.actions.aria', { name: form.name })}
          >
            <MoreHorizontal size={15} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isLinked ? (
            <>
              <DropdownMenuItem asChild>
                <Link to="/applications/$appId/forms/$formId/records" params={{ appId, formId: form.id }} className="flex items-center gap-2">
                  {t('forms.actions.view_records')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive
                onClick={() => unlinkSharedMutation.mutate(form.id)}
                disabled={unlinkSharedMutation.isPending}
                className="flex items-center gap-2"
              >
                <Unlink size={13} /> {t('forms.actions.remove_from_app')}
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem onClick={() => setAddDependentOpen(true)} className="flex items-center gap-2">
                <ListTree size={13} /> {t('forms.actions.add_dependent')}
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/applications/$appId/forms/$formId" params={{ appId, formId: form.id }} className="flex items-center gap-2">
                  {t('forms.actions.edit')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/applications/$appId/forms/$formId/records" params={{ appId, formId: form.id }} className="flex items-center gap-2">
                  {t('forms.actions.view_records')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => copyMutation.mutate(form.id)} disabled={copyMutation.isPending}>
                {t('forms.actions.copy')}
              </DropdownMenuItem>
              <DropdownMenuItem
                destructive
                onClick={() => {
                  if (confirm(t('forms.actions.delete_confirm', { name: form.name }))) deleteMutation.mutate(form.id)
                }}
              >
                {t('forms.actions.delete')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShareOpen(true)}>
                {t('forms.actions.share_settings')}
              </DropdownMenuItem>
              {form.parent_form_id && (
                <DropdownMenuItem
                  onClick={() => unlinkMutation.mutate(form.id)}
                  disabled={unlinkMutation.isPending}
                >
                  {t('forms.actions.unlink_dependent')}
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {!isLinked && (
        <>
          <ShareSettingsDialog formId={form.id} open={shareOpen} onOpenChange={setShareOpen} />
          <AddDependentFormDialog defaultParentId={form.id} open={addDependentOpen} onOpenChange={setAddDependentOpen} />
        </>
      )}
    </>
  )
}
