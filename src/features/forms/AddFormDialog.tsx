import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { PencilRuler, Share2, Braces, ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { LinkSharedFormDialog } from './LinkSharedFormDialog'
import { ImportFormJsonDialog } from './ImportFormJsonDialog'

interface AddFormDialogProps {
  appId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Choice = 'scratch' | 'shared' | 'json'

const CHOICES: { id: Choice; icon: LucideIcon; title: string; description: string }[] = [
  {
    id: 'scratch',
    icon: PencilRuler,
    title: 'Form from scratch',
    description: 'Open the blank builder and drag fields onto the canvas.',
  },
  {
    id: 'shared',
    icon: Share2,
    title: 'Shared from another app',
    description: 'Use a form another app in this workspace has shared. It stays owned by that app.',
  },
  {
    id: 'json',
    icon: Braces,
    title: 'JSON specification',
    description: 'Paste a form definition as JSON — the shape an AI agent writes.',
  },
]

/** The "Add Form" entry point. Replaces the direct link to the blank builder
 *  that used to sit behind this button, which was the only way to create a
 *  form and left no room for the other two starting points.
 *
 *  Deliberately a chooser and not three separate buttons on the page: the
 *  three paths all end in the same place (a form in this app's tree), and
 *  the page already carries a floating action button plus a help button
 *  without room for more. */
export function AddFormDialog({ appId, open, onOpenChange }: AddFormDialogProps) {
  const navigate = useNavigate()
  const [sharedOpen, setSharedOpen] = useState(false)
  const [jsonOpen, setJsonOpen] = useState(false)

  const choose = (choice: Choice) => {
    onOpenChange(false)
    if (choice === 'scratch') {
      navigate({ to: '/applications/$appId/forms/new', params: { appId } })
      return
    }
    if (choice === 'shared') setSharedOpen(true)
    else setJsonOpen(true)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full max-w-lg">
          <DialogHeader>
            <DialogTitle>Add a form</DialogTitle>
            <DialogDescription>How would you like to start?</DialogDescription>
          </DialogHeader>

          <div className="mt-2 flex flex-col gap-2">
            {CHOICES.map(({ id, icon: Icon, title, description }) => (
              <button
                key={id}
                type="button"
                onClick={() => choose(id)}
                className="group flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 text-left transition-colors hover:border-[hsl(var(--primary))]/50 hover:bg-[hsl(var(--muted))]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                  <Icon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[hsl(var(--foreground))]">{title}</span>
                  <span className="block text-xs text-[hsl(var(--muted-foreground))]">{description}</span>
                </span>
                <ChevronRight
                  size={16}
                  className="shrink-0 text-[hsl(var(--muted-foreground))] transition-transform group-hover:translate-x-0.5"
                />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <LinkSharedFormDialog open={sharedOpen} onOpenChange={setSharedOpen} />
      <ImportFormJsonDialog appId={appId} open={jsonOpen} onOpenChange={setJsonOpen} />
    </>
  )
}
