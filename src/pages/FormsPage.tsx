import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { Plus, Database, HelpCircle, LayoutList, ListTree } from 'lucide-react'
import { useForms } from '@/features/forms/hooks'
import { AddFormDialog } from '@/features/forms/AddFormDialog'
import { useApplication } from '@/features/applications/hooks'
import { usePermission } from '@/features/auth/permissions'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { FormTree } from '@/features/forms/FormTree'
import { FormList } from '@/features/forms/FormList'
import { useTranslation } from '@/features/i18n/I18nProvider'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'

export function FormsPage() {
  const t = useTranslation()
  const { data: forms, isLoading } = useForms()
  const { data: app } = useApplication()
  const canWrite = usePermission('forms:write')
  const [helpOpen, setHelpOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [view, setView] = useState<'tree' | 'list'>('list')
  const { appId } = useParams({ strict: false }) as { appId?: string }

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  return (
    <div className="relative flex h-full flex-col p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Form Builder</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{forms?.length ?? 0} forms</p>
        </div>
        <fieldset className="flex items-center gap-2">
          <legend className="sr-only">{t('forms.view.legend')}</legend>
          <span aria-hidden="true" className="text-xs text-[hsl(var(--muted-foreground))]">{t('forms.view.label')}</span>
          <div className="inline-flex rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={`h-7 px-2.5 ${view === 'tree' ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]' : ''}`}
              aria-pressed={view === 'tree'}
              onClick={() => setView('tree')}
            >
              <ListTree size={14} />{t('forms.view.tree')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={`h-7 px-2.5 ${view === 'list' ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]' : ''}`}
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              <LayoutList size={14} />{t('forms.view.list')}
            </Button>
          </div>
        </fieldset>
      </div>

      {!forms?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[hsl(var(--border))] p-12 text-center">
          <Database size={32} className="text-[hsl(var(--muted-foreground))]/60 mb-3" />
          <p className="text-[hsl(var(--muted-foreground))] mb-4">No forms yet. Create one to auto-generate a Postgres table.</p>
          {canWrite && (
            <Button variant="outline" onClick={() => setAddOpen(true)}>
              <Plus size={16} />Create your first form
            </Button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {view === 'tree' ? (
            <FormTree appId={appId ?? ''} appName={app?.name ?? 'App'} forms={forms} canWrite={canWrite} />
          ) : (
            <FormList appId={appId ?? ''} forms={forms} canWrite={canWrite} />
          )}
        </div>
      )}

      <div className="absolute bottom-6 right-6 flex flex-col items-end gap-2">
        {canWrite && (
          <Button className="rounded-full shadow-md" onClick={() => setAddOpen(true)}>
            <Plus size={16} />Add Form
          </Button>
        )}
        <Button variant="outline" className="rounded-full bg-[hsl(var(--card))] shadow-md" onClick={() => setHelpOpen(true)}>
          <HelpCircle size={16} />What is a Form?
        </Button>
      </div>

      <AddFormDialog appId={appId ?? ''} open={addOpen} onOpenChange={setAddOpen} />

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="w-full max-w-md">
          <DialogHeader>
            <DialogTitle>What is a Form?</DialogTitle>
            <DialogDescription>
              A Form defines a data table: its fields become Postgres columns, and its layout drives the
              record entry/edit screens. Forms can be nested as <strong>dependent forms</strong> under a
              parent — use the ⋯ menu on any form to add one, copy it, share it into another app, or
              detach it from its parent.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  )
}
