import { useState } from 'react'
import { Eye, CheckCircle2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FormRenderer } from '@/features/forms/runtime/FormRenderer'
import type { FormSchema } from './schema'

interface FormPreviewDialogProps {
  open: boolean
  onClose: () => void
  name: string
  schema: FormSchema
  /** Real form id in edit mode, undefined for a not-yet-saved new form —
   *  threaded straight to FormRenderer, which already treats this as an
   *  optional, degraded-but-supported state (see its own doc comment on
   *  FormRendererHarness's identical "no formId" dev-preview use). */
  formId?: string
}

/** Renders the actual FormRenderer/FieldRenderer stack a real end user would
 *  see and fill in — real Zod validation, real expression-driven visibility/
 *  required/read-only, real interactive controls (including a functional
 *  Line Items grid) — rather than a separately-maintained static mock.
 *  onSubmit never reaches the backend: it just confirms the values that
 *  WOULD have been sent, since this is a design-time preview, not a real
 *  submission path. (FR-C1-004, sibling fix in the same file family: this is
 *  a display-only reuse, not a destructive action, so no confirmation gate
 *  is needed the way that fix's mode-switch warning is.) */
export function FormPreviewDialog({ open, onClose, name, schema, formId }: FormPreviewDialogProps) {
  const [justSubmitted, setJustSubmitted] = useState(false)

  // Fresh local state each time the dialog reopens, so a stale "Previewed
  // submission" banner from a prior open doesn't linger into the next one.
  const handleOpenChange = (o: boolean) => {
    if (!o) {
      onClose()
      setJustSubmitted(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[85vh] w-[720px] max-w-[95vw] flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-[hsl(var(--border))] px-6 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/15">
              <Eye size={14} className="text-[hsl(var(--primary))]" />
            </div>
            Preview — {name || 'Untitled Form'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-2xl space-y-6 p-6">
            {schema.sections.length === 0 ? (
              <p className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">This form has no fields yet.</p>
            ) : (
              <>
                {justSubmitted && (
                  <div className="flex items-center gap-2 rounded-md border border-[hsl(var(--success))]/40 bg-[hsl(var(--success))]/15 p-3 text-sm text-[hsl(var(--success))]">
                    <CheckCircle2 size={16} className="shrink-0" />
                    Validation passed — this is a preview, so nothing was actually saved.
                  </div>
                )}
                <FormRenderer
                  schema={schema}
                  fields={[]}
                  formId={formId}
                  onSubmit={() => setJustSubmitted(true)}
                  submitLabel="Test submit"
                />
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
