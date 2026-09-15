import { useMemo } from 'react'
import { toast } from 'sonner'
import { HTTPError } from 'ky'
import { Database, Plus, Share2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { useLinkableForms, useLinkSharedForm } from './hooks'
import type { LinkableForm, FormVisibility } from './types'

interface LinkSharedFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** What a borrowing app may do under each grant. Deliberately phrased from
 *  the BORROWER's point of view — the same three values read very
 *  differently in Share Settings, where the owner is deciding. Local to this
 *  one component, so a t()-taking factory is simpler than dynamic-key
 *  reconstruction — same shape as fnLabels(t) elsewhere in this migration. */
function grantLabels(t: ReturnType<typeof useTranslation>): Record<FormVisibility, { label: string; variant: 'default' | 'secondary'; hint: string }> {
  return {
    full_access: { label: t('forms.link_shared_dialog.grant_full_access'), variant: 'default', hint: t('forms.link_shared_dialog.grant_full_access_hint') },
    read_only:   { label: t('forms.link_shared_dialog.grant_read_only'),   variant: 'secondary', hint: t('forms.link_shared_dialog.grant_read_only_hint') },
    // Never rendered: a private form is not linkable and the server filters
    // it out of this list. Present so the map is total.
    private:     { label: t('forms.link_shared_dialog.grant_not_shared'),  variant: 'secondary', hint: t('forms.link_shared_dialog.grant_not_shared_hint') },
  }
}

/** "Shared from another app" — picks a form another app owns and has shared,
 *  and adds it to this app's own forms list.
 *
 *  This creates a LINK, not a copy: the form keeps living in its owning app,
 *  and what this app may do with it is whatever that app's sharing grant
 *  says, re-evaluated on every request. Un-sharing removes it from here with
 *  no further action, which is why nothing in this dialog promises the form
 *  will stay. */
export function LinkSharedFormDialog({ open, onOpenChange }: LinkSharedFormDialogProps) {
  const t = useTranslation()
  const { data: forms, isLoading, error } = useLinkableForms(open)
  const linkMutation = useLinkSharedForm()
  const GRANT_LABEL = grantLabels(t)

  // Grouped by owning app: "which app is this coming from" is the first
  // thing you need to know about a borrowed form, and a flat list of names
  // from three different apps reads as one undifferentiated pile.
  const byApp = useMemo(() => {
    const groups = new Map<string, { appName: string; forms: LinkableForm[] }>()
    for (const form of forms ?? []) {
      const group = groups.get(form.owner_app_id) ?? { appName: form.owner_app_name, forms: [] }
      group.forms.push(form)
      groups.set(form.owner_app_id, group)
    }
    return [...groups.values()]
  }, [forms])

  const link = (form: LinkableForm) => {
    linkMutation.mutate(form.id, {
      onSuccess: () => toast.success(t('forms.link_shared_dialog.linked_toast', { name: form.name })),
      onError: (e) => {
        // 409 is the real race this dialog can hit: the list was fetched,
        // then the owning app narrowed the grant before the click landed.
        if (e instanceof HTTPError && e.response.status === 409) {
          toast.error(t('forms.link_shared_dialog.no_longer_shared_toast', { name: form.name, owner: form.owner_app_name }))
          return
        }
        toast.error(t('forms.link_shared_dialog.link_failed_toast', { name: form.name }))
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] w-full max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle>{t('forms.link_shared_dialog.title')}</DialogTitle>
          <DialogDescription>
            {t('forms.link_shared_dialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 mt-2 flex-1 overflow-y-auto px-1">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center"><Spinner /></div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-[hsl(var(--destructive))]">
              {t('forms.link_shared_dialog.load_error')}
            </p>
          ) : byApp.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[hsl(var(--border))] px-6 py-10 text-center">
              <Share2 size={26} className="mb-3 text-[hsl(var(--muted-foreground))]/60" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {t('forms.link_shared_dialog.empty_title')}
              </p>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                {t('forms.link_shared_dialog.empty_hint')}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {byApp.map((group) => (
                <div key={group.appName}>
                  <p className="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    {group.appName}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {group.forms.map((form) => {
                      const grant = GRANT_LABEL[form.visibility]
                      return (
                        <div
                          key={form.id}
                          className="flex items-center gap-2.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5"
                        >
                          <Database size={15} className="shrink-0 text-[hsl(var(--primary))]" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-[13px] font-medium text-[hsl(var(--foreground))]">{form.name}</p>
                              <Badge variant={grant.variant} className="shrink-0">{grant.label}</Badge>
                            </div>
                            <p className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">
                              {form.description || `${form.field_count} field${form.field_count === 1 ? '' : 's'}`}
                              {' · '}{grant.hint}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            disabled={linkMutation.isPending}
                            onClick={() => link(form)}
                          >
                            <Plus size={14} />{t('forms.link_shared_dialog.add')}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
