import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Plus, Database, HelpCircle } from 'lucide-react'
import { useForms } from '@/features/forms/hooks'
import { useApplication } from '@/features/applications/hooks'
import { usePermission } from '@/features/auth/permissions'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { FormTree } from '@/features/forms/FormTree'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'

export function FormsPage() {
  const { data: forms, isLoading } = useForms()
  const { data: app } = useApplication()
  const canWrite = usePermission('forms:write')
  const [helpOpen, setHelpOpen] = useState(false)

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  return (
    <div className="relative flex h-full flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Form Builder</h1>
          <p className="text-sm text-gray-500 mt-1">{forms?.length ?? 0} forms</p>
        </div>
      </div>

      {!forms?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <Database size={32} className="text-gray-300 mb-3" />
          <p className="text-gray-500 mb-4">No forms yet. Create one to auto-generate a Postgres table.</p>
          {canWrite && (
            <Link to="/forms/new">
              <Button variant="outline"><Plus size={16} />Create your first form</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <FormTree appName={app?.name ?? 'App'} forms={forms} canWrite={canWrite} />
        </div>
      )}

      <div className="absolute bottom-6 right-6 flex flex-col items-end gap-2">
        {canWrite && (
          <Link to="/forms/new">
            <Button className="rounded-full shadow-md"><Plus size={16} />Add Form</Button>
          </Link>
        )}
        <Button variant="outline" className="rounded-full bg-white shadow-md" onClick={() => setHelpOpen(true)}>
          <HelpCircle size={16} />What is a Form?
        </Button>
      </div>

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
