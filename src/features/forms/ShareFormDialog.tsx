import { useState } from 'react'
import { Share2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  SelectMenu, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from '@/components/ui/select-menu'
import { useApps, useApplication } from '@/features/applications/hooks'
import { useShareForm } from './hooks'

interface ShareFormDialogProps {
  formId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** "Share This Form In Other Apps" — clones the form's definition into
 *  another app under the same client. */
export function ShareFormDialog({ formId, open, onOpenChange }: ShareFormDialogProps) {
  const { data: apps, isLoading: appsLoading } = useApps()
  const { data: currentApp } = useApplication()
  const shareMutation = useShareForm()
  const [targetAppId, setTargetAppId] = useState('')

  const otherApps = (apps ?? []).filter((a) => a.id !== currentApp?.id)

  const handleShare = async () => {
    if (!targetAppId) return
    await shareMutation.mutateAsync({ id: formId, targetAppId })
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setTargetAppId('')
      shareMutation.reset()
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Share2 size={16} /> Share This Form In Other Apps</DialogTitle>
          <DialogDescription>
            Creates a copy of this form's fields and layout in another app. The two forms are independent afterward — edits don't sync.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6 py-4">
          {shareMutation.isSuccess ? (
            <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-[13px] text-green-700">
              <CheckCircle2 size={14} className="shrink-0" /> Shared successfully.
            </div>
          ) : (
            <>
              <label className="text-[12px] font-medium text-slate-600">Target app</label>
              <SelectMenu value={targetAppId} onValueChange={setTargetAppId}>
                <SelectTrigger>
                  <SelectValue placeholder={appsLoading ? 'Loading apps…' : 'Select an app'} />
                </SelectTrigger>
                <SelectContent>
                  {otherApps.map((app) => (
                    <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>
                  ))}
                  {!appsLoading && otherApps.length === 0 && (
                    <div className="px-3 py-2 text-[12px] text-slate-400">No other apps available</div>
                  )}
                </SelectContent>
              </SelectMenu>

              {shareMutation.isError && (
                <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-700">
                  <AlertCircle size={13} className="shrink-0" />
                  {shareMutation.error instanceof Error ? shareMutation.error.message : 'Failed to share form'}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          {shareMutation.isSuccess ? (
            <Button size="sm" onClick={() => handleOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
              <Button size="sm" onClick={handleShare} disabled={!targetAppId || shareMutation.isPending}>
                {shareMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                Share
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
