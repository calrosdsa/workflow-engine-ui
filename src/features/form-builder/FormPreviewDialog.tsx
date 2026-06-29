import { Eye } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ElementPreview } from './ElementPreview'
import { COLUMN_LAYOUTS, type FormSchema } from './schema'

interface FormPreviewDialogProps {
  open: boolean
  onClose: () => void
  name: string
  schema: FormSchema
}

/** Renders the whole form as an end user would see it (read-only preview). */
export function FormPreviewDialog({ open, onClose, name, schema }: FormPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex h-[85vh] w-[720px] max-w-[95vw] flex-col overflow-hidden p-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100">
              <Eye size={14} className="text-indigo-600" />
            </div>
            Preview — {name || 'Untitled Form'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-2xl space-y-6 p-6">
            {schema.sections.length === 0 && (
              <p className="py-12 text-center text-sm text-slate-400">This form has no fields yet.</p>
            )}
            {schema.sections.map((section) => (
              <div key={section.id} className="space-y-3">
                <div className="border-b border-slate-200 pb-1.5">
                  <h3 className="text-[15px] font-semibold text-slate-800">{section.title}</h3>
                  {section.description && <p className="mt-0.5 text-[12px] text-slate-400">{section.description}</p>}
                </div>
                <div className="flex gap-4">
                  {section.columns.map((col, ci) => (
                    <div key={col.id} style={{ flex: COLUMN_LAYOUTS[section.layout].ratios[ci] ?? 1 }} className="min-w-0 space-y-4">
                      {col.elements
                        .filter((el) => el.behavior.visibility !== 'hidden')
                        .map((el) => <ElementPreview key={el.id} element={el} />)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
