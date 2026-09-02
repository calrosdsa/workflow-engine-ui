// Renders whatever a suspended workflow step is asking. Mounted once per app
// root, beside the Toaster, for the same reason: both are app-level overlays
// driven by a module-level call from outside the tree.
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useAskStore, abandonPendingAsk } from './ask-store'

export function UiWorkflowDialogHost() {
  const pending = useAskStore((s) => s.pending)

  // A dialog nobody can see must not leave its run parked forever.
  useEffect(() => () => abandonPendingAsk('the app closed the dialog'), [])

  if (!pending) return null
  return <AskDialog key={pending.id} />
}

function AskDialog() {
  const pending = useAskStore((s) => s.pending)!
  const { request, settle } = pending
  // Keyed on the ask's id by the parent, so a second prompt starts with its
  // own default rather than inheriting whatever was typed into the last one.
  const [value, setValue] = useState(request.defaultValue ?? '')

  const canConfirm = request.kind === 'prompt' ? value.trim().length > 0 : true

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // Escape, the X, and a click outside all land here. Dismissing is a
        // real answer — "not confirmed" — not a cancellation of the run: the
        // author decides what a dismissal means via the step's own on_cancel.
        if (!open) settle({ confirmed: false })
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{request.title}</DialogTitle>
          {request.message && <DialogDescription>{request.message}</DialogDescription>}
        </DialogHeader>

        {request.kind === 'prompt' && (
          <div className="px-6">
            <Input
              autoFocus
              value={value}
              placeholder={request.placeholder}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canConfirm) settle({ confirmed: true, value })
              }}
              className="h-9 text-sm"
            />
          </div>
        )}

        {request.kind === 'choose' && (
          <div className="flex flex-col gap-1.5 px-6">
            {(request.options ?? []).map((o) => (
              <Button
                key={o.value}
                type="button"
                variant="outline"
                className="justify-start text-[13px]"
                onClick={() => settle({ confirmed: true, value: o.value })}
              >
                {o.label}
              </Button>
            ))}
            {(request.options ?? []).length === 0 && (
              <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
                This step has no options configured.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => settle({ confirmed: false })}>
            {request.cancelLabel || 'Cancel'}
          </Button>
          {/* A choose dialog confirms by picking an option, so it gets no
              separate confirm button — one would have nothing to submit. */}
          {request.kind !== 'choose' && (
            <Button
              type="button"
              disabled={!canConfirm}
              onClick={() => settle({ confirmed: true, value: request.kind === 'prompt' ? value : undefined })}
            >
              {request.confirmLabel || 'OK'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
